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
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
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
    defaultVideoId: 'xDWQ3LkccY8',
    category: '英國與國際',
    badge: 'Sky News',
    keywords: ['sky', 'xDWQ3LkccY8', 'uk news'],
  },
  {
    id: 'bloomberg-live',
    name: 'Bloomberg 24/7 全球財經與市場直播',
    englishName: 'Bloomberg Television Live',
    streamUrl: 'https://stream.revma.ihrhls.com/zc4732',
    defaultVideoId: 'QB5BNdBFujE',
    category: '商業財經',
    badge: 'Bloomberg',
    keywords: ['bloomberg', 'QB5BNdBFujE', 'finance', 'market'],
  },
  {
    id: 'nbc-news-live',
    name: 'NBC News NOW / 全美即時新聞焦點',
    englishName: 'NBC News NOW Live',
    streamUrl: 'https://streams.kqed.org/kqedradio.mp3',
    defaultVideoId: 'bdvIO2Tzcr4',
    category: '美國時事',
    badge: 'NBC News',
    keywords: ['nbc', 'bdvIO2Tzcr4', 'kqed'],
  },
  {
    id: 'dw-news-live',
    name: 'DW News 24/7 德國之聲國際新聞',
    englishName: 'DW News Live',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
    defaultVideoId: 'LuKwFajn37U',
    category: '歐洲國際',
    badge: 'DW News',
    keywords: ['dw', 'LuKwFajn37U', 'germany'],
  },
  {
    id: 'france24-live',
    name: 'France 24 24/7 法國國際新聞',
    englishName: 'France 24 English Live',
    streamUrl: 'https://stream.revma.ihrhls.com/zc4732',
    defaultVideoId: 'HvZt-nh9sGg',
    category: '歐洲時事',
    badge: 'France 24',
    keywords: ['france', 'HvZt-nh9sGg', 'paris'],
  },
  {
    id: 'livenow-fox-live',
    name: 'LiveNOW from FOX 24/7 美國即時現場',
    englishName: 'LiveNOW from FOX Live',
    streamUrl: 'https://streams.kqed.org/kqedradio.mp3',
    defaultVideoId: 'C96oohpWBGw',
    category: '全美現場',
    badge: 'LiveNOW FOX',
    keywords: ['livenow', 'fox', 'C96oohpWBGw'],
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
