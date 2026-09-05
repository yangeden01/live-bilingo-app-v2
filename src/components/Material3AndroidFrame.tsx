import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { SubtitleItem, PlaybackStatus, RadioStation, ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { FlashcardQuizModal } from './FlashcardQuizModal';
import { NativeInFeedAdCard } from './NativeInFeedAdCard';
import { MarqueeText } from './MarqueeText';
import { getApiUrl } from '../utils/apiUrl';
import { convertChinese } from '../utils/chineseConverter';
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
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  BookOpen,
  ArrowDownCircle,
  Lock,
  Volume2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playBeanWallImpactSound } from '../utils/sound';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { lookupQuickWord } from '../utils/quickDictionary';
import { translateEnglishToChinese } from '../utils/clientTranslation';
import { speakText } from '../utils/tts';

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
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize?: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
}

type FrameTab = 'live' | 'history' | 'bookmarks' | 'vocab';

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
  effectiveTheme: propEffectiveTheme,
  chineseVariant: propChineseVariant,
  onChineseVariantChange: propOnChineseVariantChange,
  fontSize: propFontSize,
  onFontSizeChange: propOnFontSizeChange,
}) => {
  const [activeTab, setActiveTab] = useState<FrameTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    type: 'history' | 'bookmarks' | 'vocab';
    title: string;
    message: string;
    confirmText: string;
  } | null>(null);
  const [localFontSize, setLocalFontSize] = useState<SubtitleFontSize>(() => {
    try {
      const saved = getPersistentItem('radio_subtitle_font_size');
      if (saved === 'small' || saved === 'medium' || saved === 'large' || saved === 'xlarge') return saved;
    } catch (e) {}
    return 'small';
  });

  const [localChineseVariant, setLocalChineseVariant] = useState<ChineseVariant>(() => {
    try {
      const saved = getPersistentItem('radio_chinese_variant');
      if (saved === 'traditional' || saved === 'simplified') return saved;
    } catch (e) {}
    return 'traditional';
  });

  const fontSize = propFontSize ?? localFontSize;
  const setFontSize = (size: SubtitleFontSize) => {
    setLocalFontSize(size);
    propOnFontSizeChange?.(size);
    try {
      setPersistentItem('radio_subtitle_font_size', size);
    } catch (e) {}
  };

  const chineseVariant = propChineseVariant ?? localChineseVariant;
  const setChineseVariant = (variant: ChineseVariant) => {
    setLocalChineseVariant(variant);
    propOnChineseVariantChange?.(variant);
    try {
      setPersistentItem('radio_chinese_variant', variant);
    } catch (e) {}
  };

  const [localReadingMode, setLocalReadingMode] = useState<ReadingMode>(() => {
    try {
      const saved = getPersistentItem('radio_reading_mode');
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
      setPersistentItem('radio_reading_mode', readingMode);
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

  const [currentHour, setCurrentHour] = useState<number>(() => new Date().getHours());

  useEffect(() => {
    const updateHour = () => setCurrentHour(new Date().getHours());
    updateHour();
    const interval = setInterval(updateHour, 30000);
    return () => clearInterval(interval);
  }, []);

  // Derived effective theme ('dark' | 'light' | 'paper')
  const effectiveTheme = useMemo<'dark' | 'light' | 'paper'>(() => {
    if (propEffectiveTheme) {
      return propEffectiveTheme;
    }
    if (readingMode === 'paper') return 'paper';
    if (readingMode === 'light') return 'light';
    if (readingMode === 'dark') return 'dark';

    // System / Ambient Light adaptive mode
    if (ambientLux !== null) {
      return ambientLux < 40 ? 'dark' : 'light';
    }
    if (systemPrefersDark) {
      return 'dark';
    }
    // Time-based automatic night mode: 18:00 to 07:00 is dark mode
    const isNightTime = currentHour >= 18 || currentHour < 7;
    if (isNightTime) {
      return 'dark';
    }
    return 'light';
  }, [propEffectiveTheme, readingMode, ambientLux, systemPrefersDark, currentHour]);

  useEffect(() => {
    try {
      setPersistentItem('radio_subtitle_font_size', fontSize);
    } catch (e) {}
  }, [fontSize]);
  const [sortAscending, setSortAscending] = useState(false); // false = newest first, true = oldest first
  const [liveClearedAt, setLiveClearedAt] = useState<number | null>(null);
  const [historyClearedAt, setHistoryClearedAt] = useState<number | null>(() => {
    try {
      const saved = getPersistentItem('radio_history_cleared_at');
      if (saved) return Number(saved) || null;
    } catch (e) {}
    return null;
  });
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const prevTopItemIdRef = useRef<string | null>(null);

  // Auto-scroll subtitle list container to top when active station changes, and auto-switch to live tab
  useEffect(() => {
    setActiveTab('live');
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeStation?.id, activeStation?.streamUrl]);

  // Reset internal list container scroll when returning to reading mode
  useEffect(() => {
    const handleScrollToSubtitles = () => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('scroll-to-subtitles', handleScrollToSubtitles);
    return () => {
      window.removeEventListener('scroll-to-subtitles', handleScrollToSubtitles);
    };
  }, []);

  // Keep scroll position 100% stable & fixed when the user scrolls down to read previous paragraphs
  useLayoutEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;

    const currentScrollTop = el.scrollTop;
    const currentScrollHeight = el.scrollHeight;
    const prevScrollHeight = prevScrollHeightRef.current;
    const topItem = filteredSubtitles[0]?.id;
    const isNewItemPrepended = prevTopItemIdRef.current && topItem && topItem !== prevTopItemIdRef.current;

    if (isNewItemPrepended && prevScrollHeight > 0 && currentScrollTop >= 40) {
      // User has scrolled down to read previous paragraphs.
      // Compensate scrollTop by the exact delta of the prepended content so the currently viewed paragraph remains 100% frozen in place!
      const heightDelta = currentScrollHeight - prevScrollHeight;
      if (heightDelta > 0) {
        el.scrollTop = currentScrollTop + heightDelta;
      }
    } else if (activeTab === 'live' && currentScrollTop < 40 && isNewItemPrepended) {
      // User is at the very top watching the latest live subtitles
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }

    prevScrollHeightRef.current = el.scrollHeight;
    prevTopItemIdRef.current = topItem || null;
  });

  const showToast = (message: string) => {
    setCopiedToast(message);
    setTimeout(() => {
      setCopiedToast(null);
    }, 2500);
  };

  const [savedWordsList, setSavedWordsList] = useState<string[]>(() => {
    try {
      const saved = getPersistentItem('saved_dict_words');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  // Chinese translation visibility in vocabulary notes (persistent across mode changes and app restarts)
  const [vocabShowChinese, setVocabShowChinese] = useState<boolean>(() => {
    try {
      const saved = getPersistentItem('vocab_show_chinese');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  // Temporarily revealed words in "Hide Chinese" mode when tapped
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());

  // Cached asynchronous translations for saved words not in built-in dictionary
  const [asyncWordTranslations, setAsyncWordTranslations] = useState<Record<string, string>>(() => {
    try {
      const saved = getPersistentItem('cached_word_translations');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [highlightDifficulty, setHighlightDifficulty] = useState<boolean>(() => {
    try {
      const saved = getPersistentItem('radio_highlight_difficulty');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [isQuizOpen, setIsQuizOpen] = useState(false);

  const handleToggleVocabShowChinese = (show: boolean) => {
    setVocabShowChinese(show);
    // Reset individual revealed words when toggling mode
    setRevealedWords(new Set());
    try {
      setPersistentItem('vocab_show_chinese', String(show));
    } catch (e) {}
  };

  // Automatically fetch Chinese translations for any saved words without offline definitions
  useEffect(() => {
    if (savedWordsList.length === 0) return;
    let isMounted = true;

    const translateMissingWords = async () => {
      let updatedTranslations = { ...asyncWordTranslations };
      let hasUpdates = false;

      for (const word of savedWordsList) {
        const quick = lookupQuickWord(word);
        if (!quick && !updatedTranslations[word]) {
          try {
            const zh = await translateEnglishToChinese(word);
            if (zh && zh !== word) {
              updatedTranslations[word] = zh;
              hasUpdates = true;
            }
          } catch (e) {}
        }
      }

      if (hasUpdates && isMounted) {
        setAsyncWordTranslations(updatedTranslations);
        try {
          setPersistentItem('cached_word_translations', JSON.stringify(updatedTranslations));
        } catch (e) {}
      }
    };

    translateMissingWords();
    return () => {
      isMounted = false;
    };
  }, [savedWordsList]);

  // Sync saved words
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = getPersistentItem('saved_dict_words');
        setSavedWordsList(saved ? JSON.parse(saved) : []);
      } catch (e) {
        setSavedWordsList([]);
      }
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, [activeTab]);

  const vocabCount = savedWordsList.length;

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
    if (activeTab === 'vocab') return [];
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

      // 4. Search query condition (supports Traditional & Simplified matching)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const qSimp = convertChinese(q, 'simplified').toLowerCase();
        const qTrad = convertChinese(q, 'traditional').toLowerCase();
        const matchEng = item.english.toLowerCase().includes(q);
        const rawChi = item.traditionalChinese.toLowerCase();
        const simpChi = convertChinese(rawChi, 'simplified').toLowerCase();
        const matchChi =
          rawChi.includes(q) ||
          rawChi.includes(qSimp) ||
          rawChi.includes(qTrad) ||
          simpChi.includes(q) ||
          simpChi.includes(qSimp) ||
          simpChi.includes(qTrad);
        if (!matchEng && !matchChi) return false;
      }

      return true;
    }).sort((a, b) => {
      // Live Broadcast mode: ALWAYS newest on top (descending by timestamp), 100% independent and unaffected by history sort toggle
      if (activeTab === 'live') {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      }

      // History / Bookmarks tabs: respect sortAscending preference
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) {
        return sortAscending ? timeA - timeB : timeB - timeA;
      }
      return sortAscending ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    }).slice(0, activeTab === 'live' ? 50 : undefined);
  }, [subtitles, activeTab, liveClearedAt, historyClearedAt, searchQuery, sortAscending]);

  // Filtered vocabulary list
  const filteredVocabList = useMemo(() => {
    if (activeTab !== 'vocab') return [];
    return savedWordsList;
  }, [activeTab, savedWordsList]);

  const handleDeleteWord = (wordToDelete: string) => {
    const updated = savedWordsList.filter((w) => w !== wordToDelete);
    setSavedWordsList(updated);
    try {
      setPersistentItem('saved_dict_words', JSON.stringify(updated));
      setTimeout(() => {
        window.dispatchEvent(new Event('storage'));
      }, 0);
      showToast(`已移除生詞「${wordToDelete}」`);
    } catch (e) {}
  };

  const handleSpeakWord = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    speakText(
      word,
      () => setSpeakingWord(word),
      () => setSpeakingWord(null),
      () => setSpeakingWord(null)
    );
  };

  // Stable Ad Anchor Map: Permanently anchor Native In-Feed Ads every 15 paragraphs (15:1 ratio)
  const adAttachedSubtitleIds = useMemo(() => {
    if (!subtitles || subtitles.length === 0) return new Map<string, number>();

    const adMap = new Map<string, number>();

    // 1. First check if items have explicit attachedAdIndex
    let foundExplicit = false;
    subtitles.forEach((sub) => {
      if (typeof sub.attachedAdIndex === 'number') {
        adMap.set(sub.id, sub.attachedAdIndex);
        foundExplicit = true;
      }
    });

    if (foundExplicit && adMap.size > 0) {
      return adMap;
    }

    // 2. Deterministic sort chronologically (oldest = index 0) with tie-breaker by ID
    const sortedChronological = [...subtitles].sort((a, b) => {
      const diff = (a.createdAt || 0) - (b.createdAt || 0);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    sortedChronological.forEach((sub, chronIndex) => {
      if (sub.hasAttachedAd || (chronIndex + 1) >= 15 && (chronIndex + 1) % 15 === 0) {
        // Anchor an in-feed ad every 15th paragraph (at #15, #30, #45...)
        const creativeIndex = (Math.floor((chronIndex + 1) / 15) - 1) % 5;
        adMap.set(sub.id, creativeIndex);
      }
    });

    return adMap;
  }, [subtitles]);

  // Export full transcript as text
  const getFormattedTranscript = () => {
    const stationName = activeStation?.name || 'Live Bilingo';
    const header = `=== ${stationName} 雙語廣播逐字稿歷史紀錄 ===\n匯出時間：${new Date().toLocaleString('zh-TW')}\n總段落數：${filteredSubtitles.length}\n----------------------------------------\n\n`;

    const body = filteredSubtitles
      .map((item, index) => {
        const chi =
          chineseVariant === 'simplified'
            ? convertChinese(item.traditionalChinese, 'simplified')
            : item.traditionalChinese;
        return `[段落 #${filteredSubtitles.length - index}] ${item.timestamp}\n英文廣播: ${item.english}\n中文翻譯: ${chi}\n`;
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

  const vocabWordFontSize = {
    small: 'text-base sm:text-lg font-black tracking-wide',
    medium: 'text-lg sm:text-xl font-black tracking-wide',
    large: 'text-xl sm:text-2xl font-black tracking-wide',
    xlarge: 'text-2xl sm:text-3xl font-black tracking-wide',
  }[fontSize];

  const vocabZhFontSize = {
    small: 'text-xs sm:text-sm leading-relaxed',
    medium: 'text-sm sm:text-base leading-relaxed',
    large: 'text-base sm:text-lg leading-relaxed',
    xlarge: 'text-lg sm:text-xl leading-relaxed font-medium',
  }[fontSize];

  const vocabPhoneticFontSize = {
    small: 'text-xs',
    medium: 'text-xs sm:text-sm',
    large: 'text-sm',
    xlarge: 'text-sm sm:text-base',
  }[fontSize];

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
    <div id="subtitle-frame-top" className={`rounded-3xl p-3 sm:p-6 border shadow-2xl relative max-w-4xl mx-auto scroll-mt-20 sm:scroll-mt-24 transition-colors duration-200 ${outerFrameBg}`}>
      {/* Phone Screen Container */}
      <div className={`rounded-2xl overflow-hidden shadow-inner border flex flex-col min-h-[680px] transition-colors duration-200 ${screenContainerBg}`}>
        
        {/* Unified Top Control Deck Panel (Seamless Container) */}
        <div className={`border-b flex flex-col select-none transition-colors duration-200 ${headerDeckBg}`}>
          {/* Android Top Header Status, Reading Mode & Font Switcher Bar (Single Compact Row) */}
          <div className="px-2.5 sm:px-4 pt-3 pb-2.5 flex items-center justify-between gap-1 sm:gap-2 text-xs select-none">
            {/* Title: Radio Icon + 雙語字幕 */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 select-none">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-black tracking-tight whitespace-nowrap">雙語字幕</span>
              {readingMode === 'system' && (
                <span className="hidden 2xl:inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-400/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  感應中
                </span>
              )}
            </div>

            {/* Dynamic Difficulty Legend (Visible only when 難字標註 is activated - Single line 2-column compact list) */}
            {highlightDifficulty && (
              <div className="flex items-center gap-x-1.5 sm:gap-x-2 text-[8.5px] sm:text-[9.5px] leading-tight animate-fadeIn select-none shrink-0 mx-auto">
                {/* Left Column: B1 & B2 */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-0.5">
                    <span className="px-1 py-0.2 rounded font-mono font-black text-[7.5px] sm:text-[8.5px] leading-none bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-400/40 shrink-0">
                      B1
                    </span>
                    <span className="text-[8px] sm:text-[9px] opacity-85 whitespace-nowrap">中級實用</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <span className="px-1 py-0.2 rounded font-mono font-black text-[7.5px] sm:text-[8.5px] leading-none bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/50 shrink-0">
                      B2
                    </span>
                    <span className="text-[8px] sm:text-[9px] opacity-85 whitespace-nowrap">中高階</span>
                  </div>
                </div>

                {/* Right Column: C1 & C2 */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-0.5">
                    <span className="px-1 py-0.2 rounded font-mono font-black text-[7.5px] sm:text-[8.5px] leading-none bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/50 shrink-0">
                      C1
                    </span>
                    <span className="text-[8px] sm:text-[9px] opacity-85 whitespace-nowrap">進階詞</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <span className="px-1 py-0.2 rounded font-mono font-black text-[7.5px] sm:text-[8.5px] leading-none bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/50 shrink-0">
                      C2
                    </span>
                    <span className="text-[8px] sm:text-[9px] opacity-85 whitespace-nowrap">母語精通</span>
                  </div>
                </div>
              </div>
            )}

            {/* CEFR Difficulty Highlighter Toggle Button */}
            <button
              type="button"
              id="difficulty-highlighter-btn"
              onClick={() => {
                setHighlightDifficulty((prev) => {
                  const next = !prev;
                  try {
                    setPersistentItem('radio_highlight_difficulty', String(next));
                  } catch (e) {}
                  setTimeout(playBeanWallImpactSound, 135);
                  return next;
                });
              }}
              title={highlightDifficulty ? '點擊關閉 CEFR 難字標註' : '點擊開啟 CEFR 難字標註（多益/雅思/B2/C1高階詞）'}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm select-none shrink-0 active:scale-95 ${
                highlightDifficulty
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 ring-1 ring-amber-400/40 font-black'
                  : fontSizeUnselected
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="whitespace-nowrap">難字標註</span>
            </button>
          </div>

          {/* OneNote Layered Deck Style Overlapping Tabs Bar (即時 / 紀錄 / 收藏 / 生詞) */}
          <div id="subtitle-tabs-bar" className="pt-1 px-1 sm:px-2 pb-0 scroll-mt-14 sm:scroll-mt-16">
            <div className="flex items-end border-b border-slate-300 dark:border-slate-700/80 px-0.5 pt-1 select-none w-full relative isolate">
              {/* Tab 1: 即時 (Live) - Leftmost Tab (zIndex: Active 40, Inactive 25) */}
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                title="即時廣播 (Live)"
                style={{ zIndex: activeTab === 'live' ? 40 : 25 }}
                className={`relative flex-1 min-w-0 flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-t-xl font-bold cursor-pointer whitespace-nowrap select-none -mr-2.5 sm:-mr-3 transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out will-change-transform ${
                  activeTab === 'live'
                    ? 'bg-blue-600 text-white shadow-lg -mb-[1px] border-t-2 border-x-2 border-blue-400 font-extrabold scale-[1.03] origin-bottom'
                    : effectiveTheme === 'paper'
                    ? 'bg-[#EADDC3] text-blue-900 border-t border-r border-[#CBB895] shadow-[2px_0_4px_rgba(0,0,0,0.1)] hover:bg-[#E2D2B0]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-200 text-blue-800 border-t border-r border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.08)] hover:bg-slate-300/80'
                    : 'bg-[#1e293b] text-blue-300 border-t border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.45)] hover:bg-[#273549]'
                }`}
              >
                <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${activeTab === 'live' ? 'animate-pulse text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                <span className="text-[11px] sm:text-sm tracking-tight font-extrabold truncate">即時</span>
                {liveCount > 0 && (
                  <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black font-mono leading-none shrink-0 min-w-[14px] text-center ${
                    activeTab === 'live' ? 'bg-white text-blue-700 shadow-xs' : 'bg-blue-300/90 dark:bg-blue-900 text-blue-950 dark:text-blue-100'
                  }`}>
                    {Math.min(50, liveCount)}
                  </span>
                )}
              </button>

              {/* Tab 2: 紀錄 (History) - Second Tab (zIndex: Active 40, Inactive 20) */}
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                title="歷史紀錄 (History)"
                style={{ zIndex: activeTab === 'history' ? 40 : 20 }}
                className={`relative flex-1 min-w-0 flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-t-xl font-bold cursor-pointer whitespace-nowrap select-none -mr-2.5 sm:-mr-3 transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out will-change-transform ${
                  activeTab === 'history'
                    ? 'bg-teal-600 text-white shadow-lg -mb-[1px] border-t-2 border-x-2 border-teal-300 font-extrabold scale-[1.03] origin-bottom'
                    : effectiveTheme === 'paper'
                    ? 'bg-[#EADDC3] text-teal-900 border-t border-r border-[#CBB895] shadow-[2px_0_4px_rgba(0,0,0,0.1)] hover:bg-[#E2D2B0]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-200 text-teal-800 border-t border-r border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.08)] hover:bg-slate-300/80'
                    : 'bg-[#1e293b] text-teal-300 border-t border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.45)] hover:bg-[#273549]'
                }`}
              >
                <History className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${activeTab === 'history' ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                <span className="text-[11px] sm:text-sm tracking-tight font-extrabold truncate">紀錄</span>
                {historyCount > 0 && (
                  <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black font-mono leading-none shrink-0 min-w-[14px] text-center ${
                    activeTab === 'history' ? 'bg-white text-teal-700 shadow-xs' : 'bg-teal-300/90 dark:bg-teal-900 text-teal-950 dark:text-teal-100'
                  }`}>
                    {historyCount}
                  </span>
                )}
              </button>

              {/* Tab 3: 收藏 (Bookmarks) - Third Tab (zIndex: Active 40, Inactive 15) */}
              <button
                type="button"
                onClick={() => setActiveTab('bookmarks')}
                title="精選收藏 (Bookmarks)"
                style={{ zIndex: activeTab === 'bookmarks' ? 40 : 15 }}
                className={`relative flex-1 min-w-0 flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-t-xl font-bold cursor-pointer whitespace-nowrap select-none -mr-2.5 sm:-mr-3 transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out will-change-transform ${
                  activeTab === 'bookmarks'
                    ? 'bg-amber-500 text-slate-950 shadow-lg -mb-[1px] border-t-2 border-x-2 border-amber-300 font-extrabold scale-[1.03] origin-bottom'
                    : effectiveTheme === 'paper'
                    ? 'bg-[#EADDC3] text-amber-900 border-t border-r border-[#CBB895] shadow-[2px_0_4px_rgba(0,0,0,0.1)] hover:bg-[#E2D2B0]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-200 text-amber-800 border-t border-r border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.08)] hover:bg-slate-300/80'
                    : 'bg-[#1e293b] text-amber-300 border-t border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.45)] hover:bg-[#273549]'
                }`}
              >
                <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${activeTab === 'bookmarks' ? 'fill-current text-slate-950' : 'text-amber-600 dark:text-amber-400'}`} />
                <span className="text-[11px] sm:text-sm tracking-tight font-extrabold truncate">收藏</span>
                {bookmarkedCount > 0 && (
                  <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black font-mono leading-none shrink-0 min-w-[14px] text-center ${
                    activeTab === 'bookmarks' ? 'bg-slate-950 text-amber-300 shadow-xs' : 'bg-amber-300/90 dark:bg-amber-900 text-amber-950 dark:text-amber-100'
                  }`}>
                    {bookmarkedCount}
                  </span>
                )}
              </button>

              {/* Tab 4: 生詞 (Vocabulary) - Rightmost Tab (zIndex: Active 40, Inactive 10) */}
              <button
                type="button"
                onClick={() => setActiveTab('vocab')}
                title="生詞筆記 (Vocabulary)"
                style={{ zIndex: activeTab === 'vocab' ? 40 : 10 }}
                className={`relative flex-1 min-w-0 flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-t-xl font-bold cursor-pointer whitespace-nowrap select-none transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out will-change-transform ${
                  activeTab === 'vocab'
                    ? 'bg-emerald-600 text-white shadow-lg -mb-[1px] border-t-2 border-x-2 border-emerald-300 font-extrabold scale-[1.03] origin-bottom'
                    : effectiveTheme === 'paper'
                    ? 'bg-[#EADDC3] text-emerald-900 border-t border-[#CBB895] hover:bg-[#E2D2B0]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-200 text-emerald-800 border-t border-slate-300 hover:bg-slate-300/80'
                    : 'bg-[#1e293b] text-emerald-300 border-t border-slate-700 hover:bg-[#273549]'
                }`}
              >
                <BookOpen className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${activeTab === 'vocab' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                <span className="text-[11px] sm:text-sm tracking-tight font-extrabold truncate">生詞</span>
                {vocabCount > 0 && (
                  <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black font-mono leading-none shrink-0 min-w-[14px] text-center ${
                    activeTab === 'vocab' ? 'bg-white text-emerald-700 shadow-xs' : 'bg-emerald-300/90 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100'
                  }`}>
                    {vocabCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Input Bar & Clear Data Button / Chinese Visibility Switcher for Vocab */}
          <div id="subtitle-search-bar" className="px-3 py-1.5 flex items-center justify-between gap-2 scroll-mt-14 sm:scroll-mt-16">
            {activeTab === 'vocab' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`inline-flex items-center p-0.5 rounded-lg border text-xs font-bold transition-colors ${
                  effectiveTheme === 'paper'
                    ? 'bg-[#EADDC2]/80 border-[#C8B282]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-900 border-slate-700'
                }`}>
                  <button
                    type="button"
                    onClick={() => handleToggleVocabShowChinese(true)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer text-xs font-bold ${
                      vocabShowChinese
                        ? effectiveTheme === 'paper'
                          ? 'bg-[#4A3B2C] text-[#FFFDF7] shadow-xs'
                          : 'bg-emerald-600 text-white shadow-xs'
                        : effectiveTheme === 'paper'
                        ? 'text-[#6B5840] hover:text-[#2C1D0F]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="顯示單字中文釋義"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">顯示中文</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleVocabShowChinese(false)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer text-xs font-bold ${
                      !vocabShowChinese
                        ? effectiveTheme === 'paper'
                          ? 'bg-[#4A3B2C] text-[#FFFDF7] shadow-xs'
                          : 'bg-emerald-600 text-white shadow-xs'
                        : effectiveTheme === 'paper'
                        ? 'text-[#6B5840] hover:text-[#2C1D0F]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="隱藏中文釋義，自我測驗單字記憶"
                  >
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">隱藏中文</span>
                  </button>
                </div>

                {/* Flashcard Quiz Interactive Modal Trigger (Neutral action button, not looking pre-selected) */}
                <button
                  type="button"
                  onClick={() => setIsQuizOpen(true)}
                  disabled={savedWordsList.length === 0}
                  title={savedWordsList.length === 0 ? '目前尚無生詞，請先在字幕中點擊單字加入' : '啟動單字翻卡測驗 (Flashcard Quiz)'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-extrabold border select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    effectiveTheme === 'paper'
                      ? 'bg-[#FFFDF7] hover:bg-[#F4EAD5] text-[#3B2E1E] border-[#C8B282] shadow-xs'
                      : effectiveTheme === 'light'
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-600/80 shadow-xs hover:border-slate-500'
                  }`}
                >
                  <span className="shrink-0">🎴 翻卡測驗</span>
                  {savedWordsList.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none shrink-0 ${
                      effectiveTheme === 'paper'
                        ? 'bg-[#EADDC2] text-[#4A3B2C]'
                        : effectiveTheme === 'light'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {savedWordsList.length}
                    </span>
                  )}
                </button>
              </div>
            ) : (
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
            )}

            {activeTab !== 'vocab' && searchQuery && (
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
                } else if (activeTab === 'vocab') {
                  if (vocabCount === 0) {
                    showToast('生詞筆記目前是空的');
                  } else {
                    setConfirmModal({
                      type: 'vocab',
                      title: '清空所有生詞筆記',
                      message: `確定要清空目前收藏的 ${vocabCount} 個生詞筆記嗎？此動作將清除所有生詞紀錄。`,
                      confirmText: '確認清空生詞本',
                    });
                  }
                }
              }}
              title={
                activeTab === 'live'
                  ? '僅清空目前即時字幕畫面，不影響歷史紀錄'
                  : activeTab === 'history'
                  ? '刪除所有廣播歷史紀錄'
                  : activeTab === 'bookmarks'
                  ? '清空已收藏句子列表'
                  : '清空生詞筆記'
              }
              className={`px-2.5 py-1.5 rounded-lg transition-all shadow-xs active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap ${deleteBtnBg}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>
                {activeTab === 'live'
                  ? '刪除即時資料'
                  : activeTab === 'history'
                  ? '刪除歷史資料'
                  : activeTab === 'bookmarks'
                  ? '刪除收藏資料'
                  : '清空生詞本'}
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

        {/* Subtitle / History / Bookmark / Vocab List Container */}
        <div ref={listContainerRef} className={`flex-1 p-2.5 sm:p-3.5 pt-2.5 sm:pt-3.5 overflow-y-auto space-y-2.5 sm:space-y-3 relative transition-colors duration-200 ${listBg}`}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2.5 sm:space-y-3 will-change-[opacity,transform]"
          >
            {activeTab === 'vocab' ? (
              filteredVocabList.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[360px] text-center p-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border ${
                    effectiveTheme === 'paper'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50'
                  }`}>
                    <BookOpen className="w-8 h-8" />
                  </div>

                  <h3 className={`font-bold text-lg mb-1 ${effectiveTheme === 'paper' ? 'text-[#3B2E1E]' : 'text-slate-800 dark:text-slate-100'}`}>
                    尚未加入任何生詞筆記
                  </h3>

                  <p className={`text-xs max-w-sm leading-relaxed mb-4 ${effectiveTheme === 'paper' ? 'text-[#6B5840]' : 'text-slate-500 dark:text-slate-400'}`}>
                    在雙語字幕卡片中點擊任何英文單字即可查字典，並點擊星星圖示將單字加入專屬生詞本。
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredVocabList.map((word) => {
                    const quickMatch = lookupQuickWord(word);
                    const rawZh = quickMatch?.zh || asyncWordTranslations[word] || '';
                    const zhTrans = rawZh || '英語廣播常用單字';
                    const phonetic = quickMatch?.phonetic;
                    const isSpeaking = speakingWord === word;
                    const isRevealed = revealedWords.has(word);
                    const isChineseVisible = vocabShowChinese || isRevealed;

                    return (
                      <div
                        key={word}
                        className={`p-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 shadow-sm cursor-pointer ${
                          effectiveTheme === 'paper'
                            ? 'bg-[#FFFDF7] border-[#C8B282] hover:bg-[#F2E8D3] hover:border-[#8C765C]'
                            : effectiveTheme === 'light'
                            ? 'bg-white border-slate-300 hover:border-emerald-500 hover:shadow-md'
                            : 'bg-slate-800 border-slate-600 hover:border-emerald-400 hover:bg-slate-750'
                        }`}
                        onClick={() => {
                          if (vocabShowChinese) {
                            onOpenDictionary?.(word);
                          } else {
                            // In "Hide Chinese" mode, clicking the card toggles revealing/hiding Chinese translation
                            setRevealedWords((prev) => {
                              const next = new Set(prev);
                              if (next.has(word)) {
                                next.delete(word);
                              } else {
                                next.add(word);
                              }
                              return next;
                            });
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`${vocabWordFontSize} ${
                              effectiveTheme === 'paper'
                                ? 'text-[#2C1D0F]'
                                : effectiveTheme === 'light'
                                ? 'text-slate-950'
                                : 'text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                            }`}>
                              {word}
                            </span>
                            {phonetic && (
                              <span className={`${vocabPhoneticFontSize} font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                effectiveTheme === 'paper'
                                  ? 'bg-[#EADDC2] text-[#4A3B2C]'
                                  : effectiveTheme === 'light'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-slate-900 text-slate-200 border border-slate-700'
                              }`}>
                                /{phonetic}/
                              </span>
                            )}
                          </div>

                          {isChineseVisible ? (
                            <p
                              className={`${vocabZhFontSize} mt-1.5 font-medium ${
                                effectiveTheme === 'paper'
                                  ? 'text-[#4A3B2C]'
                                  : effectiveTheme === 'light'
                                  ? 'text-slate-800'
                                  : 'text-slate-100'
                              }`}
                            >
                              {chineseVariant === 'simplified' ? convertChinese(zhTrans, 'simplified') : zhTrans}
                              {!vocabShowChinese && (
                                <span className="ml-2 text-[11px] text-amber-500/80 font-normal">
                                  (已展開 · 點擊重新隱藏)
                                </span>
                              )}
                            </p>
                          ) : (
                            <div
                              className="flex items-center gap-1.5 mt-2 py-0.5 px-2 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-500 hover:text-amber-400 border border-amber-500/20 w-fit transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>點擊顯示中文釋義</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleSpeakWord(word, e)}
                            title="單字發音"
                            className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                              isSpeaking
                                ? 'bg-emerald-500 text-white animate-pulse'
                                : effectiveTheme === 'paper'
                                ? 'bg-[#EADDC2] text-[#2C1D0F] hover:bg-[#DFCFA8]'
                                : effectiveTheme === 'light'
                                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-slate-700 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-slate-600'
                            }`}
                          >
                            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDictionary?.(word);
                            }}
                            title="查閱完整字典"
                            className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                              effectiveTheme === 'paper'
                                ? 'bg-[#EADDC2] text-[#2C1D0F] hover:bg-[#DFCFA8]'
                                : effectiveTheme === 'light'
                                ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                                : 'bg-slate-700 text-blue-300 hover:bg-blue-600 hover:text-white border border-slate-600'
                            }`}
                          >
                            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWord(word);
                            }}
                            title="從生詞本移除"
                            className="p-2.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer border border-transparent hover:border-rose-300 dark:hover:border-rose-800"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : filteredSubtitles.length === 0 ? (
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
              <>
                {/* Interim Real-time Streaming Partial Transcript if currently playing and on live tab */}
                {interimSubtitle && activeTab === 'live' && !sortAscending && playbackStatus === 'PLAYING' && (
                  <div className="mb-2">
                    <BilingualSubtitleCard
                      subtitle={interimSubtitle}
                      searchQuery={searchQuery}
                      isLatest={true}
                      isInterim={true}
                      fontSize={fontSize}
                      chineseVariant={chineseVariant}
                      highlightDifficulty={highlightDifficulty}
                      theme={effectiveTheme}
                    />
                  </div>
                )}

                {filteredSubtitles.map((subtitle, index) => {
                  const attachedAdIndex = adAttachedSubtitleIds.get(subtitle.id) ?? subtitle.attachedAdIndex ?? subtitle.adIndex;
                  // Strict Rule: In live mode, the top 10 newest paragraphs (index < 10) never display ads
                  const isTop10InLive = activeTab === 'live' && index < 10;
                  const shouldRenderAd = !isTop10InLive && attachedAdIndex !== undefined;

                  return (
                    <div
                      key={subtitle.id}
                      className="flex flex-col gap-2.5 sm:gap-3"
                    >
                      <BilingualSubtitleCard
                        subtitle={subtitle}
                        onBookmarkToggle={onBookmarkToggle}
                        onOpenDictionary={onOpenDictionary}
                        searchQuery={searchQuery}
                        isLatest={index === 0 && activeTab === 'live' && !sortAscending && playbackStatus === 'PLAYING' && !interimSubtitle}
                        fontSize={fontSize}
                        chineseVariant={chineseVariant}
                        highlightDifficulty={highlightDifficulty}
                        segmentNumber={activeTab === 'history' ? (sortAscending ? index + 1 : filteredSubtitles.length - index) : undefined}
                        theme={effectiveTheme}
                      />

                      {/* Permanently Anchored Native In-Feed Ad Card (relative position is 100% fixed directly after this subtitle) */}
                      {shouldRenderAd && (
                        <NativeInFeedAdCard
                          index={attachedAdIndex!}
                          theme={effectiveTheme}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </motion.div>
        </div>

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
                  showToast('目前為最新版本 (v2.3.2)');
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
                          setPersistentItem('radio_history_cleared_at', now.toString());
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
                      } else if (confirmModal.type === 'vocab') {
                        setSavedWordsList([]);
                        try {
                          setPersistentItem('saved_dict_words', JSON.stringify([]));
                          setTimeout(() => {
                            window.dispatchEvent(new Event('storage'));
                          }, 0);
                        } catch (e) {}
                        showToast('已清空所有生詞筆記');
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

        {/* Flashcard Quiz Modal */}
        <FlashcardQuizModal
          isOpen={isQuizOpen}
          onClose={() => setIsQuizOpen(false)}
          words={savedWordsList}
          theme={effectiveTheme}
          chineseVariant={chineseVariant}
          asyncWordTranslations={asyncWordTranslations}
        />

      </div>
    </div>
  );
};
