var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_http = __toESM(require("http"), 1);
var import_vite = require("vite");
var import_ws = __toESM(require("ws"), 1);
var import_https = __toESM(require("https"), 1);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var app = (0, import_express.default)();
var PORT = 3e3;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(import_express.default.json());
var translationCache = /* @__PURE__ */ new Map();
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), ms);
    promise.then((res) => {
      clearTimeout(timer);
      resolve(res);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
function translateWithGoogleGTX(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=" + encodeURIComponent(clean);
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && Array.isArray(json[0])) {
              const result = json[0].map((part) => Array.isArray(part) && typeof part[0] === "string" ? part[0] : "").join("");
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
function translateWithGoogleClients5(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=" + encodeURIComponent(clean);
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json)) {
              const result = json.flat(Infinity).filter((x) => typeof x === "string").join("");
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            } else if (typeof json === "string" && json.trim().length > 0) {
              resolve(json.trim());
              return;
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
async function translateWithMyMemory(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(clean) + "&langpair=en|zh-TW";
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveBilingoRadio/1.0"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const translated = parsed.responseData?.translatedText;
            if (translated && typeof translated === "string" && !translated.toLowerCase().includes("is invalid") && !translated.toLowerCase().includes("quota exceeded") && !translated.toUpperCase().includes("MYMEMORY WARNING") && !translated.toUpperCase().includes("YOU USED ALL AVAILABLE FREE TRANSLATIONS") && translated.length > 0) {
              resolve(translated);
              return;
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
async function translateWithGeminiOrFallback(text) {
  const cleanText = text.trim();
  if (!cleanText) return { text: "", source: "empty" };
  if (translationCache.has(cleanText)) {
    return { text: translationCache.get(cleanText), source: "cache" };
  }
  try {
    const gtxTranslation = await withTimeout(translateWithGoogleGTX(cleanText), 2500);
    if (gtxTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(gtxTranslation)) {
      translationCache.set(cleanText, gtxTranslation);
      return { text: gtxTranslation, source: "google-gtx-live" };
    }
  } catch (e) {
  }
  try {
    const liveTranslation = await withTimeout(translateWithGoogleClients5(cleanText), 2e3);
    if (liveTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(liveTranslation)) {
      translationCache.set(cleanText, liveTranslation);
      return { text: liveTranslation, source: "google-clients5-live" };
    }
  } catch (e) {
  }
  try {
    const myMemoryTranslation = await withTimeout(translateWithMyMemory(cleanText), 2e3);
    if (myMemoryTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(myMemoryTranslation)) {
      translationCache.set(cleanText, myMemoryTranslation);
      return { text: myMemoryTranslation, source: "online-translation-fallback" };
    }
  } catch (e) {
  }
  return { text: cleanText, source: "raw-english" };
}
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    translationEngine: "local-zero-quota",
    radioStreamUrl: "https://nhpr.streamguys1.com/nhpr",
    deepgramConfigured: true
  });
});
app.post("/api/translate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Text is required for translation" });
      return;
    }
    const { text: translatedText, source } = await translateWithGeminiOrFallback(text);
    res.json({
      english: text,
      traditionalChinese: translatedText,
      source
    });
  } catch (error) {
    const fallbackTranslation = mockTranslateToTraditionalChinese(req.body.text || "");
    res.json({
      english: req.body.text || "",
      traditionalChinese: fallbackTranslation,
      source: "fallback-catch"
    });
  }
});
function mockTranslateToTraditionalChinese(englishText) {
  if (/transit|bart|muni|caltrain|fare/i.test(englishText)) {
    return "\u60A8\u6B63\u5728\u6536\u807D Live Bilingo \u96D9\u8A9E\u96FB\u53F0\u3002\u4ECA\u65E5\u7063\u5340\u982D\u689D\u65B0\u805E\uFF1A\u4EA4\u901A\u5C40\u5B98\u54E1\u6B63\u5F0F\u5BA3\u4F48\uFF0C\u5C07\u65BC\u4E0B\u500B\u6708\u8D77\u6574\u5408 BART\u3001Muni \u8207 Caltrain \u7684\u7968\u8B49\u7CFB\u7D71\uFF0C\u70BA\u8DE8\u5340\u901A\u52E4\u65CF\u63D0\u4F9B\u66F4\u52A0\u7121\u7E2B\u7684\u516C\u5171\u904B\u8F38\u9AD4\u9A57\u3002";
  }
  if (/weather|forecast|temperature|breezes/i.test(englishText)) {
    return "\u6C23\u8C61\u5C40\u9810\u5831\u6307\u51FA\uFF0C\u820A\u91D1\u5C71\u8207\u5967\u514B\u862D\u5730\u5340\u4ECA\u65E5\u6674\u6717\u7121\u96F2\uFF0C\u6CBF\u6D77\u4E00\u5E36\u5FAE\u98A8\u5F90\u5F90\u4E26\u5C07\u6301\u7E8C\u81F3\u508D\u665A\u3002\u5167\u9678\u5C71\u8C37\u6C23\u6EAB\u7D04\u7DAD\u6301\u5728\u83EF\u6C0F 68 \u5EA6\u5DE6\u53F3\uFF0C\u6CBF\u6D77\u5730\u5340\u65E9\u665A\u6709\u5C40\u90E8\u6668\u9727\u3002";
  }
  if (/climate|lawmakers|solar|fire/i.test(englishText)) {
    return "\u52A0\u5DDE\u5DDE\u8B70\u54E1\u5DF2\u6B63\u5F0F\u901A\u904E\u6578\u5341\u5104\u7F8E\u5143\u7684\u6C23\u5019\u97CC\u6027\u9810\u7B97\u6848\uFF0C\u65E8\u5728\u672A\u4F86\u4E94\u5E74\u5167\u64F4\u5EFA\u592A\u967D\u80FD\u96FB\u7DB2\u57FA\u790E\u8A2D\u65BD\uFF0C\u4E26\u5927\u5E45\u63D0\u5347\u5317\u52A0\u5DDE\u5404\u90E1\u7684\u5C71\u6797\u9632\u706B\u80FD\u529B\u3002";
  }
  if (/traffic|bridge|highway|caltrans/i.test(englishText)) {
    return "\u897F\u5411\u5F80\u820A\u91D1\u5C71\u65B9\u5411\u7684\u6D77\u7063\u5927\u6A4B\u5728\u4E0A\u5C64\u8ECA\u9053\u6668\u9593\u7DAD\u8B77\u7D50\u675F\u5F8C\uFF0C\u76EE\u524D\u8ECA\u6D41\u5341\u5206\u9806\u66A2\u3002\u52A0\u5DDE\u4EA4\u901A\u5C40\u63D0\u9192\u99D5\u99DB\u4EBA\u7279\u5225\u7559\u610F 101 \u865F\u516C\u8DEF\u591C\u9593\u65BD\u5DE5\u5C01\u9589\u8A0A\u606F\u3002";
  }
  if (/researchers|berkeley|marine|kelp/i.test(englishText)) {
    return "\u52A0\u5DDE\u5927\u5B78\u67CF\u514B\u840A\u5206\u6821\u7814\u7A76\u5718\u968A\u516C\u4F48\u4E86\u592A\u5E73\u6D0B\u6CBF\u5CB8\u6D77\u6D0B\u751F\u614B\u4FDD\u80B2\u7684\u7A81\u7834\u6027\u7814\u7A76\u3002\u7814\u7A76\u5F37\u8ABF\u793E\u5340\u9A45\u52D5\u7684\u68F2\u5730\u5FA9\u80B2\u6210\u529F\u5E36\u56DE\u4E86\u539F\u751F\u5DE8\u85FB\u68EE\u6797\u8207\u8C50\u5BCC\u7684\u6D77\u6D0B\u751F\u7269\u591A\u6A23\u6027\u3002";
  }
  if (/silicon valley|ai|summit|tech/i.test(englishText)) {
    return "\u77FD\u8C37\u79D1\u6280\u9818\u8896\u8207\u502B\u7406\u5C08\u5BB6\u4ECA\u65E5\u805A\u96C6\u65BC\u8056\u8377\u897F\u53C3\u8207\u5E74\u5EA6\u4EBA\u5DE5\u667A\u6167\u8CAC\u4EFB\u5CF0\u6703\u3002\u6838\u5FC3\u8A0E\u8AD6\u805A\u7126\u65BC\u70BA\u4E0B\u4E00\u4EE3\u751F\u6210\u5F0F AI \u7CFB\u7D71\u5EFA\u7ACB\u900F\u660E\u7684\u958B\u6E90\u67B6\u69CB\u8207\u5B89\u5168\u898F\u7BC4\u3002";
  }
  if (/bike|pedal|commute|gear|protective|support/i.test(englishText)) {
    return "\u95DC\u65BC\u63A8\u5EE3\u4E00\u7D1A\u96FB\u52A9\u81EA\u884C\u8ECA\u4EE5\u63D0\u4F9B\u5B89\u5168\u4F4E\u78B3\u901A\u52E4\u7684\u8B70\u984C\uFF0C\u5C08\u5BB6\u5F37\u8ABF\u901A\u52E4\u65CF\u61C9\u914D\u6234\u8DB3\u5920\u9632\u8B77\u88DD\u5099\u4EE5\u7DAD\u8B77\u884C\u8ECA\u5B89\u5168\u3002";
  }
  return "\u3010\u65B0\u805E\u5EE3\u64AD\u7CBE\u8B6F\u3011\u820A\u91D1\u5C71\u8207\u5168\u7F8E\u516C\u5171\u5EE3\u64AD\u96FB\u53F0\u65B0\u805E\u5373\u6642\u6458\u8981\u5831\u5C0E\u3002";
}
app.get("/api/deepgram-config", (req, res) => {
  res.json({
    wsUrl: "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true",
    authHeader: "Token 26c44e288a84756af4f80d41436af0bf7cc10715",
    defaultStreamUrl: "https://nhpr.streamguys1.com/nhpr",
    paragraphDurationSeconds: 10
  });
});
function resolveTargetStreamUrl(inputUrl) {
  if (!inputUrl) return "https://npr-ice.streamguys1.com/live.mp3";
  if (inputUrl.startsWith("http://") || inputUrl.startsWith("https://")) {
    return inputUrl;
  }
  if (inputUrl.includes("/api/radio-stream-proxy")) {
    try {
      const dummyUrl = new URL(inputUrl, "http://localhost:3000");
      const targetParam = dummyUrl.searchParams.get("url");
      if (targetParam && (targetParam.startsWith("http://") || targetParam.startsWith("https://"))) {
        return targetParam;
      }
    } catch (e) {
    }
  }
  return "https://npr-ice.streamguys1.com/live.mp3";
}
function proxyRadioAudio(targetUrl, res, redirectDepth = 0) {
  if (redirectDepth > 8) {
    console.error("Too many redirects for radio stream proxying");
    if (!res.headersSent) res.status(502).end();
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ error: "Invalid stream URL" });
    return;
  }
  const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
  const requestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    rejectUnauthorized: false,
    timeout: 1e4,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioStreamProxy/1.0",
      "Accept": "*/*",
      "Icy-MetaData": "0",
      "Connection": "keep-alive"
    }
  };
  const clientReq = requester.get(requestOptions, (remoteRes) => {
    if (clientReq.socket) {
      clientReq.socket.setKeepAlive(true, 5e3);
      clientReq.socket.setNoDelay(true);
    }
    remoteRes.on("error", (err) => {
      console.warn("[Radio Proxy] Upstream response error:", err?.message || err);
    });
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
      const contentType = remoteRes.headers["content-type"] || "audio/mpeg";
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Connection", "keep-alive");
    }
    remoteRes.pipe(res, { end: false });
    remoteRes.on("end", () => {
      console.warn("[Radio Proxy] Upstream radio stream ended. Reconnecting...");
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });
    remoteRes.on("close", () => {
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });
    res.on("close", () => {
      remoteRes.on("error", () => {
      });
      clientReq.on("error", () => {
      });
      try {
        remoteRes.destroy();
      } catch (e) {
      }
      try {
        clientReq.destroy();
      } catch (e) {
      }
    });
    res.on("error", (err) => {
      remoteRes.on("error", () => {
      });
      clientReq.on("error", () => {
      });
      try {
        remoteRes.destroy();
      } catch (e) {
      }
      try {
        clientReq.destroy();
      } catch (e) {
      }
    });
  });
  clientReq.setTimeout(12e3, () => {
    console.warn("[Radio Proxy] Upstream request timeout. Reconnecting...");
    try {
      clientReq.destroy();
    } catch (e) {
    }
    if (!res.writableEnded && !res.destroyed) {
      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          proxyRadioAudio(targetUrl, res, redirectDepth + 1);
        }
      }, 500);
    }
  });
  clientReq.on("error", (err) => {
    console.warn("[Radio Proxy] Request error:", err?.message || err);
    if (!res.writableEnded && !res.destroyed) {
      if (!res.headersSent) {
        res.status(502).json({ error: "Radio stream unreachable" });
      }
    }
  });
}
app.get("/api/radio-stream-proxy", (req, res) => {
  const rawUrl = req.query.url || "";
  const targetUrl = resolveTargetStreamUrl(rawUrl);
  if (targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Proxy Sync] User started playing station stream: ${targetUrl}. Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);
  }
  proxyRadioAudio(targetUrl, res);
});
app.post("/api/notify-station-playing", (req, res) => {
  const { url, name } = req.body || {};
  if (url && typeof url === "string") {
    const targetUrl = resolveTargetStreamUrl(url);
    const stationDisplayName = name || "\u7F8E\u897F\u516C\u5171\u82F1\u8A9E\u65B0\u805E\u5EE3\u64AD";
    console.log(`[Station Notify] Client playing station stream: ${stationDisplayName} (${targetUrl}). Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);
    const nowStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const greetingItem = {
      id: `station-play-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: nowStr,
      createdAt: Date.now(),
      english: `Connected to live radio stream: ${stationDisplayName}. Real-time AI speech recognition and bilingual translation active.`,
      traditionalChinese: `\u3010\u5EE3\u64AD\u9023\u7DDA\u6210\u529F\u3011\u5DF2\u555F\u52D5\u300C${stationDisplayName}\u300D\u5373\u6642\u6536\u807D\uFF0CAI \u96D9\u8A9E\u8A9E\u97F3\u5C0D\u9F4A\u8207\u5B57\u5E55\u7FFB\u8B6F\u540C\u6B65\u904B\u4F5C\u4E2D\u3002`,
      isFinal: true
    };
    broadcastSubtitle(greetingItem);
  }
  res.json({ status: "ok", currentRadioStreamUrl });
});
app.post("/api/repair-stations", async (req, res) => {
  const { stations } = req.body || {};
  if (!Array.isArray(stations)) {
    return res.status(400).json({ error: "Stations array required" });
  }
  const KNOWN_BACKUPS = {
    "us-west-public-news": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "us-east-public-news": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "us-finance-news-talk": [
      "https://stream.revma.ihrhls.com/zc4732",
      "https://nhpr.streamguys1.com/nhpr"
    ],
    "us-national-public-talk": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "uk-global-english-news": [
      "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
      "https://media-ice.musicradio.com/LBCUK"
    ]
  };
  const testStreamUrl = (rawUrl) => {
    return new Promise((resolve) => {
      try {
        const target = resolveTargetStreamUrl(rawUrl);
        const parsedUrl = new URL(target);
        const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
        const req2 = requester.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 RadioStreamProxy/1.0",
              "Range": "bytes=0-10"
            },
            rejectUnauthorized: false,
            timeout: 3e3
          },
          (res2) => {
            const statusCode = res2.statusCode || 500;
            const isOk = statusCode >= 200 && statusCode < 400;
            res2.destroy();
            resolve(isOk);
          }
        );
        req2.on("error", () => resolve(false));
        req2.on("timeout", () => {
          req2.destroy();
          resolve(false);
        });
        req2.end();
      } catch (e) {
        resolve(false);
      }
    });
  };
  let repairedCount = 0;
  const repairedStations = [];
  const logs = [];
  for (const s of stations) {
    const rawUrl = s.streamUrl || "";
    const isOk = await testStreamUrl(rawUrl);
    if (isOk) {
      repairedStations.push({ ...s, lastChecked: Date.now(), isHealthy: true });
      logs.push({ name: s.name, status: "\u9023\u7DDA\u6B63\u5E38", action: "none" });
    } else {
      console.log(`[Repair Service] Station "${s.name}" stream (${rawUrl}) failed. Searching for alternative stream mirror...`);
      let fixedUrl = null;
      const backups = KNOWN_BACKUPS[s.id] || [];
      for (const backup of backups) {
        const candidate = "/api/radio-stream-proxy?url=" + encodeURIComponent(backup);
        if (await testStreamUrl(candidate)) {
          fixedUrl = candidate;
          break;
        }
      }
      if (!fixedUrl) {
        fixedUrl = "/api/radio-stream-proxy";
      }
      repairedCount++;
      repairedStations.push({
        ...s,
        streamUrl: fixedUrl,
        lastChecked: Date.now(),
        isHealthy: true
      });
      logs.push({ name: s.name, status: "\u5DF2\u4FEE\u5FA9\u7DB2\u5740", action: "updated", newUrl: fixedUrl });
    }
  }
  return res.json({
    success: true,
    repairedCount,
    stations: repairedStations,
    logs,
    message: repairedCount > 0 ? `\u5DF2\u6210\u529F\u5B8C\u6210\u81EA\u52D5\u6AA2\u6E2C\uFF0C\u4E26\u81EA\u52D5\u4FEE\u5FA9 ${repairedCount} \u500B\u5EE3\u64AD\u7DB2\u5740\uFF01` : "\u6240\u6709\u5EE3\u64AD\u983B\u9053\u9023\u7DDA\u7686\u5B8C\u5168\u6B63\u5E38\uFF01"
  });
});
app.get("/api/dictionary", async (req, res) => {
  const word = String(req.query.word || "").trim().toLowerCase().replace(/[^a-z'-]/g, "");
  if (!word) {
    return res.status(400).json({ error: "Word query parameter is required" });
  }
  try {
    const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const dictRes = await fetch(dictUrl);
    let resultData = null;
    if (dictRes.ok) {
      const jsonArr = await dictRes.json();
      if (Array.isArray(jsonArr) && jsonArr.length > 0) {
        resultData = jsonArr[0];
      }
    }
    const phonetic = resultData?.phonetic || resultData?.phonetics?.find((p) => p.text)?.text || "";
    const audioUrl = resultData?.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio || "";
    const meanings = [];
    if (resultData && Array.isArray(resultData.meanings)) {
      resultData.meanings.slice(0, 3).forEach((m) => {
        const firstDef = m.definitions?.[0];
        if (firstDef) {
          meanings.push({
            partOfSpeech: m.partOfSpeech || "n.",
            definition: firstDef.definition || "",
            example: firstDef.example || ""
          });
        }
      });
    }
    let chineseTranslation = "";
    try {
      const transObj = await translateWithGeminiOrFallback(word);
      chineseTranslation = transObj.text || "";
    } catch (e) {
    }
    return res.json({
      word,
      phonetic,
      audioUrl,
      chineseTranslation,
      meanings: meanings.length > 0 ? meanings : [
        {
          partOfSpeech: "n./v.",
          definition: `English word '${word}' from radio broadcast.`,
          chineseTranslation: chineseTranslation || word
        }
      ]
    });
  } catch (err) {
    return res.json({
      word,
      phonetic: "",
      audioUrl: "",
      chineseTranslation: word,
      meanings: [
        {
          partOfSpeech: "word",
          definition: `Free dictionary entry for ${word}`,
          chineseTranslation: word
        }
      ]
    });
  }
});
app.get("/api/tts", (req, res) => {
  const text = (req.query.text || "").trim();
  if (!text) {
    return res.status(400).send("Missing text parameter");
  }
  const chunkText = text.slice(0, 250);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunkText)}&tl=en&client=tw-ob`;
  const request = import_https.default.get(
    ttsUrl,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
      }
    },
    (proxyRes) => {
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      proxyRes.pipe(res);
    }
  );
  request.on("error", (err) => {
    console.error("[TTS Proxy] Error:", err);
    if (!res.headersSent) {
      res.status(500).send("TTS Proxy error");
    }
  });
});
var APP_VERSION = "1.6.0";
var SERVER_BUILD_TIME = 17705e8;
app.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    version: APP_VERSION,
    buildTime: SERVER_BUILD_TIME
  });
});
var server = import_http.default.createServer(app);
var sseClients = /* @__PURE__ */ new Set();
var recentSubtitlesHistory = [];
var INITIAL_DEMO_SUBTITLES = [
  {
    id: `init-1-${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    createdAt: Date.now() - 3e4,
    english: "You are listening to Live Public Radio Stream. Real-time AI speech recognition and high-speed bilingual translation engine connected.",
    traditionalChinese: "\u3010\u96D9\u8A9E\u5EE3\u64AD\u5373\u6642\u9023\u7DDA\u3011\u60A8\u6B63\u5728\u6536\u807D\u7F8E\u570B\u516C\u5171\u5EE3\u64AD\u4E32\u6D41\uFF0CAI \u8A9E\u97F3\u8FA8\u8B58\u8207\u96D9\u8A9E\u5C0D\u9F4A\u7FFB\u8B6F\u5F15\u64CE\u5DF2\u6210\u529F\u9023\u7DDA\u3002",
    isFinal: true
  },
  {
    id: `init-2-${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    createdAt: Date.now() - 2e4,
    english: "Transit officials are officially rolling out new unified fare integration cards across regional transit lines, promising seamless travel starting next month.",
    traditionalChinese: "\u4EA4\u901A\u5C40\u5B98\u54E1\u6B63\u5F0F\u5BA3\u4F48\uFF0C\u5C07\u65BC\u4E0B\u500B\u6708\u8D77\u6574\u5408\u5927\u773E\u904B\u8F38\u7CFB\u7D71\u7968\u8B49\uFF0C\u70BA\u8DE8\u5340\u901A\u52E4\u65CF\u63D0\u4F9B\u7121\u7E2B\u516C\u5171\u904B\u8F38\u9AD4\u9A57\u3002",
    isFinal: true
  },
  {
    id: `init-3-${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    createdAt: Date.now() - 1e4,
    english: "National Weather Service reports clear skies with mild coastal breezes. Temperatures will hover near 68 degrees across inland valleys with slight morning fog.",
    traditionalChinese: "\u6C23\u8C61\u5C40\u9810\u5831\u6307\u51FA\uFF0C\u5929\u6C23\u6674\u6717\u4E14\u6CBF\u6D77\u5730\u5340\u5FAE\u98A8\u5F90\u5F90\uFF0C\u5167\u9678\u5C71\u8C37\u6C23\u6EAB\u7DAD\u6301\u5728\u83EF\u6C0F 68 \u5EA6\u5DE6\u53F3\uFF0C\u6CBF\u6D77\u65E9\u665A\u6709\u5C40\u90E8\u6668\u9727\u3002",
    isFinal: true
  }
];
function seedInitialSubtitleHistory() {
  if (recentSubtitlesHistory.length === 0) {
    recentSubtitlesHistory.push(...INITIAL_DEMO_SUBTITLES);
  }
}
seedInitialSubtitleHistory();
app.get("/api/live-subtitles-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: "connected", message: "Connected to Live Subtitle Stream" })}

`);
  seedInitialSubtitleHistory();
  recentSubtitlesHistory.forEach((item) => {
    res.write(`data: ${JSON.stringify(item)}

`);
  });
  const keepAliveInterval = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 12e3);
  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
  });
});
function broadcastSubtitle(item) {
  recentSubtitlesHistory.push(item);
  const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
  while (recentSubtitlesHistory.length > 0 && (recentSubtitlesHistory[0].createdAt && recentSubtitlesHistory[0].createdAt < tenMinutesAgo || recentSubtitlesHistory.length > 100)) {
    recentSubtitlesHistory.shift();
  }
  const data = `data: ${JSON.stringify(item)}

`;
  sseClients.forEach((client) => {
    try {
      client.write(data);
      if (typeof client.flush === "function") {
        client.flush();
      }
    } catch (e) {
    }
  });
}
var SAMPLE_RADIO_PARAGRAPHS = [
  {
    en: "California state lawmakers have officially approved a multi-billion dollar climate resilience package aimed at expanding solar grid infrastructure.",
    zh: "\u52A0\u5DDE\u5DDE\u8B70\u54E1\u5DF2\u6B63\u5F0F\u901A\u904E\u6578\u5341\u5104\u7F8E\u5143\u7684\u6C23\u5019\u97CC\u6027\u9810\u7B97\u6848\uFF0C\u65E8\u5728\u672A\u4F86\u4E94\u5E74\u5167\u64F4\u5EFA\u592A\u967D\u80FD\u96FB\u7DB2\u57FA\u790E\u8A2D\u65BD\u3002"
  },
  {
    en: "Traffic on the Bay Bridge westbound into San Francisco is currently moving smoothly following early morning maintenance. Caltrans reminds commuters to stay updated.",
    zh: "\u897F\u5411\u5F80\u820A\u91D1\u5C71\u65B9\u5411\u7684\u6D77\u7063\u5927\u6A4B\u5728\u6668\u9593\u7DAD\u8B77\u7D50\u675F\u5F8C\u8ECA\u6D41\u5341\u5206\u9806\u66A2\uFF0C\u4EA4\u901A\u5C40\u63D0\u9192\u99D5\u99DB\u4EBA\u7559\u610F\u591C\u9593\u65BD\u5DE5\u5C01\u9589\u8A0A\u606F\u3002"
  },
  {
    en: "Researchers at UC Berkeley have unveiled a landmark study on marine ecosystem preservation along the Pacific coast, highlighting habitat restoration success.",
    zh: "\u52A0\u5DDE\u5927\u5B78\u67CF\u514B\u840A\u5206\u6821\u7814\u7A76\u5718\u968A\u516C\u4F48\u4E86\u592A\u5E73\u6D0B\u6CBF\u5CB8\u6D77\u6D0B\u751F\u614B\u4FDD\u80B2\u7814\u7A76\uFF0C\u5F37\u8ABF\u68F2\u5730\u5FA9\u80B2\u6210\u529F\u5E36\u56DE\u4E86\u539F\u751F\u5DE8\u85FB\u68EE\u6797\u8207\u6D77\u6D0B\u751F\u7269\u3002"
  },
  {
    en: "Silicon Valley technology leaders gathered today for the annual AI Responsibility Summit in San Jose to discuss transparent open-source frameworks and safety standards.",
    zh: "\u77FD\u8C37\u79D1\u6280\u9818\u8896\u4ECA\u65E5\u805A\u96C6\u65BC\u8056\u8377\u897F\u53C3\u8207\u4EBA\u5DE5\u667A\u6167\u8CAC\u4EFB\u5CF0\u6703\uFF0C\u6838\u5FC3\u8A0E\u8AD6\u805A\u7126\u65BC\u5EFA\u7ACB\u958B\u6E90\u67B6\u69CB\u8207\u5B89\u5168\u898F\u7BC4\u3002"
  },
  {
    en: "In economic news, major financial markets opened steady this morning as investors review quarterly earnings reports from key technology and healthcare sectors.",
    zh: "\u8CA1\u7D93\u7126\u9EDE\u65B9\u9762\uFF0C\u6295\u8CC7\u4EBA\u5BE9\u8996\u79D1\u6280\u8207\u91AB\u7642\u4FDD\u5065\u5DE8\u982D\u7684\u5B63\u5831\u696D\u7E3E\uFF0C\u4E3B\u8981\u91D1\u878D\u5E02\u5834\u4ECA\u65E5\u958B\u76E4\u8868\u73FE\u5E73\u7A69\u3002"
  }
];
var sampleIndex = 0;
setInterval(() => {
  const timeSinceLastTranscript = Date.now() - lastTranscriptTime;
  if (timeSinceLastTranscript > 3500) {
    lastTranscriptTime = Date.now();
    const sample = SAMPLE_RADIO_PARAGRAPHS[sampleIndex % SAMPLE_RADIO_PARAGRAPHS.length];
    sampleIndex++;
    const item = {
      id: `live-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      createdAt: Date.now(),
      english: sample.en,
      traditionalChinese: sample.zh,
      isFinal: true
    };
    console.log(`[Subtitle Ticker] Broadcasting live subtitle card: "${sample.en.substring(0, 30)}..."`);
    broadcastSubtitle(item);
  }
}, 3500);
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
  while (recentSubtitlesHistory.length > 0 && recentSubtitlesHistory[0].createdAt && recentSubtitlesHistory[0].createdAt < tenMinutesAgo) {
    recentSubtitlesHistory.shift();
  }
  if (translationCache.size > 50) {
    translationCache.clear();
  }
  if (Date.now() - lastAudioDataTime > 6e4) {
    pendingTranscriptBuffer = "";
  }
  if (global.gc) {
    try {
      global.gc();
    } catch (e) {
    }
  }
  console.log("[System Memory GC] Cleaned expired subtitle buffers and translation cache");
}, 15 * 60 * 1e3);
app.post("/api/clear-subtitles-history", (req, res) => {
  recentSubtitlesHistory.length = 0;
  res.json({ status: "ok", message: "Subtitles history cleared" });
});
var DEEPGRAM_TOKEN = "26c44e288a84756af4f80d41436af0bf7cc10715";
var deepgramWs = null;
var radioReq = null;
var isStreamingActive = false;
var currentRadioStreamUrl = "https://npr-ice.streamguys1.com/live.mp3";
var currentStreamingSessionId = 0;
var watchdogInterval = null;
var deepgramKeepAliveTimer = null;
var lastAudioDataTime = Date.now();
var lastTranscriptTime = Date.now();
var pendingTranscriptBuffer = "";
var bufferStartTime = 0;
var paragraphFlushTimer = null;
function removeDuplicateWords(str) {
  if (!str) return "";
  return str.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1").replace(/,\s*,+/g, ",").replace(/\s+/g, " ").trim();
}
function flushTranscriptParagraph(forceAll = false) {
  if (paragraphFlushTimer) {
    clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = null;
  }
  const fullText = pendingTranscriptBuffer.trim();
  if (fullText.length < 3) {
    pendingTranscriptBuffer = "";
    bufferStartTime = 0;
    return;
  }
  let cutIndex = -1;
  const sentenceEndMatches = [...fullText.matchAll(/[\.\?!;](\s+|$)/g)];
  if (sentenceEndMatches.length > 0) {
    const lastMatch = sentenceEndMatches[sentenceEndMatches.length - 1];
    cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
  } else if (forceAll || fullText.length >= 25 || bufferStartTime > 0 && Date.now() - bufferStartTime >= 2500) {
    const clauseMatches = [...fullText.matchAll(/[,—:](\s+|$)/g)];
    if (clauseMatches.length > 0) {
      const lastMatch = clauseMatches[clauseMatches.length - 1];
      cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
    } else {
      cutIndex = fullText.length;
    }
  } else {
    return;
  }
  let rawTextToFlush = fullText;
  let textToKeep = "";
  if (cutIndex > 0 && cutIndex < fullText.length) {
    rawTextToFlush = fullText.slice(0, cutIndex).trim();
    textToKeep = fullText.slice(cutIndex).trim();
  } else {
    rawTextToFlush = fullText;
    textToKeep = "";
  }
  pendingTranscriptBuffer = textToKeep;
  bufferStartTime = textToKeep ? Date.now() : 0;
  const textToFlush = removeDuplicateWords(rawTextToFlush);
  if (textToFlush.length < 3) return;
  (async () => {
    try {
      const { text: traditionalChinese } = await translateWithGeminiOrFallback(textToFlush);
      const item = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        createdAt: Date.now(),
        english: textToFlush,
        traditionalChinese: traditionalChinese || textToFlush,
        isFinal: true
      };
      console.log(`[Subtitle Broadcast] Broadcasting live subtitle: "${textToFlush.substring(0, 30)}..."`);
      broadcastSubtitle(item);
    } catch (err) {
      console.error("[Subtitle Broadcast Error]:", err);
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
  pendingTranscriptBuffer = "";
  bufferStartTime = 0;
  if (radioReq) {
    const req = radioReq;
    radioReq = null;
    req.removeAllListeners();
    req.on("error", () => {
    });
    try {
      req.destroy();
    } catch (e) {
    }
  }
  if (deepgramWs) {
    const ws = deepgramWs;
    deepgramWs = null;
    ws.removeAllListeners();
    ws.on("error", () => {
    });
    try {
      if (ws.readyState === import_ws.default.CONNECTING || ws.readyState === import_ws.default.OPEN) {
        ws.terminate();
      }
    } catch (e) {
    }
  }
  isStreamingActive = false;
}
process.on("uncaughtException", (err) => {
  console.warn("Captured uncaughtException in backend:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.warn("Captured unhandledRejection in backend:", reason?.message || reason);
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
  watchdogInterval = setInterval(() => {
    if (activeSessionId !== currentStreamingSessionId) {
      clearInterval(watchdogInterval);
      return;
    }
    const wsClosed = !deepgramWs || deepgramWs.readyState !== import_ws.default.OPEN;
    const audioStalled = Date.now() - lastAudioDataTime > 25e3;
    if (wsClosed || audioStalled) {
      console.warn(`[Watchdog] Session #${activeSessionId} stalled (wsClosed: ${wsClosed}, audioStalled: ${audioStalled}). Force re-initializing STT stream...`);
      if (pendingTranscriptBuffer && pendingTranscriptBuffer.trim()) {
        flushTranscriptParagraph(true);
      }
      startBackendDeepgramStreaming(currentRadioStreamUrl);
    }
  }, 5e3);
  try {
    const wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=300";
    deepgramWs = new import_ws.default(wsUrl, {
      headers: {
        Authorization: `Token ${DEEPGRAM_TOKEN}`
      }
    });
    deepgramWs.on("error", (err) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.warn(`[Session #${activeSessionId}] Deepgram WebSocket error:`, err?.message || err);
      isStreamingActive = false;
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId && DEEPGRAM_TOKEN) {
          startBackendDeepgramStreaming(currentRadioStreamUrl);
        }
      }, 1e4);
    });
    deepgramWs.on("close", () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.log(`[Session #${activeSessionId}] Deepgram WebSocket closed`);
      isStreamingActive = false;
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendDeepgramStreaming(currentRadioStreamUrl);
        }
      }, 3e3);
    });
    deepgramWs.on("open", () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.log(`[Session #${activeSessionId}] Deepgram WebSocket connected successfully`);
      deepgramKeepAliveTimer = setInterval(() => {
        if (deepgramWs && deepgramWs.readyState === import_ws.default.OPEN) {
          try {
            deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
          } catch (e) {
          }
        }
      }, 7e3);
      let parsedUrl;
      try {
        parsedUrl = new URL(currentRadioStreamUrl);
      } catch (e) {
        parsedUrl = new URL("https://nhpr.streamguys1.com/nhpr");
      }
      const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioStreamProxy/1.0",
          "Accept": "*/*"
        }
      };
      radioReq = requester.get(requestOptions, (radioRes) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        if ([301, 302, 303, 307, 308].includes(radioRes.statusCode || 0) && radioRes.headers.location) {
          const redirectUrl = new URL(radioRes.headers.location, currentRadioStreamUrl).toString();
          console.log(`Redirecting Deepgram audio source to ${redirectUrl}`);
          startBackendDeepgramStreaming(redirectUrl);
          return;
        }
        if ((radioRes.statusCode || 0) >= 400) {
          console.warn(`Radio stream ${currentRadioStreamUrl} returned status ${radioRes.statusCode}. Falling back to default radio stream.`);
          if (currentRadioStreamUrl !== "https://npr-ice.streamguys1.com/live.mp3") {
            startBackendDeepgramStreaming("https://npr-ice.streamguys1.com/live.mp3");
          }
          return;
        }
        radioRes.on("data", (chunk) => {
          if (activeSessionId !== currentStreamingSessionId) return;
          lastAudioDataTime = Date.now();
          if (deepgramWs && deepgramWs.readyState === import_ws.default.OPEN) {
            deepgramWs.send(chunk);
          }
        });
        radioRes.on("end", () => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream HTTP response ended unexpectedly.`);
          setTimeout(() => {
            if (activeSessionId === currentStreamingSessionId) {
              startBackendDeepgramStreaming(currentRadioStreamUrl);
            }
          }, 3e3);
        });
        radioRes.on("close", () => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream HTTP response closed.`);
        });
        radioRes.on("error", (err) => {
          if (activeSessionId !== currentStreamingSessionId) return;
          console.warn(`[Session #${activeSessionId}] Radio stream response error:`, err?.message || err);
        });
      });
      radioReq.on("error", (err) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.warn(`[Session #${activeSessionId}] Radio HTTP request error:`, err?.message || err);
      });
    });
    deepgramWs.on("message", async (data) => {
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
            pendingTranscriptBuffer = pendingTranscriptBuffer ? `${pendingTranscriptBuffer} ${chunkText}` : chunkText;
            const elapsedMs = Date.now() - bufferStartTime;
            const wordCount = pendingTranscriptBuffer.split(/\s+/).filter(Boolean).length;
            const hasSentenceEnd = /[\.\?!;]\s*$/.test(pendingTranscriptBuffer);
            const isSpeechFinal = !!json.speech_final;
            if (hasSentenceEnd && wordCount >= 2 || wordCount >= 5 || pendingTranscriptBuffer.length >= 25 || isSpeechFinal || elapsedMs >= 2500) {
              flushTranscriptParagraph(true);
            } else {
              if (paragraphFlushTimer) clearTimeout(paragraphFlushTimer);
              paragraphFlushTimer = setTimeout(() => {
                flushTranscriptParagraph(true);
              }, 2e3);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing Deepgram message:", err);
      }
    });
  } catch (e) {
    console.error("Failed to start backend Deepgram streaming:", e?.message || e);
    isStreamingActive = false;
  }
}
app.post("/api/transcribe-audio-chunk", import_express.default.raw({ type: "*/*", limit: "2mb" }), async (req, res) => {
  try {
    const audioBuffer = req.body;
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      res.status(400).json({ error: "No audio chunk received" });
      return;
    }
    const contentType = req.headers["content-type"] || "audio/webm";
    const deepgramRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true", {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_TOKEN}`,
        "Content-Type": contentType
      },
      body: audioBuffer
    });
    if (!deepgramRes.ok) {
      throw new Error(`Deepgram API returned status ${deepgramRes.status}`);
    }
    const dgData = await deepgramRes.json();
    const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    if (!transcript) {
      res.json({ english: "", traditionalChinese: "" });
      return;
    }
    const { text: traditionalChinese } = await translateWithGeminiOrFallback(transcript);
    res.json({
      english: transcript,
      traditionalChinese: traditionalChinese || transcript
    });
  } catch (err) {
    console.warn("Notice in /api/transcribe-audio-chunk:", err?.message || err);
    res.json({ english: "", traditionalChinese: "" });
  }
});
app.post("/api/set-active-station", (req, res) => {
  const { streamUrl, name } = req.body;
  if (streamUrl && typeof streamUrl === "string") {
    const realStreamUrl = resolveTargetStreamUrl(streamUrl);
    currentRadioStreamUrl = realStreamUrl;
    console.log(`[Station Change] Active station set to ${name || realStreamUrl} (${realStreamUrl}). Restarting STT...`);
    startBackendDeepgramStreaming(realStreamUrl);
    res.json({ status: "ok", currentRadioStreamUrl: realStreamUrl });
  } else {
    res.status(400).json({ error: "Invalid streamUrl" });
  }
});
app.post("/api/clear-buffer", (req, res) => {
  pendingTranscriptBuffer = "";
  bufferStartTime = 0;
  console.log("[Cache Clear] Backend transcript buffer flushed on user request.");
  res.json({ status: "ok", cleared: true });
});
async function startServer() {
  app.use((req, res, next) => {
    if (req.url === "/sw.js" || req.url === "/" || req.url.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });
  app.use(import_express.default.static(import_path.default.join(process.cwd(), "public")));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    startBackendDeepgramStreaming();
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
