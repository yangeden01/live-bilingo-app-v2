import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Newspaper,
  RefreshCw,
  Clock,
  AlertTriangle,
  Play,
  ShieldCheck,
  Flame,
  Globe,
  Landmark,
  Building2,
  Cpu,
  BookOpen,
  Compass,
  Star,
  Trash2,
  Radio,
} from 'lucide-react';
import { getApiUrl } from '../utils/apiUrl';
import {
  YouTubeNewsVideo,
  YouTubeNewsResponse,
  YouTubeNewsCategory,
  YouTubeSavedUrl,
  ReadingMode,
} from '../types';

export type NewsModalCategoryTab = 'ALL' | YouTubeNewsCategory | 'Favorites';

interface YouTubeNewsDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: YouTubeNewsVideo) => void;
  effectiveTheme?: ReadingMode;
  savedUrls?: YouTubeSavedUrl[];
  activeVideoId?: string | null;
  onSelectSavedUrl?: (url: string, videoId: string, title?: string) => void;
  onDeleteSavedUrl?: (id: string) => void;
  initialCategory?: NewsModalCategoryTab;
}

const CATEGORY_TABS: { key: NewsModalCategoryTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'ALL', label: '全部', icon: Compass },
  { key: 'Knowledge', label: '知識科普', icon: BookOpen },
  { key: 'Technology', label: '科技前沿', icon: Cpu },
  { key: 'Business', label: '商業財經', icon: Building2 },
  { key: 'World', label: '國際視野', icon: Globe },
  { key: 'US', label: '美國焦點', icon: Landmark },
  { key: 'Breaking', label: '焦點', icon: Flame },
  { key: 'Favorites', label: '收藏影片', icon: Star },
];

export const CATEGORY_NAMES_ZH: Record<string, string> = {
  ALL: '全部',
  Knowledge: '知識科普',
  Technology: '科技創新',
  Business: '商業財經',
  World: '全球國際',
  US: '美國時事',
  Breaking: '焦點快訊',
};

async function translateEnToZh(text: string): Promise<string> {
  try {
    const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=${encodeURIComponent(text)}`);
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]) return String(arr[0]).trim();
    }
  } catch (_) {}
  return '';
}

export const YouTubeNewsDiscoveryModal: React.FC<YouTubeNewsDiscoveryModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  effectiveTheme = 'dark',
  savedUrls = [],
  activeVideoId = null,
  onSelectSavedUrl,
  onDeleteSavedUrl,
  initialCategory,
}) => {
  const [videos, setVideos] = useState<YouTubeNewsVideo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NewsModalCategoryTab>(initialCategory || 'ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory, isOpen]);

  const fetchNews = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    let data: YouTubeNewsResponse | null = null;

    try {
      // 1. If running in Android native app with AndroidBridge, use direct native OkHttp (bypasses all auth/CORS)
      if (
        typeof window !== 'undefined' &&
        (window as any).AndroidBridge &&
        typeof (window as any).AndroidBridge.fetchYouTubeNews === 'function'
      ) {
        data = await new Promise<YouTubeNewsResponse>((resolve) => {
          const callbackId = `yt_news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          if (!(window as any).__yt_news_callbacks) {
            (window as any).__yt_news_callbacks = {};
          }
          const timer = setTimeout(() => {
            delete (window as any).__yt_news_callbacks[callbackId];
            resolve({
              success: false,
              videos: [],
              cached: false,
              timestamp: Date.now(),
              publishedAfter: '',
              message: '原生連線搜尋逾時，請點擊重新搜尋',
            });
          }, 8000);

          (window as any).__yt_news_callbacks[callbackId] = (result: any) => {
            clearTimeout(timer);
            resolve(result);
          };

          try {
            (window as any).AndroidBridge.fetchYouTubeNews(forceRefresh, callbackId);
          } catch (e: any) {
            clearTimeout(timer);
            delete (window as any).__yt_news_callbacks[callbackId];
            resolve({
              success: false,
              videos: [],
              cached: false,
              timestamp: Date.now(),
              publishedAfter: '',
              message: `原生介面調用失敗: ${e?.message || e}`,
            });
          }
        });
      }

      // 2. Web browser or fallback if native returned no videos
      if (!data || !data.success || !Array.isArray(data.videos) || data.videos.length === 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const endpoint = getApiUrl(`/api/youtube/news${forceRefresh ? '?refresh=true' : ''}`);
          const res = await fetch(endpoint, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            data = await res.json();
          } else {
            console.warn(`[YouTubeNewsModal] Web API returned HTTP ${res.status}`);
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          console.warn('[YouTubeNewsModal] Web API fetch error:', fetchErr?.message || fetchErr);
        }
      }

      if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        // Filter out live streams and ensure only videos with closed captions are shown
        const validVideos = data.videos.filter((v: YouTubeNewsVideo) => {
          if (!v || !v.videoId) return false;
          if (/^(?:live:|\(live\)|\[live\]|\|\s*live)/i.test(v.title || '')) return false;
          if (/\b(?:live stream|streaming live|watch live)\b/i.test(v.title || '')) return false;
          return v.hasCaptions !== false;
        });

        // Strict sort: newest first (由最新開始排)
        const sorted = [...validVideos].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setVideos(sorted);
        setCached(!!data.cached);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // If any video returned from native or cache has fallback duration '05:00' or lacks titleZh,
        // perform immediate background enrichment to guarantee real duration and Traditional Chinese titles
        if (sorted.some((v) => !v.titleZh || v.durationFormatted === '05:00')) {
          fetch(getApiUrl(`/api/youtube/news${forceRefresh ? '?refresh=true' : ''}`))
            .then((r) => r.json())
            .then((enrichedData) => {
              if (enrichedData && enrichedData.success && Array.isArray(enrichedData.videos)) {
                const map = new Map<string, YouTubeNewsVideo>();
                enrichedData.videos.forEach((ev: YouTubeNewsVideo) => map.set(ev.videoId, ev));
                setVideos((prev) =>
                  prev.map((pv) => {
                    const match = map.get(pv.videoId);
                    if (match) {
                      return {
                        ...pv,
                        durationFormatted:
                          match.durationFormatted !== '05:00' ? match.durationFormatted : pv.durationFormatted,
                        durationSeconds: match.durationSeconds !== 300 ? match.durationSeconds : pv.durationSeconds,
                        titleZh: match.titleZh || pv.titleZh,
                      };
                    }
                    return pv;
                  })
                );
              }
            })
            .catch(() => {});

          const missingZh = sorted.filter((v) => !v.titleZh);
          if (missingZh.length > 0) {
            Promise.all(
              missingZh.map(async (v) => {
                const zh = await translateEnToZh(v.title);
                return { videoId: v.videoId, zh };
              })
            ).then((results) => {
              setVideos((prev) =>
                prev.map((pv) => {
                  const found = results.find((r) => r.videoId === pv.videoId && r.zh);
                  return found ? { ...pv, titleZh: found.zh } : pv;
                })
              );
            });
          }
        }
      } else {
        const msg = data?.message || '最近 7 天暫時找不到可用英文字幕的新聞影片';
        setError(msg);
      }
    } catch (err: any) {
      console.warn('[YouTubeNewsModal] Unexpected error during news discovery:', err);
      setError('搜尋暫時逾時，請點擊「重新搜尋」再試一次');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when opened if empty
  useEffect(() => {
    if (isOpen && videos.length === 0 && !isLoading) {
      fetchNews(false);
    }
  }, [isOpen, videos.length, isLoading, fetchNews]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered videos based on category tab
  const filteredVideos = useMemo(() => {
    if (selectedCategory === 'ALL') return videos;
    return videos.filter((v) => v.category === selectedCategory);
  }, [videos, selectedCategory]);

  if (!isOpen) return null;

  // Theme-aware styles
  const isPaper = effectiveTheme === 'paper';
  const isLight = effectiveTheme === 'light';

  const modalBgClass = isPaper
    ? 'bg-[#FDF8EE] text-[#2C2214] border-[#E5D8B8]'
    : isLight
    ? 'bg-white text-slate-900 border-slate-200 shadow-2xl'
    : 'bg-slate-900 text-slate-100 border-slate-800 shadow-2xl';

  const headerBorderClass = isPaper
    ? 'border-[#E5D8B8]'
    : isLight
    ? 'border-slate-200'
    : 'border-slate-800';

  const cardBgClass = isPaper
    ? 'bg-[#F5ECE0] hover:bg-[#EDE1D1] border-[#DFD1BA] text-[#2C2214]'
    : isLight
    ? 'bg-slate-50 hover:bg-slate-100/90 border-slate-200 text-slate-900'
    : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700 text-white';

  const secondaryTextClass = isPaper
    ? 'text-[#7D6B53]'
    : isLight
    ? 'text-slate-500'
    : 'text-slate-400';

  const pillInactiveClass = isPaper
    ? 'bg-[#ECE0CE] text-[#6B5A44] hover:bg-[#E2D4BF]'
    : isLight
    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    : 'bg-slate-800 text-slate-300 hover:bg-slate-700';

  return (
    <div
      id="youtube-news-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        id="youtube-news-modal-container"
        className={`relative w-full max-w-3xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${modalBgClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-news-modal-title"
      >
        {/* Header Bar */}
        <div className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${headerBorderClass}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="youtube-news-modal-title" className="text-base sm:text-lg font-bold truncate">
                  美語精選頻道
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                  一週內 • 完整英文字幕
                </span>
              </div>
              <p className={`text-xs truncate ${secondaryTextClass}`}>
                知識科普、商業科技與權威外電 • 點擊即刻啟動雙語學習
                {lastUpdated && ` (更新於 ${lastUpdated}${cached ? '，快取模式' : ''})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              id="youtube-news-refresh-btn"
              onClick={() => fetchNews(true)}
              disabled={isLoading}
              title="強制重新搜尋最新一週影片"
              aria-label="重新搜尋"
              className={`p-2 rounded-xl border border-transparent transition-all cursor-pointer ${
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-500/10'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              id="youtube-news-close-btn"
              onClick={onClose}
              title="關閉"
              aria-label="關閉"
              className="p-2 rounded-xl border border-transparent hover:bg-slate-500/10 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs Filter */}
        <div className={`px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${headerBorderClass}`}>
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedCategory === tab.key;
            const count = tab.key === 'Favorites' ? (savedUrls?.length ?? 0) : null;
            return (
              <button
                key={tab.key}
                type="button"
                id={`youtube-news-tab-${tab.key.toLowerCase()}`}
                onClick={() => setSelectedCategory(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? tab.key === 'Favorites'
                      ? 'bg-amber-600 text-white font-semibold shadow-sm'
                      : 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : pillInactiveClass
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.key === 'Favorites' ? (isSelected ? 'fill-white text-white' : 'text-amber-500 fill-amber-500') : ''}`} />
                <span>{tab.label}</span>
                {count !== null && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-black/25 text-white' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[300px]">
          {selectedCategory === 'Favorites' ? (
            <div className="space-y-3">
              {savedUrls.length === 0 ? (
                <div className={`p-8 rounded-2xl border text-center space-y-3 my-4 ${cardBgClass}`}>
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Star className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-sm font-semibold">尚無收藏影片</h4>
                    <p className={`text-xs ${secondaryTextClass}`}>
                      在主畫面的 YouTube 網址前點擊 ⭐ 圖示，即可將喜愛的影片加入收藏，隨時在此點選複習！
                    </p>
                  </div>
                </div>
              ) : (
                savedUrls.map((saved) => (
                  <div
                    key={saved.id || saved.videoId}
                    id={`youtube-saved-item-${saved.videoId}`}
                    onClick={() => {
                      if (onSelectSavedUrl) {
                        onSelectSavedUrl(saved.url, saved.videoId, saved.title);
                      } else {
                        onSelectVideo({
                          videoId: saved.videoId,
                          title: saved.title || `YouTube 影片 (${saved.videoId})`,
                          channelTitle: saved.channelName || 'YouTube',
                          publishedAt: '',
                          publishedRelative: '',
                          durationFormatted: '',
                          durationSeconds: 0,
                          thumbnailUrl: `https://i.ytimg.com/vi/${saved.videoId}/mqdefault.jpg`,
                          hasCaptions: true,
                          captionBadge: 'CC 英文字幕',
                          category: 'Knowledge',
                        });
                      }
                      onClose();
                    }}
                    className={`group flex flex-col sm:flex-row gap-3.5 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer relative ${cardBgClass} ${
                      saved.videoId === activeVideoId ? 'ring-2 ring-amber-500/50' : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onSelectSavedUrl) {
                          onSelectSavedUrl(saved.url, saved.videoId, saved.title);
                        }
                        onClose();
                      }
                    }}
                  >
                    {/* Video Thumbnail */}
                    <div className="relative w-full sm:w-44 aspect-video sm:aspect-[16/9] rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      <img
                        src={`https://i.ytimg.com/vi/${saved.videoId}/mqdefault.jpg`}
                        alt={saved.title || saved.url}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${saved.videoId}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                      {saved.isLive ? (
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                          <Radio className="w-2.5 h-2.5 animate-pulse" />
                          <span>LIVE</span>
                        </div>
                      ) : (
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/80 text-white backdrop-blur-xs">
                          收藏
                        </div>
                      )}
                    </div>

                    {/* Video Metadata */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span>收藏影片</span>
                          </span>
                          {saved.videoId === activeVideoId && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20">
                              播放中
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-semibold line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">
                          {saved.title || `YouTube 影片 (${saved.videoId})`}
                        </h4>

                        <p className="text-[11px] font-mono text-slate-400/80 truncate">
                          {saved.url}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-inherit/20 text-[11px]">
                        <span className={secondaryTextClass}>
                          {saved.savedAt ? new Date(saved.savedAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '已收藏'}
                        </span>

                        {onDeleteSavedUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSavedUrl(saved.id);
                            }}
                            title="從收藏影片移除"
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                              isPaper
                                ? 'hover:bg-rose-100 text-rose-700'
                                : 'hover:bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">移除</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Loading State */}
          {isLoading && videos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">正在搜尋最近 7 天美語新聞...</p>
                <p className={`text-xs ${secondaryTextClass}`}>
                  依序檢索 PBS, CNN, BBC, NBC, CBS, Sky News 等權威頻道並驗證英文字幕
                </p>
              </div>
            </div>
          )}

          {/* Error / Empty State */}
          {!isLoading && error && (
            <div className={`p-8 rounded-2xl border text-center space-y-4 my-4 ${cardBgClass}`}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm font-semibold">{error}</h4>
                <p className={`text-xs ${secondaryTextClass}`}>
                  系統僅推薦符合最近 7 天發布時間且已確認具備英文字幕之影片，確保雙語學習體驗。
                </p>
              </div>
              <button
                type="button"
                id="youtube-news-retry-btn"
                onClick={() => fetchNews(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新搜尋</span>
              </button>
            </div>
          )}

          {/* Video List */}
          {!isLoading && !error && filteredVideos.length === 0 && (
            <div className={`p-8 rounded-2xl border text-center space-y-3 ${cardBgClass}`}>
              <p className="text-sm font-semibold">此分類在最近 7 天暫無影片</p>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="text-xs text-emerald-400 hover:underline cursor-pointer"
              >
                查看全部新聞
              </button>
            </div>
          )}

          {!error &&
            filteredVideos.map((video) => (
              <div
                key={video.videoId}
                id={`youtube-news-item-${video.videoId}`}
                onClick={() => onSelectVideo(video)}
                className={`group flex flex-col sm:flex-row gap-3.5 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${cardBgClass}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectVideo(video);
                  }
                }}
              >
                {/* Video Thumbnail with duration overlay */}
                <div className="relative w-full sm:w-44 aspect-video sm:aspect-[16/9] rounded-lg overflow-hidden bg-slate-800 shrink-0">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback to high quality YouTube thumbnail
                      (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                    }}
                  />
                  {/* Play icon overlay on hover */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                  {/* Duration Badge */}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/80 text-white backdrop-blur-xs">
                    {video.durationFormatted}
                  </div>
                </div>

                {/* Video Metadata & Badges */}
                <div className="flex-1 flex flex-col justify-between min-w-0 space-y-2">
                  <div className="space-y-1">
                    {/* Top Row: Category + CC Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          video.category === 'Breaking'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            : video.category === 'Technology'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                            : video.category === 'Business'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : video.category === 'US'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {CATEGORY_NAMES_ZH[video.category] || video.category}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{video.captionBadge}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs sm:text-sm font-semibold line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">
                      {video.title}
                    </h4>

                    {/* Chinese Translation */}
                    {video.titleZh && (
                      <p
                        className={`text-xs leading-snug line-clamp-2 pt-0.5 ${
                          isPaper
                            ? 'text-emerald-800 font-medium'
                            : isLight
                            ? 'text-emerald-700 font-medium'
                            : 'text-emerald-400/95 font-normal'
                        }`}
                      >
                        {video.titleZh}
                      </p>
                    )}
                  </div>

                  {/* Channel & Published Time Info */}
                  <div className={`flex items-center gap-3 text-[11px] ${secondaryTextClass}`}>
                    <span className="font-medium truncate max-w-[140px] flex items-center gap-1">
                      {video.channelTitle}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{video.publishedRelative}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            </>
          )}
        </div>

        {/* Footer info banner */}
        <div className={`px-5 py-3 border-t flex items-center justify-between text-[11px] shrink-0 ${headerBorderClass} ${secondaryTextClass}`}>
          <span>點擊任意頻道影片即可自動填入網址並載入雙語字幕</span>
          <button
            type="button"
            onClick={onClose}
            className="hover:underline font-medium cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
