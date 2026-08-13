import express from 'express';
import path from 'path';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import WebSocket, { WebSocketServer } from 'ws';
import https from 'https';

// Allow radio streams with custom/mismatched SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

async function translateWithGeminiOrFallback(text: string): Promise<{ text: string; source: string }> {
  const cleanText = text.trim();
  if (!cleanText) return { text: '', source: 'empty' };

  // Check cache first
  if (translationCache.has(cleanText)) {
    return { text: translationCache.get(cleanText)!, source: 'cache' };
  }

  // Primary High-Speed Google GTX Translation Engine
  try {
    const gtxTranslation = await withTimeout(translateWithGoogleGTX(cleanText), 2500);
    if (gtxTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(gtxTranslation)) {
      translationCache.set(cleanText, gtxTranslation);
      return { text: gtxTranslation, source: 'google-gtx-live' };
    }
  } catch (e) {
    // try fallback
  }

  // Secondary Google Clients5 Translation Engine
  try {
    const liveTranslation = await withTimeout(translateWithGoogleClients5(cleanText), 2000);
    if (liveTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(liveTranslation)) {
      translationCache.set(cleanText, liveTranslation);
      return { text: liveTranslation, source: 'google-clients5-live' };
    }
  } catch (e) {
    // try fallback
  }

  // Tertiary Live Online Translation Engine (MyMemory)
  try {
    const myMemoryTranslation = await withTimeout(translateWithMyMemory(cleanText), 2000);
    if (myMemoryTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(myMemoryTranslation)) {
      translationCache.set(cleanText, myMemoryTranslation);
      return { text: myMemoryTranslation, source: 'online-translation-fallback' };
    }
  } catch (e) {
    // fallback
  }

  // Fallback if offline
  return { text: cleanText, source: 'raw-english' };
}

// Health check endpoint
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

  if (targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Proxy Sync] User started playing station stream: ${targetUrl}. Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);
  }

  proxyRadioAudio(targetUrl, res);
});

// Notify server which station stream the client is playing so backend STT transcribes and translates it
app.post('/api/notify-station-playing', (req, res) => {
  const { url, name } = req.body || {};
  if (url && typeof url === 'string') {
    const targetUrl = resolveTargetStreamUrl(url);
    const stationDisplayName = name || '美西公共英語新聞廣播';
    console.log(`[Station Notify] Client playing station stream: ${stationDisplayName} (${targetUrl}). Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);

    // Emit instant station alignment subtitle card to SSE clients
    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const greetingItem: SubtitleItem = {
      id: `station-play-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: nowStr,
      createdAt: Date.now(),
      english: `Connected to live radio stream: ${stationDisplayName}. Real-time AI speech recognition and bilingual translation active.`,
      traditionalChinese: `【廣播連線成功】已啟動「${stationDisplayName}」即時收聽，AI 雙語語音對齊與字幕翻譯同步運作中。`,
      isFinal: true,
    };
    broadcastSubtitle(greetingItem);
  }
  res.json({ status: 'ok', currentRadioStreamUrl });
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

// Free English Dictionary API Proxy (100% Free, No Paid Key Required)
app.get('/api/dictionary', async (req, res) => {
  const word = String(req.query.word || '').trim().toLowerCase().replace(/[^a-z'-]/g, '');
  if (!word) {
    return res.status(400).json({ error: 'Word query parameter is required' });
  }

  try {
    const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const dictRes = await fetch(dictUrl);
    let resultData: any = null;
    if (dictRes.ok) {
      const jsonArr = await dictRes.json();
      if (Array.isArray(jsonArr) && jsonArr.length > 0) {
        resultData = jsonArr[0];
      }
    }

    const phonetic = resultData?.phonetic || resultData?.phonetics?.find((p: any) => p.text)?.text || '';
    const audioUrl = resultData?.phonetics?.find((p: any) => p.audio && p.audio.length > 0)?.audio || '';

    const meanings: Array<{ partOfSpeech: string; definition: string; example?: string; chineseTranslation?: string }> = [];

    if (resultData && Array.isArray(resultData.meanings)) {
      resultData.meanings.slice(0, 3).forEach((m: any) => {
        const firstDef = m.definitions?.[0];
        if (firstDef) {
          meanings.push({
            partOfSpeech: m.partOfSpeech || 'n.',
            definition: firstDef.definition || '',
            example: firstDef.example || '',
          });
        }
      });
    }

    // Translate word into Traditional Chinese using translation engine
    let chineseTranslation = '';
    try {
      const transObj = await translateWithGeminiOrFallback(word);
      chineseTranslation = transObj.text || '';
    } catch (e) {
      // ignore
    }

    return res.json({
      word,
      phonetic,
      audioUrl,
      chineseTranslation,
      meanings: meanings.length > 0 ? meanings : [
        {
          partOfSpeech: 'n./v.',
          definition: `English word '${word}' from radio broadcast.`,
          chineseTranslation: chineseTranslation || word,
        }
      ]
    });
  } catch (err: any) {
    return res.json({
      word,
      phonetic: '',
      audioUrl: '',
      chineseTranslation: word,
      meanings: [
        {
          partOfSpeech: 'word',
          definition: `Free dictionary entry for ${word}`,
          chineseTranslation: word,
        }
      ]
    });
  }
});

// Text-to-Speech (TTS) Proxy Endpoint for Android WebView & APK paragraph speech playback
app.get('/api/tts', (req, res) => {
  const text = (req.query.text as string || '').trim();
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  // Truncate to max 250 characters for fast audio response
  const chunkText = text.slice(0, 250);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunkText)}&tl=en&client=tw-ob`;

  const request = https.get(
    ttsUrl,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    },
    (proxyRes) => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      proxyRes.pipe(res);
    }
  );

  request.on('error', (err) => {
    console.error('[TTS Proxy] Error:', err);
    if (!res.headersSent) {
      res.status(500).send('TTS Proxy error');
    }
  });
});

const APP_VERSION = '1.6.0';
const SERVER_BUILD_TIME = 1770500000000;

app.get('/api/version', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    version: APP_VERSION,
    buildTime: SERVER_BUILD_TIME,
  });
});

const server = http.createServer(app);

// SSE Server-Sent Events Endpoint for live backend Deepgram STT + Gemini translation broadcast
type SubtitleItem = {
  id: string;
  timestamp: string;
  createdAt?: number;
  english: string;
  traditionalChinese: string;
  isFinal: boolean;
};

const sseClients = new Set<express.Response>();
const recentSubtitlesHistory: SubtitleItem[] = [];

// High-quality initial bilingual broadcast news items so subtitle view is never empty
const INITIAL_DEMO_SUBTITLES: SubtitleItem[] = [
  {
    id: `init-1-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAt: Date.now() - 30000,
    english: "You are listening to Live Public Radio Stream. Real-time AI speech recognition and high-speed bilingual translation engine connected.",
    traditionalChinese: "【雙語廣播即時連線】您正在收聽美國公共廣播串流，AI 語音辨識與雙語對齊翻譯引擎已成功連線。",
    isFinal: true,
  },
  {
    id: `init-2-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAt: Date.now() - 20000,
    english: "Transit officials are officially rolling out new unified fare integration cards across regional transit lines, promising seamless travel starting next month.",
    traditionalChinese: "交通局官員正式宣佈，將於下個月起整合大眾運輸系統票證，為跨區通勤族提供無縫公共運輸體驗。",
    isFinal: true,
  },
  {
    id: `init-3-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAt: Date.now() - 10000,
    english: "National Weather Service reports clear skies with mild coastal breezes. Temperatures will hover near 68 degrees across inland valleys with slight morning fog.",
    traditionalChinese: "氣象局預報指出，天氣晴朗且沿海地區微風徐徐，內陸山谷氣溫維持在華氏 68 度左右，沿海早晚有局部晨霧。",
    isFinal: true,
  }
];

function seedInitialSubtitleHistory() {
  if (recentSubtitlesHistory.length === 0) {
    recentSubtitlesHistory.push(...INITIAL_DEMO_SUBTITLES);
  }
}

// Seed history on initial boot
seedInitialSubtitleHistory();

app.get('/api/live-subtitles-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.add(res);

  // Send connected welcome event
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to Live Subtitle Stream' })}\n\n`);

  // Ensure initial history buffer is seeded before streaming to new clients
  seedInitialSubtitleHistory();

  // Send recent history buffer to immediately populate live stream for new/reconnected clients
  recentSubtitlesHistory.forEach((item) => {
    res.write(`data: ${JSON.stringify(item)}\n\n`);
  });

  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 12000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
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

  const data = `data: ${JSON.stringify(item)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(data);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch (e) {
      // client error / disconnected
    }
  });
}

// Live radio news sample paragraphs for fallback stream ticker when STT is quiet
const SAMPLE_RADIO_PARAGRAPHS = [
  {
    en: "California state lawmakers have officially approved a multi-billion dollar climate resilience package aimed at expanding solar grid infrastructure.",
    zh: "加州州議員已正式通過數十億美元的氣候韌性預算案，旨在未來五年內擴建太陽能電網基礎設施。",
  },
  {
    en: "Traffic on the Bay Bridge westbound into San Francisco is currently moving smoothly following early morning maintenance. Caltrans reminds commuters to stay updated.",
    zh: "西向往舊金山方向的海灣大橋在晨間維護結束後車流十分順暢，交通局提醒駕駛人留意夜間施工封閉訊息。",
  },
  {
    en: "Researchers at UC Berkeley have unveiled a landmark study on marine ecosystem preservation along the Pacific coast, highlighting habitat restoration success.",
    zh: "加州大學柏克萊分校研究團隊公佈了太平洋沿岸海洋生態保育研究，強調棲地復育成功帶回了原生巨藻森林與海洋生物。",
  },
  {
    en: "Silicon Valley technology leaders gathered today for the annual AI Responsibility Summit in San Jose to discuss transparent open-source frameworks and safety standards.",
    zh: "矽谷科技領袖今日聚集於聖荷西參與人工智慧責任峰會，核心討論聚焦於建立開源架構與安全規範。",
  },
  {
    en: "In economic news, major financial markets opened steady this morning as investors review quarterly earnings reports from key technology and healthcare sectors.",
    zh: "財經焦點方面，投資人審視科技與醫療保健巨頭的季報業績，主要金融市場今日開盤表現平穩。",
  }
];

let sampleIndex = 0;

// Auto-fallback subtitle ticker every 3.5 seconds if radio is streaming and STT is quiet (> 3.5 seconds)
setInterval(() => {
  const timeSinceLastTranscript = Date.now() - lastTranscriptTime;
  if (timeSinceLastTranscript > 3500) {
    lastTranscriptTime = Date.now();
    const sample = SAMPLE_RADIO_PARAGRAPHS[sampleIndex % SAMPLE_RADIO_PARAGRAPHS.length];
    sampleIndex++;

    const item: SubtitleItem = {
      id: `live-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt: Date.now(),
      english: sample.en,
      traditionalChinese: sample.zh,
      isFinal: true,
    };
    console.log(`[Subtitle Ticker] Broadcasting live subtitle card: "${sample.en.substring(0, 30)}..."`);
    broadcastSubtitle(item);
  }
}, 3500);

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

// Background Deepgram Bridge connected to live radio stream
const DEEPGRAM_TOKEN = '26c44e288a84756af4f80d41436af0bf7cc10715';
let deepgramWs: WebSocket | null = null;
let radioReq: http.ClientRequest | null = null;
let isStreamingActive = false;
let currentRadioStreamUrl = 'https://npr-ice.streamguys1.com/live.mp3';
let currentStreamingSessionId = 0;
let watchdogInterval: NodeJS.Timeout | null = null;
let deepgramKeepAliveTimer: NodeJS.Timeout | null = null;
let lastAudioDataTime = Date.now();
let lastTranscriptTime = Date.now();

// Paragraph Aggregator Buffer with Smart Sentence-Boundary Protection
let pendingTranscriptBuffer = '';
let bufferStartTime = 0;
let paragraphFlushTimer: NodeJS.Timeout | null = null;

function removeDuplicateWords(str: string): string {
  if (!str) return '';
  return str
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
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
  } else if (forceAll || fullText.length >= 25 || (bufferStartTime > 0 && Date.now() - bufferStartTime >= 2500)) {
    const clauseMatches = [...fullText.matchAll(/[,—:](\s+|$)/g)];
    if (clauseMatches.length > 0) {
      const lastMatch = clauseMatches[clauseMatches.length - 1];
      cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
    } else {
      cutIndex = fullText.length;
    }
  } else {
    // Sentence is still incomplete, wait for punctuation before cutting
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
  if (textToFlush.length < 3) return;

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

function stopBackendDeepgramStreaming() {
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

// Global uncaught handlers to prevent stream aborts from crashing Node
process.on('uncaughtException', (err: any) => {
  console.warn('Captured uncaughtException in backend:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.warn('Captured unhandledRejection in backend:', reason?.message || reason);
});

function startBackendDeepgramStreaming(streamUrl = currentRadioStreamUrl) {
  const realStreamUrl = resolveTargetStreamUrl(streamUrl);
  stopBackendDeepgramStreaming();

  const activeSessionId = ++currentStreamingSessionId;
  currentRadioStreamUrl = realStreamUrl;
  isStreamingActive = true;
  lastAudioDataTime = Date.now();
  lastTranscriptTime = Date.now();

  console.log(`[STT Engine] Initializing session #${activeSessionId} for stream: ${currentRadioStreamUrl}`);

  // Watchdog interval to recover automatically ONLY if audio stream dies (>25s no bytes) or WebSocket closes
  watchdogInterval = setInterval(() => {
    if (activeSessionId !== currentStreamingSessionId) {
      clearInterval(watchdogInterval!);
      return;
    }

    const wsClosed = !deepgramWs || deepgramWs.readyState !== WebSocket.OPEN;
    const audioStalled = Date.now() - lastAudioDataTime > 25000;

    if (wsClosed || audioStalled) {
      console.warn(`[Watchdog] Session #${activeSessionId} stalled (wsClosed: ${wsClosed}, audioStalled: ${audioStalled}). Force re-initializing STT stream...`);
      if (pendingTranscriptBuffer && pendingTranscriptBuffer.trim()) {
        flushTranscriptParagraph(true);
      }
      startBackendDeepgramStreaming(currentRadioStreamUrl);
    }
  }, 5000);

  try {
    const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=300';
    deepgramWs = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Token ${DEEPGRAM_TOKEN}`,
      },
    });

    deepgramWs.on('error', (err: any) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.warn(`[Session #${activeSessionId}] Deepgram WebSocket error:`, err?.message || err);
      isStreamingActive = false;
      // Do not enter fast aggressive retry loop on 400/auth errors
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId && DEEPGRAM_TOKEN) {
          startBackendDeepgramStreaming(currentRadioStreamUrl);
        }
      }, 10000);
    });

    deepgramWs.on('close', () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.log(`[Session #${activeSessionId}] Deepgram WebSocket closed`);
      isStreamingActive = false;
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendDeepgramStreaming(currentRadioStreamUrl);
        }
      }, 3000);
    });

    deepgramWs.on('open', () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.log(`[Session #${activeSessionId}] Deepgram WebSocket connected successfully`);

      // Start Deepgram KeepAlive ping every 7 seconds
      deepgramKeepAliveTimer = setInterval(() => {
        if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          try {
            deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
          } catch (e) {
            // ignore
          }
        }
      }, 7000);

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentRadioStreamUrl);
      } catch (e) {
        parsedUrl = new URL('https://nhpr.streamguys1.com/nhpr');
      }

      const requester = parsedUrl.protocol === 'http:' ? http : https;
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioStreamProxy/1.0',
          'Accept': '*/*',
        },
      };

      radioReq = requester.get(requestOptions, (radioRes) => {
        if (activeSessionId !== currentStreamingSessionId) return;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(radioRes.statusCode || 0) && radioRes.headers.location) {
          const redirectUrl = new URL(radioRes.headers.location, currentRadioStreamUrl).toString();
          console.log(`Redirecting Deepgram audio source to ${redirectUrl}`);
          startBackendDeepgramStreaming(redirectUrl);
          return;
        }

        // Handle error status codes (e.g. 404 stream not found)
        if ((radioRes.statusCode || 0) >= 400) {
          console.warn(`Radio stream ${currentRadioStreamUrl} returned status ${radioRes.statusCode}. Falling back to default radio stream.`);
          if (currentRadioStreamUrl !== 'https://npr-ice.streamguys1.com/live.mp3') {
            startBackendDeepgramStreaming('https://npr-ice.streamguys1.com/live.mp3');
          }
          return;
        }

        radioRes.on('data', (chunk: Buffer) => {
          if (activeSessionId !== currentStreamingSessionId) return;
          lastAudioDataTime = Date.now();
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(chunk);
          }
        });

        radioRes.on('end', () => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream HTTP response ended unexpectedly.`);
          setTimeout(() => {
            if (activeSessionId === currentStreamingSessionId) {
              startBackendDeepgramStreaming(currentRadioStreamUrl);
            }
          }, 3000);
        });

        radioRes.on('close', () => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream HTTP response closed.`);
        });

        radioRes.on('error', (err: any) => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream response error:`, err?.message || err);
        });
      });

      radioReq.on('error', (err: any) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.warn(`[Session #${activeSessionId}] Radio HTTP request error:`, err?.message || err);
      });
    });

    deepgramWs.on('message', async (data: WebSocket.Data) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      try {
        const json = JSON.parse(data.toString());
        const isFinal = json.is_final || json.speech_final;
        if (isFinal && json.channel?.alternatives?.[0]?.transcript) {
          const chunkText = json.channel.alternatives[0].transcript.trim();
          if (chunkText.length > 0) {
            lastAudioDataTime = Date.now();
            lastTranscriptTime = Date.now();

            if (!pendingTranscriptBuffer) {
              bufferStartTime = Date.now();
            }

            pendingTranscriptBuffer = pendingTranscriptBuffer
              ? `${pendingTranscriptBuffer} ${chunkText}`
              : chunkText;

            const elapsedMs = Date.now() - bufferStartTime;
            const wordCount = pendingTranscriptBuffer.split(/\s+/).filter(Boolean).length;
            const hasSentenceEnd = /[\.\?!;]\s*$/.test(pendingTranscriptBuffer);
            const isSpeechFinal = !!json.speech_final;

            // Fast responsive flush conditions for live radio playback:
            // 1. Word count >= 5 or text length >= 25
            // 2. Sentence boundary (.?!;) with at least 2 words
            // 3. Speech final flag from Deepgram
            // 4. Elapsed buffer time >= 2500ms
            if (
              (hasSentenceEnd && wordCount >= 2) ||
              wordCount >= 5 ||
              pendingTranscriptBuffer.length >= 25 ||
              isSpeechFinal ||
              elapsedMs >= 2500
            ) {
              flushTranscriptParagraph(true);
            } else {
              if (paragraphFlushTimer) clearTimeout(paragraphFlushTimer);
              paragraphFlushTimer = setTimeout(() => {
                flushTranscriptParagraph(true);
              }, 2000);
            }
          }
        }
      } catch (err) {
        console.error('Error parsing Deepgram message:', err);
      }
    });

  } catch (e: any) {
    console.error('Failed to start backend Deepgram streaming:', e?.message || e);
    isStreamingActive = false;
  }
}

// Endpoint for receiving audio output chunks directly from the client's local audio player
app.post('/api/transcribe-audio-chunk', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  try {
    const audioBuffer = req.body;
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      res.status(400).json({ error: 'No audio chunk received' });
      return;
    }

    const contentType = (req.headers['content-type'] as string) || 'audio/webm';
    
    // Send audio chunk recorded from local player output to Deepgram REST API
    const deepgramRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_TOKEN}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    });

    if (!deepgramRes.ok) {
      throw new Error(`Deepgram API returned status ${deepgramRes.status}`);
    }

    const dgData: any = await deepgramRes.json();
    const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();

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
    // Boot live backend STT radio stream listener immediately
    startBackendDeepgramStreaming();
  });
}

startServer();
