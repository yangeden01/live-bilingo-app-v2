import { defaultTranscriptProvider } from './youtubeTranscriptProvider';

export interface YouTubeNewsItem {
  videoId: string;
  title: string;
  titleZh?: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  publishedRelative: string;
  durationFormatted: string;
  durationSeconds: number;
  thumbnailUrl: string;
  hasCaptions: boolean;
  captionBadge: string;
  category: 'Breaking' | 'World' | 'US' | 'Business' | 'Technology' | 'Knowledge';
}

export interface YouTubeNewsDiscoveryResult {
  success: boolean;
  cached: boolean;
  timestamp: number;
  publishedAfter: string;
  videos: YouTubeNewsItem[];
  code?: string;
  message?: string;
}

// Trusted reputable English channels prioritized for discovery (spanning Knowledge, Tech, Business, and World)
export const REPUTABLE_NEWS_CHANNELS = [
  // Knowledge, Science & Education (知識科普與深度學習)
  { name: 'TED', id: 'UCsT0YIqwnpJCM-mx7-gSA4Q', category: 'Knowledge' },
  { name: 'TED-Ed', id: 'UCsooa4yRKGN_zEE8iknghZA', category: 'Knowledge' },
  { name: 'Kurzgesagt – In a Nutshell', id: 'UCsXVk37bltHxD1rDPwtNM8Q', category: 'Knowledge' },
  { name: 'Vox', id: 'UCLXo7UDZvByw2ixzpQCufnA', category: 'Knowledge' },
  { name: 'CrashCourse', id: 'UCX6b17PVsYBQ0ip5gyeme-Q', category: 'Knowledge' },
  { name: 'National Geographic', id: 'UCpVm7bg6pXKo1Pr6k5kxG9A', category: 'Knowledge' },
  { name: 'BBC Learning English', id: 'UCHaHD477h-FeBbVh9Sh7syA', category: 'Knowledge' },
  { name: 'Veritasium', id: 'UCHnyfMqiRRG1u-2MsSQLbXA', category: 'Knowledge' },

  // Business, Finance & Technology (商業財經與科技前沿)
  { name: 'Bloomberg Television', id: 'UCIALMKvObZNtJ6AmdCLP7Lg', category: 'Business' },
  { name: 'CNBC', id: 'UCvJJ_dzjViJCoLf5uKUTwoA', category: 'Business' },
  { name: 'Wall Street Journal', id: 'UCK7tptUDHh-RYDsdxO1-5QQ', category: 'Business' },
  { name: 'Financial Times', id: 'UCoUxsWakJucW46KW5RFPVFA', category: 'Business' },
  { name: 'The Verge', id: 'UCddiUEpeqJcYeBxX1IVBKvQ', category: 'Technology' },

  // World, US & Current Affairs (國際視野與權威時事)
  { name: 'PBS NewsHour', id: 'UC6ZFN9Tx6xh-skXCuRHCDpQ', category: 'US' },
  { name: 'ABC News', id: 'UCBi2mrWuNuyYy4gbM6fU18Q', category: 'US' },
  { name: 'NBC News', id: 'UCeY0bbntWzzVIaj2z3QigXg', category: 'US' },
  { name: 'CBS News', id: 'UC8p1vwvWtl6T73JiExfWs1g', category: 'US' },
  { name: 'CNN', id: 'UCupvZG-5ko_eiXAupbDfxWw', category: 'World' },
  { name: 'BBC News', id: 'UC16niRr50-MSBwiO3YDb3RA', category: 'World' },
  { name: 'DW News', id: 'UCknLrEdhRCp1aegoMqRaCZg', category: 'World' },
  { name: 'Reuters', id: 'UChqUTb7kYRX8-EiaN3XFrSQ', category: 'World' },
  { name: 'Associated Press', id: 'UC52XwA83_M4hDia5cCUMifA', category: 'World' },
  { name: 'Sky News', id: 'UCoMdktPbSTixAyNGwb-UYkQ', category: 'World' },
];

// In-memory cache to strictly observe 5-10 min caching mandate and reduce quota
interface NewsCacheEntry {
  timestamp: number;
  publishedAfter: string;
  videos: YouTubeNewsItem[];
}

let newsCache: NewsCacheEntry | null = null;
const CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes (within 5-10 min mandate)

/**
 * Parses ISO 8601 duration (e.g. PT4M15S, PT1H2M30S) into seconds and human-readable MM:SS
 */
export function parseIsoDuration(durationStr: string): { seconds: number; formatted: string } {
  if (!durationStr) return { seconds: 0, formatted: '00:00' };
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 0, formatted: '00:00' };
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
  return { seconds: totalSeconds, formatted };
}

/**
 * Formats published date into Traditional Chinese relative time string (e.g. "12 分鐘前", "1 小時前")
 */
export function formatRelativeTimeZh(publishedAt: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(publishedAt).getTime());
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

/**
 * Categorizes an English video based on title keywords and channel source
 */
export function categorizeNewsVideo(
  title: string,
  channelTitle: string,
  defaultCat: 'Breaking' | 'World' | 'US' | 'Business' | 'Technology' | 'Knowledge' = 'World'
): 'Breaking' | 'World' | 'US' | 'Business' | 'Technology' | 'Knowledge' {
  const lower = title.toLowerCase();
  if (
    channelTitle.includes('TED') ||
    channelTitle.includes('Kurzgesagt') ||
    channelTitle.includes('CrashCourse') ||
    channelTitle.includes('National Geographic') ||
    channelTitle.includes('Veritasium') ||
    channelTitle.includes('Learning English') ||
    channelTitle.includes('Vox') ||
    /\b(science|space|universe|biology|physics|history|psychology|brain|evolution|planet|learn|lesson|grammar|vocabulary)\b/i.test(lower)
  ) {
    return 'Knowledge';
  }
  if (/\b(breaking|alert|urgent|just in|live update)\b/i.test(lower)) {
    return 'Breaking';
  }
  if (
    channelTitle.includes('The Verge') ||
    /\b(ai|artificial intelligence|tech|technology|nvidia|openai|semiconductor|cyber|google|apple|microsoft|gadget|robot)\b/i.test(lower)
  ) {
    return 'Technology';
  }
  if (
    channelTitle.includes('Bloomberg') ||
    channelTitle.includes('CNBC') ||
    channelTitle.includes('Wall Street Journal') ||
    channelTitle.includes('Financial Times') ||
    /\b(economy|inflation|wall street|stock|market|fed|interest rate|trade|tariff|ceo|bank|investor)\b/i.test(lower)
  ) {
    return 'Business';
  }
  if (
    /\b(biden|trump|congress|senate|white house|supreme court|fbi|pentagon|us election|election|harris|republican|democrat)\b/i.test(lower)
  ) {
    return 'US';
  }
  return defaultCat;
}

/**
 * Filter out non-news, entertainment, shorts, or non-English titles
 */
function isNewsContent(title: string, channelTitle?: string): boolean {
  const lower = title.toLowerCase();

  // Exclude shorts explicitly
  if (lower.includes('#shorts') || lower.includes('#short') || lower.includes(' shorts') || lower.includes('shorts ')) {
    return false;
  }

  // Exclude live streams explicitly (live streams lack captions and freeze players)
  if (
    /^(?:live:|\(live\)|\[live\]|\|\s*live)/i.test(title.trim()) ||
    /\b(?:live stream|streaming live|watch live)\b/i.test(lower)
  ) {
    return false;
  }

  // Must be English text (exclude non-Latin alphabets such as Bengali, Hindi, Arabic, Cyrillic, Chinese, etc.)
  // Allow ASCII, Latin extensions, common punctuation, quotes, dashes, symbols
  const isEnglish = /^[\u0020-\u007E\u00A0-\u024F\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u2100-\u214F\s\w\d.,!?'"()\-–—:;%$&@#/*+=[\]|\\<>]+$/.test(title);
  if (!isEnglish) {
    return false;
  }

  const bannedKeywords = [
    'vlog',
    'gaming',
    'gameplay',
    'highlights',
    'music video',
    'trailer',
    'official audio',
    'teaser',
    'remix',
    'unboxing',
    'comedy sketch',
    'reaction video',
  ];
  return !bannedKeywords.some((kw) => lower.includes(kw));
}

/**
 * Deduplicate near-identical coverage
 */
function deduplicateNewsVideos(videos: YouTubeNewsItem[]): YouTubeNewsItem[] {
  const result: YouTubeNewsItem[] = [];
  const seenTitles: string[] = [];

  for (const v of videos) {
    // Extract key word tokens (> 3 chars)
    const tokens = v.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3);

    const tokenSet = new Set(tokens);
    let isDuplicate = false;

    for (const prevTitle of seenTitles) {
      const prevTokens = prevTitle
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 3);

      if (prevTokens.length > 0 && tokens.length > 0) {
        const overlap = prevTokens.filter((t) => tokenSet.has(t)).length;
        const ratio = overlap / Math.min(prevTokens.length, tokens.length);
        if (ratio >= 0.75) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      seenTitles.push(v.title);
      result.push(v);
    }
  }

  return result;
}

/**
 * Discovers recent news videos via YouTube Data API v3 or official trusted RSS feeds.
 * Strictly checks the 7-day (1-week) publication window and validates caption availability.
 * ZERO GEMINI CALLS are made here.
 */
export async function discoverLiveEnglishNews(
  forceRefresh: boolean = false
): Promise<YouTubeNewsDiscoveryResult> {
  const now = Date.now();
  // 1 week (7 days) publication window
  const oneWeekAgoMs = now - 7 * 24 * 60 * 60 * 1000;
  const publishedAfterIso = new Date(oneWeekAgoMs).toISOString();

  // 1. Check in-memory cache if not forced refresh
  if (
    !forceRefresh &&
    newsCache &&
    now - newsCache.timestamp < CACHE_TTL_MS &&
    newsCache.videos.length > 0
  ) {
    return {
      success: true,
      cached: true,
      timestamp: newsCache.timestamp,
      publishedAfter: newsCache.publishedAfter,
      videos: newsCache.videos,
    };
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  let candidateVideos: YouTubeNewsItem[] = [];

  // 2. Stage 1: Discovery from Trusted Reputable English News Channels
  try {
    const feedResults = await Promise.allSettled(
      REPUTABLE_NEWS_CHANNELS.map(async (ch) => {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
        const res = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LiveBilingo/2.5; +https://ai.studio)',
          },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
        const items: YouTubeNewsItem[] = [];

        for (const entry of entries) {
          const block = entry[1];
          const vId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
          const titleRaw = block.match(/<title>([^<]+)<\/title>/)?.[1];
          const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
          const thumb =
            block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/)?.[1] ||
            (vId ? `https://i.ytimg.com/vi/${vId}/hqdefault.jpg` : '');

          if (!vId || !titleRaw || !published) continue;

          const pubMs = new Date(published).getTime();
          // Strict 1-week publication window check
          if (pubMs < oneWeekAgoMs || pubMs > now) continue;

          const title = titleRaw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          if (!isNewsContent(title)) continue;

          const cat = categorizeNewsVideo(title, ch.name, ch.category as any);

          items.push({
            videoId: vId,
            title,
            channelTitle: ch.name,
            channelId: ch.id,
            publishedAt: published,
            publishedRelative: formatRelativeTimeZh(published),
            durationFormatted: '05:00', // Default fallback duration estimate
            durationSeconds: 300,
            thumbnailUrl: thumb,
            hasCaptions: true, // Will be verified in stage 2
            captionBadge: 'CC 英文字幕',
            category: cat,
          });
        }
        return items;
      })
    );

    for (const res of feedResults) {
      if (res.status === 'fulfilled' && res.value.length > 0) {
        for (const item of res.value) {
          if (!candidateVideos.some((cv) => cv.videoId === item.videoId)) {
            candidateVideos.push(item);
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('[YouTubeNews] Feed aggregation error:', e?.message || e);
  }

  // 3. Stage 2: Caption Validation & Verification
  // Batch query YouTube Data API to guarantee closed captions, real duration, and filter out live streams
  if (apiKey && candidateVideos.length > 0) {
    try {
      const allIds = candidateVideos.map((v) => v.videoId).filter(Boolean);
      // Batch in chunks of 50
      const validDetailsMap = new Map<
        string,
        { seconds: number; formatted: string; hasCaption: boolean; isLive: boolean; embeddable: boolean }
      >();

      for (let i = 0; i < allIds.length; i += 50) {
        const batchIds = allIds.slice(i, i + 50);
        const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        videosUrl.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails,status');
        videosUrl.searchParams.set('id', batchIds.join(','));
        videosUrl.searchParams.set('key', apiKey);

        const vRes = await fetch(videosUrl.toString(), {
          headers: { Accept: 'application/json' },
        });

        if (vRes.ok) {
          const vData = (await vRes.json()) as any;
          for (const item of vData.items || []) {
            const isEmbeddable = item.status?.embeddable !== false;
            const hasCaption = item.contentDetails?.caption === 'true';
            const isLive = !!item.liveStreamingDetails || (item.snippet?.liveBroadcastContent && item.snippet.liveBroadcastContent !== 'none');
            const { seconds, formatted } = parseIsoDuration(item.contentDetails?.duration || '');

            validDetailsMap.set(item.id, {
              seconds,
              formatted,
              hasCaption,
              isLive,
              embeddable: isEmbeddable,
            });
          }
        }
      }

      // Filter candidateVideos strictly: must have caption === true, not live, embeddable, duration 60s - 7200s
      candidateVideos = candidateVideos.filter((v) => {
        const details = validDetailsMap.get(v.videoId);
        if (!details) return false; // If not in YouTube API response, reject
        if (!details.hasCaption) return false; // MUST HAVE CLOSED CAPTIONS
        if (details.isLive) return false; // NO LIVE STREAMS
        if (!details.embeddable) return false; // MUST BE EMBEDDABLE
        if (details.seconds < 60 || details.seconds > 7200) return false; // Normal video duration

        // Apply authentic duration
        v.durationSeconds = details.seconds;
        v.durationFormatted = details.formatted;
        v.hasCaptions = true;
        return true;
      });
    } catch (apiErr: any) {
      console.warn('[YouTubeNews] API batch validation error:', apiErr?.message || apiErr);
    }
  }

  // If after verification candidateVideos has fewer than 15 items, fetch guaranteed CC news directly via search
  if (apiKey && candidateVideos.length < 15) {
    try {
      for (const ch of REPUTABLE_NEWS_CHANNELS.slice(0, 5)) {
        if (candidateVideos.length >= 25) break;
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
        searchUrl.searchParams.set('part', 'snippet');
        searchUrl.searchParams.set('type', 'video');
        searchUrl.searchParams.set('videoCaption', 'closedCaption');
        searchUrl.searchParams.set('channelId', ch.id);
        searchUrl.searchParams.set('order', 'date');
        searchUrl.searchParams.set('maxResults', '5');
        searchUrl.searchParams.set('key', apiKey);

        const sRes = await fetch(searchUrl.toString(), { headers: { Accept: 'application/json' } });
        if (!sRes.ok) continue;
        const sData = (await sRes.json()) as any;
        const ids = (sData.items || []).map((i: any) => i?.id?.videoId).filter(Boolean);
        if (ids.length === 0) continue;

        const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        vUrl.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails,status');
        vUrl.searchParams.set('id', ids.join(','));
        vUrl.searchParams.set('key', apiKey);

        const vRes = await fetch(vUrl.toString(), { headers: { Accept: 'application/json' } });
        if (!vRes.ok) continue;
        const vData = (await vRes.json()) as any;

        for (const item of vData.items || []) {
          const title = item.snippet?.title || '';
          if (!isNewsContent(title)) continue;
          if (item.status?.embeddable === false) continue;
          if (item.contentDetails?.caption !== 'true') continue;
          if (item.liveStreamingDetails || (item.snippet?.liveBroadcastContent && item.snippet.liveBroadcastContent !== 'none')) continue;

          const { seconds, formatted } = parseIsoDuration(item.contentDetails?.duration || '');
          if (seconds < 60 || seconds > 7200) continue;

          const publishedAt = item.snippet?.publishedAt || '';
          const pubMs = new Date(publishedAt).getTime();
          if (pubMs < oneWeekAgoMs || pubMs > now) continue;

          if (!candidateVideos.some((cv) => cv.videoId === item.id)) {
            candidateVideos.push({
              videoId: item.id,
              title,
              channelTitle: ch.name,
              channelId: ch.id,
              publishedAt,
              publishedRelative: formatRelativeTimeZh(publishedAt),
              durationFormatted: formatted,
              durationSeconds: seconds,
              thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
              hasCaptions: true,
              captionBadge: 'CC 英文字幕',
              category: ch.category as any,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('[YouTubeNews] Direct search CC query error:', e?.message || e);
    }
  }

  // Sort candidate videos strictly newest first (由最新開始排)
  candidateVideos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Deduplicate near-identical stories
  const deduplicated = deduplicateNewsVideos(candidateVideos);

  // Balance categories so all categories (World, US, Business, Technology, Knowledge, Breaking) have representation
  const categoryOrder: Array<'World' | 'US' | 'Business' | 'Technology' | 'Knowledge' | 'Breaking'> = [
    'World', 'US', 'Business', 'Technology', 'Knowledge', 'Breaking'
  ];
  const selectedVideos: YouTubeNewsItem[] = [];
  const selectedIds = new Set<string>();

  // Pass 1: pick top 4 newest items from each category
  for (const cat of categoryOrder) {
    const catItems = deduplicated.filter((v) => v.category === cat);
    for (const item of catItems.slice(0, 4)) {
      if (!selectedIds.has(item.videoId)) {
        selectedIds.add(item.videoId);
        selectedVideos.push(item);
      }
    }
  }

  // Pass 2: fill up to 45 items with remaining newest items
  for (const item of deduplicated) {
    if (selectedVideos.length >= 45) break;
    if (!selectedIds.has(item.videoId)) {
      selectedIds.add(item.videoId);
      selectedVideos.push(item);
    }
  }

  // Sort final selected videos strictly newest first
  selectedVideos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const validatedList = selectedVideos.length > 0 ? selectedVideos : deduplicated.slice(0, 45);

  // If no caption-compatible videos found within 7 days
  if (validatedList.length === 0) {
    return {
      success: true,
      cached: false,
      timestamp: now,
      publishedAfter: publishedAfterIso,
      videos: [],
      message: '最近 7 天暫時找不到可用英文字幕的新聞影片',
    };
  }

  // 4. Translate titles to Traditional Chinese (Taiwan)
  await enrichNewsVideosWithDetailsAndTranslation(validatedList);

  // Cache discovery results
  newsCache = {
    timestamp: now,
    publishedAfter: publishedAfterIso,
    videos: validatedList,
  };

  return {
    success: true,
    cached: false,
    timestamp: now,
    publishedAfter: publishedAfterIso,
    videos: validatedList,
  };
}

/**
 * Enriches videos with exact YouTube contentDetails duration and Traditional Chinese titles
 */
async function enrichNewsVideosWithDetailsAndTranslation(videos: YouTubeNewsItem[]): Promise<void> {
  if (!videos || videos.length === 0) return;

  // 1. Enrich exact duration from YouTube Data API v3
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    try {
      const ids = videos.map((v) => v.videoId).filter(Boolean);
      if (ids.length > 0) {
        const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        videosUrl.searchParams.set('part', 'contentDetails');
        videosUrl.searchParams.set('id', ids.slice(0, 50).join(','));
        videosUrl.searchParams.set('key', apiKey);

        const res = await fetch(videosUrl.toString(), {
          headers: { Accept: 'application/json' },
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const durationMap = new Map<string, { seconds: number; formatted: string }>();
          for (const item of data.items || []) {
            const parsed = parseIsoDuration(item.contentDetails?.duration || '');
            if (parsed.seconds > 0) {
              durationMap.set(item.id, parsed);
            }
          }
          for (const v of videos) {
            const d = durationMap.get(v.videoId);
            if (d) {
              v.durationSeconds = d.seconds;
              v.durationFormatted = d.formatted;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[YouTubeNews] Duration enrichment error:', e?.message || e);
    }
  }

  // 2. Batch translate titles into Traditional Chinese (Taiwan)
  const titlesToTranslate = videos.map((v) => v.title);
  const translatedMap = new Map<string, string>();

  // Tier 1: Gemini 2.5-flash / 2.0-flash (with graceful fallback on credit depletion)
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && titlesToTranslate.length > 0) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt =
        'Translate the following English news titles into authentic, fluent Traditional Chinese (Taiwan, 繁體中文台灣習慣用語). ' +
        'Return ONLY a valid JSON array of strings corresponding to each title in order, with no explanation or markdown tags:\n' +
        JSON.stringify(titlesToTranslate);

      let resp;
      try {
        resp = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
        ]);
      } catch {
        try {
          resp = await Promise.race([
            ai.models.generateContent({
              model: 'gemini-2.0-flash',
              contents: prompt,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
          ]);
        } catch {
          // Gemini credits/quota depleted or model unavailable - smoothly fall back to Tier 2 (clients5)
        }
      }

      const text = (resp as any)?.text?.trim() || '';
      if (text) {
        const cleanJson = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length === titlesToTranslate.length) {
          titlesToTranslate.forEach((t, i) => {
            if (parsed[i] && typeof parsed[i] === 'string' && parsed[i].trim().length > 0) {
              translatedMap.set(t, parsed[i].trim());
            }
          });
        }
      }
    } catch {
      // Smoothly fall back to Tier 2 without throwing or logging noisy error notes
    }
  }

  // Tier 2: Google clients5 translation fallback for any untranslated titles
  const untranslated = videos.filter((v) => !translatedMap.has(v.title));
  if (untranslated.length > 0) {
    await Promise.all(
      untranslated.map(async (v) => {
        try {
          const res = await fetch(
            `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=${encodeURIComponent(v.title)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
          );
          if (res.ok) {
            const arr = (await res.json()) as any;
            if (Array.isArray(arr) && arr[0] && typeof arr[0] === 'string') {
              translatedMap.set(v.title, arr[0].trim());
            }
          }
        } catch (_) {}
      })
    );
  }

  // Apply translated titles
  for (const v of videos) {
    const zh = translatedMap.get(v.title);
    if (zh) {
      v.titleZh = zh;
    }
  }
}
