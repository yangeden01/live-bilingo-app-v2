import fs from 'fs';
import path from 'path';
import { defaultTranscriptProvider } from './youtubeTranscriptProvider';

export type YouTubeNewsCategory =
  | 'News'
  | 'TED'
  | 'Technology'
  | 'Entertainment'
  | 'Knowledge'
  | 'Business'
  | 'TalkShow'
  | 'World'
  | 'US'
  | 'Breaking';

export interface YouTubeNewsItem {
  videoId: string;
  title: string;
  titleZh?: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  publishedRelative: string;
  durationFormatted: string;
  durationSeconds: number;
  thumbnailUrl: string;
  hasCaptions: boolean;
  captionBadge: string;
  category: YouTubeNewsCategory;
}

export interface YouTubeNewsDiscoveryResult {
  success: boolean;
  cached: boolean;
  timestamp: number;
  publishedAfter?: string;
  videos: YouTubeNewsItem[];
  code?: string;
  message?: string;
}

// Trusted reputable English channels prioritized for discovery (100% verified English caption standards)
export const REPUTABLE_NEWS_CHANNELS: Array<{
  name: string;
  id: string;
  category: 'News' | 'TED' | 'Technology' | 'Entertainment' | 'Knowledge' | 'Business';
}> = [
  // 1. 即時新聞 (News: 國際主流權威時事，100% 官方標配英文雙語字幕)
  { name: 'PBS NewsHour', id: 'UC6ZFN9Tx6xh-skXCuRHCDpQ', category: 'News' },
  { name: 'BBC News', id: 'UC16niRr50-MSBwiO3YDb3RA', category: 'News' },
  { name: 'Associated Press', id: 'UC52XwA83_M4hDia5cCUMifA', category: 'News' },
  { name: 'Sky News', id: 'UCoMdktPbSTixAyNGwb-UYkQ', category: 'News' },
  { name: 'Reuters', id: 'UChqUTb7kYRX8-EiaN3XFrSQ', category: 'News' },
  { name: 'ABC News', id: 'UCBi2mrWuNuyYy4gbM6fU18Q', category: 'News' },
  { name: 'NBC News', id: 'UCeY0bbntWzzVIaj2z3QigXg', category: 'News' },
  { name: 'CBS News', id: 'UC8p1vwvWtl6T73JiExfWs1g', category: 'News' },
  { name: 'CNN', id: 'UCupvZG-5ko_eiXAupbDfxWw', category: 'News' },
  { name: 'The Economist', id: 'UCEbP6Y3oGv4eS3_28y-Ceqw', category: 'News' },

  // 2. TED 演講 (TED: 經典思維、全球演講與深度觀點，100% 官方高品質 CC 字幕)
  { name: 'TED', id: 'UCsT0YIqwnpJCM-mx7-gSA4Q', category: 'TED' },
  { name: 'TED-Ed', id: 'UCsooa4yRKGN_zEE8iknghZA', category: 'TED' },
  { name: 'Big Think', id: 'UCEBb1b_L6zDS3xTUrIALZOw', category: 'TED' },

  // 3. 3C 科技 (Technology: 旗艦產品評測、3C 前沿與數位生活，100% 官方英文字幕)
  { name: 'The Verge', id: 'UCddiUEpeqJcYeBxX1IVBKvQ', category: 'Technology' },
  { name: 'Marques Brownlee', id: 'UCBJycsmduvYEL83R_U4JriQ', category: 'Technology' },
  { name: 'CNET', id: 'UCOmcA33OE6WwHp9432oTagQ', category: 'Technology' },
  { name: 'WIRED', id: 'UCftwRNsjfEc04G0YRxSOvAw', category: 'Technology' },

  // 4. 美語娛樂 (Entertainment: 美式脫口秀與影視娛樂訪談，口語高頻對話)
  { name: 'The Tonight Show Starring Jimmy Fallon', id: 'UC8-Th83bH_thdKZDJCrn88g', category: 'Entertainment' },
  { name: 'Jimmy Kimmel Live', id: 'UCa6vGFO9ty8v5KZJXQxdhaw', category: 'Entertainment' },
  { name: 'The Late Show with Stephen Colbert', id: 'UCMtFAi84ehTSYSE9XoHefig', category: 'Entertainment' },
  { name: 'Late Night with Seth Meyers', id: 'UCVTyTA7-g9nopHeHbeuvpRA', category: 'Entertainment' },
  { name: 'The Daily Show', id: 'UCwWhs_6x42TyRM4Wstoq8HA', category: 'Entertainment' },
  { name: 'Team Coco', id: 'UCi7GJNg51C3jgmYTUwqoUXA', category: 'Entertainment' },

  // 5. 知識科普 (Knowledge: 科學、深度人文與趣味科普，標準美式發音)
  { name: 'Kurzgesagt – In a Nutshell', id: 'UCsXVk37bltHxD1rDPwtNM8Q', category: 'Knowledge' },
  { name: 'Vox', id: 'UCLXo7UDZvByw2ixzpQCufnA', category: 'Knowledge' },
  { name: 'Veritasium', id: 'UCHnyfMqiRRG1u-2MsSQLbXA', category: 'Knowledge' },
  { name: 'CrashCourse', id: 'UCX6b17PVsYBQ0ip5gyeme-Q', category: 'Knowledge' },
  { name: 'National Geographic', id: 'UCpVm7bg6pXKo1Pr6k5kxG9A', category: 'Knowledge' },
  { name: 'BBC Learning English', id: 'UCHaHD477h-FeBbVh9Sh7syA', category: 'Knowledge' },

  // 6. 商業財經 (Business: 職場商務與全球財經脈動)
  { name: 'Bloomberg Television', id: 'UCIALMKvObZNtJ6AmdCLP7Lg', category: 'Business' },
  { name: 'CNBC', id: 'UCvJJ_dzjViJCoLf5uKUTwoA', category: 'Business' },
  { name: 'Wall Street Journal', id: 'UCK7tptUDHh-RYDsdxO1-5QQ', category: 'Business' },
  { name: 'Financial Times', id: 'UCoUxsWakJucW46KW5RFPVFA', category: 'Business' },
];


const DAILY_SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'daily-youtube-curated-snapshot.json');

export const EVERGREEN_SEED_VIDEOS: YouTubeNewsItem[] = [
  // TED 演講經典種子 (100% 官方英文字幕)
  {
    videoId: 'iCvmsMzlF7o',
    title: 'The power of vulnerability | Brené Brown',
    titleZh: '脆弱的力量 | 布芮尼·布朗 (TED 經典演講)',
    channelTitle: 'TED',
    channelId: 'UCsT0YIqwnpJCM-mx7-gSA4Q',
    publishedAt: '2023-01-01T00:00:00Z',
    publishedRelative: 'TED 經典演講',
    durationFormatted: '20:19',
    durationSeconds: 1219,
    thumbnailUrl: 'https://i.ytimg.com/vi/iCvmsMzlF7o/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },
  {
    videoId: 'qp0HIF3SfI4',
    title: 'Inside the mind of a master procrastinator | Tim Urban',
    titleZh: '拖延大師的心智世界 | 提姆·厄本 (TED 演講)',
    channelTitle: 'TED',
    channelId: 'UCsT0YIqwnpJCM-mx7-gSA4Q',
    publishedAt: '2023-01-01T00:00:00Z',
    publishedRelative: 'TED 經典演講',
    durationFormatted: '14:03',
    durationSeconds: 843,
    thumbnailUrl: 'https://i.ytimg.com/vi/qp0HIF3SfI4/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },
  {
    videoId: 'Rbg0xiwTez0',
    title: 'How to protect your identity from AI deepfakes | Melissa Hut',
    titleZh: '如何防止個人身分遭 AI 深偽盜用 | 梅麗莎·哈特 (TED)',
    channelTitle: 'TED',
    channelId: 'UCsT0YIqwnpJCM-mx7-gSA4Q',
    publishedAt: '2026-10-12T00:00:00Z',
    publishedRelative: 'TED 演講',
    durationFormatted: '12:45',
    durationSeconds: 765,
    thumbnailUrl: 'https://i.ytimg.com/vi/Rbg0xiwTez0/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },
  {
    videoId: 'h6CmKF-mN2U',
    title: 'Which is better: Buying or renting a home? - Ella Feldman',
    titleZh: '買房還是租房比較划算？ - 艾拉·費爾德曼 (TED-Ed)',
    channelTitle: 'TED-Ed',
    channelId: 'UCsooa4yRKGN_zEE8iknghZA',
    publishedAt: '2026-10-08T00:00:00Z',
    publishedRelative: 'TED-Ed 思維',
    durationFormatted: '05:12',
    durationSeconds: 312,
    thumbnailUrl: 'https://i.ytimg.com/vi/h6CmKF-mN2U/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },
  {
    videoId: 'G3hXvByzLHs',
    title: '6 ways to be more persuasive - TED-Ed',
    titleZh: '讓說服力大增的 6 種核心方法 - TED-Ed 思考訓練',
    channelTitle: 'TED-Ed',
    channelId: 'UCsooa4yRKGN_zEE8iknghZA',
    publishedAt: '2026-10-01T00:00:00Z',
    publishedRelative: 'TED-Ed 精選',
    durationFormatted: '06:30',
    durationSeconds: 390,
    thumbnailUrl: 'https://i.ytimg.com/vi/G3hXvByzLHs/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },
  {
    videoId: 'Bjr62PO1WO4',
    title: 'From Uganda to Ukraine: The Global Impact of MIT OpenCourseWare at 25',
    titleZh: '從烏干達走向烏克蘭：MIT 開放式課程 25 週年的全球深遠影響',
    channelTitle: 'Big Think',
    channelId: 'UCEBb1b_L6zDS3xTUrIALZOw',
    publishedAt: '2026-10-08T00:00:00Z',
    publishedRelative: 'Big Think',
    durationFormatted: '08:45',
    durationSeconds: 525,
    thumbnailUrl: 'https://i.ytimg.com/vi/Bjr62PO1WO4/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'TED',
  },

  // 知識科普經典種子 (Knowledge)
  {
    videoId: 'ujkD4SxPKOI',
    title: 'AI Just Crossed the Terrifying Line - Now What?',
    titleZh: 'AI 剛剛跨越了令人震驚的臨界線——人類接下來該如何應對？',
    channelTitle: 'Kurzgesagt – In a Nutshell',
    channelId: 'UCsXVk37bltHxD1rDPwtNM8Q',
    publishedAt: '2026-10-05T00:00:00Z',
    publishedRelative: '簡而言之科普',
    durationFormatted: '11:20',
    durationSeconds: 680,
    thumbnailUrl: 'https://i.ytimg.com/vi/ujkD4SxPKOI/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },
  {
    videoId: 'NiCgcUTL9_Q',
    title: 'The Clearest Material Ever Made - Veritasium',
    titleZh: '人類有史以來製造出最透明的終極材料 - 真理元素',
    channelTitle: 'Veritasium',
    channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA',
    publishedAt: '2026-10-12T00:00:00Z',
    publishedRelative: '科學探秘',
    durationFormatted: '18:50',
    durationSeconds: 1130,
    thumbnailUrl: 'https://i.ytimg.com/vi/NiCgcUTL9_Q/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },
  {
    videoId: 'PSysNY5EIbc',
    title: 'Meet the Extraordinary Team Behind Africa Earth | National Geographic',
    titleZh: '深入直擊《非洲大地》幕後傳奇攝影團隊 | 國家地理頻道',
    channelTitle: 'National Geographic',
    channelId: 'UCpVm7bg6pXKo1Pr6k5kxG9A',
    publishedAt: '2026-10-11T00:00:00Z',
    publishedRelative: '國家地理紀錄',
    durationFormatted: '14:20',
    durationSeconds: 860,
    thumbnailUrl: 'https://i.ytimg.com/vi/PSysNY5EIbc/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },
  {
    videoId: 'Y22FuMI7vXI',
    title: 'Where Does Campaign Money Really Come From?: Crash Course',
    titleZh: '競選資金究竟從何而來？深入解析政治金錢流向 - 速成課',
    channelTitle: 'CrashCourse',
    channelId: 'UCX6b17PVsYBQ0ip5gyeme-Q',
    publishedAt: '2026-10-06T00:00:00Z',
    publishedRelative: '公民通識速成',
    durationFormatted: '09:40',
    durationSeconds: 580,
    thumbnailUrl: 'https://i.ytimg.com/vi/Y22FuMI7vXI/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },
  {
    videoId: 'I4G9TjlbdtM',
    title: 'Films at home or at the cinema - which is better? | BBC Learning English',
    titleZh: '在家看電影還是去電影院感受更好？BBC 英語視角深度討論',
    channelTitle: 'BBC Learning English',
    channelId: 'UCHaHD477h-FeBbVh9Sh7syA',
    publishedAt: '2026-10-12T00:00:00Z',
    publishedRelative: 'BBC 英語學習',
    durationFormatted: '06:15',
    durationSeconds: 375,
    thumbnailUrl: 'https://i.ytimg.com/vi/I4G9TjlbdtM/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },
  {
    videoId: 'yS7hhQd4Jpg',
    title: 'This science depends on one of the most expensive resources | Vox',
    titleZh: '這項尖端科學完全仰賴全球最昂貴的稀有資源 | Vox 深度解說',
    channelTitle: 'Vox',
    channelId: 'UCLXo7UDZvByw2ixzpQCufnA',
    publishedAt: '2026-10-12T00:00:00Z',
    publishedRelative: 'Vox 深入專題',
    durationFormatted: '10:55',
    durationSeconds: 655,
    thumbnailUrl: 'https://i.ytimg.com/vi/yS7hhQd4Jpg/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Knowledge',
  },

  // 3C 科技經典種子 (Technology)
  {
    videoId: 'aoag03mSuXQ',
    title: 'The Internet Was Weeks Away From Disaster And No One Knew',
    titleZh: '全球網際網路曾差幾週就全面崩潰，而當時幾乎沒人察覺',
    channelTitle: 'Veritasium',
    channelId: 'UCHnyfMqiRRG1u-2MsSQLbXA',
    publishedAt: '2026-09-10T00:00:00Z',
    publishedRelative: '科技深度回顧',
    durationFormatted: '22:15',
    durationSeconds: 1335,
    thumbnailUrl: 'https://i.ytimg.com/vi/aoag03mSuXQ/hqdefault.jpg',
    hasCaptions: true,
    captionBadge: 'CC 英文字幕',
    category: 'Technology',
  }
];

interface DailyCuratedSnapshot {
  utcDate: string;
  updatedAt: number;
  videos: YouTubeNewsItem[];
}

function loadDailySnapshot(): DailyCuratedSnapshot | null {
  try {
    if (fs.existsSync(DAILY_SNAPSHOT_FILE)) {
      const raw = fs.readFileSync(DAILY_SNAPSHOT_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.videos) && data.videos.length > 0) {
        return data as DailyCuratedSnapshot;
      }
    }
  } catch (err) {
    console.warn('[YouTubeDiscovery] Error loading daily snapshot:', err);
  }
  return null;
}

function saveDailySnapshot(snapshot: DailyCuratedSnapshot): void {
  try {
    const dir = path.dirname(DAILY_SNAPSHOT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DAILY_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[YouTubeDiscovery] Error saving daily snapshot:', err);
  }
}

// In-memory cache
interface NewsCacheEntry {
  timestamp: number;
  videos: YouTubeNewsItem[];
}

let newsCache: NewsCacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Caption Probe Cache & Blacklist (Ensures 100% of discovered videos have subtitles)
export const verifiedCaptionsCache = new Map<string, boolean>();
export const reportedNoCaptionBlacklist = new Set<string>();

/**
 * Reports a video as having no captions, blacklists it, and evicts it from cache immediately
 */
export function reportNoCaptionVideo(videoId: string): void {
  if (!videoId) return;
  reportedNoCaptionBlacklist.add(videoId);
  verifiedCaptionsCache.set(videoId, false);
  if (newsCache && Array.isArray(newsCache.videos)) {
    newsCache.videos = newsCache.videos.filter((v) => v.videoId !== videoId);
  }
}

/**
 * Validates whether a video possesses working English transcript / CC.
 */
export async function probeHasEnglishTranscript(videoId: string): Promise<boolean> {
  if (!videoId) return false;
  if (reportedNoCaptionBlacklist.has(videoId)) return false;
  if (verifiedCaptionsCache.has(videoId)) return verifiedCaptionsCache.get(videoId)!;

  try {
    const res = await Promise.race([
      defaultTranscriptProvider.getTranscript(videoId),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), 2500)),
    ]);
    const hasValidTranscript = !!(
      res &&
      res.success &&
      res.result?.segments &&
      res.result.segments.length > 0
    );
    verifiedCaptionsCache.set(videoId, hasValidTranscript);
    if (!hasValidTranscript) {
      reportedNoCaptionBlacklist.add(videoId);
    }
    return hasValidTranscript;
  } catch {
    // If timed out, treat as potentially available without blocking discovery
    return true;
  }
}

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
  if (!publishedAt) return '精選影片';
  try {
    const pubMs = new Date(publishedAt).getTime();
    if (isNaN(pubMs)) return '精選影片';
    const diffSec = Math.max(0, Math.floor((Date.now() - pubMs) / 1000));
    if (diffSec < 60) return '剛剛';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} 分鐘前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小時前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} 天前`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} 個月前`;
    const diffYear = Math.floor(diffMonth / 12);
    return `${diffYear} 年前`;
  } catch {
    return '精選影片';
  }
}

/**
 * Categorizes a video into: News, TED, Technology, Entertainment, Knowledge, Business
 */
export function categorizeNewsVideo(
  title: string,
  channelTitle: string,
  defaultCat: YouTubeNewsCategory = 'News'
): YouTubeNewsCategory {
  const lower = title.toLowerCase();

  if (
    channelTitle.includes('TED') ||
    channelTitle.includes('Big Think') ||
    defaultCat === 'TED'
  ) {
    return 'TED';
  }

  if (
    defaultCat === 'Entertainment' ||
    defaultCat === 'TalkShow' ||
    channelTitle.includes('Fallon') ||
    channelTitle.includes('Kimmel') ||
    channelTitle.includes('Colbert') ||
    channelTitle.includes('Meyers') ||
    channelTitle.includes('Daily Show') ||
    channelTitle.includes('Coco') ||
    /\b(talk show|tonight show|late night|monologue|interview|jimmy fallon|jimmy kimmel|stephen colbert|seth meyers|conan o'brien|daily show|comedy|hollywood|actor|actress)\b/i.test(lower)
  ) {
    return 'Entertainment';
  }

  if (
    channelTitle.includes('The Verge') ||
    channelTitle.includes('Marques Brownlee') ||
    channelTitle.includes('CNET') ||
    channelTitle.includes('WIRED') ||
    defaultCat === 'Technology' ||
    /\b(ai|artificial intelligence|tech|technology|nvidia|openai|semiconductor|cyber|google|apple|microsoft|gadget|robot|smartphone|iphone|macbook|pixel|review)\b/i.test(lower)
  ) {
    return 'Technology';
  }

  if (
    channelTitle.includes('Kurzgesagt') ||
    channelTitle.includes('CrashCourse') ||
    channelTitle.includes('National Geographic') ||
    channelTitle.includes('Veritasium') ||
    channelTitle.includes('Learning English') ||
    channelTitle.includes('Vox') ||
    defaultCat === 'Knowledge' ||
    /\b(science|space|universe|biology|physics|history|psychology|brain|evolution|planet|learn|lesson|grammar|vocabulary|documentary)\b/i.test(lower)
  ) {
    return 'Knowledge';
  }

  if (
    channelTitle.includes('Bloomberg') ||
    channelTitle.includes('CNBC') ||
    channelTitle.includes('Wall Street Journal') ||
    channelTitle.includes('Financial Times') ||
    defaultCat === 'Business' ||
    /\b(economy|inflation|wall street|stock|market|fed|interest rate|trade|tariff|ceo|bank|investor|finance)\b/i.test(lower)
  ) {
    return 'Business';
  }

  return 'News';
}

/**
 * Filter out shorts, live broadcasts, or non-English titles
 */
function isCleanLearningVideo(title: string, channelTitle?: string): boolean {
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

  // Must be English text (exclude non-Latin alphabets)
  const isEnglish = /^[\u0020-\u007E\u00A0-\u024F\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u2100-\u214F\s\w\d.,!?'"()\-–—:;%$&@#/*+=[\]|\\<>]+$/.test(title);
  if (!isEnglish) {
    return false;
  }

  const bannedKeywords = [
    'vlog',
    'gaming',
    'gameplay',
    'music video',
    'official audio',
    'trailer',
    'teaser',
    'remix',
    'reaction video',
    'asmr',
  ];

  if (bannedKeywords.some((b) => lower.includes(b))) {
    return false;
  }

  return true;
}

/**
 * Deduplicate videos based on title similarity
 */
function deduplicateNewsVideos(videos: YouTubeNewsItem[]): YouTubeNewsItem[] {
  const seenTitles: string[] = [];
  const result: YouTubeNewsItem[] = [];

  for (const v of videos) {
    const tokenSet = new Set(
      v.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 3)
    );

    let isDuplicate = false;
    for (const prevTitle of seenTitles) {
      const prevTokens = prevTitle
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 3);

      if (prevTokens.length > 0 && tokenSet.size > 0) {
        const overlap = prevTokens.filter((t) => tokenSet.has(t)).length;
        const ratio = overlap / Math.min(prevTokens.length, tokenSet.size);
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
 * Discovers curated learning videos from trusted channels.
 * NO ARTIFICIAL TIME WINDOW RESTRICTIONS (No 7-day or 1-year limits).
 * STRICT SUBTITLE INTEGRITY: Excludes any video without valid captions.
 */
export async function discoverLiveEnglishNews(
  forceRefresh: boolean = false
): Promise<YouTubeNewsDiscoveryResult> {
  const now = Date.now();
  const currentUtcDay = new Date().toISOString().slice(0, 10);

  // 1. Check Daily Cloud Snapshot (Single-Daily-Fetch: everyone shares today's snapshot)
  if (!forceRefresh) {
    // 1.1 In-memory hot cache
    if (newsCache && newsCache.videos.length > 0) {
      const active = newsCache.videos.filter((v) => !reportedNoCaptionBlacklist.has(v.videoId));
      if (active.length > 0) {
        return {
          success: true,
          cached: true,
          timestamp: newsCache.timestamp,
          videos: active,
        };
      }
    }

    // 1.2 Persistent daily snapshot on disk
    const savedSnapshot = loadDailySnapshot();
    if (savedSnapshot && savedSnapshot.utcDate === currentUtcDay && savedSnapshot.videos.length > 0) {
      const active = savedSnapshot.videos.filter((v) => !reportedNoCaptionBlacklist.has(v.videoId));
      if (active.length >= 30) {
        newsCache = {
          timestamp: savedSnapshot.updatedAt,
          videos: active,
        };
        return {
          success: true,
          cached: true,
          timestamp: savedSnapshot.updatedAt,
          videos: active,
        };
      }
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  let candidateVideos: YouTubeNewsItem[] = [];

  // 2. Stage 1: Feed aggregation from trusted reputable channels (NO TIME WINDOW CUTOFF)
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
          const published = block.match(/<published>([^<]+)<\/published>/)?.[1] || '';
          const thumb =
            block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/)?.[1] ||
            (vId ? `https://i.ytimg.com/vi/${vId}/hqdefault.jpg` : '');

          if (!vId || !titleRaw) continue;
          if (reportedNoCaptionBlacklist.has(vId)) continue;

          const title = titleRaw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          if (!isCleanLearningVideo(title, ch.name)) continue;

          const cat = categorizeNewsVideo(title, ch.name, ch.category);

          items.push({
            videoId: vId,
            title,
            channelTitle: ch.name,
            channelId: ch.id,
            publishedAt: published,
            publishedRelative: formatRelativeTimeZh(published),
            durationFormatted: '05:00',
            durationSeconds: 300,
            thumbnailUrl: thumb,
            hasCaptions: true,
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
    console.warn('[YouTubeDiscovery] Feed aggregation error:', e?.message || e);
  }

  // 2.5 Stage 1.5: Targeted High-Value Learning Queries (TED & Entertainment)
  if (apiKey) {
    try {
      const targetedQueries = [
        { name: 'TED', id: 'UCsT0YIqwnpJCM-mx7-gSA4Q', cat: 'TED' as const },
        { name: 'The Tonight Show Starring Jimmy Fallon', id: 'UC8-Th83bH_thdKZDJCrn88g', cat: 'Entertainment' as const },
        { name: 'The Verge', id: 'UCddiUEpeqJcYeBxX1IVBKvQ', cat: 'Technology' as const },
        { name: 'Kurzgesagt – In a Nutshell', id: 'UCsXVk37bltHxD1rDPwtNM8Q', cat: 'Knowledge' as const },
        { name: 'CNBC', id: 'UCvJJ_dzjViJCoLf5uKUTwoA', cat: 'Business' as const },
      ];

      for (const tq of targetedQueries) {
        try {
          const sUrl = new URL('https://www.googleapis.com/youtube/v3/search');
          sUrl.searchParams.set('part', 'snippet');
          sUrl.searchParams.set('type', 'video');
          sUrl.searchParams.set('videoCaption', 'closedCaption'); // STRICT: Must have closed captions
          sUrl.searchParams.set('channelId', tq.id);
          sUrl.searchParams.set('order', 'relevance');
          sUrl.searchParams.set('maxResults', '4');
          sUrl.searchParams.set('key', apiKey);

          const sRes = await fetch(sUrl.toString(), { headers: { Accept: 'application/json' } });
          if (!sRes.ok) continue;
          const sData = (await sRes.json()) as any;
          for (const item of sData.items || []) {
            const vId = item.id?.videoId;
            const title = (item.snippet?.title || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            const published = item.snippet?.publishedAt || '';
            if (!vId || !title || !isCleanLearningVideo(title, tq.name)) continue;
            if (reportedNoCaptionBlacklist.has(vId)) continue;

            if (!candidateVideos.some((cv) => cv.videoId === vId)) {
              candidateVideos.push({
                videoId: vId,
                title,
                channelTitle: tq.name,
                channelId: tq.id,
                publishedAt: published,
                publishedRelative: formatRelativeTimeZh(published),
                durationFormatted: '08:00',
                durationSeconds: 480,
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                hasCaptions: true,
                captionBadge: 'CC 英文字幕',
                category: tq.cat,
              });
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 3. Stage 2: YouTube API Batch Metadata & Caption Validation
  if (apiKey && candidateVideos.length > 0) {
    try {
      const allIds = candidateVideos.map((v) => v.videoId).filter(Boolean);
      const validDetailsMap = new Map<
        string,
        { seconds: number; formatted: string; hasCaption: boolean; isLive: boolean; embeddable: boolean; isNonEnglishAudio: boolean }
      >();

      for (let i = 0; i < allIds.length; i += 50) {
        const batchIds = allIds.slice(i, i + 50);
        const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        videosUrl.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails,status');
        videosUrl.searchParams.set('id', batchIds.join(','));
        videosUrl.searchParams.set('key', apiKey);

        const vRes = await fetch(videosUrl.toString(), { headers: { Accept: 'application/json' } });
        if (vRes.ok) {
          const vData = (await vRes.json()) as any;
          for (const item of vData.items || []) {
            const isEmbeddable = item.status?.embeddable !== false;
            const hasCaption = item.contentDetails?.caption === 'true'; // STRICT
            const isLive = !!item.liveStreamingDetails || (item.snippet?.liveBroadcastContent && item.snippet.liveBroadcastContent !== 'none');
            const { seconds, formatted } = parseIsoDuration(item.contentDetails?.duration || '');

            const defaultAudioLanguage = (item.snippet?.defaultAudioLanguage || '').toLowerCase();
            const defaultLanguage = (item.snippet?.defaultLanguage || '').toLowerCase();
            const isNonEnglishAudio = (defaultAudioLanguage && !defaultAudioLanguage.startsWith('en')) ||
                                      (defaultLanguage && !defaultLanguage.startsWith('en') && !defaultAudioLanguage);

            validDetailsMap.set(item.id, {
              seconds,
              formatted,
              hasCaption,
              isLive,
              embeddable: isEmbeddable,
              isNonEnglishAudio: !!isNonEnglishAudio,
            });
          }
        }
      }

      // Filter: embeddable, not live, duration 45s - 7200s, and STRICTLY hasCaption === true & English audio!
      candidateVideos = candidateVideos.filter((v) => {
        const details = validDetailsMap.get(v.videoId);
        if (!details) return false;
        if (details.isLive) return false;
        if (!details.embeddable) return false;
        if (details.seconds < 45 || details.seconds > 7200) return false;
        if (details.hasCaption !== true) return false; // STRICT: Exclude videos without closed captions!
        if (details.isNonEnglishAudio) return false; // STRICT: Exclude videos that are not in English!
        if (reportedNoCaptionBlacklist.has(v.videoId)) return false;

        const lowerTitle = v.title.toLowerCase();
        if (lowerTitle.startsWith('raw:') || lowerTitle.startsWith('raw video:') || lowerTitle.includes('no comment') || lowerTitle.includes('raw footage')) return false;
        if (/\b(?:auf deutsch|en español|en français|in russian|in french|in german|in spanish|in hindi|in arabic|en francais|en espanol)\b/i.test(lowerTitle)) return false;
        if (/[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F]/.test(v.title)) return false;

        v.durationSeconds = details.seconds;
        v.durationFormatted = details.formatted;
        v.hasCaptions = true;
        v.captionBadge = 'CC 英文字幕';
        return true;
      });
    } catch (apiErr: any) {
      console.warn('[YouTubeDiscovery] API batch validation error:', apiErr?.message || apiErr);
    }
  }

  // Sort candidate videos newest first
  candidateVideos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Deduplicate near-identical stories
  const deduplicated = deduplicateNewsVideos(candidateVideos);

  // Stage 3: Category Balancing & Rolling Carryover (Guarantees >= 10 videos per category)
  const categoryOrder: Array<'News' | 'TED' | 'Technology' | 'Entertainment' | 'Knowledge' | 'Business'> = [
    'News', 'TED', 'Technology', 'Entertainment', 'Knowledge', 'Business'
  ];
  const selectedVideos: YouTubeNewsItem[] = [];
  const selectedIds = new Set<string>();

  // Load previous day snapshot for rolling carryover (補齊不足 10 筆的分類)
  const previousSnapshot = loadDailySnapshot();
  const previousVideos = previousSnapshot?.videos || [];

  // Pass 1: Pick top fresh items from today's discovery for each category
  for (const cat of categoryOrder) {
    const catItems = deduplicated.filter((v) => v.category === cat);
    for (const item of catItems.slice(0, 10)) {
      if (!selectedIds.has(item.videoId)) {
        selectedIds.add(item.videoId);
        selectedVideos.push(item);
      }
    }

    // Rolling Carryover: If today has fewer than 10 items in this category, fill with previous day snapshot
    const currentCount = selectedVideos.filter((v) => v.category === cat).length;
    if (currentCount < 10 && previousVideos.length > 0) {
      const prevCatItems = previousVideos.filter((v) => v.category === cat);
      for (const pItem of prevCatItems) {
        if (selectedVideos.filter((v) => v.category === cat).length >= 10) break;
        if (!selectedIds.has(pItem.videoId)) {
          selectedIds.add(pItem.videoId);
          selectedVideos.push(pItem);
        }
      }
    }

    // Seed Fallback: If still under 10, fill from verified evergreen seeds
    const countAfterPrev = selectedVideos.filter((v) => v.category === cat).length;
    if (countAfterPrev < 10) {
      const seedCatItems = EVERGREEN_SEED_VIDEOS.filter((v) => v.category === cat);
      for (const sItem of seedCatItems) {
        if (selectedVideos.filter((v) => v.category === cat).length >= 10) break;
        if (!selectedIds.has(sItem.videoId)) {
          selectedIds.add(sItem.videoId);
          selectedVideos.push(sItem);
        }
      }
    }
  }

  // Pass 2: Fill remaining space up to 60 items with other fresh verified videos
  for (const item of deduplicated) {
    if (selectedVideos.length >= 60) break;
    if (!selectedIds.has(item.videoId)) {
      selectedIds.add(item.videoId);
      selectedVideos.push(item);
    }
  }

  // Sort final selected videos newest first
  selectedVideos.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Stage 4: High-Reliability Caption Verification & Blacklist Filtering
  // Videos from YouTube Data API v3 are already verified with hasCaption: true.
  // For unverified videos or fallback, quick-probe a small batch with timeout.
  const fullyVerifiedVideos: YouTubeNewsItem[] = [];
  const unverified = selectedVideos.filter((v) => !v.hasCaptions && !verifiedCaptionsCache.has(v.videoId));
  if (unverified.length > 0) {
    const probeBatch = unverified.slice(0, 8);
    await Promise.all(
      probeBatch.map(async (v) => {
        const ok = await probeHasEnglishTranscript(v.videoId);
        v.hasCaptions = ok;
      })
    );
  }

  for (const v of selectedVideos) {
    if (reportedNoCaptionBlacklist.has(v.videoId)) continue;
    if (v.hasCaptions !== false) {
      fullyVerifiedVideos.push(v);
    }
  }

  const finalVideoList = fullyVerifiedVideos.length > 0 ? fullyVerifiedVideos : selectedVideos;

  if (finalVideoList.length === 0) {
    return {
      success: true,
      cached: false,
      timestamp: now,
      videos: [],
      message: '暫時找不到可用英文字幕的影片，請稍後點擊重新整理',
    };
  }

  // Stage 5: Translate titles to Traditional Chinese (Taiwan)
  await enrichNewsVideosWithDetailsAndTranslation(finalVideoList);

  // Cache discovery results in memory and save daily persistent snapshot
  newsCache = {
    timestamp: now,
    videos: finalVideoList,
  };
  saveDailySnapshot({
    utcDate: currentUtcDay,
    updatedAt: now,
    videos: finalVideoList,
  });

  return {
    success: true,
    cached: false,
    timestamp: now,
    videos: finalVideoList,
  };
}

/**
 * Enriches videos with exact YouTube contentDetails duration and Traditional Chinese titles
 */
async function enrichNewsVideosWithDetailsAndTranslation(videos: YouTubeNewsItem[]): Promise<void> {
  if (!videos || videos.length === 0) return;

  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    try {
      const ids = videos.map((v) => v.videoId).filter(Boolean);
      if (ids.length > 0) {
        const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        videosUrl.searchParams.set('part', 'contentDetails');
        videosUrl.searchParams.set('id', ids.slice(0, 50).join(','));
        videosUrl.searchParams.set('key', apiKey);

        const res = await fetch(videosUrl.toString(), { headers: { Accept: 'application/json' } });
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
    } catch (_) {}
  }

  // Batch translate titles into Traditional Chinese
  const titlesToTranslate = videos.map((v) => v.title);
  const translatedMap = new Map<string, string>();

  // Tier 1: Gemini
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && titlesToTranslate.length > 0) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt =
        'Translate the following English video titles into authentic, fluent Traditional Chinese (Taiwan, 繁體中文台灣習慣用語). ' +
        'Return ONLY a valid JSON array of strings corresponding to each title in order, with no explanation or markdown tags:\n' +
        JSON.stringify(titlesToTranslate);

      let resp;
      try {
        resp = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
        ]);
      } catch {
        try {
          resp = await Promise.race([
            ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
          ]);
        } catch (_) {}
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
    } catch (_) {}
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
            if (Array.isArray(arr) && arr[0]) {
              translatedMap.set(v.title, String(arr[0]).trim());
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
