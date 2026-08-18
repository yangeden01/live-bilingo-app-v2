import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SubtitleItem, PlaybackStatus, RadioStation, ReadingMode } from '../types';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { BannerAd } from './BannerAd';
import { MarqueeText } from './MarqueeText';
import { getApiUrl } from '../utils/apiUrl';
import {
  Play,
  Pause,
  Radio,
  Search,
  Bookmark,
  RefreshCw,
  ListMusic,
  History,
  Copy,
  Download,
  Check,
  FileText,
  Sparkles,
  Layers,
  Trash2,
  Type,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  BookOpen,
  ArrowDownCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playBeanWallImpactSound } from '../utils/sound';

interface Props {
  subtitles: SubtitleItem[];
  interimSubtitle?: SubtitleItem | null;
  playbackStatus: PlaybackStatus;
  onTogglePlayPause: () => void;
  sttConnected: boolean;
  onBookmarkToggle: (id: string) => void;
  onClearBookmarks?: () => void;
  onClearSubtitles: () => void;
  onOpenDictionary?: (word?: string) => void;
  activeStation?: RadioStation;
  onOpenStationManager?: () => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
}

type FrameTab = 'live' | 'history' | 'bookmarks';

export const Material3AndroidFrame: React.FC<Props> = ({
  subtitles,
  interimSubtitle,
  playbackStatus,
  onTogglePlayPause,
  sttConnected,
  onBookmarkToggle,
  onClearBookmarks,
  onClearSubtitles,
  onOpenDictionary,
  activeStation,
  onOpenStationManager,
  readingMode: propReadingMode,
  onReadingModeChange: propOnReadingModeChange,
}) => {
  const [activeTab, setActiveTab] = useState<FrameTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    type: 'history' | 'bookmarks';
    title: string;
    message: string;
    confirmText: string;
  } | null>(null);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    try {
      const saved = localStorage.getItem('radio_subtitle_font_size');
      if (saved === 'small' || saved === 'medium' || saved === 'large') return saved;
    } catch (e) {}
    return 'small';
  });

  const [localReadingMode, setLocalReadingMode] = useState<ReadingMode>(() => {
    try {
      const saved = localStorage.getItem('radio_reading_mode');
      if (saved === 'system' || saved === 'paper' || saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {}
    return 'system';
  });

  const readingMode = propReadingMode ?? localReadingMode;
  const setReadingMode = (mode: ReadingMode) => {
    if (propOnReadingModeChange) {
      propOnReadingModeChange(mode);
    } else {
      setLocalReadingMode(mode);
    }
  };

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [ambientLux, setAmbientLux] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('radio_reading_mode', readingMode);
    } catch (e) {}

    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    let sensor: any = null;
    if ('AmbientLightSensor' in window) {
      try {
        // @ts-ignore
        sensor = new AmbientLightSensor();
        sensor.onreading = () => {
          if (typeof sensor.illuminance === 'number') {
            setAmbientLux(sensor.illuminance);
          }
        };
        sensor.onerror = () => {};
        sensor.start();
      } catch (e) {}
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      if (sensor) {
        try {
          sensor.stop();
        } catch (e) {}
      }
    };
  }, [readingMode]);

  // Derived effective theme ('dark' | 'light' | 'paper')
  const effectiveTheme = useMemo<'dark' | 'light' | 'paper'>(() => {
    if (readingMode === 'paper') return 'paper';
    if (readingMode === 'light') return 'light';
    if (readingMode === 'dark') return 'dark';

    // System / Ambient Light adaptive mode
    if (ambientLux !== null) {
      return ambientLux < 40 ? 'dark' : 'light';
    }
    return systemPrefersDark ? 'dark' : 'light';
  }, [readingMode, ambientLux, systemPrefersDark]);

  useEffect(() => {
    try {
      localStorage.setItem('radio_subtitle_font_size', fontSize);
    } catch (e) {}
  }, [fontSize]);
  const [sortAscending, setSortAscending] = useState(false); // false = newest first, true = oldest first
  const [liveClearedAt, setLiveClearedAt] = useState<number | null>(null);
  const [historyClearedAt, setHistoryClearedAt] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('radio_history_cleared_at');
      if (saved) return Number(saved) || null;
    } catch (e) {}
    return null;
  });
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll subtitle list container to top when a new live subtitle arrives
  useEffect(() => {
    if (activeTab === 'live' && listContainerRef.current) {
      if (listContainerRef.current.scrollTop < 150) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [subtitles.length, activeTab]);

  const showToast = (message: string) => {
    setCopiedToast(message);
    setTimeout(() => {
      setCopiedToast(null);
    }, 2500);
  };

  const liveCount = useMemo(() => {
    return subtitles.filter((item) => {
      if (liveClearedAt && item.createdAt && item.createdAt <= liveClearedAt) return false;
      if (historyClearedAt && item.createdAt && item.createdAt <= historyClearedAt) return false;
      return true;
    }).length;
  }, [subtitles, liveClearedAt, historyClearedAt]);

  const historyCount = useMemo(() => {
    return subtitles.filter((item) => {
      if (historyClearedAt && item.createdAt && item.createdAt <= historyClearedAt) return false;
      return true;
    }).length;
  }, [subtitles, historyClearedAt]);

  const bookmarkedCount = useMemo(() => {
    return subtitles.filter((item) => item.bookmarked).length;
  }, [subtitles]);

  // Filter subtitles based on active tab, live clearing timestamp, history clearing timestamp, and search query
  const filteredSubtitles = useMemo(() => {
    return subtitles.filter((item) => {
      // 1. Live tab timestamp clear check
      if (activeTab === 'live') {
        if (liveClearedAt && item.createdAt && item.createdAt <= liveClearedAt) {
          return false;
        }
      }

      // 2. History tab check: exclude items created before history cleared timestamp
      if (activeTab === 'history') {
        if (historyClearedAt && item.createdAt && item.createdAt <= historyClearedAt) {
          return false;
        }
      }

      // 3. Bookmarks tab check: must be bookmarked
      if (activeTab === 'bookmarks') {
        if (!item.bookmarked) {
          return false;
        }
      }

      // 4. Search query condition
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEng = item.english.toLowerCase().includes(q);
        const matchChi = item.traditionalChinese.toLowerCase().includes(q);
        if (!matchEng && !matchChi) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return sortAscending ? timeA - timeB : timeB - timeA;
    }).slice(0, activeTab === 'live' ? 50 : undefined);
  }, [subtitles, activeTab, liveClearedAt, historyClearedAt, searchQuery, sortAscending]);

  // Export full transcript as text
  const getFormattedTranscript = () => {
    const stationName = activeStation?.name || 'Live Bilingo';
    const header = `=== ${stationName} 雙語廣播逐字稿歷史紀錄 ===\n匯出時間：${new Date().toLocaleString('zh-TW')}\n總段落數：${filteredSubtitles.length}\n----------------------------------------\n\n`;

    const body = filteredSubtitles
      .map((item, index) => {
        return `[段落 #${filteredSubtitles.length - index}] ${item.timestamp}\n英文廣播: ${item.english}\n中文翻譯: ${item.traditionalChinese}\n`;
      })
      .join('\n');

    return header + body;
  };

  const handleCopyFullTranscript = () => {
    if (filteredSubtitles.length === 0) {
      showToast('目前沒有可複製的歷史字幕段落');
      return;
    }
    const text = getFormattedTranscript();
    navigator.clipboard.writeText(text).then(() => {
      showToast(`成功複製 ${filteredSubtitles.length} 個雙語歷史段落至剪貼簿！`);
    }).catch(() => {
      showToast('複製失敗，請手動選取文字');
    });
  };

  const handleDownloadTranscript = () => {
    if (filteredSubtitles.length === 0) {
      showToast('目前沒有可下載的歷史字幕段落');
      return;
    }
    const text = getFormattedTranscript();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Radio_Bilingual_History_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('歷史紀錄檔案已開始下載！');
  };

  // Theme styling based on effectiveTheme
  const outerFrameBg =
    effectiveTheme === 'paper'
      ? 'bg-[#F4EAD5] border-[#E2D2B0] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-slate-100 border-slate-200 text-slate-900'
      : 'bg-slate-950 border-slate-800 text-slate-100';

  const screenContainerBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] border-[#E2D2B0]'
      : effectiveTheme === 'light'
      ? 'bg-slate-50 border-slate-200'
      : 'bg-slate-900 border-slate-800';

  const headerDeckBg =
    effectiveTheme === 'paper'
      ? 'bg-[#EFE6D0] border-[#D8C49E] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-slate-100 border-slate-200 text-slate-900'
      : 'bg-slate-900 border-slate-800 text-slate-100';

  const fontSizeBoxBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] border-[#D8C49E]'
      : effectiveTheme === 'light'
      ? 'bg-white border-slate-200'
      : 'bg-slate-800/90 border-slate-700/80';

  const fontSizeDividerBg =
    effectiveTheme === 'paper'
      ? 'bg-[#D8C49E]'
      : effectiveTheme === 'light'
      ? 'bg-slate-300'
      : 'bg-slate-700/80';

  const fontSizeUnselected =
    effectiveTheme === 'paper'
      ? 'text-[#7A6853] hover:text-[#3B2E1E] hover:bg-[#E2D2B0]'
      : effectiveTheme === 'light'
      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60';

  const tabUnselectedBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] text-[#7A6853] hover:text-[#3B2E1E] hover:bg-[#E2D2B0] border border-[#D8C49E]'
      : effectiveTheme === 'light'
      ? 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800';

  const tabBadgeUnselectedBg =
    effectiveTheme === 'paper'
      ? 'bg-[#E2D2B0] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-slate-200 text-slate-800'
      : 'bg-slate-800 text-slate-300 border border-slate-700';

  const deleteBtnBg =
    effectiveTheme === 'paper'
      ? 'bg-rose-100/80 hover:bg-rose-200/80 text-rose-900 border border-rose-300'
      : effectiveTheme === 'light'
      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30';

  const sectionTitleClass =
    effectiveTheme === 'paper'
      ? 'text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'text-slate-900'
      : 'text-slate-100';

  const sectionBadgeClass =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] text-amber-900 border-[#D8C49E]'
      : effectiveTheme === 'light'
      ? 'bg-white text-blue-800 border-slate-300 font-bold'
      : 'bg-slate-800/80 text-blue-400 border-slate-700/50';

  const sortSwitcherContainerClass =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] border-[#D8C49E]'
      : effectiveTheme === 'light'
      ? 'bg-white border-slate-300'
      : 'bg-slate-800/80 border-slate-700/60';

  const sortUnselectedTextClass =
    effectiveTheme === 'paper'
      ? 'text-[#7A6853] hover:text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'text-slate-700 hover:text-slate-950 font-bold'
      : 'text-slate-300 hover:text-white';

  const searchInputBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8] border-[#D8C49E] text-[#3B2E1E] placeholder-[#8C765C]'
      : effectiveTheme === 'light'
      ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
      : 'bg-black border-slate-700 text-slate-100 placeholder-slate-400';

  const listBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8]'
      : effectiveTheme === 'light'
      ? 'bg-slate-50'
      : 'bg-slate-950';

  const bottomBarBg =
    effectiveTheme === 'paper'
      ? 'bg-[#FFFDF7] border-[#E8D8B8] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-white border-slate-200 text-slate-900'
      : 'bg-slate-800/90 border-slate-700/60 text-slate-100';

  return (
    <div className={`rounded-3xl p-3 sm:p-6 border shadow-2xl relative max-w-4xl mx-auto transition-colors duration-200 ${outerFrameBg}`}>
      {/* Phone Screen Container */}
      <div className={`rounded-2xl overflow-hidden shadow-inner border flex flex-col min-h-[680px] transition-colors duration-200 ${screenContainerBg}`}>
        
        {/* Unified Top Control Deck Panel (Seamless Container) */}
        <div className={`border-b flex flex-col select-none transition-colors duration-200 ${headerDeckBg}`}>
          {/* Android Top Header Status, Reading Mode & Font Switcher Bar */}
          <div className="px-3 sm:px-5 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="font-bold flex items-center gap-2 min-w-0 shrink-0">
              <Radio className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />
              <span className="text-sm font-extrabold tracking-wide">雙語字幕</span>
              {readingMode === 'system' && (
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-400/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  光線感應中 ({effectiveTheme === 'dark' ? '夜間暗黑' : '日間明亮'}
                  {ambientLux !== null ? ` | ${Math.round(ambientLux)} lux` : ''})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Mechanical Sliding Font Size Switcher (T | 小 / 中 / 大) */}
              <div className={`flex items-center gap-1 px-1.5 py-1 rounded-xl border shrink-0 shadow-sm transition-colors duration-200 ${fontSizeBoxBg}`}>
                <div className="flex items-center justify-center text-blue-500 font-bold px-0.5" title="字體大小選擇">
                  <Type className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className={`w-[1px] h-3.5 mx-0.5 ${fontSizeDividerBg}`} />
                <div className="relative inline-flex items-center p-0.5 rounded-lg select-none">
                  {(() => {
                    const fontSizes = ['small', 'medium', 'large'] as const;
                    const selectedIndex = fontSizes.indexOf(fontSize);
                    return (
                      <motion.div
                        className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_8px_rgba(180,83,9,0.5)] pointer-events-none flex items-center justify-center z-0"
                        initial={false}
                        animate={{
                          left: `calc(${selectedIndex * 33.333}% + 1px)`,
                          width: 'calc(33.333% - 2px)',
                        }}
                        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                      >
                        <div className="w-1 h-2.5 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
                      </motion.div>
                    );
                  })()}

                  <div className="relative z-10 flex items-center">
                    {(['small', 'medium', 'large'] as const).map((size) => {
                      const labels = { small: '小', medium: '中', large: '大' };
                      const sizeStyles = { small: 'text-xs', medium: 'text-xs', large: 'text-xs font-black' };
                      const isSelected = fontSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            if (fontSize !== size) {
                              setFontSize(size);
                              setTimeout(playBeanWallImpactSound, 135);
                            }
                          }}
                          title={`字幕字體大小：${labels[size]}`}
                          className={`w-7 sm:w-8 py-0.5 text-center font-bold transition-colors duration-150 cursor-pointer select-none rounded-md ${
                            sizeStyles[size]
                          } ${
                            isSelected
                              ? 'text-amber-100 font-black'
                              : fontSizeUnselected
                          }`}
                        >
                          {labels[size]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subtitle Navigation Bar */}
          <div className="px-3 py-1.5">
            <div className="w-full grid grid-cols-3 gap-1.5 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('live')}
                title="即時廣播 (Live)"
                className={`flex items-center justify-center gap-1 h-8 px-1.5 sm:px-2 rounded-xl transition-all text-xs cursor-pointer whitespace-nowrap select-none ${
                  activeTab === 'live'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : tabUnselectedBg
                }`}
              >
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">即時</span>
                {liveCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono leading-none shrink-0 min-w-[18px] text-center ${
                    activeTab === 'live' ? 'bg-blue-300 text-slate-950' : tabBadgeUnselectedBg
                  }`}>
                    {Math.min(50, liveCount)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('history')}
                title="歷史紀錄 (History)"
                className={`flex items-center justify-center gap-1 h-8 px-1.5 sm:px-2 rounded-xl transition-all text-xs cursor-pointer whitespace-nowrap select-none ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : tabUnselectedBg
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">歷史</span>
                {historyCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono leading-none shrink-0 min-w-[18px] text-center ${
                    activeTab === 'history' ? 'bg-blue-300 text-slate-950' : tabBadgeUnselectedBg
                  }`}>
                    {historyCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('bookmarks')}
                title="精選收藏 (Bookmarks)"
                className={`flex items-center justify-center gap-1 h-8 px-1.5 sm:px-2 rounded-xl transition-all text-xs cursor-pointer whitespace-nowrap select-none ${
                  activeTab === 'bookmarks'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : tabUnselectedBg
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'bookmarks' ? 'fill-current' : ''}`} />
                <span className="whitespace-nowrap">收藏</span>
                {bookmarkedCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono leading-none shrink-0 min-w-[18px] text-center ${
                    activeTab === 'bookmarks' ? 'bg-amber-950 text-amber-200' : tabBadgeUnselectedBg
                  }`}>
                    {bookmarkedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Input Bar & Clear Data Button */}
          <div id="subtitle-search-bar" className="px-3 py-1.5 flex items-center gap-2 scroll-mt-14 sm:scroll-mt-16">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'history'
                    ? '搜尋歷史紀錄 (英 / 中)...'
                    : activeTab === 'bookmarks'
                    ? '搜尋已收藏句子...'
                    : '搜尋即時字幕...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/40 shadow-inner transition-colors ${searchInputBg}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="text-xs text-blue-400 font-medium whitespace-nowrap hidden sm:block">
                <strong>{filteredSubtitles.length}</strong> 結果
              </div>
            )}

            {/* Delete Icon Button */}
            <button
              onClick={() => {
                if (activeTab === 'live') {
                  setLiveClearedAt(Date.now());
                  showToast('已清空即時字幕畫面（歷史紀錄已安全保留）');
                } else if (activeTab === 'history') {
                  if (historyCount === 0) {
                    showToast('目前沒有可清空的歷史紀錄');
                  } else {
                    setConfirmModal({
                      type: 'history',
                      title: '清空廣播歷史紀錄',
                      message: '確定要清空所有廣播歷史紀錄嗎？已收藏的句子將會獨立保留。',
                      confirmText: '確認清空歷史',
                    });
                  }
                } else if (activeTab === 'bookmarks') {
                  if (bookmarkedCount === 0) {
                    showToast('目前沒有已收藏的句子');
                  } else {
                    setConfirmModal({
                      type: 'bookmarks',
                      title: '清空所有收藏資料',
                      message: `確定要清空目前收藏的 ${bookmarkedCount} 句學習資料嗎？此動作將移除所有句子的收藏標記。`,
                      confirmText: '確認清空收藏',
                    });
                  }
                }
              }}
              title={
                activeTab === 'live'
                  ? '僅清空目前即時字幕畫面，不影響歷史紀錄'
                  : activeTab === 'history'
                  ? '刪除所有廣播歷史紀錄'
                  : '清空已收藏句子列表'
              }
              className={`px-2.5 py-1.5 rounded-lg transition-all shadow-xs active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap ${deleteBtnBg}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                {activeTab === 'live'
                  ? '刪除即時資料'
                  : activeTab === 'history'
                  ? '刪除歷史資料'
                  : '刪除收藏資料'}
              </span>
            </button>
          </div>

          {/* History Tab Header & Mechanical Wooden Bean Sort Switcher (Strict Single-Row Layout) */}
          {activeTab === 'history' && (
            <div className="px-3 pt-1 pb-2.5 flex flex-nowrap items-center justify-between gap-1.5 text-xs w-full overflow-hidden">
              <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                <span className={`font-bold text-xs shrink-0 whitespace-nowrap transition-colors duration-200 ${sectionTitleClass}`}>廣播歷史紀錄</span>
                <span className={`text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded-md border shrink-0 whitespace-nowrap transition-colors duration-200 ${sectionBadgeClass}`}>
                  {filteredSubtitles.length} 段
                </span>
              </div>

              {/* Slim Mechanical Track Switcher with Unified Slot Background */}
              <div className={`relative inline-flex items-center p-0.5 rounded-lg border select-none shrink-0 transition-colors duration-200 ${sortSwitcherContainerClass}`}>
                {/* Sliding Wooden Bean / Amber Wood Capsule */}
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_8px_rgba(180,83,9,0.5)] pointer-events-none flex items-center justify-center"
                  initial={false}
                  animate={{
                    left: sortAscending ? '2px' : 'calc(50% + 1px)',
                    width: 'calc(50% - 3px)',
                  }}
                  transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                >
                  {/* Wooden Bean Grain Notch */}
                  <div className="w-1 h-2.5 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
                </motion.div>

                {/* Interactive Options */}
                <div className="relative z-10 flex items-center text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      if (!sortAscending) {
                        setSortAscending(true);
                        // Trigger wall-hit impact sound right before the bean stops (~135ms)
                        setTimeout(playBeanWallImpactSound, 135);
                      }
                    }}
                    title="切換為時間正序（舊在上，適合順序閱讀）"
                    className={`px-2 py-0.5 rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      sortAscending ? 'text-amber-100 font-bold' : sortUnselectedTextClass
                    }`}
                  >
                    <ArrowUp className={`w-3 h-3 transition-transform ${sortAscending ? 'scale-110 text-amber-300' : 'opacity-75'}`} />
                    <span>舊在上</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (sortAscending) {
                        setSortAscending(false);
                        // Trigger wall-hit impact sound right before the bean stops (~135ms)
                        setTimeout(playBeanWallImpactSound, 135);
                      }
                    }}
                    title="切換為時間倒序（最新在上，適合閱讀最新）"
                    className={`px-2 py-0.5 rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      !sortAscending ? 'text-amber-100 font-bold' : sortUnselectedTextClass
                    }`}
                  >
                    <ArrowDown className={`w-3 h-3 transition-transform ${!sortAscending ? 'scale-110 text-amber-300' : 'opacity-75'}`} />
                    <span>最新在上</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast Alert Notice */}
        <AnimatePresence>
          {copiedToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-blue-600 text-white text-xs font-bold px-4 py-2 mx-3 mt-2 rounded-xl flex items-center justify-between shadow-lg z-30"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{copiedToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtitle / History List Container */}
        <div ref={listContainerRef} className={`flex-1 p-3 sm:p-4 pt-4 sm:pt-5 overflow-y-auto space-y-4 relative transition-colors duration-200 ${listBg}`}>
          {filteredSubtitles.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center p-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${
                effectiveTheme === 'paper'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50'
              }`}>
                {activeTab === 'history' ? (
                  <History className="w-8 h-8" />
                ) : activeTab === 'bookmarks' ? (
                  <Bookmark className="w-8 h-8" />
                ) : (
                  <Radio className="w-8 h-8" />
                )}
              </div>

              <h3 className={`font-bold text-lg mb-1 ${effectiveTheme === 'paper' ? 'text-[#3B2E1E]' : 'text-slate-800 dark:text-slate-100'}`}>
                {searchQuery
                  ? '沒有符合搜尋條件的段落'
                  : activeTab === 'history'
                  ? '尚無雙語歷史紀錄'
                  : activeTab === 'bookmarks'
                  ? '尚未加入任何收藏句子'
                  : '雙語廣播即時字幕欄'}
              </h3>

              <p className={`text-xs max-w-sm leading-relaxed mb-4 ${effectiveTheme === 'paper' ? 'text-[#6B5840]' : 'text-slate-500 dark:text-slate-400'}`}>
                {searchQuery
                  ? '請嘗試更換搜尋關鍵字，或清除搜尋過濾條件。'
                  : activeTab === 'history'
                  ? '收聽廣播時，系統每 10 秒會自動生成一個完整的雙語字幕新聞段落，並在此累積長時間歷史記錄供隨時查閱。'
                  : activeTab === 'bookmarks'
                  ? '可以在「即時廣播」或「歷史紀錄」卡片右上角點擊星號/書籤圖示，將心儀句子收藏於此。'
                  : '點擊下方播放按鈕收聽廣播，語音將即時由 Deepgram 轉為逐字稿，並自動翻譯為繁體中文。'}
              </p>

              {activeTab === 'live' && !searchQuery && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={onTogglePlayPause}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    {playbackStatus === 'PLAYING' ? '暫停廣播' : '立即收聽廣播'}
                  </button>
                  <button
                    onClick={() => {
                      fetch(getApiUrl('/api/translate'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          text: 'You are listening to Live Public Radio Stream. Real-time AI speech recognition and bilingual translation engine active.'
                        })
                      })
                        .then((res) => res.json())
                        .then((data) => {
                          const newItem: SubtitleItem = {
                            id: `live-btn-${Date.now()}`,
                            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            createdAt: Date.now(),
                            english: 'You are listening to Live Public Radio Stream. Real-time AI speech recognition and bilingual translation engine active.',
                            traditionalChinese: data.translation || '【廣播連線成功】您正在收聽即時廣播，AI 雙語語音對齊與字幕翻譯運作中。',
                            isFinal: true,
                          };
                          window.dispatchEvent(new CustomEvent('new-subtitle', { detail: newItem }));
                          showToast('已即時產生並對齊全新雙語字幕段落！');
                        })
                        .catch(() => {
                          const newItem: SubtitleItem = {
                            id: `live-btn-${Date.now()}`,
                            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            createdAt: Date.now(),
                            english: 'You are listening to Live Public Radio Stream. Real-time AI speech recognition and bilingual translation engine active.',
                            traditionalChinese: '【廣播連線成功】您正在收聽即時廣播，AI 雙語語音對齊與字幕翻譯運作中。',
                            isFinal: true,
                          };
                          window.dispatchEvent(new CustomEvent('new-subtitle', { detail: newItem }));
                          showToast('已即時對齊雙語字幕段落！');
                        });
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>產生即時雙語字幕</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {/* Interim Real-time Streaming Partial Transcript if currently playing and on live tab */}
              {interimSubtitle && activeTab === 'live' && !sortAscending && playbackStatus === 'PLAYING' && (
                <motion.div
                  key="interim-live-streaming"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="mb-2"
                >
                  <BilingualSubtitleCard
                    subtitle={interimSubtitle}
                    searchQuery={searchQuery}
                    isLatest={true}
                    isInterim={true}
                    fontSize={fontSize}
                    theme={effectiveTheme}
                  />
                </motion.div>
              )}

              {filteredSubtitles.map((subtitle, index) => (
                <motion.div
                  key={subtitle.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <BilingualSubtitleCard
                    subtitle={subtitle}
                    onBookmarkToggle={onBookmarkToggle}
                    onOpenDictionary={onOpenDictionary}
                    searchQuery={searchQuery}
                    isLatest={index === 0 && activeTab === 'live' && !sortAscending && playbackStatus === 'PLAYING' && !interimSubtitle}
                    fontSize={fontSize}
                    segmentNumber={activeTab === 'history' ? (sortAscending ? index + 1 : filteredSubtitles.length - index) : undefined}
                    theme={effectiveTheme}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Non-intrusive AdMob Banner Ad (100% Free Ad-Supported Model) */}
        <BannerAd />

        {/* Material 3 Bottom Bar / FAB */}
        <div className={`p-3 border-t flex items-center justify-between sticky bottom-0 z-20 transition-colors duration-200 ${bottomBarBg}`}>
          <div className="text-xs font-medium flex items-center gap-2.5 opacity-90">
            <span>
              已記錄 <strong className={effectiveTheme === 'paper' ? 'text-amber-800 font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>{subtitles.length}</strong> 個 10 秒段落
            </span>

            {/* Check for Google Play App Update button (if AndroidBridge available) */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).AndroidBridge?.checkForAppUpdate) {
                  (window as any).AndroidBridge.checkForAppUpdate();
                } else {
                  showToast('目前為最新版本 (v2.2.2)');
                }
              }}
              title="檢查 Google Play 商店是否有最新版本"
              className={`p-1 rounded-lg border transition-all cursor-pointer opacity-70 hover:opacity-100 active:scale-95 ${
                effectiveTheme === 'paper'
                  ? 'border-[#D8C49E] text-[#2C2115]'
                  : effectiveTheme === 'light'
                  ? 'border-slate-300 text-slate-700'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onTogglePlayPause}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95 cursor-pointer ${
              playbackStatus === 'PLAYING'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {playbackStatus === 'PLAYING' ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>暫停收聽</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>收聽直播</span>
              </>
            )}
          </button>
        </div>

        {/* In-App Confirmation Modal (Ensures 100% Reliability on Android WebView & iFrames) */}
        <AnimatePresence>
          {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.18 }}
                className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border ${
                  effectiveTheme === 'paper'
                    ? 'bg-[#FDF8EE] border-[#D8C49E] text-[#2C2115]'
                    : effectiveTheme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base tracking-tight">{confirmModal.title}</h3>
                    <p className="text-[11px] opacity-70">請確認是否執行此清理動作</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed mb-6 opacity-85">
                  {confirmModal.message}
                </p>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      effectiveTheme === 'paper'
                        ? 'border-[#D8C49E] hover:bg-[#EFE6D2] text-[#2C2115]'
                        : effectiveTheme === 'light'
                        ? 'border-slate-300 hover:bg-slate-100 text-slate-700'
                        : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    取消
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirmModal.type === 'history') {
                        const now = Date.now();
                        setHistoryClearedAt(now);
                        try {
                          localStorage.setItem('radio_history_cleared_at', now.toString());
                        } catch (e) {}
                        onClearSubtitles();
                        setLiveClearedAt(null);
                        showToast('已清空廣播歷史紀錄（收藏句子已獨立保留）');
                      } else if (confirmModal.type === 'bookmarks') {
                        if (onClearBookmarks) {
                          onClearBookmarks();
                        } else {
                          subtitles.filter((s) => s.bookmarked).forEach((s) => onBookmarkToggle(s.id));
                        }
                        showToast('已清空所有已收藏的句子');
                      }
                      setConfirmModal(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    {confirmModal.confirmText}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
