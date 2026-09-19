export interface YouTubeLiveNewsChannel {
  id: string;
  name: string;
  englishName: string;
  streamUrl: string;
  defaultVideoId: string;
  category: string;
  badge: string;
  keywords: string[];
}

export const YOUTUBE_LIVE_NEWS_CHANNELS: YouTubeLiveNewsChannel[] = [
  {
    id: 'abc-news-live',
    name: 'ABC News 24/7 國際即時新聞',
    englishName: 'ABC News Live',
    streamUrl: 'http://abc.streamguys1.com/live/newsradio/icecast.audio',
    defaultVideoId: 'vOTiJkg1voo',
    category: '國際時事',
    badge: 'ABC News',
    keywords: ['abc', 'vOTiJkg1voo', 'australia'],
  },
  {
    id: 'sky-news-live',
    name: 'Sky News 24/7 全球即時新聞',
    englishName: 'Sky News Live',
    streamUrl: 'http://radio.canstream.co.uk:8022/live.mp3',
    defaultVideoId: '9Auq9mYxFEE',
    category: '英國與國際',
    badge: 'Sky News',
    keywords: ['sky', '9Auq9mYxFEE', 'uk news'],
  },
  {
    id: 'bloomberg-live',
    name: 'Bloomberg 24/7 全球財經與市場直播',
    englishName: 'Bloomberg Television Live',
    streamUrl: 'https://stream.revma.ihrhls.com/zc4732',
    defaultVideoId: 'dp8PhLsUcFE',
    category: '商業財經',
    badge: 'Bloomberg',
    keywords: ['bloomberg', 'dp8PhLsUcFE', 'finance', 'market'],
  },
  {
    id: 'nbc-news-live',
    name: 'NBC News NOW / 全美即時新聞焦點',
    englishName: 'NBC News NOW Live',
    streamUrl: 'https://streams.kqed.org/kqedradio.mp3',
    defaultVideoId: '34XpWw_6t0E',
    category: '美國時事',
    badge: 'NBC News',
    keywords: ['nbc', '34XpWw_6t0E', 'kqed'],
  },
];

/**
 * Match an incoming YouTube videoId, title, or url to the best live news channel.
 */
export function matchLiveNewsChannel(
  videoId?: string | null,
  title?: string | null,
  url?: string | null
): YouTubeLiveNewsChannel {
  const normTitle = (title || '').toLowerCase();
  const normUrl = (url || '').toLowerCase();
  const vid = videoId || '';

  // 1. Exact Video ID match
  const byVideoId = YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.defaultVideoId === vid);
  if (byVideoId) return byVideoId;

  // 2. Keyword check against Title or URL
  for (const ch of YOUTUBE_LIVE_NEWS_CHANNELS) {
    for (const kw of ch.keywords) {
      if (normTitle.includes(kw) || normUrl.includes(kw)) {
        return ch;
      }
    }
  }

  // 3. Specific brand checks
  if (normTitle.includes('bloomberg') || normUrl.includes('bloomberg')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[2];
  }
  if (normTitle.includes('sky') || normUrl.includes('sky')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[1];
  }
  if (normTitle.includes('abc') || normUrl.includes('abc')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[0];
  }
  if (normTitle.includes('nbc') || normUrl.includes('nbc')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[3];
  }

  // Default to ABC News
  return YOUTUBE_LIVE_NEWS_CHANNELS[0];
}
