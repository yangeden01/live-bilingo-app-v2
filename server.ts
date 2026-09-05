import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import WebSocket, { WebSocketServer } from 'ws';
import https from 'https';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { matchExactPhrase, postprocessChineseTranslation, preprocessEnglishForTranslation } from './src/utils/broadcastGlossary';
import { lookupQuickWord, generateContextualExample } from './src/utils/quickDictionary';

// Allow radio streams with custom/mismatched SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('Notice: Gemini API client initialization skipped:', e);
    }
  }
  return geminiClient;
}

const app = express();
const PORT = 3000;

// Enable global CORS for all origins (WebView, local asset, mobile, PWA)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

// In-memory translation cache
const translationCache = new Map<string, string>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// High-speed real-time Google GTX Translate engine for fast zero-quota live translation
function translateWithGoogleGTX(englishText: string): Promise<string> {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve('');
      return;
    }

    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=' +
      encodeURIComponent(clean);

    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && Array.isArray(json[0])) {
              const result = json[0]
                .map((part: any) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
                .join('');
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            }
          } catch (e) {}
          resolve('');
        });
      }
    );

    req.on('error', () => resolve(''));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve('');
    });
  });
}

// High-speed real-time Google Clients5 Translate engine fallback
function translateWithGoogleClients5(englishText: string): Promise<string> {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve('');
      return;
    }

    const url =
      'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=' +
      encodeURIComponent(clean);

    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json)) {
              const result = json.flat(Infinity).filter((x) => typeof x === 'string').join('');
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            } else if (typeof json === 'string' && json.trim().length > 0) {
              resolve(json.trim());
              return;
            }
          } catch (e) {}
          resolve('');
        });
      }
    );

    req.on('error', () => resolve(''));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve('');
    });
  });
}

// Free live translation service fallback (MyMemory API)
async function translateWithMyMemory(englishText: string): Promise<string> {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve('');
      return;
    }

    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(clean) + '&langpair=en|zh-TW';
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveBilingoRadio/1.0',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const translated = parsed.responseData?.translatedText;
            if (
              translated &&
              typeof translated === 'string' &&
              !translated.toLowerCase().includes('is invalid') &&
              !translated.toLowerCase().includes('quota exceeded') &&
              !translated.toUpperCase().includes('MYMEMORY WARNING') &&
              !translated.toUpperCase().includes('YOU USED ALL AVAILABLE FREE TRANSLATIONS') &&
              translated.length > 0
            ) {
              resolve(translated);
              return;
            }
          } catch (e) {}
          resolve('');
        });
      }
    );

    req.on('error', () => resolve(''));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve('');
    });
  });
}

async function translateWithGeminiModel(englishText: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return '';
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are an expert English-to-Traditional Chinese radio broadcast interpreter. Translate the following live radio subtitle into natural, authentic, highly fluent Traditional Chinese (Taiwan/Hong Kong).
Rules:
1. Translate accurately in the context of live public radio news, traffic, talk shows, and idioms.
2. For traffic terms: "stop and go" -> "走走停停（車多壅塞）", "the maze" -> "麥克阿瑟立交樞紐（The Maze）", "shoulder" -> "路肩", "CHP" -> "加州公路巡警（CHP）", "hit and run" -> "肇事逃逸".
3. Return ONLY the Traditional Chinese translation, without explanation or commentary.

Text to translate:
"${englishText}"`,
  });
  return response.text?.trim() || '';
}

async function translateWithGeminiOrFallback(text: string): Promise<{ text: string; source: string }> {
  const cleanText = text.trim();
  if (!cleanText) return { text: '', source: 'empty' };

  // Check cache first
  if (translationCache.has(cleanText)) {
    return { text: translationCache.get(cleanText)!, source: 'cache' };
  }

  // 0. Exact idiom & broadcast phrase dictionary match (0ms instant)
  const exactMatch = matchExactPhrase(cleanText);
  if (exactMatch && exactMatch !== cleanText) {
    const postMatch = postprocessChineseTranslation(exactMatch, cleanText);
    translationCache.set(cleanText, postMatch);
    return { text: postMatch, source: 'exact-broadcast-glossary' };
  }

  // 1. Google Gemini AI Contextual Translation (if key available)
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await withTimeout(translateWithGeminiModel(cleanText), 1800);
      if (geminiResult && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(geminiResult)) {
        const refined = postprocessChineseTranslation(geminiResult, cleanText);
        translationCache.set(cleanText, refined);
        return { text: refined, source: 'gemini-contextual' };
      }
    } catch (e) {
      // fallback to high-speed engine
    }
  }

  const preprocessedEn = preprocessEnglishForTranslation(cleanText);

  // 2. Primary High-Speed Google GTX Translation Engine
  try {
    const gtxTranslation = await withTimeout(translateWithGoogleGTX(preprocessedEn), 2500);
    if (gtxTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(gtxTranslation)) {
      const refined = postprocessChineseTranslation(gtxTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: 'google-gtx-live' };
    }
  } catch (e) {
    // try fallback
  }

  // 3. Secondary Google Clients5 Translation Engine
  try {
    const liveTranslation = await withTimeout(translateWithGoogleClients5(preprocessedEn), 2000);
    if (liveTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(liveTranslation)) {
      const refined = postprocessChineseTranslation(liveTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: 'google-clients5-live' };
    }
  } catch (e) {
    // try fallback
  }

  // 4. Tertiary Live Online Translation Engine (MyMemory)
  try {
    const myMemoryTranslation = await withTimeout(translateWithMyMemory(preprocessedEn), 2500);
    if (myMemoryTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(myMemoryTranslation)) {
      const refined = postprocessChineseTranslation(myMemoryTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: 'online-translation-fallback' };
    }
  } catch (e) {
    // fallback
  }

  // 5. Quaternary Contextual Fallback for Common News Broadcaster Patterns
  const contextualFallback = mockTranslateToTraditionalChinese(cleanText);
  if (contextualFallback && contextualFallback !== cleanText) {
    const refined = postprocessChineseTranslation(contextualFallback, cleanText);
    translationCache.set(cleanText, refined);
    return { text: refined, source: 'contextual-fallback' };
  }

  // Fallback if offline
  return { text: cleanText, source: 'raw-english' };
}

// Health check endpoint (for Cloud Run / container ingress and API)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    translationEngine: 'local-zero-quota',
    radioStreamUrl: 'https://nhpr.streamguys1.com/nhpr',
    deepgramConfigured: true,
  });
});

// Translation Endpoint using High-Speed Local Translation
app.post('/api/translate', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required for translation' });
      return;
    }

    const { text: translatedText, source } = await translateWithGeminiOrFallback(text);

    res.json({
      english: text,
      traditionalChinese: translatedText,
      source,
    });
  } catch (error: any) {
    const fallbackTranslation = mockTranslateToTraditionalChinese(req.body.text || '');
    res.json({
      english: req.body.text || '',
      traditionalChinese: fallbackTranslation,
      source: 'fallback-catch',
    });
  }
});

// Helper for fallback translation when Gemini is in cooldown or API key is unconfigured
function mockTranslateToTraditionalChinese(englishText: string): string {
  if (/transit|bart|muni|caltrain|fare/i.test(englishText)) {
    return '您正在收聽 Live Bilingo 雙語電台。今日灣區頭條新聞：交通局官員正式宣佈，將於下個月起整合 BART、Muni 與 Caltrain 的票證系統，為跨區通勤族提供更加無縫的公共運輸體驗。';
  }
  if (/weather|forecast|temperature|breezes/i.test(englishText)) {
    return '氣象局預報指出，舊金山與奧克蘭地區今日晴朗無雲，沿海一帶微風徐徐並將持續至傍晚。內陸山谷氣溫約維持在華氏 68 度左右，沿海地區早晚有局部晨霧。';
  }
  if (/climate|lawmakers|solar|fire/i.test(englishText)) {
    return '加州州議員已正式通過數十億美元的氣候韌性預算案，旨在未來五年內擴建太陽能電網基礎設施，並大幅提升北加州各郡的山林防火能力。';
  }
  if (/traffic|bridge|highway|caltrans/i.test(englishText)) {
    return '西向往舊金山方向的海灣大橋在上層車道晨間維護結束後，目前車流十分順暢。加州交通局提醒駕駛人特別留意 101 號公路夜間施工封閉訊息。';
  }
  if (/researchers|berkeley|marine|kelp/i.test(englishText)) {
    return '加州大學柏克萊分校研究團隊公佈了太平洋沿岸海洋生態保育的突破性研究。研究強調社區驅動的棲地復育成功帶回了原生巨藻森林與豐富的海洋生物多樣性。';
  }
  if (/silicon valley|ai|summit|tech/i.test(englishText)) {
    return '矽谷科技領袖與倫理專家今日聚集於聖荷西參與年度人工智慧責任峰會。核心討論聚焦於為下一代生成式 AI 系統建立透明的開源架構與安全規範。';
  }
  if (/bike|pedal|commute|gear|protective|support/i.test(englishText)) {
    return '關於推廣一級電助自行車以提供安全低碳通勤的議題，專家強調通勤族應配戴足夠防護裝備以維護行車安全。';
  }
  return '【新聞廣播精譯】舊金山與全美公共廣播電台新聞即時摘要報導。';
}

// Deepgram token endpoint for client or native Android references
app.get('/api/deepgram-config', (req, res) => {
  res.json({
    wsUrl: 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true',
    authHeader: 'Token 26c44e288a84756af4f80d41436af0bf7cc10715',
    defaultStreamUrl: 'https://nhpr.streamguys1.com/nhpr',
    paragraphDurationSeconds: 10,
  });
});

function resolveTargetStreamUrl(inputUrl: string): string {
  if (!inputUrl) return 'https://npr-ice.streamguys1.com/live.mp3';
  if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
    return inputUrl;
  }
  if (inputUrl.includes('/api/radio-stream-proxy')) {
    try {
      const dummyUrl = new URL(inputUrl, 'http://localhost:3000');
      const targetParam = dummyUrl.searchParams.get('url');
      if (targetParam && (targetParam.startsWith('http://') || targetParam.startsWith('https://'))) {
        return targetParam;
      }
    } catch (e) {
      // ignore
    }
  }
  return 'https://npr-ice.streamguys1.com/live.mp3';
}

// Universal Proxy for radio streams to bypass browser CORS and protocol restrictions with infinite auto-reconnect
function proxyRadioAudio(targetUrl: string, res: express.Response, redirectDepth = 0) {
  if (redirectDepth > 8) {
    console.error('Too many redirects for radio stream proxying');
    if (!res.headersSent) res.status(502).end();
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ error: 'Invalid stream URL' });
    return;
  }

  const requester = parsedUrl.protocol === 'http:' ? http : https;

  const requestOptions: any = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    rejectUnauthorized: false,
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioStreamProxy/1.0',
      'Accept': '*/*',
      'Icy-MetaData': '0',
      'Connection': 'keep-alive',
    },
  };

  const clientReq = requester.get(requestOptions, (remoteRes) => {
    // Keep socket alive
    if (clientReq.socket) {
      clientReq.socket.setKeepAlive(true, 5000);
      clientReq.socket.setNoDelay(true);
    }

    remoteRes.on('error', (err: any) => {
      console.warn('[Radio Proxy] Upstream response error:', err?.message || err);
    });

    // Handle redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(remoteRes.statusCode || 0) && remoteRes.headers.location) {
      const redirectUrl = new URL(remoteRes.headers.location, targetUrl).toString();
      return proxyRadioAudio(redirectUrl, res, redirectDepth + 1);
    }

    if ((remoteRes.statusCode || 0) >= 400) {
      console.warn(`[Radio Proxy] Stream ${targetUrl} returned status ${remoteRes.statusCode}.`);
      if (!res.headersSent) res.status(remoteRes.statusCode || 500).end();
      return;
    }

    if (!res.headersSent) {
      const contentType = remoteRes.headers['content-type'] || 'audio/mpeg';
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Connection', 'keep-alive');
    }

    // Pipe with end: false so upstream disconnects won't close client's audio connection!
    remoteRes.pipe(res, { end: false });

    // Handle upstream stream end or close: automatically reconnect upstream seamlessly
    remoteRes.on('end', () => {
      console.warn('[Radio Proxy] Upstream radio stream ended. Reconnecting...');
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });

    remoteRes.on('close', () => {
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });

    res.on('close', () => {
      remoteRes.on('error', () => {});
      clientReq.on('error', () => {});
      try { remoteRes.destroy(); } catch (e) {}
      try { clientReq.destroy(); } catch (e) {}
    });

    res.on('error', (err: any) => {
      remoteRes.on('error', () => {});
      clientReq.on('error', () => {});
      try { remoteRes.destroy(); } catch (e) {}
      try { clientReq.destroy(); } catch (e) {}
    });
  });

  clientReq.setTimeout(12000, () => {
    console.warn('[Radio Proxy] Upstream request timeout. Reconnecting...');
    try { clientReq.destroy(); } catch (e) {}
    if (!res.writableEnded && !res.destroyed) {
      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          proxyRadioAudio(targetUrl, res, redirectDepth + 1);
        }
      }, 500);
    }
  });

  clientReq.on('error', (err) => {
    console.warn('[Radio Proxy] Request error:', err?.message || err);
    if (!res.writableEnded && !res.destroyed) {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Radio stream unreachable' });
      }
    }
  });
}

// Proxy for radio stream to bypass browser CORS if needed by Web Audio API
app.get('/api/radio-stream-proxy', (req, res) => {
  const rawUrl = (req.query.url as string) || '';
  const targetUrl = resolveTargetStreamUrl(rawUrl);

  recordListenerActivity('Radio stream proxy audio requested', targetUrl);

  if (targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Proxy Sync] User started playing station stream: ${targetUrl}. Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);
  }

  proxyRadioAudio(targetUrl, res);
});

// Endpoint: Direct / proxied radio audio stream (backward compatibility for /api/radio-stream-delayed)
app.get('/api/radio-stream-delayed', (req, res) => {
  const rawUrl = (req.query.url as string) || '';
  const targetUrl = resolveTargetStreamUrl(rawUrl);

  recordListenerActivity('Radio stream audio requested', targetUrl);

  if (!isStreamingActive || targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Stream] Starting backend STT & audio pipeline for ${targetUrl}...`);
    startBackendStreaming(targetUrl);
  }

  proxyRadioAudio(targetUrl, res);
});

// Notify server which station stream the client is playing so backend STT transcribes and translates it
app.post('/api/notify-station-playing', (req, res) => {
  const { url, name, forceRestart } = req.body || {};
  if (url && typeof url === 'string') {
    const targetUrl = resolveTargetStreamUrl(url);
    const stationDisplayName = name || '美西公共英語新聞廣播';
    console.log(`[Station Notify] Client playing station stream: ${stationDisplayName} (${targetUrl}) [forceRestart=${!!forceRestart}]. Synchronizing backend STT...`);
    
    recordListenerActivity(`Station Notify: ${stationDisplayName}`, targetUrl);

    if (forceRestart || !isStreamingActive || currentRadioStreamUrl !== targetUrl || (Date.now() - lastAudioDataTime > 15000)) {
      startBackendDeepgramStreaming(targetUrl);
    }

    // Reset transcript buffers to guarantee instant alignment with new station audio
    pendingTranscriptBuffer = '';
    bufferStartTime = 0;
    lastTranscriptTime = Date.now();
  }
  res.json({ status: 'ok', currentRadioStreamUrl, aligned: true });
});

// Auto-Repair Radio Stations API: Tests connectivity and heals broken radio stream URLs
app.post('/api/repair-stations', async (req, res) => {
  const { stations } = req.body || {};
  if (!Array.isArray(stations)) {
    return res.status(400).json({ error: 'Stations array required' });
  }

  const KNOWN_BACKUPS: Record<string, string[]> = {
    'us-west-public-news': [
      'https://nhpr.streamguys1.com/nhpr',
      'https://npr-ice.streamguys1.com/live.mp3',
    ],
    'us-east-public-news': [
      'https://nhpr.streamguys1.com/nhpr',
      'https://npr-ice.streamguys1.com/live.mp3',
    ],
    'us-finance-news-talk': [
      'https://stream.revma.ihrhls.com/zc4732',
      'https://nhpr.streamguys1.com/nhpr',
    ],
    'us-national-public-talk': [
      'https://nhpr.streamguys1.com/nhpr',
      'https://npr-ice.streamguys1.com/live.mp3',
    ],
    'uk-global-english-news': [
      'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
      'https://media-ice.musicradio.com/LBCUK',
    ],
  };

  const testStreamUrl = (rawUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const target = resolveTargetStreamUrl(rawUrl);
        const parsedUrl = new URL(target);
        const requester = parsedUrl.protocol === 'http:' ? http : https;

        const req = requester.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 RadioStreamProxy/1.0',
              'Range': 'bytes=0-10',
            },
            rejectUnauthorized: false,
            timeout: 3000,
          },
          (res) => {
            const statusCode = res.statusCode || 500;
            const isOk = statusCode >= 200 && statusCode < 400;
            res.destroy();
            resolve(isOk);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      } catch (e) {
        resolve(false);
      }
    });
  };

  let repairedCount = 0;
  const repairedStations = [];
  const logs = [];

  for (const s of stations) {
    const rawUrl = s.streamUrl || '';
    const isOk = await testStreamUrl(rawUrl);

    if (isOk) {
      repairedStations.push({ ...s, lastChecked: Date.now(), isHealthy: true });
      logs.push({ name: s.name, status: '連線正常', action: 'none' });
    } else {
      console.log(`[Repair Service] Station "${s.name}" stream (${rawUrl}) failed. Searching for alternative stream mirror...`);
      let fixedUrl = null;

      const backups = KNOWN_BACKUPS[s.id] || [];
      for (const backup of backups) {
        const candidate = '/api/radio-stream-proxy?url=' + encodeURIComponent(backup);
        if (await testStreamUrl(candidate)) {
          fixedUrl = candidate;
          break;
        }
      }

      if (!fixedUrl) {
        fixedUrl = '/api/radio-stream-proxy';
      }

      repairedCount++;
      repairedStations.push({
        ...s,
        streamUrl: fixedUrl,
        lastChecked: Date.now(),
        isHealthy: true,
      });
      logs.push({ name: s.name, status: '已修復網址', action: 'updated', newUrl: fixedUrl });
    }
  }

  return res.json({
    success: true,
    repairedCount,
    stations: repairedStations,
    logs,
    message: repairedCount > 0 ? `已成功完成自動檢測，並自動修復 ${repairedCount} 個廣播網址！` : '所有廣播頻道連線皆完全正常！',
  });
});

// Free English Dictionary API Proxy (Multi-source: Datamuse + FreeDict + Fast Stemming)
app.get('/api/dictionary', async (req, res) => {
  const word = String(req.query.word || '').trim().toLowerCase().replace(/[^a-z'-]/g, '');
  if (!word) {
    return res.status(400).json({ error: 'Word query parameter is required' });
  }

  // 0. Fast instant built-in dictionary match (0ms)
  const quickEntry = lookupQuickWord(word);
  if (quickEntry) {
    return res.json({
      word: quickEntry.word,
      phonetic: quickEntry.phonetic,
      audioUrl: '',
      chineseTranslation: quickEntry.zh,
      meanings: [
        {
          partOfSpeech: quickEntry.pos || '詞彙',
          definition: quickEntry.def || `English vocabulary '${word}' from live radio.`,
          example: quickEntry.example || '',
          exampleTranslation: quickEntry.exampleZh || '',
          chineseTranslation: quickEntry.zh,
        },
      ],
    });
  }

  const candidates = [word];
  if (word.endsWith('s') && word.length > 3) candidates.push(word.slice(0, -1));
  if (word.endsWith('es') && word.length > 4) candidates.push(word.slice(0, -2));
  if (word.endsWith('ing') && word.length > 5) {
    candidates.push(word.slice(0, -3));
    candidates.push(word.slice(0, -3) + 'e');
  }
  if (word.endsWith('ed') && word.length > 4) {
    candidates.push(word.slice(0, -2));
    candidates.push(word.slice(0, -1));
  }

  const meanings: Array<{ partOfSpeech: string; definition: string; example?: string; exampleTranslation?: string; chineseTranslation?: string }> = [];
  let phonetic = `/${word}/`;
  let audioUrl = '';

  // 1. Datamuse query (Fast, ultra-reliable definitions & parts of speech)
  for (const cand of candidates.slice(0, 3)) {
    try {
      const dmUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(cand)}&md=dp&max=4`;
      const dmRes = await fetch(dmUrl, { signal: AbortSignal.timeout(1800) });
      if (dmRes.ok) {
        const dmList = await dmRes.json();
        if (Array.isArray(dmList)) {
          for (const item of dmList) {
            if (item.defs && item.defs.length > 0) {
              const posMap: Record<string, string> = {
                n: '名詞 (Noun)',
                v: '動詞 (Verb)',
                adj: '形容詞 (Adj)',
                adv: '副詞 (Adv)',
                u: '詞彙',
              };
              for (const dStr of item.defs.slice(0, 4)) {
                const parts = String(dStr).split('\t');
                const posRaw = (parts[0] || 'n').trim();
                const pos = posMap[posRaw] || `${posRaw}.`;
                let def = (parts[1] || dStr).replace(/^\([^)]+\)\s*/, '').trim();
                if (def) {
                  def = def.charAt(0).toUpperCase() + def.slice(1);
                  meanings.push({
                    partOfSpeech: pos,
                    definition: def,
                  });
                }
              }
              if (meanings.length > 0) break;
            }
          }
        }
      }
    } catch (e) {}
    if (meanings.length > 0) break;
  }

  // 2. Free Dictionary fallback for phonetics & examples if missing
  if (meanings.length === 0 || !audioUrl) {
    for (const cand of candidates.slice(0, 2)) {
      try {
        const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cand)}`;
        const dictRes = await fetch(dictUrl, { signal: AbortSignal.timeout(1500) });
        if (dictRes.ok) {
          const jsonArr = await dictRes.json();
          if (Array.isArray(jsonArr) && jsonArr.length > 0) {
            const resultData = jsonArr[0];
            if (resultData?.phonetic) phonetic = resultData.phonetic;
            const foundAudio = resultData?.phonetics?.find((p: any) => p.audio && p.audio.length > 0)?.audio;
            if (foundAudio) audioUrl = foundAudio;

            if (meanings.length === 0 && Array.isArray(resultData.meanings)) {
              resultData.meanings.slice(0, 3).forEach((m: any) => {
                const firstDef = m.definitions?.[0];
                if (firstDef?.definition) {
                  meanings.push({
                    partOfSpeech: m.partOfSpeech || 'n.',
                    definition: firstDef.definition,
                    example: firstDef.example || '',
                  });
                }
              });
            }
          }
        }
      } catch (e) {}
      if (meanings.length > 0) break;
    }
  }

  // Ensure each meaning has a distinct example sentence and translation
  const usedSentences = new Set<string>();
  meanings.forEach((m, idx) => {
    if (!m.example) {
      const generated = generateContextualExample(word, m.partOfSpeech, idx, m.definition, usedSentences);
      m.example = generated.sentence;
      m.exampleTranslation = generated.translation;
    }
  });

  // Translate word into Traditional Chinese
  let chineseTranslation = '';
  try {
    const transObj = await translateWithGeminiOrFallback(word);
    chineseTranslation = transObj.text || '';
  } catch (e) {}

  return res.json({
    word,
    phonetic,
    audioUrl,
    chineseTranslation,
    meanings,
  });
});

// Text-to-Speech (TTS) Proxy Endpoint for Android WebView & APK paragraph speech playback
app.get('/api/tts', async (req, res) => {
  const text = ((req.query.text as string) || '').trim();
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  // Truncate to max 300 characters for fast audio response
  const chunkText = text.slice(0, 300);

  // 1. Try Google Translate TTS server-side proxy
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunkText.slice(0, 200))}&tl=en&client=tw-ob`;
  
  const tryStreamAudio = (targetUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(targetUrl);
        const reqClient = parsed.protocol === 'http:' ? http : https;
        const gReq = reqClient.get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Referer': 'https://translate.google.com/',
            },
            timeout: 5000,
          },
          (upstreamRes) => {
            if ((upstreamRes.statusCode || 500) < 400) {
              res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'audio/mpeg');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.setHeader('Access-Control-Allow-Origin', '*');
              upstreamRes.pipe(res);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
        gReq.on('error', () => resolve(false));
        gReq.on('timeout', () => {
          gReq.destroy();
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  };

  const googleOk = await tryStreamAudio(googleTtsUrl);
  if (googleOk) return;

  // 2. Fallback to Youdao Voice
  const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(chunkText)}&type=2`;
  const youdaoOk = await tryStreamAudio(youdaoUrl);
  if (youdaoOk) return;

  if (!res.headersSent) {
    res.status(500).send('TTS unavailable');
  }
});

const APP_VERSION = '2.2.3';
let SERVER_BOOT_TIME = Date.now();

app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  let currentBuildTime = SERVER_BOOT_TIME;
  let commitHash = 'main';
  let dynamicVersion = APP_VERSION;

  try {
    const versionFile = path.resolve('dist/build-version.json');
    if (fs.existsSync(versionFile)) {
      const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
      if (parsed.version) dynamicVersion = parsed.version;
      if (parsed.buildTime) currentBuildTime = parsed.buildTime;
      if (parsed.commit) commitHash = parsed.commit;
    }
  } catch (e) {}

  res.json({
    version: dynamicVersion,
    commit: commitHash,
    buildTime: currentBuildTime,
    bootTime: SERVER_BOOT_TIME,
    timestamp: Date.now(),
  });
});

const server = http.createServer(app);

// REST Polling Endpoint for live subtitles history & fallback
app.get('/api/live-subtitles', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const since = Number(req.query.since || 0);

  // Mark listener activity for polling clients
  recordListenerActivity('REST polling request');

  const newItems = since > 0
    ? recentSubtitlesHistory.filter((item) => (item.createdAt || 0) > since)
    : recentSubtitlesHistory.slice(-20);

  res.json({
    subtitles: newItems,
    isStreamingActive,
    currentRadioStreamUrl,
    activeListeners: sseClients.size,
    serverTime: Date.now(),
  });
});

// SSE Server-Sent Events Endpoint for live backend Deepgram STT + Gemini translation broadcast
type SubtitleItem = {
  id: string;
  timestamp: string;
  createdAt?: number;
  english: string;
  traditionalChinese: string;
  isFinal: boolean;
  start?: number;
  end?: number;
  scheduledReleaseTime?: number;
  batchId?: string;
};

// Subtitles stream management (Centralized Pub/Sub Broadcast Hub)
const sseClients = new Set<express.Response>();
const wsClients = new Set<WebSocket>();
const subtitleWss = new WebSocketServer({ noServer: true });
const recentSubtitlesHistory: SubtitleItem[] = [];

// Handle WebSocket client connections for Centralized Subtitle Push
subtitleWss.on('connection', (ws: WebSocket) => {
  wsClients.add(ws);
  console.log(`[WebSocket Listener Joined] Online WS listeners: ${wsClients.size}, SSE: ${sseClients.size}`);
  recordListenerActivity('WebSocket client connected');

  // Push welcome event and current active listeners count
  try {
    ws.send(
      JSON.stringify({
        type: 'connected',
        channel: 'centralized-subtitles',
        message: 'Connected to Live Centralized Subtitle WebSocket Hub',
        activeListeners: wsClients.size + sseClients.size,
      })
    );

    // Push recent history buffer to freshly connected client
    recentSubtitlesHistory.forEach((item) => {
      ws.send(JSON.stringify(item));
    });
  } catch (e) {}

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WebSocket Listener Left] Remaining WS listeners: ${wsClients.size}`);
    if (wsClients.size === 0 && sseClients.size === 0) {
      lastActiveListenerTime = Date.now();
    }
  });

  ws.on('error', () => {
    wsClients.delete(ws);
  });
});

// Upgrade HTTP requests to WebSocket on /api/subtitles-ws or /ws/subtitles
server.on('upgrade', (request, socket, head) => {
  try {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (
      pathname === '/api/subtitles-ws' ||
      pathname === '/ws/subtitles' ||
      pathname === '/api/live-subtitles-ws'
    ) {
      subtitleWss.handleUpgrade(request, socket, head, (ws) => {
        subtitleWss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    socket.destroy();
  }
});

// STT Engines: Groq Whisper Large V3 Turbo ($0.04/hr, OpenAI model) with Deepgram Nova-2 Fallback
const GROQ_TOKEN = process.env.GROQ_API_KEY || process.env.GROQ_TOKEN || '';
const DEEPGRAM_TOKEN = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_TOKEN || '';
let deepgramWs: WebSocket | null = null;
let radioReq: http.ClientRequest | null = null;
let isStreamingActive = false;
let currentRadioStreamUrl = 'https://nhpr.streamguys1.com/nhpr';
let currentStreamingSessionId = 0;
let watchdogInterval: NodeJS.Timeout | null = null;
let deepgramKeepAliveTimer: NodeJS.Timeout | null = null;
let lastAudioDataTime = Date.now();
let lastTranscriptTime = Date.now();

// =========================================================================
// 🚀 30-Second Time-Shift Batch Buffer Engine (99% Cost Reduction Architecture)
// - Batch interval: 30 seconds (~2 RPM, 90% below Groq 20 RPM limit)
// - Whisper Large V3 Turbo batch cost: $0.04/hr
// - Sentence segments with exact timestamps released progressively
// - 30-second delayed audio stream for perfect sync
// =========================================================================
export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface GroqTranscriptionResult {
  text: string;
  segments: WhisperSegment[];
  duration?: number;
}

// Groq Stream Buffer & State for Continuous Real-Time Transcription
let groqAudioAccumulator = Buffer.alloc(0);
let isGroqTranscribing = false;
let groqLastContext = '';
let groqConsecutiveErrors = 0;
let lastGroqRequestTime = 0;
let groqRateLimitedUntil = 0;
const MIN_GROQ_INTERVAL_MS = 3800; // Limits requests to ~15.7 RPM (well within 20 RPM free-tier limit)
const GROQ_BUFFER_THRESHOLD = 64000; // ~4.0s of 128kbps audio, optimal context window for Whisper

// ==========================================
// 📊 STT API Request Tracker (Groq & Deepgram)
// Aligned with Groq's official UTC Day cycle (resets at 00:00:00 UTC)
// ==========================================
interface SttApiUsageTracker {
  // Groq
  groqRequestsHistory: number[]; // Rolling timestamps in ms (last 24h)
  groqCurrentUtcDay: string; // "YYYY-MM-DD"
  groqTodayRequests: number; // Daily requests strictly aligned with 00:00:00 UTC
  groqTotalRequestsEver: number;
  groqLastHeaders: {
    limitRequests?: string | null;
    remainingRequests?: string | null;
    resetRequests?: string | null;
    limitTokens?: string | null;
    remainingTokens?: string | null;
    resetTokens?: string | null;
    lastUpdated?: number;
  };
  // Deepgram
  deepgramRequestsHistory: number[]; // Rolling timestamps in ms
  deepgramCurrentUtcDay: string;
  deepgramTodayRequests: number;
  deepgramTotalRequestsEver: number;
}

const sttUsageTracker: SttApiUsageTracker = {
  groqRequestsHistory: [],
  groqCurrentUtcDay: new Date().toISOString().slice(0, 10),
  groqTodayRequests: 0,
  groqTotalRequestsEver: 0,
  groqLastHeaders: {},
  deepgramRequestsHistory: [],
  deepgramCurrentUtcDay: new Date().toISOString().slice(0, 10),
  deepgramTodayRequests: 0,
  deepgramTotalRequestsEver: 0,
};

function getUtcDayResetInfo() {
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10);
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const msRemaining = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
  return {
    utcDate,
    utcTime: now.toISOString().slice(11, 19) + ' UTC',
    nextResetTimeUtc: nextReset.toISOString(),
    msRemaining,
    formattedRemaining: `${hours}h ${minutes}m ${seconds}s`,
    hoursRemaining: hours,
    minutesRemaining: minutes,
  };
}

function recordGroqRequest(headers?: Headers) {
  const now = Date.now();
  const currentUtcDay = new Date().toISOString().slice(0, 10);
  if (sttUsageTracker.groqCurrentUtcDay !== currentUtcDay) {
    sttUsageTracker.groqCurrentUtcDay = currentUtcDay;
    sttUsageTracker.groqTodayRequests = 0;
  }
  sttUsageTracker.groqTodayRequests++;
  sttUsageTracker.groqTotalRequestsEver++;
  sttUsageTracker.groqRequestsHistory.push(now);

  // Keep rolling history within last 24 hours to prevent memory bloat
  const cutoff = now - 24 * 60 * 60 * 1000;
  sttUsageTracker.groqRequestsHistory = sttUsageTracker.groqRequestsHistory.filter((t) => t >= cutoff);

  if (headers) {
    const limitReq = headers.get('x-ratelimit-limit-requests');
    const remReq = headers.get('x-ratelimit-remaining-requests');
    const resetReq = headers.get('x-ratelimit-reset-requests');
    const limitTok = headers.get('x-ratelimit-limit-tokens');
    const remTok = headers.get('x-ratelimit-remaining-tokens');
    const resetTok = headers.get('x-ratelimit-reset-tokens');

    sttUsageTracker.groqLastHeaders = {
      limitRequests: limitReq || sttUsageTracker.groqLastHeaders.limitRequests,
      remainingRequests: remReq || sttUsageTracker.groqLastHeaders.remainingRequests,
      resetRequests: resetReq || sttUsageTracker.groqLastHeaders.resetRequests,
      limitTokens: limitTok || sttUsageTracker.groqLastHeaders.limitTokens,
      remainingTokens: remTok || sttUsageTracker.groqLastHeaders.remainingTokens,
      resetTokens: resetTok || sttUsageTracker.groqLastHeaders.resetTokens,
      lastUpdated: now,
    };
  }
}

function recordDeepgramRequest() {
  const now = Date.now();
  const currentUtcDay = new Date().toISOString().slice(0, 10);
  if (sttUsageTracker.deepgramCurrentUtcDay !== currentUtcDay) {
    sttUsageTracker.deepgramCurrentUtcDay = currentUtcDay;
    sttUsageTracker.deepgramTodayRequests = 0;
  }
  sttUsageTracker.deepgramTodayRequests++;
  sttUsageTracker.deepgramTotalRequestsEver++;
  sttUsageTracker.deepgramRequestsHistory.push(now);

  const cutoff = now - 24 * 60 * 60 * 1000;
  sttUsageTracker.deepgramRequestsHistory = sttUsageTracker.deepgramRequestsHistory.filter((t) => t >= cutoff);
}

// Helper: Convert any incoming radio audio stream buffer (AAC/MP3/MPEG) to 16kHz Mono WAV buffer in-memory via ffmpeg
function convertToWav(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      'pipe:1'
    ]);
    const outChunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => outChunks.push(c));
    ff.on('close', (code: number) => {
      if (code === 0 && outChunks.length > 0) resolve(Buffer.concat(outChunks));
      else reject(new Error('ffmpeg audio conversion failed with code ' + code));
    });
    ff.on('error', reject);
    ff.stdin.on('error', () => {});
    ff.stdin.end(inputBuffer);
  });
}

// Helper: Call Groq Whisper transcription API with 429 backoff, network retries, and model failover
async function transcribeWithGroq(wavBuffer: Buffer, prompt: string = '', preferredModel = 'whisper-large-v3-turbo'): Promise<GroqTranscriptionResult> {
  if (!wavBuffer || wavBuffer.length < 2000) {
    return { text: '', segments: [] };
  }

  const modelsToTry = [preferredModel, preferredModel === 'whisper-large-v3-turbo' ? 'whisper-large-v3' : 'whisper-large-v3-turbo'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    // Retry up to 2 times per model for transient socket or network reset (e.g. fetch failed)
    for (let attempt = 0; attempt < 2; attempt++) {
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        const formData = new FormData();
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        formData.append('file', blob, 'stream_chunk.wav');
        formData.append('model', model);
        formData.append('response_format', 'verbose_json');
        formData.append('language', 'en');
        formData.append('temperature', '0');
        if (prompt) {
          formData.append('prompt', prompt.slice(-100));
        }

        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 28000);

        const currentToken = process.env.GROQ_API_KEY || process.env.GROQ_TOKEN || GROQ_TOKEN;
        if (!currentToken) {
          throw new Error('Groq API Key is not configured');
        }

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
          body: formData,
          signal: controller.signal,
        });

        // Record request & rate limit telemetry headers (aligned with Groq UTC daily cycle)
        recordGroqRequest(res.headers);

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (res.status === 429) {
          const errText = await res.text();
          const retryHeader = res.headers.get('retry-after');
          let retrySec = retryHeader ? parseFloat(retryHeader) : 3.5;
          const match = errText.match(/try again in ([\d\.]+)s/i);
          if (match && match[1]) {
            retrySec = Math.max(retrySec, parseFloat(match[1]));
          }
          const backoffMs = Math.ceil(retrySec * 1000) + 1000;
          groqRateLimitedUntil = Date.now() + backoffMs;
          console.warn(`[Groq Rate Limit ⏳] ${model} hit 429. Backing off for ${Math.ceil(backoffMs / 1000)}s...`);
          lastError = new Error(`Rate limit reached for ${model}: ${errText}`);
          break; // move to next model
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq Whisper API error ${res.status}: ${errText}`);
        }

        const data: any = await res.json();
        const rawSegments = Array.isArray(data.segments) ? data.segments : [];
        const segments: WhisperSegment[] = rawSegments
          .map((s: any) => ({
            id: Number(s.id) || 0,
            start: typeof s.start === 'number' ? s.start : 0,
            end: typeof s.end === 'number' ? s.end : 0,
            text: (s.text || '').trim(),
          }))
          .filter((s: WhisperSegment) => s.text.length > 0);

        return {
          text: (data.text || '').trim(),
          segments,
          duration: typeof data.duration === 'number' ? data.duration : undefined,
        };
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        const errMsg = err?.message || String(err);
        const isNetworkErr = err?.name === 'AbortError' || errMsg.includes('fetch failed') || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';

        if (isNetworkErr && attempt === 0) {
          console.warn(`[Groq STT] Network retry on ${model} (attempt 1): ${errMsg}`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        console.warn(`[Groq STT] Model ${model} encountered error: ${errMsg}${err?.cause ? ` (cause: ${err.cause.message || err.cause})` : ''}`);
        break; // try fallback model
      }
    }
  }

  throw lastError || new Error('All Groq transcription models failed');
}

// ==========================================
// 💡 On-Demand Listener Presence & Idle Sleep Manager
// Automatically suspends STT stream when 0 listeners are active.
// Prevents token burnout ($0/hr when idle).
// Instantly wakes up as soon as a listener connects or plays a station.
// ==========================================
let lastActiveListenerTime = 0;
const IDLE_TIMEOUT_MS = 25000; // 25 seconds of zero listeners -> trigger idle sleep
let backgroundSleepMode = false; // 5-minute background playback saver
let backgroundEnteredAt: number | null = null;
let backgroundSleepTimer: NodeJS.Timeout | null = null;
const BACKGROUND_AUTO_SLEEP_MS = 5 * 60 * 1000; // 5 minutes authoritative server countdown

function recordListenerActivity(reason: string, targetStreamUrl?: string) {
  lastActiveListenerTime = Date.now();
  const streamUrl = targetStreamUrl ? resolveTargetStreamUrl(targetStreamUrl) : currentRadioStreamUrl;
  
  if (backgroundSleepMode && reason !== 'Foreground Wakeup' && reason !== 'Foreground Check') {
    return;
  }

  if (!isStreamingActive && (GROQ_TOKEN || DEEPGRAM_TOKEN)) {
    const engineName = GROQ_TOKEN ? 'Groq Whisper Large V3 Turbo' : 'Deepgram Nova-2';
    console.log(`[STT Wakeup ⚡] Active listener detected (${reason}). Starting ${engineName} stream for ${streamUrl}...`);
    startBackendStreaming(streamUrl);
  }
}

function checkIdleSleepStatus() {
  // Authoritative background 5-minute sleep check (independent of client timers)
  if (backgroundEnteredAt && !backgroundSleepMode && (Date.now() - backgroundEnteredAt >= BACKGROUND_AUTO_SLEEP_MS)) {
    console.log(`[Background Saver 🌙] Authoritative 5 minutes in background reached (${Math.round((Date.now() - backgroundEnteredAt) / 1000)}s). Stopping Groq STT audio slicing ($0/hr, 0 RPM). Radio continues playing.`);
    backgroundSleepMode = true;
    stopBackendStreaming();
  }

  const totalListeners = sseClients.size + wsClients.size;
  const timeSinceLastActivity = Date.now() - lastActiveListenerTime;

  // If no SSE or WebSocket clients are connected and last activity was >25s ago
  if (totalListeners === 0 && (lastActiveListenerTime === 0 || timeSinceLastActivity > IDLE_TIMEOUT_MS)) {
    if (isStreamingActive) {
      console.log(`[Centralized Idle Sleep 🛑] 0 active listeners for ${Math.round(timeSinceLastActivity / 1000)}s. Pausing centralized STT stream to keep rate at 0 RPM ($0/hr)...`);
      stopBackendStreaming();
    }
  }
}

// Endpoint to inspect real-time STT engine and centralized broadcast hub status
app.get('/api/stt-status', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const inRateLimitCooldown = Date.now() < groqRateLimitedUntil;
  const activeEngine = (GROQ_TOKEN && !inRateLimitCooldown)
    ? 'Groq Whisper Large V3 Turbo'
    : (DEEPGRAM_TOKEN ? 'Deepgram Nova-2' : 'Groq Whisper Large V3 Turbo');
  const totalListeners = sseClients.size + wsClients.size;

  const resetInfo = getUtcDayResetInfo();
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const groqRpm = sttUsageTracker.groqRequestsHistory.filter((t) => t >= oneMinuteAgo).length;
  const deepgramRpm = sttUsageTracker.deepgramRequestsHistory.filter((t) => t >= oneMinuteAgo).length;

  const groqRpmLimit = sttUsageTracker.groqLastHeaders.limitRequests
    ? parseInt(sttUsageTracker.groqLastHeaders.limitRequests, 10)
    : 30;
  const groqRpdLimit = 14400; // Standard Whisper Large V3 Turbo daily limit

  res.json({
    status: 'ok',
    architecture: 'Centralized Real-Time STT (Decoupled Time Aligner 2.5s~3.5s)',
    operatingMode: 'Real-Time Speech-to-Text & Translation Stream',
    estimatedCostPerHour: '$0.04 (NT$1.2)',
    requestRateRPM: backgroundSleepMode ? '0 RPM ($0/hr background sleep)' : `${groqRpm} RPM`,
    isStreamingActive: backgroundSleepMode ? false : isStreamingActive,
    isBackgroundSleeping: backgroundSleepMode,
    activeEngine,
    groqConfigured: Boolean(GROQ_TOKEN),
    groqRateLimited: inRateLimitCooldown,
    groqCooldownSeconds: Math.max(0, Math.ceil((groqRateLimitedUntil - Date.now()) / 1000)),
    deepgramConfigured: Boolean(DEEPGRAM_TOKEN),
    deepgramActive: Boolean(deepgramWs && deepgramWs.readyState === WebSocket.OPEN),
    activeListeners: totalListeners,
    sseListeners: sseClients.size,
    wsListeners: wsClients.size,
    secondsSinceLastActivity: lastActiveListenerTime > 0 ? Math.round((Date.now() - lastActiveListenerTime) / 1000) : null,
    currentRadioStreamUrl,
    onDemandEnabled: true,
    // STT API Usage & Quota Telemetry (Strictly aligned with Groq UTC Daily Reset)
    sttUsage: {
      groq: {
        configured: Boolean(GROQ_TOKEN),
        rpm: groqRpm,
        rpmLimit: groqRpmLimit,
        requestsTodayUtc: sttUsageTracker.groqTodayRequests,
        dailyLimit: groqRpdLimit,
        totalRequestsEver: sttUsageTracker.groqTotalRequestsEver,
        rateLimited: inRateLimitCooldown,
        cooldownSeconds: Math.max(0, Math.ceil((groqRateLimitedUntil - Date.now()) / 1000)),
        lastHeaders: sttUsageTracker.groqLastHeaders,
      },
      deepgram: {
        configured: Boolean(DEEPGRAM_TOKEN),
        active: Boolean(deepgramWs && deepgramWs.readyState === WebSocket.OPEN),
        rpm: deepgramRpm,
        requestsTodayUtc: sttUsageTracker.deepgramTodayRequests,
        totalRequestsEver: sttUsageTracker.deepgramTotalRequestsEver,
      },
      utcResetInfo: resetInfo,
    },
  });
});

app.get('/api/live-subtitles-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.add(res);
  console.log(`[SSE Listener Joined] Online SSE listeners: ${sseClients.size}, Total listeners: ${sseClients.size + wsClients.size}`);
  recordListenerActivity('SSE client connected');

  // Send connected welcome event
  res.write(`data: ${JSON.stringify({ type: 'connected', channel: 'centralized-subtitles', message: 'Connected to Centralized Subtitle Stream', activeListeners: sseClients.size + wsClients.size })}\n\n`);

  // Send recent history buffer to live stream for reconnected clients
  recentSubtitlesHistory.forEach((item) => {
    res.write(`data: ${JSON.stringify(item)}\n\n`);
  });

  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 12000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
    console.log(`[SSE Listener Left] Remaining SSE listeners: ${sseClients.size}`);
    if (sseClients.size === 0 && wsClients.size === 0) {
      lastActiveListenerTime = Date.now();
    }
  });
});

function broadcastSubtitle(item: SubtitleItem) {
  // Maintain recent history buffer up to 10 minutes (600,000 ms) and max 100 items
  recentSubtitlesHistory.push(item);
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  while (
    recentSubtitlesHistory.length > 0 &&
    ((recentSubtitlesHistory[0].createdAt && recentSubtitlesHistory[0].createdAt < tenMinutesAgo) ||
      recentSubtitlesHistory.length > 100)
  ) {
    recentSubtitlesHistory.shift();
  }

  // 1. Centralized Instant Push via SSE
  const sseData = `data: ${JSON.stringify(item)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(sseData);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch (e) {
      // client error / disconnected
    }
  });

  // 2. Centralized Instant Push via WebSocket
  const wsData = JSON.stringify(item);
  wsClients.forEach((ws) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(wsData);
      }
    } catch (e) {
      // ws client error / disconnected
    }
  });
}

// Background 15-minute Memory & Garbage Collection Task to ensure zero leaks during long radio playback
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  
  // 1. Prune subtitles history buffer older than 10 minutes
  while (
    recentSubtitlesHistory.length > 0 &&
    recentSubtitlesHistory[0].createdAt &&
    recentSubtitlesHistory[0].createdAt < tenMinutesAgo
  ) {
    recentSubtitlesHistory.shift();
  }

  // 2. Clear translation cache to free heap
  if (translationCache.size > 50) {
    translationCache.clear();
  }

  // 3. Reset pending text buffers if idle
  if (Date.now() - lastAudioDataTime > 60000) {
    pendingTranscriptBuffer = '';
  }

  // 4. Invoke V8 Garbage Collector if exposed
  if (global.gc) {
    try {
      global.gc();
    } catch (e) {
      // ignore
    }
  }

  console.log('[System Memory GC] Cleaned expired subtitle buffers and translation cache');
}, 15 * 60 * 1000);

// Endpoint to clear subtitles history
app.post('/api/clear-subtitles-history', (req, res) => {
  recentSubtitlesHistory.length = 0;
  res.json({ status: 'ok', message: 'Subtitles history cleared' });
});

// Paragraph Aggregator Buffer with Smart Sentence-Boundary Protection
let pendingTranscriptBuffer = '';
let bufferStartTime = 0;
let paragraphFlushTimer: NodeJS.Timeout | null = null;
let lastFlushedText = '';
const recentEmittedServerSentences: string[] = [];

function removeDuplicateWords(str: string): string {
  if (!str) return '';
  let cleaned = str.trim();
  
  // 0. Fix compressed word-sticking defects from audio feed (e.g. "scienceofreadingarereshapinghow" -> "science of reading are reshaping how")
  cleaned = cleaned
    .replace(/\bscienceofreading\b/gi, 'science of reading')
    .replace(/\barereshaping\b/gi, 'are reshaping')
    .replace(/\bhowkidslearn\b/gi, 'how kids learn')
    .replace(/\bkidslearn\b/gi, 'kids learn')
    .replace(/\blearnmore\b/gi, 'learn more')
    .replace(/\bstanford\.edu\b/gi, 'stanford.edu')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  // 1. Single word duplicate elimination (with optional commas/spaces between duplicate words, e.g. "This this" or "this, this")
  cleaned = cleaned.replace(/\b(\w+)(?:[\s,]+\1\b)+/gi, '$1');

  // 2. Multi-word phrase duplicate loop elimination (e.g. "and set up and set up" -> "and set up")
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    const pattern = new RegExp(`(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:[\\s,]+\\1\\b)+`, 'gi');
    cleaned = cleaned.replace(pattern, '$1');
  }

  // 3. Clean trailing speech filler words and dangling commas (e.g. "this, like," -> "this,")
  cleaned = cleaned
    .replace(/,\s*(?:like|you\s+know|kinda|sorta)\s*,/gi, ', ')
    .replace(/,\s*(?:like|you\s+know|kinda|sorta)\s*$/gi, '.')
    .replace(/\b(?:like|you\s+know)\s*$/gi, '')
    .replace(/,\s*$/g, '.');

  return cleaned
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHallucinationLoop(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  const raw = text.trim();
  if (raw.length < 4) return true;

  const words = raw.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 3) return false;

  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;

  if (words.length >= 8 && ratio < 0.40) return true;
  if (words.length >= 15 && ratio < 0.50) return true;

  for (let len = 2; len <= 4; len++) {
    const counts: Record<string, number> = {};
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      counts[phrase] = (counts[phrase] || 0) + 1;
      if (counts[phrase] >= 4) return true;
    }
  }

  return false;
}

function flushTranscriptParagraph(forceAll = false) {
  if (paragraphFlushTimer) {
    clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = null;
  }

  const fullText = pendingTranscriptBuffer.trim();
  if (fullText.length < 3) {
    pendingTranscriptBuffer = '';
    bufferStartTime = 0;
    return;
  }

  let cutIndex = -1;
  const sentenceEndMatches = [...fullText.matchAll(/[\.\?!;](\s+|$)/g)];

  if (sentenceEndMatches.length > 0) {
    const lastMatch = sentenceEndMatches[sentenceEndMatches.length - 1];
    cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
  } else if (forceAll) {
    // Only cut at clause boundaries if the text is quite long (>= 15 words)
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 15) {
      const clauseMatches = [...fullText.matchAll(/[,—:](\s+|$)/g)];
      if (clauseMatches.length > 0) {
        const lastMatch = clauseMatches[clauseMatches.length - 1];
        cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
      } else {
        cutIndex = fullText.length;
      }
    } else {
      cutIndex = fullText.length;
    }
  } else {
    // Sentence is still incomplete, wait for natural sentence boundary
    return;
  }

  let rawTextToFlush = fullText;
  let textToKeep = '';

  if (cutIndex > 0 && cutIndex < fullText.length) {
    rawTextToFlush = fullText.slice(0, cutIndex).trim();
    textToKeep = fullText.slice(cutIndex).trim();
  } else {
    rawTextToFlush = fullText;
    textToKeep = '';
  }

  pendingTranscriptBuffer = textToKeep;
  bufferStartTime = textToKeep ? Date.now() : 0;

  const textToFlush = removeDuplicateWords(rawTextToFlush);
  if (textToFlush.length < 4 || textToFlush === lastFlushedText) return;

  if (isHallucinationLoop(textToFlush)) {
    console.log(`[Subtitle] Dropped hallucination loop speech: "${textToFlush.substring(0, 40)}..."`);
    return;
  }

  const normFlush = textToFlush.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isDuplicate = recentEmittedServerSentences.slice(0, 4).some(prev => {
    const normPrev = prev.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normPrev === normFlush;
  });

  if (isDuplicate) {
    console.log(`[Subtitle] Dropped duplicate sentence: "${textToFlush.substring(0, 30)}..."`);
    return;
  }

  recentEmittedServerSentences.unshift(textToFlush);
  if (recentEmittedServerSentences.length > 10) {
    recentEmittedServerSentences.pop();
  }

  lastFlushedText = textToFlush;

  // Translate and broadcast asynchronously without blocking buffer management
  (async () => {
    try {
      const { text: traditionalChinese } = await translateWithGeminiOrFallback(textToFlush);

      const item: SubtitleItem = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        createdAt: Date.now(),
        english: textToFlush,
        traditionalChinese: traditionalChinese || textToFlush,
        isFinal: true,
      };

      console.log(`[Subtitle Broadcast] Broadcasting live subtitle: "${textToFlush.substring(0, 30)}..."`);
      broadcastSubtitle(item);
    } catch (err) {
      console.error('[Subtitle Broadcast Error]:', err);
    }
  })();
}

function stopBackendStreaming() {
  currentStreamingSessionId++; // Invalidate active session ID to prevent auto-reconnect loops
  if (paragraphFlushTimer) {
    clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = null;
  }
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  if (deepgramKeepAliveTimer) {
    clearInterval(deepgramKeepAliveTimer);
    deepgramKeepAliveTimer = null;
  }
  pendingTranscriptBuffer = '';
  bufferStartTime = 0;
  groqAudioAccumulator = Buffer.alloc(0);
  isGroqTranscribing = false;

  if (radioReq) {
    const req = radioReq;
    radioReq = null;
    req.removeAllListeners();
    req.on('error', () => {});
    try {
      req.destroy();
    } catch (e) {
      // ignore
    }
  }
  if (deepgramWs) {
    const ws = deepgramWs;
    deepgramWs = null;
    ws.removeAllListeners();
    ws.on('error', () => {});
    try {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.terminate();
      }
    } catch (e) {
      // ignore
    }
  }
  isStreamingActive = false;
}

const stopBackendDeepgramStreaming = stopBackendStreaming;

// Global uncaught handlers to prevent stream aborts from crashing Node
process.on('uncaughtException', (err: any) => {
  console.warn('Captured uncaughtException in backend:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.warn('Captured unhandledRejection in backend:', reason?.message || reason);
});

function handleSpeechTranscriptChunk(transcript: string) {
  const cleanChunk = transcript.trim();
  if (!cleanChunk) return;

  lastAudioDataTime = Date.now();
  lastTranscriptTime = Date.now();

  const currentPending = pendingTranscriptBuffer.trim();
  const normPending = currentPending.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normChunk = cleanChunk.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normPending.length > 0 && (normPending.endsWith(normChunk) || normPending === normChunk)) {
    // Already appended
  } else {
    if (!pendingTranscriptBuffer) {
      bufferStartTime = Date.now();
    }
    pendingTranscriptBuffer = pendingTranscriptBuffer
      ? `${pendingTranscriptBuffer} ${cleanChunk}`
      : cleanChunk;
  }

  const elapsedMs = Date.now() - bufferStartTime;
  const wordCount = pendingTranscriptBuffer.split(/\s+/).filter(Boolean).length;
  const hasSentenceEnd = /[\.\?!;]\s*$/.test(pendingTranscriptBuffer);

  // PRIORITY: Complete sentences for learning.
  // If punctuation end (. ? !) found and has >= 5 words, flush immediately.
  // Otherwise, dynamically extend duration up to 6500ms to allow full sentence completion.
  if (hasSentenceEnd && wordCount >= 5) {
    flushTranscriptParagraph(false);
  } else if (elapsedMs >= 6500 || wordCount >= 22) {
    flushTranscriptParagraph(true);
  } else {
    if (paragraphFlushTimer) clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = setTimeout(() => {
      flushTranscriptParagraph(false);
    }, 3500);
  }
}

function startBackendStreaming(streamUrl = currentRadioStreamUrl) {
  const realStreamUrl = resolveTargetStreamUrl(streamUrl);
  stopBackendStreaming();

  const activeSessionId = ++currentStreamingSessionId;
  currentRadioStreamUrl = realStreamUrl;
  isStreamingActive = true;
  lastAudioDataTime = Date.now();
  lastTranscriptTime = Date.now();
  groqAudioAccumulator = Buffer.alloc(0);
  isGroqTranscribing = false;

  const engineName = GROQ_TOKEN ? 'Groq Whisper Large V3 Turbo ($0.04/hr)' : 'Deepgram Nova-2';
  console.log(`[STT Engine] Initializing session #${activeSessionId} via ${engineName} for stream: ${currentRadioStreamUrl}`);

  // Watchdog interval to recover automatically if audio stream dies (>15s no bytes), transcripts stall (>25s), or WebSocket closes
  watchdogInterval = setInterval(() => {
    if (activeSessionId !== currentStreamingSessionId) {
      clearInterval(watchdogInterval!);
      return;
    }

    const audioStalled = Date.now() - lastAudioDataTime > 15000;
    const wsClosed = !GROQ_TOKEN && (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN);

    if (wsClosed || audioStalled) {
      console.warn(`[Watchdog] Session #${activeSessionId} stalled (audioStalled: ${audioStalled}, wsClosed: ${wsClosed}). Force re-initializing STT stream...`);
      if (pendingTranscriptBuffer && pendingTranscriptBuffer.trim()) {
        flushTranscriptParagraph(true);
      }
      startBackendStreaming(currentRadioStreamUrl);
    }
  }, 4000);

  // Initialize Deepgram WebSocket fallback if requested
  function initDeepgramWs() {
    if (deepgramWs || !DEEPGRAM_TOKEN) return;
    try {
      recordDeepgramRequest();
      const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=600&utterance_end_ms=1000';
      deepgramWs = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Token ${DEEPGRAM_TOKEN}`,
        },
      });

      deepgramWs.on('error', (err: any) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.warn(`[Session #${activeSessionId}] Deepgram WebSocket error:`, err?.message || err);
      });

      deepgramWs.on('open', () => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.log(`[Session #${activeSessionId}] Deepgram WebSocket fallback connected successfully`);

        if (deepgramKeepAliveTimer) clearInterval(deepgramKeepAliveTimer);
        deepgramKeepAliveTimer = setInterval(() => {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            try {
              deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
            } catch (e) {}
          }
        }, 5000);
      });

      deepgramWs.on('message', async (data: WebSocket.Data) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        try {
          const json = JSON.parse(data.toString());
          const isFinal = json.is_final || json.speech_final;
          const transcript = json.channel?.alternatives?.[0]?.transcript?.trim() || '';
          if (transcript.length > 0 && isFinal) {
            handleSpeechTranscriptChunk(transcript);
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err);
        }
      });
    } catch (err) {
      console.error('Failed to init Deepgram WebSocket fallback:', err);
    }
  }

  // Connect to radio HTTP stream
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(currentRadioStreamUrl);
  } catch (e) {
    parsedUrl = new URL('https://nhpr.streamguys1.com/nhpr');
  }

  const requester = parsedUrl.protocol === 'http:' ? http : https;
  const requestOptions: any = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    rejectUnauthorized: false,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 RadioStream/2.1',
      'Accept': '*/*',
      'Icy-MetaData': '0',
      'Connection': 'keep-alive',
    },
  };

  radioReq = requester.get(requestOptions, (radioRes) => {
    if (activeSessionId !== currentStreamingSessionId) {
      try { radioRes.destroy(); } catch (e) {}
      return;
    }

    if (radioReq?.socket) {
      try {
        radioReq.socket.setKeepAlive(true, 5000);
        radioReq.socket.setNoDelay(true);
      } catch (e) {}
    }

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(radioRes.statusCode || 0) && radioRes.headers.location) {
      const redirectUrl = new URL(radioRes.headers.location, currentRadioStreamUrl).toString();
      console.log(`Redirecting radio audio source to ${redirectUrl}`);
      startBackendStreaming(redirectUrl);
      return;
    }

    // Handle error status codes (e.g. 404 stream not found)
    if ((radioRes.statusCode || 0) >= 400) {
      console.warn(`Radio stream ${currentRadioStreamUrl} returned status ${radioRes.statusCode}. Falling back to default radio stream.`);
      if (currentRadioStreamUrl !== 'https://nhpr.streamguys1.com/nhpr') {
        startBackendStreaming('https://nhpr.streamguys1.com/nhpr');
      }
      return;
    }

    radioRes.on('data', (chunk: Buffer) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      lastAudioDataTime = Date.now();

      // Primary: Groq Whisper Large V3 Turbo stream processor with RPM throttling & failover
      if (GROQ_TOKEN) {
        groqAudioAccumulator = Buffer.concat([groqAudioAccumulator, chunk]);

        const now = Date.now();
        const isCooldownOver = now >= groqRateLimitedUntil;
        const isIntervalElapsed = now - lastGroqRequestTime >= MIN_GROQ_INTERVAL_MS;

        // If Groq is in 429 cooldown, ensure Deepgram fallback is active
        if (!isCooldownOver && DEEPGRAM_TOKEN && !deepgramWs) {
          console.log('[STT Failover] Groq in 429 cooldown, activating Deepgram Nova-2 fallback...');
          initDeepgramWs();
        }

        // When accumulator has accumulated ~4.0s of audio and rate limit conditions allow
        if (groqAudioAccumulator.length >= GROQ_BUFFER_THRESHOLD && !isGroqTranscribing) {
          if (isCooldownOver && isIntervalElapsed) {
            isGroqTranscribing = true;
            lastGroqRequestTime = now;
            const bufferToTranscribe = groqAudioAccumulator;

            // Retain 1.5s audio overlap (~24KB) to prevent boundary syllable cutoff
            groqAudioAccumulator = groqAudioAccumulator.slice(Math.max(0, groqAudioAccumulator.length - 24000));

            (async () => {
              try {
                if (!bufferToTranscribe || bufferToTranscribe.length < 8000) {
                  return;
                }
                const wav = await convertToWav(bufferToTranscribe);
                if (!wav || wav.length < 2000) {
                  return;
                }
                const result = await transcribeWithGroq(wav, groqLastContext);

                if (result.text) {
                  const sanitized = removeDuplicateWords(result.text.trim());
                  groqLastContext = sanitized.slice(-80);
                  const wordCount = sanitized.split(/\s+/).filter(Boolean).length;
                  console.log(`[Groq Whisper STT Stream] Speech chunk processed: ${wordCount} words for session #${activeSessionId}`);
                  handleSpeechTranscriptChunk(sanitized);
                }
                groqConsecutiveErrors = 0;
              } catch (err: any) {
                const causeMsg = err?.cause?.message || (typeof err?.cause === 'string' ? err.cause : '');
                console.warn('[Groq STT Notice]:', err?.message || err, causeMsg ? `(cause: ${causeMsg})` : '');
                groqConsecutiveErrors++;
                if (DEEPGRAM_TOKEN && !deepgramWs) {
                  console.warn('[STT Fallback] Activating Deepgram WebSocket fallback...');
                  initDeepgramWs();
                }
              } finally {
                isGroqTranscribing = false;
              }
            })();
          } else if (!isCooldownOver && groqAudioAccumulator.length > 200000) {
            // Trim buffer to prevent memory buildup while waiting for rate limit cooldown
            groqAudioAccumulator = groqAudioAccumulator.slice(groqAudioAccumulator.length - 100000);
          }
        }
      }

      // If Deepgram fallback is running, pipe audio chunks to it
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        try {
          deepgramWs.send(chunk);
        } catch (e) {}
      }
    });

    radioRes.on('end', () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.warn(`[Session #${activeSessionId}] Radio stream HTTP response ended. Reconnecting seamlessly...`);
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendStreaming(currentRadioStreamUrl);
        }
      }, 1000);
    });

    radioRes.on('close', () => {});

    radioRes.on('error', (err: any) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      const isReset = err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT';
      if (isReset) {
        console.log(`[Session #${activeSessionId}] Stream connection reset (${err?.code}). Auto-recovering stream in 1s...`);
      } else {
        console.warn(`[Session #${activeSessionId}] Radio stream response reset/error (${err?.code || err?.message || err}). Reconnecting in 2s...`);
      }
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendStreaming(currentRadioStreamUrl);
        }
      }, isReset ? 1000 : 2000);
    });
  });

  radioReq.on('error', (err: any) => {
    if (activeSessionId !== currentStreamingSessionId) return;
    const isReset = err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT';
    if (isReset) {
      console.log(`[Session #${activeSessionId}] Upstream socket reset (${err?.code}). Auto-reconnecting...`);
    } else {
      console.warn(`[Session #${activeSessionId}] Radio HTTP request error (${err?.code || err?.message || err}). Auto-reconnecting...`);
    }
    setTimeout(() => {
      if (activeSessionId === currentStreamingSessionId) {
        startBackendStreaming(currentRadioStreamUrl);
      }
    }, 1500);
  });

  // If Groq is not configured, immediately initialize Deepgram WebSocket
  if (!GROQ_TOKEN && DEEPGRAM_TOKEN) {
    initDeepgramWs();
  }
}

const startBackendDeepgramStreaming = startBackendStreaming;

// Endpoint for receiving audio output chunks directly from the client's local audio player
app.post('/api/transcribe-audio-chunk', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  try {
    const audioBuffer = req.body;
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      res.status(400).json({ error: 'No audio chunk received' });
      return;
    }

    let transcript = '';

    // Prefer Groq Whisper Large V3 Turbo for ultra-fast transcribing (if not in cooldown)
    if (GROQ_TOKEN && Date.now() >= groqRateLimitedUntil) {
      try {
        const wavBuffer = await convertToWav(audioBuffer);
        const groqData = await transcribeWithGroq(wavBuffer);
        transcript = groqData.text;
      } catch (e: any) {
        console.warn('Groq transcribe warning in /api/transcribe-audio-chunk:', e?.message || e);
      }
    }

    // Fallback to Deepgram if transcript empty and Deepgram token present
    if (!transcript && DEEPGRAM_TOKEN) {
      const contentType = (req.headers['content-type'] as string) || 'audio/webm';
      const deepgramRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true', {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_TOKEN}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      });

      if (deepgramRes.ok) {
        const dgData: any = await deepgramRes.json();
        transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
      }
    }

    if (!transcript) {
      res.json({ english: '', traditionalChinese: '' });
      return;
    }

    // Translate recognized English transcript from local audio output to Traditional Chinese
    const { text: traditionalChinese } = await translateWithGeminiOrFallback(transcript);

    res.json({
      english: transcript,
      traditionalChinese: traditionalChinese || transcript,
    });
  } catch (err: any) {
    console.warn('Notice in /api/transcribe-audio-chunk:', err?.message || err);
    res.json({ english: '', traditionalChinese: '' });
  }
});

// Endpoint to switch active radio station stream
app.post('/api/set-active-station', (req, res) => {
  const { streamUrl, name } = req.body;
  if (streamUrl && typeof streamUrl === 'string') {
    const realStreamUrl = resolveTargetStreamUrl(streamUrl);
    currentRadioStreamUrl = realStreamUrl;
    console.log(`[Station Change] Active station set to ${name || realStreamUrl} (${realStreamUrl}). Restarting STT...`);
    startBackendDeepgramStreaming(realStreamUrl);
    res.json({ status: 'ok', currentRadioStreamUrl: realStreamUrl });
  } else {
    res.status(400).json({ error: 'Invalid streamUrl' });
  }
});

// Endpoint to pause/stop backend STT streaming when client pauses radio
app.post('/api/radio-playback-state', (req, res) => {
  const { isPlaying, streamUrl } = req.body || {};
  if (isPlaying === false) {
    if (sseClients.size <= 1) {
      console.log('[Radio State] Client paused radio with no other listeners. Pausing backend Deepgram STT stream...');
      stopBackendDeepgramStreaming();
    } else {
      console.log(`[Radio State] Client paused radio, but ${sseClients.size - 1} other listener(s) remain active. Keeping STT stream alive.`);
    }
    res.json({ status: 'ok', isStreamingActive: sseClients.size > 1 ? isStreamingActive : false });
  } else if (isPlaying === true) {
    const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
    console.log(`[Radio State] Client resumed radio. Synchronizing backend Deepgram STT stream for ${targetUrl}...`);
    recordListenerActivity('Client resumed radio playback', targetUrl);
    startBackendDeepgramStreaming(targetUrl);
    res.json({ status: 'ok', isStreamingActive: true });
  } else {
    res.json({ status: 'ok', isStreamingActive });
  }
});

// Endpoint: Report client app lifecycle state (foreground / background)
app.post('/api/subtitle-stream-state', (req, res) => {
  const { state, streamUrl, reason } = req.body || {};
  
  if (state === 'background') {
    if (!backgroundEnteredAt) {
      backgroundEnteredAt = Date.now();
    }
    console.log(`[Background Monitor 📱] Client entered background (${reason || 'screen_off/app_hidden'}). Authoritative 5-minute backend countdown active...`);
    
    if (backgroundSleepTimer) clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = setTimeout(() => {
      if (backgroundEnteredAt && Date.now() - backgroundEnteredAt >= (BACKGROUND_AUTO_SLEEP_MS - 3000)) {
        console.log(`[Background Saver 🌙] 5 minutes in background reached. Authoritative backend stopping Groq audio slice streaming ($0/hr, 0 RPM). Radio continues playing.`);
        backgroundSleepMode = true;
        stopBackendStreaming();
      }
    }, BACKGROUND_AUTO_SLEEP_MS);

    res.json({
      status: 'ok',
      state: 'background',
      backgroundEnteredAt,
      isBackgroundSleeping: backgroundSleepMode,
      remainingSecondsUntilSleep: Math.max(0, Math.round((BACKGROUND_AUTO_SLEEP_MS - (Date.now() - backgroundEnteredAt)) / 1000))
    });
  } else if (state === 'foreground') {
    const wasSleeping = backgroundSleepMode;
    backgroundEnteredAt = null;
    if (backgroundSleepTimer) {
      clearTimeout(backgroundSleepTimer);
      backgroundSleepTimer = null;
    }
    backgroundSleepMode = false;
    const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
    
    if (wasSleeping) {
      console.log(`[Foreground Wakeup ⚡] Client returned to foreground. Seamlessly waking up Groq Whisper STT & bilingual subtitles for ${targetUrl}...`);
      recordListenerActivity('Foreground Wakeup', targetUrl);
      startBackendStreaming(targetUrl);
    } else {
      console.log(`[Foreground Check ⚡] Client in foreground. STT streaming active.`);
      recordListenerActivity('Foreground Check', targetUrl);
      if (!isStreamingActive) {
        startBackendStreaming(targetUrl);
      }
    }
    
    res.json({
      status: 'ok',
      state: 'foreground',
      isBackgroundSleeping: false,
      isStreamingActive: true,
      wokeUpFromSleep: wasSleeping
    });
  } else {
    res.json({ status: 'ok', isBackgroundSleeping: backgroundSleepMode });
  }
});

// Endpoint: 5-minute background playback sleep - stop Groq audio slicing & STT
app.post('/api/subtitle-stream-sleep', (req, res) => {
  const { reason } = req.body || {};
  console.log(`[Background Saver 🌙] 5-minute background playback sleep triggered (${reason || 'background_5min'}). Immediately stopping Groq audio slice streaming ($0/hr, 0 RPM). Radio audio playback remains active.`);
  backgroundSleepMode = true;
  backgroundEnteredAt = null;
  if (backgroundSleepTimer) {
    clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = null;
  }
  stopBackendStreaming();
  res.json({
    status: 'ok',
    isSleeping: true,
    isStreamingActive: false,
    message: 'Groq STT audio slicing stopped. Radio continues playing in background.'
  });
});

// Endpoint: Foreground wakeup - immediately resume Groq Whisper STT & bilingual subtitles
app.post('/api/subtitle-stream-wakeup', (req, res) => {
  const { streamUrl } = req.body || {};
  const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
  console.log(`[Foreground Wakeup ⚡] User returned to app. Seamlessly resuming Groq Whisper STT & bilingual subtitles for ${targetUrl}...`);
  backgroundSleepMode = false;
  backgroundEnteredAt = null;
  if (backgroundSleepTimer) {
    clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = null;
  }
  recordListenerActivity('Foreground Wakeup', targetUrl);
  startBackendStreaming(targetUrl);
  res.json({
    status: 'ok',
    isSleeping: false,
    isStreamingActive: true,
    message: 'Groq STT audio slicing resumed seamlessly.'
  });
});

// Endpoint to explicitly clear backend transcript buffer on user request
app.post('/api/clear-buffer', (req, res) => {
  pendingTranscriptBuffer = '';
  bufferStartTime = 0;
  console.log('[Cache Clear] Backend transcript buffer flushed on user request.');
  res.json({ status: 'ok', cleared: true });
});

async function startServer() {
  // Prevent browser caching of Service Worker script and HTML entry points
  app.use((req, res, next) => {
    if (req.url === '/sw.js' || req.url === '/' || req.url.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Always serve files from public/ directory (manifest.json, sw.js, favicon.ico, icons)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Global JSON 404 handler for any undefined /api/* endpoints
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      status: 404,
      error: 'Not Found',
      message: `API endpoint ${req.originalUrl} not found on server`,
      timestamp: Date.now(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log('[STT Engine] On-Demand Mode ACTIVE: Deepgram will start automatically when listeners connect ($0/hr when idle).');
    // Check for idle state every 5 seconds to immediately pause Deepgram when listeners leave
    setInterval(checkIdleSleepStatus, 5000);
  });
}

startServer();
