export interface YouTubeLiveNewsChannel {
  id: string;
  name: string;
  englishName: string;
  streamUrl: string;
  defaultVideoId: string;
  category: string;
  badge: string;
  keywords: string[];
  preferAudioMode?: boolean;
  youtubeLiveUrl?: string;
}

export const YOUTUBE_LIVE_NEWS_CHANNELS: YouTubeLiveNewsChannel[] = [
  {
    id: 'bbc-news-live',
    name: 'BBC News 24/7 英國廣播公司即時新聞',
    englishName: 'BBC News Live',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    defaultVideoId: 'sc21UUjyLaw',
    category: '英國國際',
    badge: 'BBC News',
    keywords: ['bbc', 'world service', 'bbc news', 'british'],
    preferAudioMode: true,
    youtubeLiveUrl: 'https://www.youtube.com/@BBCNews/live',
  },
  {
    id: 'sky-news-live',
    name: 'Sky News 24/7 全球即時新聞',
    englishName: 'Sky News Live',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_SKYNEWS.mp3',
    defaultVideoId: 'xDWQ3LkccY8',
    category: '英國與國際',
    badge: 'Sky News',
    keywords: ['sky', 'xDWQ3LkccY8', 'uk news', 'sky news'],
    youtubeLiveUrl: 'https://www.youtube.com/@SkyNews/live',
  },
  {
    id: 'abc-news-live',
    name: 'ABC News 24/7 國際即時新聞',
    englishName: 'ABC News Live',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WABCAM.mp3',
    defaultVideoId: 'jUkT0JL0Cjg',
    category: '國際時事',
    badge: 'ABC News',
    keywords: ['abc', 'jUkT0JL0Cjg', 'vOTiJkg1voo', 'abc news', 'wabc'],
    youtubeLiveUrl: 'https://www.youtube.com/@ABCNews/live',
  },
  {
    id: 'bloomberg-live',
    name: 'Bloomberg 24/7 全球財經與市場直播',
    englishName: 'Bloomberg Television Live',
    streamUrl: 'https://tunein.cdnstream1.com/3521_96.mp3',
    defaultVideoId: 'QB5BNdBFujE',
    category: '商業財經',
    badge: 'Bloomberg',
    keywords: ['bloomberg', 'QB5BNdBFujE', 'finance', 'market'],
    youtubeLiveUrl: 'https://www.youtube.com/@BloombergTelevision/live',
  },
  {
    id: 'france24-live',
    name: 'France 24 24/7 法國國際新聞',
    englishName: 'France 24 English Live',
    streamUrl: 'http://rfienanglais64k.ice.infomaniak.ch/rfienanglais-64.mp3',
    defaultVideoId: 'WLDE9LrGpNk',
    category: '歐洲時事',
    badge: 'France 24',
    keywords: ['france', 'paris', 'france 24'],
    youtubeLiveUrl: 'https://www.youtube.com/@France24_en/live',
  },
  {
    id: 'livenow-fox-live',
    name: 'LiveNOW from FOX 24/7 美國即時現場',
    englishName: 'LiveNOW from FOX Live',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KTELAM.mp3',
    defaultVideoId: 'adQyLViK_ZU',
    category: '全美現場',
    badge: 'LiveNOW FOX',
    keywords: ['livenow', 'fox', 'fox news'],
    youtubeLiveUrl: 'https://www.youtube.com/@LiveNOWFOX/live',
  },
  {
    id: 'nbc-news-live',
    name: 'NBC News NOW / 全美即時新聞焦點',
    englishName: 'NBC News NOW Live',
    streamUrl: 'https://tunein.cdnstream1.com/2868_96.mp3',
    defaultVideoId: '1dPIx75xMms',
    category: '美國時事',
    badge: 'NBC News',
    keywords: ['nbc', 'nbc news', 'cnn'],
    youtubeLiveUrl: 'https://www.youtube.com/@NBCNews/live',
  },
  {
    id: 'dw-news-live',
    name: 'DW News 24/7 德國之聲國際新聞',
    englishName: 'DW News Live',
    streamUrl: 'https://dw.audiostream.io/dw/1028/mp3/64/dw09',
    defaultVideoId: 'SebfRk_0jzg',
    category: '歐洲國際',
    badge: 'DW News',
    keywords: ['dw', 'germany', 'deutsche welle', 'dw news'],
    youtubeLiveUrl: 'https://www.youtube.com/@dwnews/live',
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
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'bloomberg-live') || YOUTUBE_LIVE_NEWS_CHANNELS[3];
  }
  if (normTitle.includes('bbc') || normUrl.includes('bbc')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'bbc-news-live') || YOUTUBE_LIVE_NEWS_CHANNELS[2];
  }
  if (normTitle.includes('sky') || normUrl.includes('sky')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[1];
  }
  if (normTitle.includes('dw') || normTitle.includes('deutsche') || normUrl.includes('dw')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'dw-news-live') || YOUTUBE_LIVE_NEWS_CHANNELS[5];
  }
  if (normTitle.includes('nbc') || normUrl.includes('nbc')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'nbc-news-live') || YOUTUBE_LIVE_NEWS_CHANNELS[4];
  }
  if (normTitle.includes('france') || normUrl.includes('france')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'france24-live') || YOUTUBE_LIVE_NEWS_CHANNELS[6];
  }
  if (normTitle.includes('livenow') || normTitle.includes('fox') || normUrl.includes('fox')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS.find(c => c.id === 'livenow-fox-live') || YOUTUBE_LIVE_NEWS_CHANNELS[7];
  }
  if (normTitle.includes('abc') || normUrl.includes('abc')) {
    return YOUTUBE_LIVE_NEWS_CHANNELS[0];
  }

  // Default to ABC News
  return YOUTUBE_LIVE_NEWS_CHANNELS[0];
}
