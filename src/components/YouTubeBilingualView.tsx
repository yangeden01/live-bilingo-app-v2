import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { YouTubeBilingualPlayer, YouTubePlayerRef } from './YouTubeBilingualPlayer';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { useYouTubeSubtitles } from '../hooks/useYouTubeSubtitles';
import { extractYouTubeVideoId } from '../utils/youtubeUrl';
import { YouTubeSubtitleItem, SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize, YouTubeNewsVideo, YouTubeSavedUrl } from '../types';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { vibrateDetentTick } from '../utils/haptics';
import {
  getSavedYouTubeUrls,
  saveYouTubeUrl,
  removeSavedYouTubeUrl,
  isYouTubeUrlSaved,
  updateSavedYouTubeUrlTitle,
} from '../utils/youtubeFavorites';
import {
  Youtube,
  RotateCw,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  Clock,
  HelpCircle,
  Trash2,
  X,
  ChevronDown,
  History,
  Newspaper,
  Star,
  Tv,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Play,
  Pause,
  Crown,
  Download,
  FileText,
  BookMarked,
  GraduationCap,
} from 'lucide-react';
import { ReadingModeAndFontToolbar } from './ReadingModeAndFontToolbar';
import { YouTubeNewsDiscoveryModal } from './YouTubeNewsDiscoveryModal';
import { NotesExportModal } from './NotesExportModal';
import { VocabularyNotebookModal } from './VocabularyNotebookModal';
import { AdManager } from '../utils/adManager';
import { ReviewManager } from '../utils/reviewManager';

interface Props {
  onOpenDictionary?: (word?: string) => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize?: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
  highlightDifficulty?: boolean;
  onHighlightDifficultyChange?: (enabled: boolean) => void;
  onPlaybackStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'idle') => void;
  isVideoLoopEnabled?: boolean;
  onSwitchToRadioMode?: () => void;
}

// Preset verified caption test video (passes all 6 backend extraction criteria 100%)
export const VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO = {
  id: 'MiAl9CNZUuo',
  url: 'https://youtu.be/MiAl9CNZUuo?si=Qwpeu5kv-iGQheJU',
  title: 'Jensen Huang Outlines AI Future (雙語影音示範)',
};

export interface YouTubeHistoryItem {
  url: string;
  videoId: string;
  title?: string;
  timestamp: number;
}

const YOUTUBE_HISTORY_STORAGE_KEY = 'youtube_url_history_list';

// Helper to load persistent YouTube URL history
const getSavedYouTubeHistory = (): YouTubeHistoryItem[] => {
  try {
    const raw = getPersistentItem(YOUTUBE_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  // Default with the verified test video if history is empty
  return [
    {
      url: VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url,
      videoId: VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id,
      title: VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title,
      timestamp: Date.now(),
    },
  ];
};

// Videos must always start from time zero (0:00) from the very beginning
const getSavedProgressForVideo = (_vid: string): number => {
  return 0;
};

export const YouTubeBilingualView: React.FC<Props> = ({
  onOpenDictionary,
  readingMode = 'system',
  onReadingModeChange,
  effectiveTheme = 'dark',
  chineseVariant = 'traditional',
  onChineseVariantChange,
  fontSize = 'medium',
  onFontSizeChange,
  highlightDifficulty: propHighlightDifficulty,
  onHighlightDifficultyChange: propOnHighlightDifficultyChange,
  onPlaybackStateChange,
  isVideoLoopEnabled = false,
  onSwitchToRadioMode,
}) => {
  const [localHighlightDifficulty, setLocalHighlightDifficulty] = useState<boolean>(() => {
    try {
      const saved = getPersistentItem('bilingo_highlight_difficulty') || getPersistentItem('radio_highlight_difficulty');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const highlightDifficulty = propHighlightDifficulty !== undefined ? propHighlightDifficulty : localHighlightDifficulty;

  const handleToggleHighlightDifficulty = (enabled: boolean) => {
    if (propOnHighlightDifficultyChange) {
      propOnHighlightDifficultyChange(enabled);
    } else {
      setLocalHighlightDifficulty(enabled);
    }
    try {
      setPersistentItem('bilingo_highlight_difficulty', String(enabled));
      setPersistentItem('radio_highlight_difficulty', String(enabled));
    } catch (e) {}
  };

  // Pre-fill YouTube URL and video ID from persistent storage or default test video
  const [urlInput, setUrlInput] = useState<string>(() => {
    return getPersistentItem('youtube_last_url') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url;
  });
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string>(() => {
    const savedId = getPersistentItem('youtube_last_video_id');
    if (savedId) return savedId;
    const savedUrl = getPersistentItem('youtube_last_url');
    if (savedUrl) {
      const extracted = extractYouTubeVideoId(savedUrl);
      if (extracted) return extracted;
    }
    return VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id;
  });

  const currentTheme = effectiveTheme || (readingMode === 'paper' ? 'paper' : readingMode === 'light' ? 'light' : 'dark');
  const isLightOrPaper = currentTheme === 'paper' || currentTheme === 'light';

  const cardBgClass =
    currentTheme === 'paper'
      ? 'bg-[#FAF4E8] text-[#3B2E1E] border-[#E2D2B0] shadow-xl shadow-amber-900/5'
      : currentTheme === 'light'
      ? 'bg-white/95 text-slate-900 border-slate-200 shadow-xl shadow-slate-200/60'
      : 'bg-slate-900/90 text-white border-slate-800/80 shadow-xl';

  const inputBgClass =
    currentTheme === 'paper'
      ? 'bg-[#F5ECD7] border-[#D8C49E] text-[#3B2E1E] placeholder-[#8C765C] focus:border-amber-600'
      : currentTheme === 'light'
      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-rose-500'
      : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-rose-500';

  const testBtnClass =
    currentTheme === 'paper'
      ? 'bg-[#EFE5CE] hover:bg-[#E5D9BE] active:bg-[#DBCFB3] text-[#18181B] border-[#C0AA7F]'
      : currentTheme === 'light'
      ? 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-[#09090B] border-slate-300'
      : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm';

  const statusCardBgClass =
    currentTheme === 'paper'
      ? 'bg-[#FAF4E8]/90 border-[#E2D2B0] text-[#3B2E1E]'
      : currentTheme === 'light'
      ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
      : 'bg-slate-900/60 border-slate-800 text-white';

  const statusTitleClass =
    currentTheme === 'paper'
      ? 'text-[#3B2E1E]'
      : currentTheme === 'light'
      ? 'text-slate-900'
      : 'text-white';

  const statusDescClass =
    currentTheme === 'paper'
      ? 'text-[#6E5B42]'
      : currentTheme === 'light'
      ? 'text-slate-600'
      : 'text-slate-400';

  const playerAnchorBg =
    currentTheme === 'paper'
      ? 'bg-[#F4EBD7]'
      : currentTheme === 'light'
      ? 'bg-slate-100'
      : 'bg-slate-950';
  const [initialTimeSeconds, setInitialTimeSeconds] = useState<number>(0);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0);

  const {
    subtitles,
    activeSubtitleId,
    activeSubtitleIndex,
    status,
    title,
    duration,
    progress,
    error,
    retry,
  } = useYouTubeSubtitles(activeVideoId, currentTimeSeconds);

  const [playerState, setPlayerState] = useState<'playing' | 'paused' | 'buffering' | 'idle'>('idle');
  const [autoScroll, setAutoScroll] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  // Active repeating segment ID (single segment infinite loop until disabled)
  const [repeatSegmentId, setRepeatSegmentId] = useState<string | null>(null);

  // YouTube URL input history list and dropdown state
  const [urlHistory, setUrlHistory] = useState<YouTubeHistoryItem[]>(() => getSavedYouTubeHistory());
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);
  const [showNewsModal, setShowNewsModal] = useState<boolean>(false);
  const [showVocabModal, setShowVocabModal] = useState<boolean>(false);
  const [showNotesExportModal, setShowNotesExportModal] = useState<boolean>(false);
  const historyDropdownRef = useRef<HTMLDivElement | null>(null);

  // Vocabulary words count synced with persistent storage
  const [savedWordsCount, setSavedWordsCount] = useState<number>(() => {
    try {
      const saved = getPersistentItem('saved_dict_words');
      return saved ? JSON.parse(saved).length : 0;
    } catch (e) {
      return 0;
    }
  });

  useEffect(() => {
    const syncSavedWordsCount = () => {
      try {
        const saved = getPersistentItem('saved_dict_words');
        setSavedWordsCount(saved ? JSON.parse(saved).length : 0);
      } catch (e) {
        setSavedWordsCount(0);
      }
    };
    syncSavedWordsCount();
    window.addEventListener('storage', syncSavedWordsCount);
    window.addEventListener('focus', syncSavedWordsCount);
    return () => {
      window.removeEventListener('storage', syncSavedWordsCount);
      window.removeEventListener('focus', syncSavedWordsCount);
    };
  }, []);

  // Saved / Favorite URLs state
  const [savedUrls, setSavedUrls] = useState<YouTubeSavedUrl[]>(() => getSavedYouTubeUrls());
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Option C Monetization: VIP Ad-Free Status & Rewarded Unlock Handlers
  const [isVipAdFree, setIsVipAdFree] = useState<boolean>(() => AdManager.isVipAdFree());
  const [vipRemainingMins, setVipRemainingMins] = useState<number>(() => AdManager.getVipRemainingMinutes());

  useEffect(() => {
    const syncVipState = () => {
      setIsVipAdFree(AdManager.isVipAdFree());
      setVipRemainingMins(AdManager.getVipRemainingMinutes());
    };

    syncVipState();
    const unsub = AdManager.subscribe(syncVipState);
    const interval = setInterval(syncVipState, 30_000);

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'ON_AD_REWARD_EARNED' || e.data?.type === 'ON_REWARDED_AD_CLOSED') {
        syncVipState();
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', syncVipState);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncVipState();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsub();
      clearInterval(interval);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', syncVipState);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleOpenVipPass = async () => {
    if (AdManager.isVipAdFree()) {
      const mins = AdManager.getVipRemainingMinutes();
      setIsVipAdFree(true);
      setVipRemainingMins(mins);
      setSaveToast(`👑 您目前擁有 VIP 免廣告特權 (剩餘 ${mins} 分鐘)`);
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }
    setSaveToast('⏳ 正在為您載入贊助短片...');
    const success = await AdManager.requestRewardedAd('vip_pass');
    const isNowVip = AdManager.isVipAdFree();
    if (success || isNowVip) {
      setIsVipAdFree(true);
      setVipRemainingMins(AdManager.getVipRemainingMinutes());
      setSaveToast('🎉 成功解鎖 2 小時 VIP 免插頁廣告特權！');
    } else {
      setSaveToast('完整觀看 30 秒贊助短片即可解鎖 2 小時 VIP 免廣告');
    }
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleExportNotes = async () => {
    if (subtitles.length === 0) {
      setSaveToast('目前尚無雙語字幕可供匯出');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    if (!AdManager.hasExportAccess()) {
      const confirmed = await AdManager.requestRewardedAd('export_notes');
      if (!confirmed) {
        setSaveToast('觀看 1 則短片即可解鎖 24 小時無限制筆記匯出');
        setTimeout(() => setSaveToast(null), 3000);
        return;
      }
    }

    setShowNotesExportModal(true);
  };

  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const isLoopSeekingRef = useRef<boolean>(false);
  const handleLoopReplayRef = useRef<() => void>(() => {});

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        historyDropdownRef.current &&
        !historyDropdownRef.current.contains(e.target as Node)
      ) {
        setShowHistoryDropdown(false);
      }
    };
    if (showHistoryDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showHistoryDropdown]);

  // Always reset initial time and current time to 0:00 when active video ID changes
  useEffect(() => {
    if (!activeVideoId) return;
    setInitialTimeSeconds(0);
    setCurrentTimeSeconds(0);
    lastSavedTimeRef.current = 0;
  }, [activeVideoId]);

  // Persist URL input so whatever the user typed or pasted is preserved across modes
  useEffect(() => {
    if (urlInput && urlInput.trim()) {
      setPersistentItem('youtube_last_url', urlInput.trim());
    }
  }, [urlInput]);

  // Throttled time updater that persists playback progress and handles segment repeating loop
  const handleTimeUpdate = useCallback((secs: number) => {
    // Detect video rewind / loop restart:
    // If playback time drops from near the end to the beginning (e.g. was > 5s and now < 1.5s)
    if (isVideoLoopEnabled && lastSavedTimeRef.current > 5 && secs < 1.5) {
      handleLoopReplayRef.current();
      return;
    }

    setCurrentTimeSeconds(secs);

    // Segment repeat looping logic:
    // If a segment is marked to repeat, check if current time reached or exceeded its end
    if (repeatSegmentId) {
      const targetSub = subtitles.find(s => s.id === repeatSegmentId);
      if (targetSub && targetSub.endMs > targetSub.startMs) {
        const startSec = targetSub.startMs / 1000;
        const endSec = targetSub.endMs / 1000;

        // If loop seek was just dispatched, wait until playback is safely positioned back before endSec
        if (isLoopSeekingRef.current) {
          if (secs >= startSec && secs < endSec - 0.2) {
            isLoopSeekingRef.current = false;
          }
          return;
        }

        // When playback reaches or surpasses the segment's end, loop back smoothly
        if (secs >= endSec) {
          isLoopSeekingRef.current = true;
          playerRef.current?.seekTo(startSec);
          setTimeout(() => {
            isLoopSeekingRef.current = false;
          }, 800);
        }
      }
    }

    if (Math.abs(secs - lastSavedTimeRef.current) >= 1.5) {
      lastSavedTimeRef.current = secs;
      if (activeVideoId && secs > 0) {
        setPersistentItem('youtube_last_time', String(secs));
        setPersistentItem(`youtube_progress_${activeVideoId}`, String(secs));
      }
    }
  }, [activeVideoId, repeatSegmentId, subtitles]);

  // Immediately persist progress when player pauses, buffers, or ends
  useEffect(() => {
    if (activeVideoId && currentTimeSeconds > 0) {
      setPersistentItem('youtube_last_time', String(currentTimeSeconds));
      setPersistentItem(`youtube_progress_${activeVideoId}`, String(currentTimeSeconds));
    }
  }, [playerState, activeVideoId, currentTimeSeconds]);

  // Save progress on page visibility change or unload
  useEffect(() => {
    const handleSaveCurrentProgress = () => {
      if (activeVideoId && playerRef.current) {
        const t = playerRef.current.getCurrentTime();
        if (t > 0) {
          setPersistentItem('youtube_last_time', String(t));
          setPersistentItem(`youtube_progress_${activeVideoId}`, String(t));
        }
      }
    };
    window.addEventListener('beforeunload', handleSaveCurrentProgress);
    window.addEventListener('pagehide', handleSaveCurrentProgress);
    document.addEventListener('visibilitychange', handleSaveCurrentProgress);
    return () => {
      window.removeEventListener('beforeunload', handleSaveCurrentProgress);
      window.removeEventListener('pagehide', handleSaveCurrentProgress);
      document.removeEventListener('visibilitychange', handleSaveCurrentProgress);
    };
  }, [activeVideoId]);

  const handlePlayerStateChange = useCallback((state: 'playing' | 'paused' | 'buffering' | 'ended') => {
    const mappedState: 'playing' | 'paused' | 'buffering' | 'idle' = state === 'ended' ? 'idle' : state;
    setPlayerState(mappedState);
    onPlaybackStateChange?.(mappedState);
    if (state === 'ended') {
      AdManager.triggerInterstitialAd('video_ended');
      ReviewManager.recordVideoCompletionAndCheckReview();
    }
  }, [onPlaybackStateChange]);

  // Synchronize with top header sticky play button
  useEffect(() => {
    const handleToggle = () => {
      if (!playerRef.current) return;
      if (playerState === 'playing') {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    };
    const handlePause = () => {
      playerRef.current?.pause();
    };

    window.addEventListener('youtube-toggle-play', handleToggle);
    window.addEventListener('youtube-pause', handlePause);
    return () => {
      window.removeEventListener('youtube-toggle-play', handleToggle);
      window.removeEventListener('youtube-pause', handlePause);
    };
  }, [playerState]);

  // Clear URL input field and immediately refocus without affecting loaded video or subtitles
  const handleClearUrlInput = () => {
    setUrlInput('');
    setUrlInputError(null);
    setPersistentItem('youtube_last_url', '');
    urlInputRef.current?.focus();
  };

  // Save a URL to history (persisted in localStorage)
  const saveUrlToHistory = useCallback((urlToSave: string, videoIdToSave: string, titleToSave?: string) => {
    if (!urlToSave || !videoIdToSave) return;
    setUrlHistory((prev) => {
      // Remove any existing entry with the same video ID or URL to move it to the top
      const filtered = prev.filter(
        (item) => item.videoId !== videoIdToSave && item.url !== urlToSave.trim()
      );
      const newEntry: YouTubeHistoryItem = {
        url: urlToSave.trim(),
        videoId: videoIdToSave,
        title: titleToSave || (videoIdToSave === VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id ? VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title : undefined),
        timestamp: Date.now(),
      };
      // Keep up to 20 recent history items
      const updated = [newEntry, ...filtered].slice(0, 20);
      setPersistentItem(YOUTUBE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update history item title when subtitle video title resolves
  useEffect(() => {
    if (activeVideoId && title && title.trim()) {
      setUrlHistory((prev) => {
        let changed = false;
        const updated = prev.map((item) => {
          if (item.videoId === activeVideoId && item.title !== title) {
            changed = true;
            return { ...item, title };
          }
          return item;
        });
        if (changed) {
          setPersistentItem(YOUTUBE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        }
        return prev;
      });

      // Also update title in Saved Favorites
      setSavedUrls(updateSavedYouTubeUrlTitle(activeVideoId, title));
    }
  }, [activeVideoId, title]);

  // Check if current active video or input video is saved in favorites
  const currentTargetVideoId = useMemo(() => {
    if (activeVideoId) return activeVideoId;
    if (urlInput.trim()) return extractYouTubeVideoId(urlInput.trim());
    return null;
  }, [activeVideoId, urlInput]);

  const isCurrentVideoSaved = useMemo(() => {
    if (!currentTargetVideoId) return false;
    return isYouTubeUrlSaved(currentTargetVideoId) || savedUrls.some(s => s.videoId === currentTargetVideoId);
  }, [currentTargetVideoId, savedUrls]);

  // Toggle saving current video URL to favorites
  const handleToggleSaveCurrentUrl = useCallback(() => {
    const targetVid = currentTargetVideoId;
    if (!targetVid) {
      setUrlInputError('請先輸入有效的 YouTube 網址再點擊收藏');
      return;
    }
    const urlToSave = urlInput.trim() || `https://www.youtube.com/watch?v=${targetVid}`;
    if (isCurrentVideoSaved) {
      const updated = removeSavedYouTubeUrl(targetVid);
      setSavedUrls(updated);
      setSaveToast('已從「收藏影片」移除');
      vibrateDetentTick();
      setTimeout(() => setSaveToast(null), 2500);
    } else {
      const isLive = urlToSave.includes('/live/') || (title && title.toLowerCase().includes('live')) || targetVid === 'vOTiJkg1voo';
      const updated = saveYouTubeUrl({
        videoId: targetVid,
        url: urlToSave,
        title: title || (targetVid === VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id ? VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title : undefined),
        isLive,
      });
      setSavedUrls(updated);
      setSaveToast('已儲存至「收藏影片」 ⭐');
      vibrateDetentTick();
      setTimeout(() => setSaveToast(null), 2500);
    }
  }, [currentTargetVideoId, urlInput, isCurrentVideoSaved, title]);

  // Auto-play and Progress Bar State for Video Selection
  const [isAutoPlayPending, setIsAutoPlayPending] = useState<boolean>(false);
  const [isProgressActive, setIsProgressActive] = useState<boolean>(false);

  // Smoothly scroll window so the video player and subtitle stream align right under top header (Reading Mode)
  const scrollToYouTubeReadingMode = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const header = document.querySelector('header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 56;
    const targetEl = document.getElementById('youtube-player-anchor') || document.getElementById('youtube-player-section');
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - headerBottom;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth',
      });
    }
  }, []);

  // Unified loader when a video is selected (via news modal, saved urls, history, or input)
  const startLoadingVideoWithAutoPlay = useCallback((targetVid: string, targetUrl: string, targetTitle?: string) => {
    // If switching from an existing video to a different one, check interstitial ad frequency cap
    if (activeVideoId && activeVideoId !== targetVid) {
      AdManager.triggerInterstitialAd('video_switch');
    }
    setUrlInput(targetUrl);
    setUrlInputError(null);
    setIsAutoPlayPending(true);
    setIsProgressActive(true);
    setPersistentItem('youtube_last_url', targetUrl);
    setPersistentItem('youtube_last_video_id', targetVid);
    saveUrlToHistory(targetUrl, targetVid, targetTitle);
    setShowNewsModal(false);
    setShowHistoryDropdown(false);

    // 1. Immediately auto-adjust to best reading view (video 置頂)
    scrollToYouTubeReadingMode();
    window.dispatchEvent(new CustomEvent('scroll-to-youtube-reading'));
    vibrateDetentTick();
    setTimeout(scrollToYouTubeReadingMode, 150);
    setTimeout(scrollToYouTubeReadingMode, 450);
    setTimeout(scrollToYouTubeReadingMode, 850);

    // 2. Reset subtitle stream and scroll to top
    setAutoScroll(true);
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    if (subtitleContainerRef.current) {
      subtitleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. Immediately start video playback
    const startPlayback = () => {
      try {
        if (playerRef.current) {
          playerRef.current.play();
          setPlayerState('playing');
          onPlaybackStateChange?.('playing');
        }
      } catch (_) {}
    };

    if (activeVideoId === targetVid) {
      try {
        playerRef.current?.seekTo(0);
        startPlayback();
        handleLoopReplayRef.current();
      } catch (_) {}
    } else {
      setPersistentItem('youtube_last_time', '0');
      setPersistentItem(`youtube_progress_${targetVid}`, '0');
      lastSavedTimeRef.current = 0;
      setCurrentTimeSeconds(0);
      setActiveVideoId(targetVid);
      startPlayback();
      setTimeout(startPlayback, 200);
      setTimeout(startPlayback, 600);
    }
  }, [saveUrlToHistory, activeVideoId, scrollToYouTubeReadingMode, onPlaybackStateChange]);

  // When subtitles are ready or autoPlay was requested, automatically play video, scroll to reading mode, and start live subtitles
  useEffect(() => {
    if (!isAutoPlayPending) return;

    // Resilient play attempts
    const startPlayback = () => {
      try {
        if (playerRef.current) {
          playerRef.current.play();
          setPlayerState('playing');
          onPlaybackStateChange?.('playing');
        }
      } catch (_) {}
    };

    startPlayback();
    const t1 = setTimeout(startPlayback, 200);
    const t2 = setTimeout(startPlayback, 550);
    const t3 = setTimeout(startPlayback, 1000);

    const scrollTimer = setTimeout(() => {
      scrollToYouTubeReadingMode();
      window.dispatchEvent(new CustomEvent('scroll-to-youtube-reading'));
      vibrateDetentTick();
    }, 250);

    if (status === 'ready' && subtitles.length > 0) {
      setIsAutoPlayPending(false);

      setAutoScroll(true);
      setIsUserScrolledAway(false);
      setActiveSubtitleRelativePos(null);
      if (subtitleContainerRef.current) {
        subtitleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Keep 100% completion badge visible briefly, then settle
      const progressTimer = setTimeout(() => {
        setIsProgressActive(false);
      }, 2500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(scrollTimer);
        clearTimeout(progressTimer);
      };
    } else if (status === 'error') {
      setIsAutoPlayPending(false);
      setIsProgressActive(false);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(scrollTimer);
    };
  }, [status, isAutoPlayPending, subtitles.length, onPlaybackStateChange, scrollToYouTubeReadingMode]);

  // Select a saved URL from the Saved URLs modal
  const handleSelectSavedUrl = useCallback((urlToPlay: string, vid: string, savedTitle?: string) => {
    startLoadingVideoWithAutoPlay(vid, urlToPlay, savedTitle);
  }, [startLoadingVideoWithAutoPlay]);

  // Save URL directly from modal or custom input
  const handleSaveUrlFromModal = useCallback((item: { videoId: string; url: string; title?: string; isLive?: boolean }) => {
    const updated = saveYouTubeUrl(item);
    setSavedUrls(updated);
    setSaveToast('已儲存至「收藏影片」 ⭐');
    vibrateDetentTick();
    setTimeout(() => setSaveToast(null), 2500);
  }, []);

  // Delete saved URL
  const handleDeleteSavedUrl = useCallback((id: string) => {
    const updated = removeSavedYouTubeUrl(id);
    setSavedUrls(updated);
    vibrateDetentTick();
  }, []);

  // Detect whether current video is a Live Stream
  const isCurrentLiveVideo = useMemo(() => {
    if (!activeVideoId) return false;
    const u = (urlInput || '').toLowerCase();
    const t = (title || '').toLowerCase();
    return (
      u.includes('/live/') ||
      u.includes('live') ||
      t.includes('live') ||
      activeVideoId === 'vOTiJkg1voo' ||
      activeVideoId === '9Auq9mYxFEE' ||
      activeVideoId === 'dp8PhLsUcFE' ||
      activeVideoId === '34XpWw_6t0E'
    );
  }, [activeVideoId, urlInput, title]);

  // Load the verified caption test video through the exact standard production pipeline
  const handleLoadTestVideo = () => {
    startLoadingVideoWithAutoPlay(
      VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id,
      VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url,
      VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title
    );
  };

  // Select a news video from the Live English News discovery modal
  const handleSelectNewsVideo = (video: YouTubeNewsVideo) => {
    const fullUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    startLoadingVideoWithAutoPlay(video.videoId, fullUrl, video.title);
  };

  // Load video handler
  const handleLoadVideo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = extractYouTubeVideoId(urlInput);
    if (!id) {
      setUrlInputError('請輸入有效的 YouTube 影片或直播網址 (例如: /watch?v=..., youtu.be, /live/...)');
      return;
    }
    setUrlInputError(null);
    if (id === activeVideoId && status === 'ready') {
      setIsAutoPlayPending(true);
      setIsProgressActive(true);
      retry();
    } else {
      startLoadingVideoWithAutoPlay(id, urlInput.trim(), title);
    }
  };

  // Merged play action & subtitle readiness status handler:
  // Controls play/pause, shows subtitle progress, and automatically aligns screen to best reading view (video 置頂)
  const handleMergedPlayAndStatusClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    const inputVid = urlInput.trim() ? extractYouTubeVideoId(urlInput.trim()) : null;
    const isNew = Boolean(inputVid && inputVid !== activeVideoId);

    // 1. If user typed a new URL or different URL, load it and auto-glide to reading view
    if (isNew) {
      handleLoadVideo();
      setTimeout(() => {
        scrollToYouTubeReadingMode();
        window.dispatchEvent(new CustomEvent('scroll-to-youtube-reading'));
        vibrateDetentTick();
      }, 300);
      return;
    }

    // 2. If video is currently loaded
    if (activeVideoId) {
      if (playerState === 'playing') {
        playerRef.current?.pause();
        setPlayerState('paused');
        onPlaybackStateChange?.('paused');
      } else {
        // If video had ended or was near the end, rewind to start and reset subtitles
        const currentT = playerRef.current?.getCurrentTime() || currentTimeSeconds;
        const totalDur = playerRef.current?.getDuration() || duration;
        if (totalDur > 0 && currentT >= totalDur - 1) {
          playerRef.current?.seekTo(0);
          handleLoopReplayRef.current();
        }
        // Start playing
        playerRef.current?.play();
        setPlayerState('playing');
        onPlaybackStateChange?.('playing');
        // 一旦按下播放，螢幕就自動調整到最佳閱讀畫面（video 置頂）
        scrollToYouTubeReadingMode();
        window.dispatchEvent(new CustomEvent('scroll-to-youtube-reading'));
        vibrateDetentTick();
      }
      return;
    }

    // 3. Fallback: load video & align
    handleLoadVideo();
    setTimeout(() => {
      scrollToYouTubeReadingMode();
      window.dispatchEvent(new CustomEvent('scroll-to-youtube-reading'));
      vibrateDetentTick();
    }, 300);
  }, [urlInput, activeVideoId, playerState, handleLoadVideo, scrollToYouTubeReadingMode, onPlaybackStateChange]);

  // Select a URL from the history dropdown
  const handleSelectHistoryItem = (item: YouTubeHistoryItem) => {
    startLoadingVideoWithAutoPlay(item.videoId, item.url, item.title);
  };

  // Delete an individual item from history
  const handleDeleteHistoryItem = (e: React.MouseEvent, videoIdToDelete: string) => {
    e.stopPropagation();
    setUrlHistory((prev) => {
      const updated = prev.filter((item) => item.videoId !== videoIdToDelete);
      setPersistentItem(YOUTUBE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all history entries
  const handleClearAllHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUrlHistory([]);
    setPersistentItem(YOUTUBE_HISTORY_STORAGE_KEY, JSON.stringify([]));
  };

  // Convert YouTubeSubtitleItem to standard SubtitleItem for BilingualSubtitleCard compatibility
  const toSubtitleItem = (yt: YouTubeSubtitleItem, index: number): SubtitleItem => {
    const mins = Math.floor(yt.startMs / 60000);
    const secs = Math.floor((yt.startMs % 60000) / 1000);
    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return {
      id: yt.id,
      timestamp: timeStr,
      english: yt.english,
      traditionalChinese: yt.traditionalChinese,
      isFinal: true,
      start: yt.startMs / 1000,
      end: yt.endMs / 1000,
      durationMs: yt.endMs - yt.startMs,
      bookmarked: bookmarkedIds.has(yt.id),
    };
  };

  const handleBookmarkToggle = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSeekToSentence = (startMs: number) => {
    const secs = Math.max(0, startMs / 1000);
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    setCurrentTimeSeconds(secs);
    isLoopSeekingRef.current = false;
    if (repeatSegmentId) {
      setRepeatSegmentId(null);
    }
    playerRef.current?.seekTo(secs);
  };

  const handleToggleRepeatSegment = (segmentId: string, startMs: number) => {
    isLoopSeekingRef.current = false;
    if (repeatSegmentId === segmentId) {
      setRepeatSegmentId(null);
    } else {
      setRepeatSegmentId(segmentId);
      handleSeekToSentence(startMs);
    }
  };

  // Video Subtitle Voice Alignment Offset (-2 ~ 5 segments)
  const [videoSyncOffset, setVideoSyncOffset] = useState<number>(() => {
    try {
      const saved = getPersistentItem('youtube_video_sync_offset');
      if (saved !== null && saved !== undefined) {
        const val = parseInt(String(saved), 10);
        if (!isNaN(val)) return Math.max(-2, Math.min(5, val));
      }
    } catch (e) {}
    return 0;
  });

  // State to toggle pre-read sentences preview when offset > 0
  const [showPreRead, setShowPreRead] = useState<boolean>(false);

  const handleVideoSyncOffsetChange = (newOffset: number) => {
    const clamped = Math.max(-2, Math.min(5, newOffset));
    setVideoSyncOffset(clamped);
    vibrateDetentTick();
    try {
      setPersistentItem('youtube_video_sync_offset', String(clamped));
    } catch (e) {}
    if (clamped === 0) {
      setSaveToast('影音同步：已重置為標準時間軸對齊 (0)');
    } else if (clamped > 0) {
      setSaveToast(`影音語音對齊：語音延遲 ${clamped} 段 (+${clamped})`);
    } else {
      setSaveToast(`影音語音對齊：語音提前 ${Math.abs(clamped)} 段 (${clamped})`);
    }
    setTimeout(() => setSaveToast(null), 2500);
  };

  // Calculate effective active index considering videoSyncOffset
  const effectiveActiveIndex = useMemo(() => {
    if (subtitles.length === 0) return -1;
    if (activeSubtitleIndex < 0) {
      if (currentTimeSeconds <= 3) return 0;
      return -1;
    }
    const targetIdx = activeSubtitleIndex - videoSyncOffset;
    return Math.max(0, Math.min(subtitles.length - 1, targetIdx));
  }, [activeSubtitleIndex, videoSyncOffset, subtitles.length, currentTimeSeconds]);

  const effectiveActiveId = useMemo(() => {
    if (effectiveActiveIndex >= 0 && effectiveActiveIndex < subtitles.length) {
      return subtitles[effectiveActiveIndex].id;
    }
    if (currentTimeSeconds <= 3 && subtitles.length > 0) {
      return subtitles[0].id;
    }
    return activeSubtitleId;
  }, [effectiveActiveIndex, subtitles, activeSubtitleId, currentTimeSeconds]);

  // Ahead Subtitles (for pre-reading when voice is delayed by videoSyncOffset > 0)
  const aheadSubtitles = useMemo(() => {
    if (videoSyncOffset <= 0 || effectiveActiveIndex < 0 || subtitles.length === 0) return [];
    const start = effectiveActiveIndex + 1;
    const end = Math.min(subtitles.length, effectiveActiveIndex + 1 + videoSyncOffset);
    return subtitles.slice(start, end);
  }, [subtitles, effectiveActiveIndex, videoSyncOffset]);

  // Floating Return-To-Live Subtitle Button State:
  // 'above' = active subtitle is above the visible area (user scrolled DOWN to view future subtitles)
  // 'below' = active subtitle is below the visible area (user scrolled UP to view earlier subtitles)
  // null = active subtitle is currently within the visible reading area
  const [activeSubtitleRelativePos, setActiveSubtitleRelativePos] = useState<'above' | 'below' | null>(null);
  const [isUserScrolledAway, setIsUserScrolledAway] = useState<boolean>(false);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const rafCheckId = useRef<number | null>(null);

  const checkSubtitlePosition = useCallback(() => {
    const targetId = effectiveActiveId || activeSubtitleId;
    if (!targetId || !subtitleContainerRef.current) {
      setActiveSubtitleRelativePos(null);
      return;
    }

    const container = subtitleContainerRef.current;
    const cardEl = document.getElementById(`yt-card-${targetId}`);
    if (!cardEl) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();

    // Top boundary: on mobile, youtube-player-anchor is sticky at top-[56px]
    const playerAnchor = document.getElementById('youtube-player-anchor');
    const playerBottom = playerAnchor ? playerAnchor.getBoundingClientRect().bottom : 56;
    const visibleTop = Math.max(containerRect.top, playerBottom);
    const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);

    // Active card is above the visible area (user scrolled DOWN into future subtitles)
    if (cardRect.bottom < visibleTop + 24) {
      setActiveSubtitleRelativePos('above');
    }
    // Active card is below the visible area (user scrolled UP into earlier subtitles)
    else if (cardRect.top > visibleBottom - 24) {
      setActiveSubtitleRelativePos('below');
    }
    // Active card is currently in visible reading area!
    else {
      setActiveSubtitleRelativePos(null);
      if (!isProgrammaticScrollRef.current) {
        setIsUserScrolledAway(false);
      }
    }
  }, [effectiveActiveId, activeSubtitleId]);

  const scheduleCheck = useCallback(() => {
    if (rafCheckId.current) cancelAnimationFrame(rafCheckId.current);
    rafCheckId.current = requestAnimationFrame(() => {
      checkSubtitlePosition();
    });
  }, [checkSubtitlePosition]);

  // Monitor scroll on both subtitleContainerRef and window
  useEffect(() => {
    const container = subtitleContainerRef.current;

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY || 0;
    };

    const handleUserScrollOrTouch = () => {
      if (!isProgrammaticScrollRef.current) {
        setIsUserScrolledAway(true);
      }
      scheduleCheck();
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleUserScrollOrTouch();
      if (container && container.scrollTop <= 0) {
        const currentY = e.touches[0]?.clientY || 0;
        const delta = currentY - touchStartY;
        // If user pulls down while already at the top of subtitle stream, scroll window up to reveal video & controls
        if (delta > 8 && window.scrollY > 0) {
          window.scrollBy({ top: -delta * 0.85, behavior: 'auto' });
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      handleUserScrollOrTouch();
      // If user scrolls up while at top of subtitle stream, propagate scroll to the window to view top controls & video
      if (container && container.scrollTop <= 0 && e.deltaY < 0 && window.scrollY > 0) {
        window.scrollBy({ top: e.deltaY, behavior: 'auto' });
      }
    };

    container?.addEventListener('touchstart', handleTouchStart, { passive: true });
    container?.addEventListener('scroll', handleUserScrollOrTouch, { passive: true });
    container?.addEventListener('wheel', handleWheel, { passive: true });
    container?.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('scroll', handleUserScrollOrTouch, { passive: true });
    window.addEventListener('resize', scheduleCheck, { passive: true });

    scheduleCheck();

    return () => {
      container?.removeEventListener('touchstart', handleTouchStart);
      container?.removeEventListener('scroll', handleUserScrollOrTouch);
      container?.removeEventListener('wheel', handleWheel);
      container?.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('scroll', handleUserScrollOrTouch);
      window.removeEventListener('resize', scheduleCheck);
      if (rafCheckId.current) cancelAnimationFrame(rafCheckId.current);
    };
  }, [scheduleCheck]);

  // Check visibility whenever active subtitle ID changes
  useEffect(() => {
    scheduleCheck();
  }, [effectiveActiveId, activeSubtitleId, scheduleCheck]);

  // Auto-scroll ONLY inside the dedicated subtitle container when NOT scrolled away
  useEffect(() => {
    const targetId = effectiveActiveId || activeSubtitleId;
    if (!autoScroll || isUserScrolledAway || !targetId || !subtitleContainerRef.current) return;
    const container = subtitleContainerRef.current;
    const cardEl = document.getElementById(`yt-card-${targetId}`);
    if (!cardEl) return;

    // If it's the very first subtitle paragraph (index 0), scroll smoothly directly to top: 0
    if (effectiveActiveIndex === 0 || (subtitles.length > 0 && targetId === subtitles[0].id)) {
      isProgrammaticScrollRef.current = true;
      container.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        scheduleCheck();
      }, 450);
      return () => clearTimeout(timer);
    }

    // Calculate position of the active card relative to the subtitle container
    const containerRect = container.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const relativeCardTop = cardRect.top - containerRect.top;

    // Keep active card comfortably in the upper portion (~24px padding) of the subtitle container
    const upperPadding = 24;
    const targetScrollTop = container.scrollTop + relativeCardTop - upperPadding;

    isProgrammaticScrollRef.current = true;
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });

    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scheduleCheck();
    }, 450);

    return () => clearTimeout(timer);
  }, [effectiveActiveId, activeSubtitleId, effectiveActiveIndex, subtitles, autoScroll, isUserScrolledAway, scheduleCheck]);

  // Handler to return to currently active subtitle segment
  const handleReturnToLiveSubtitle = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    vibrateDetentTick();

    const targetId = effectiveActiveId || activeSubtitleId || (subtitles.length > 0 ? subtitles[0].id : null);
    if (!targetId) return;

    const cardEl = document.getElementById(`yt-card-${targetId}`);
    const container = subtitleContainerRef.current;

    if (container && cardEl) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const relativeCardTop = cardRect.top - containerRect.top;
      const upperPadding = 24;
      const targetScrollTop = container.scrollTop + relativeCardTop - upperPadding;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }

    // Also adjust window scroll if video player was scrolled above sticky header
    const playerAnchor = document.getElementById('youtube-player-anchor');
    if (playerAnchor) {
      const anchorRect = playerAnchor.getBoundingClientRect();
      const headerBottom = 56;
      if (anchorRect.top < headerBottom - 20) {
        window.scrollTo({
          top: Math.max(0, window.scrollY + anchorRect.top - headerBottom),
          behavior: 'smooth',
        });
      }
    }

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scheduleCheck();
    }, 550);
  }, [effectiveActiveId, activeSubtitleId, subtitles, scheduleCheck]);

  // Handler when loop playback replays video from start:
  // Reset subtitle paragraphs back to the very front, corresponding with the replaying video
  const handleLoopReplay = useCallback(() => {
    // 1. Reset saved progress and current time back to 0
    if (activeVideoId) {
      setPersistentItem('youtube_last_time', '0');
      setPersistentItem(`youtube_progress_${activeVideoId}`, '0');
    }
    lastSavedTimeRef.current = 0;
    setCurrentTimeSeconds(0);

    // 2. Clear scrolled-away states and position indicator FAB
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    setAutoScroll(true);

    // 3. Subtitle paragraph returns to the very beginning (subtitles[0])
    isProgrammaticScrollRef.current = true;
    if (subtitleContainerRef.current) {
      subtitleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scheduleCheck();
    }, 450);
  }, [activeVideoId, scheduleCheck]);

  handleLoopReplayRef.current = handleLoopReplay;

  const filteredSubtitles = subtitles;

  const inputParsedVideoId = urlInput.trim() ? extractYouTubeVideoId(urlInput.trim()) : null;
  const isNewInputUrl = Boolean(inputParsedVideoId && inputParsedVideoId !== activeVideoId);

  return (
    <div className="space-y-6">
      {/* Top YouTube URL Input & Search Bar */}
      <div className={`backdrop-blur-md rounded-2xl p-4 sm:p-5 border transition-colors duration-200 shadow-xl space-y-3 ${cardBgClass}`}>
        <form onSubmit={handleLoadVideo} className="space-y-2.5">
          {/* Row 1: Action Controls (美語精選頻道, 生字本 & 播放/字幕狀態) placed ABOVE URL input to prevent dropdown list from blocking them */}
          {/* Row 1: Action Controls (精選, 生字本, 播放鍵) evenly distributed across the row */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full min-w-0">
            {/* Button 1: 精選 */}
            <button
              type="button"
              id="youtube-live-news-btn"
              onClick={() => setShowNewsModal(true)}
              aria-label="精選"
              title="探索權威美語頻道影片與收藏影片"
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 min-h-[38px] w-full rounded-xl text-xs sm:text-sm font-bold border shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95 ${testBtnClass}`}
            >
              <Newspaper className={`w-4 h-4 shrink-0 ${isLightOrPaper ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span className={`font-black tracking-tight truncate ${isLightOrPaper ? 'text-[#09090B]' : 'text-white'}`}>
                精選
              </span>
              {savedUrls.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black flex items-center gap-0.5 border shrink-0 ${
                  isLightOrPaper
                    ? 'bg-amber-100/90 text-[#09090B] border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  <Star className={`w-2.5 h-2.5 ${isLightOrPaper ? 'fill-amber-600 text-amber-600' : 'fill-amber-500 text-amber-500'}`} />
                  {savedUrls.length}
                </span>
              )}
            </button>

            {/* Button 2: 生字本 (Vocabulary Notebook with Flashcard Quiz) */}
            <button
              type="button"
              id="youtube-vocab-notebook-btn"
              onClick={() => setShowVocabModal(true)}
              aria-label="生字本"
              title="查看已收藏生字並啟動測試卡翻牌測驗 (Flashcard Quiz)"
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 min-h-[38px] w-full rounded-xl text-xs sm:text-sm font-bold border shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95 ${testBtnClass}`}
            >
              <BookMarked className={`w-4 h-4 shrink-0 ${isLightOrPaper ? 'text-indigo-700' : 'text-indigo-400'}`} />
              <span className={`font-black tracking-tight truncate ${isLightOrPaper ? 'text-[#09090B]' : 'text-white'}`}>
                生字本
              </span>
              {savedWordsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black border shrink-0 ${
                  isLightOrPaper
                    ? 'bg-indigo-100/90 text-[#09090B] border-indigo-300'
                    : 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
                }`}>
                  {savedWordsCount}
                </span>
              )}
            </button>

            {/* Button 3: 播放鍵 (取消「字幕」兩字，只留百分比，圖示完整顯現) */}
            <button
              type="button"
              id="youtube-caption-input-submit-btn"
              onClick={handleMergedPlayAndStatusClick}
              aria-label={
                isNewInputUrl
                  ? '載入播放此網址並進入最佳閱讀畫面'
                  : playerState === 'playing'
                  ? '暫停影音播放'
                  : '播放影音並自動調整至最佳閱讀畫面'
              }
              title={
                isNewInputUrl
                  ? '立即載入並播放輸入的 YouTube 網址，螢幕將自動調整至最佳閱讀畫面（影片置頂）'
                  : playerState === 'playing'
                  ? '點擊暫停播放'
                  : '點擊播放影音，螢幕將自動調整至最佳閱讀畫面（影片置頂）'
              }
              disabled={!urlInput.trim() && status === 'idle'}
              className={`relative overflow-hidden flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 min-h-[38px] w-full rounded-xl text-xs sm:text-sm font-bold border shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95 select-none ${
                isNewInputUrl
                  ? isLightOrPaper
                    ? 'bg-emerald-100 hover:bg-emerald-200 border-emerald-500 ring-2 ring-emerald-500/30 animate-pulse'
                    : 'bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-emerald-500/40 border-emerald-500 ring-2 ring-emerald-500/30 hover:border-emerald-400 animate-pulse'
                  : playerState === 'playing'
                  ? currentTheme === 'paper'
                    ? 'bg-[#EAE0CA] hover:bg-[#E2D4B9] border-[#C0AA7F]'
                    : currentTheme === 'light'
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-400'
                    : 'bg-gradient-to-r from-emerald-600/25 to-teal-600/25 border-emerald-400 ring-2 ring-emerald-500/25'
                  : currentTheme === 'paper'
                  ? 'bg-[#FAF4E8] hover:bg-[#F5ECD7] border-[#C0AA7F]'
                  : currentTheme === 'light'
                  ? 'bg-white hover:bg-slate-50 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-emerald-500/40'
              }`}
            >
              {/* Animated Background Progress Fill when active/loading or ready */}
              {(isProgressActive || status === 'loading' || status === 'translating' || (status === 'ready' && !isNewInputUrl)) && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out pointer-events-none ${
                    (progress.percent >= 100 || status === 'ready')
                      ? isLightOrPaper
                        ? 'bg-emerald-500/15'
                        : 'bg-gradient-to-r from-emerald-600/30 via-emerald-500/40 to-teal-400/40'
                      : isLightOrPaper
                      ? 'bg-amber-500/15'
                      : 'bg-gradient-to-r from-rose-500/25 via-amber-500/25 to-emerald-500/30'
                  }`}
                  style={{ width: `${isNewInputUrl ? 100 : Math.max(12, Math.min(100, progress.percent || (status === 'loading' ? 25 : 60)))}%` }}
                />
              )}

              {/* Single Clear State: Play/Pause action (No percentage badge to prevent text truncation) */}
              <div className="relative z-10 flex items-center justify-center gap-1.5 min-w-0">
                {status === 'loading' || status === 'translating' ? (
                  <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${isLightOrPaper ? 'text-emerald-700' : 'text-emerald-400'}`} />
                ) : isNewInputUrl ? (
                  <Play className={`w-4 h-4 shrink-0 ${isLightOrPaper ? 'fill-emerald-700 text-emerald-700' : 'fill-emerald-400 text-emerald-400'}`} />
                ) : playerState === 'playing' ? (
                  <Pause className={`w-4 h-4 shrink-0 ${isLightOrPaper ? 'fill-amber-700 text-amber-700' : 'fill-amber-400 text-amber-400'}`} />
                ) : (
                  <Play className={`w-4 h-4 shrink-0 ml-0.5 ${isLightOrPaper ? 'fill-emerald-700 text-emerald-700' : 'fill-emerald-400 text-emerald-400'}`} />
                )}
                <span className={`font-black tracking-tight whitespace-nowrap ${isLightOrPaper ? 'text-[#09090B]' : 'text-white'}`}>
                  {status === 'loading' || status === 'translating'
                    ? '載入中'
                    : isNewInputUrl
                    ? '播放'
                    : playerState === 'playing'
                    ? '暫停'
                    : '播放'}
                </span>
              </div>
            </button>
          </div>

          {/* Row 2: Star Icon Button + YouTube URL Input & History Dropdown */}
          <div className="flex items-center gap-2">
            {/* Star Icon Button for saving URL - placed BEFORE input */}
            <button
              type="button"
              id="youtube-save-current-url-btn"
              onClick={handleToggleSaveCurrentUrl}
              aria-label={isCurrentVideoSaved ? '已收藏此影片 (點擊取消收藏)' : '儲存網址至收藏影片'}
              title={isCurrentVideoSaved ? '已收藏此影片 (點擊取消收藏)' : '儲存網址至「收藏影片」'}
              className={`h-[42px] w-[42px] rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm ${
                isCurrentVideoSaved
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-amber-500/10 hover:bg-amber-500/30'
                  : currentTheme === 'paper'
                  ? 'bg-[#EFE5CE] hover:bg-[#E5D9BE] text-[#7A6853] hover:text-amber-600 border-[#CDB58A]'
                  : currentTheme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-amber-500 border-slate-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-700/80'
              }`}
            >
              <Star
                className={`w-4 h-4 transition-all duration-200 ${
                  isCurrentVideoSaved ? 'fill-amber-500 text-amber-500 scale-110' : ''
                }`}
              />
            </button>

            <div ref={historyDropdownRef} className="relative flex-1 min-w-0">
              <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500 pointer-events-none" />
            <input
              ref={urlInputRef}
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (urlInputError) setUrlInputError(null);
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData('text') || '';
                const parsedId = extractYouTubeVideoId(pasted);
                if (parsedId) {
                  setUrlInput(pasted.trim());
                  if (urlInputError) setUrlInputError(null);
                  setTimeout(() => {
                    startLoadingVideoWithAutoPlay(parsedId, pasted.trim());
                  }, 120);
                }
              }}
              onFocus={() => {
                if (urlHistory.length > 0) setShowHistoryDropdown(true);
              }}
              placeholder="貼上 YouTube 影片或直播網址 (例如: watch?v=..., youtu.be, /live/...)"
              className={`w-full rounded-xl pl-10 ${
                urlInput ? 'pr-18 sm:pr-20' : 'pr-10'
              } py-2.5 text-xs sm:text-sm border focus:outline-none transition-colors ${inputBgClass} ${
                urlInputError ? 'border-rose-500 ring-1 ring-rose-500/40' : ''
              }`}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {urlInput && (
                <button
                  type="button"
                  id="youtube-url-clear-btn"
                  onClick={handleClearUrlInput}
                  aria-label="清除網址"
                  title="清除網址"
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    currentTheme === 'paper'
                      ? 'text-[#7A6853] hover:text-[#3B2E1E] hover:bg-[#EFE5CE]'
                      : currentTheme === 'light'
                      ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                id="youtube-history-toggle-btn"
                onClick={() => setShowHistoryDropdown((prev) => !prev)}
                aria-label="展開歷史輸入網址"
                title="歷史輸入網址清單"
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  showHistoryDropdown
                    ? currentTheme === 'paper'
                      ? 'bg-[#E5D9BE] text-[#3B2E1E]'
                      : currentTheme === 'light'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-slate-700 text-white'
                    : currentTheme === 'paper'
                    ? 'text-[#7A6853] hover:text-[#3B2E1E] hover:bg-[#EFE5CE]'
                    : currentTheme === 'light'
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
                }`}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistoryDropdown ? 'rotate-180 text-rose-500' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu for URL History */}
            {showHistoryDropdown && (
              <div
                id="yt-history-dropdown"
                className={`absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-md transition-all duration-150 animate-in fade-in zoom-in-95 ${
                  currentTheme === 'paper'
                    ? 'bg-[#FDF8EE] border-[#E2D2B0] text-[#3B2E1E]'
                    : currentTheme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                  <div className={`px-3 py-2 border-b flex items-center justify-between text-xs font-medium ${
                    currentTheme === 'paper'
                      ? 'bg-[#F4EBD7] border-[#E2D2B0] text-[#6E5B42]'
                      : currentTheme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <History className="w-3.5 h-3.5 text-rose-500" />
                      歷史輸入網址 ({urlHistory.length})
                    </span>
                    {urlHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllHistory}
                        className={`text-[11px] hover:underline cursor-pointer flex items-center gap-1 transition-colors ${
                          currentTheme === 'paper'
                            ? 'text-amber-800 hover:text-rose-700'
                            : currentTheme === 'light'
                            ? 'text-slate-500 hover:text-rose-600'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        清除全部歷史
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-inherit">
                    {urlHistory.length === 0 ? (
                      <div className={`p-4 text-center text-xs ${
                        currentTheme === 'paper' ? 'text-[#8C765C]' : 'text-slate-400'
                      }`}>
                        尚無歷史網址紀錄。輸入並載入影片後會自動保存在此。
                      </div>
                    ) : (
                      urlHistory.map((item, idx) => {
                        const isCurrentActive = item.videoId === activeVideoId;
                        return (
                          <div
                            key={`${item.videoId}-${idx}`}
                            onClick={() => handleSelectHistoryItem(item)}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors group ${
                              isCurrentActive
                                ? currentTheme === 'paper'
                                  ? 'bg-[#EFE5CE] text-[#3B2E1E] font-medium'
                                  : currentTheme === 'light'
                                  ? 'bg-rose-50 text-rose-900 font-medium'
                                  : 'bg-rose-950/40 text-rose-300 font-medium'
                                : currentTheme === 'paper'
                                ? 'hover:bg-[#F5ECD7] text-[#3B2E1E]'
                                : currentTheme === 'light'
                                ? 'hover:bg-slate-50 text-slate-800'
                                : 'hover:bg-slate-800/80 text-slate-200'
                            }`}
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-2.5">
                              <History className={`w-3.5 h-3.5 shrink-0 ${
                                isCurrentActive ? 'text-rose-500' : 'text-slate-400 group-hover:text-rose-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium text-xs">
                                  {item.title || (item.videoId === VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id ? VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title : item.videoId)}
                                </div>
                                <div className={`truncate text-[11px] ${
                                  currentTheme === 'paper' ? 'text-[#8C765C]' : currentTheme === 'light' ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {item.url}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCurrentActive && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  播放中
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const alreadySaved = isYouTubeUrlSaved(item.videoId);
                                  if (alreadySaved) {
                                    handleDeleteSavedUrl(item.videoId);
                                    setSaveToast('已從喜愛網址清單移除');
                                  } else {
                                    handleSaveUrlFromModal({
                                      videoId: item.videoId,
                                      url: item.url,
                                      title: item.title,
                                      isLive: item.url.includes('/live/') || item.videoId === 'vOTiJkg1voo',
                                    });
                                  }
                                  setTimeout(() => setSaveToast(null), 2500);
                                }}
                                title={isYouTubeUrlSaved(item.videoId) ? '從喜愛網址移除' : '儲存至喜歡的網址'}
                                className={`p-1 rounded transition-colors ${
                                  isYouTubeUrlSaved(item.videoId)
                                    ? 'text-amber-500 hover:bg-amber-500/10'
                                    : 'opacity-50 hover:opacity-100 hover:text-amber-500'
                                }`}
                              >
                                <Star className={`w-3.5 h-3.5 ${isYouTubeUrlSaved(item.videoId) ? 'fill-amber-500' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHistoryItem(e, item.videoId)}
                                title="刪除此歷史紀錄"
                                className={`p-1 rounded opacity-60 hover:opacity-100 transition-opacity ${
                                  currentTheme === 'paper'
                                    ? 'hover:bg-[#E5D9BE] text-[#6E5B42]'
                                    : currentTheme === 'light'
                                    ? 'hover:bg-slate-200 text-slate-500'
                                    : 'hover:bg-slate-700 text-slate-400'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Save Toast Feedback */}
        {saveToast && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-semibold animate-in fade-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveToast}</span>
          </div>
        )}

        {urlInputError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{urlInputError}</span>
          </div>
        )}

        {/* Option C Monetization Bar: VIP Pass Status & Export Notes (平均分配橫行，icon 與按鈕樣式一致) */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/30 text-xs w-full">
          {/* Left: VIP Ad-Free Button / Status */}
          <button
            type="button"
            onClick={handleOpenVipPass}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] w-full rounded-xl font-bold text-xs sm:text-sm transition-all border shadow-sm cursor-pointer whitespace-nowrap active:scale-95 ${
              isVipAdFree
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/20'
                : currentTheme === 'paper'
                ? 'bg-[#EFE5CE] hover:bg-[#E5D9BE] border-[#C0AA7F] text-[#3B2E1E]'
                : currentTheme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200 hover:text-amber-300'
            }`}
            title={isVipAdFree ? `VIP 免廣告剩餘 ${vipRemainingMins} 分鐘` : '觀看 30 秒贊助影片，享 2 小時 VIP 免插頁廣告特權'}
          >
            <Crown className={`w-4 h-4 shrink-0 ${isVipAdFree ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="truncate">
              {isVipAdFree ? `VIP 免廣告 (${vipRemainingMins}m)` : '領取 2hr VIP 免廣告'}
            </span>
          </button>

          {/* Right: Export Subtitles / Notes */}
          <button
            type="button"
            onClick={handleExportNotes}
            disabled={subtitles.length === 0}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] w-full rounded-xl font-bold text-xs sm:text-sm transition-all border shadow-sm cursor-pointer whitespace-nowrap active:scale-95 ${
              subtitles.length === 0
                ? 'opacity-40 cursor-not-allowed bg-stone-900 border-stone-800 text-stone-500'
                : currentTheme === 'paper'
                ? 'bg-[#EFE5CE] hover:bg-[#E5D9BE] border-[#C0AA7F] text-[#3B2E1E]'
                : currentTheme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200 hover:text-sky-300'
            }`}
            title="匯出當前影片的雙語對照字幕與筆記"
          >
            <Download className="w-4 h-4 shrink-0 text-sky-400" />
            <span className="truncate">匯出雙語筆記</span>
          </button>
        </div>

        {/* Bottom Utility Bar: Reading Mode, Chinese Variant, Subtitle Font Size & CEFR Difficulty Controls */}
        <ReadingModeAndFontToolbar
          readingMode={readingMode}
          onReadingModeChange={onReadingModeChange}
          effectiveTheme={effectiveTheme}
          chineseVariant={chineseVariant}
          onChineseVariantChange={onChineseVariantChange}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          highlightDifficulty={highlightDifficulty}
          onHighlightDifficultyChange={handleToggleHighlightDifficulty}
          idPrefix="youtube"
        />
      </div>

      {/* Main Learning Interface: Video Player & Subtitles Grid */}
      <div id="youtube-player-section" className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 sm:gap-4 lg:gap-6 items-start">
        {/* Left Column: Player (Clean fixed/sticky reading mode) */}
        <div className="lg:col-span-5 space-y-2 lg:space-y-3 lg:sticky lg:top-20">
          {/* Live Stream Notice: Guide to Curated Channels (Moved above video player to preserve optimal reading layout) */}
          {isCurrentLiveVideo && (
            <div className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2.5 transition-colors duration-200 shadow-sm ${
              currentTheme === 'paper'
                ? 'bg-[#FAF4E8] border-[#E2D2B0] text-[#3B2E1E]'
                : currentTheme === 'light'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-medium leading-relaxed">
                  此影片為 24/7 即時直播新聞，受限於 YouTube 平台限制無逐句時間軸字幕。建議點擊「📰 美語精選頻道」探索 100% 具備英文字幕與雙語對照的優質影音！
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setShowNewsModal(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>探索精選頻道</span>
                </button>
              </div>
            </div>
          )}

          <div id="youtube-player-anchor" className={`sticky top-[56px] z-20 sm:static pb-0 transition-colors duration-200 ${playerAnchorBg}`}>
            <YouTubeBilingualPlayer
              ref={playerRef}
              videoId={activeVideoId}
              initialTimeSeconds={initialTimeSeconds}
              onTimeUpdate={handleTimeUpdate}
              onStateChange={handlePlayerStateChange}
              hideActionControls
              isLoopEnabled={isVideoLoopEnabled}
              autoPlay={isAutoPlayPending}
              onLoopReplay={handleLoopReplay}
            />
          </div>
        </div>

        {/* Right Column: Bilingual Subtitle Stream (Clean reading mode) */}
        <div className="lg:col-span-7 space-y-1 sm:space-y-3 lg:space-y-4">
          {/* Subtitle Idle / Ready to Load State */}
          {status === 'idle' && subtitles.length === 0 && (
            <div className={`rounded-2xl p-10 border flex flex-col items-center justify-center text-center space-y-3 transition-colors duration-200 ${statusCardBgClass}`}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Newspaper className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className={`text-sm font-semibold ${statusTitleClass}`}>點擊「美語精選頻道」立即探索</h4>
                <p className={`text-xs mt-1 leading-relaxed ${statusDescClass}`}>
                  探索最近一週具備完整英文字幕的權威頻道影片與即時新聞，點擊即可自動填入網址並啟動 Gemini 雙語對照學習。
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
                <button
                  type="button"
                  id="youtube-open-news-btn-inline"
                  onClick={() => setShowNewsModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Newspaper className="w-4 h-4" />
                  <span>瀏覽美語精選頻道</span>
                </button>
                <button
                  type="button"
                  id="youtube-load-test-btn-inline"
                  onClick={handleLoadTestVideo}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700/60 hover:border-slate-600 text-slate-300 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>或載入示範影片</span>
                </button>
              </div>
            </div>
          )}

          {/* Subtitle Loading State */}
          {status === 'loading' && (
            <div className={`rounded-2xl p-12 border flex flex-col items-center justify-center text-center space-y-3 transition-colors duration-200 ${statusCardBgClass}`}>
              <RotateCw className="w-8 h-8 text-blue-400 animate-spin" />
              <div>
                <h4 className={`text-sm font-semibold ${statusTitleClass}`}>正在取得 YouTube 原始字幕...</h4>
                <p className={`text-xs mt-1 ${statusDescClass}`}>解析英文字幕軌道並提取時間軸標記</p>
              </div>
            </div>
          )}

          {/* Subtitle Translating State */}
          {status === 'translating' && subtitles.length === 0 && (
            <div className={`rounded-2xl p-12 border flex flex-col items-center justify-center text-center space-y-3 transition-colors duration-200 ${statusCardBgClass}`}>
              <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <div>
                <h4 className={`text-sm font-semibold ${statusTitleClass}`}>Gemini 批次翻譯首批字幕中...</h4>
                <p className={`text-xs mt-1 ${statusDescClass}`}>完成第一批段落後即可立刻開始影音學習</p>
              </div>
            </div>
          )}

          {/* Live Stream Status in Subtitle Section (Clean & minimal, doesn't disrupt reading layout) */}
          {isCurrentLiveVideo && subtitles.length === 0 && status !== 'loading' && status !== 'translating' && (
            <div className={`p-6 sm:p-8 rounded-2xl border flex flex-col items-center justify-center text-center space-y-2.5 transition-colors duration-200 ${statusCardBgClass}`}>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Tv className="w-5 h-5" />
              </div>
              <h4 className={`text-sm font-semibold ${statusTitleClass}`}>24/7 即時新聞直播播放中</h4>
              <p className={`text-xs max-w-sm leading-relaxed ${statusDescClass}`}>
                本頻道為 24/7 直播串流，YouTube 官方英文即時字幕於上方畫面自動呈現。若需逐句英漢對照與筆記匯出，歡迎點擊上方精選頻道切換。
              </p>
            </div>
          )}

          {/* Error State for non-live videos (Handled cleanly with Curated News alternatives) */}
          {!isCurrentLiveVideo && status === 'error' && error && (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-rose-300">
                  {error.code === 'CAPTIONS_NOT_AVAILABLE'
                    ? '此影片未提供可用的英文字幕'
                    : error.code === 'VIDEO_UNAVAILABLE'
                    ? '該 YouTube 影片無法取得或設為私人'
                    : error.code === 'INVALID_YOUTUBE_URL'
                    ? '無效的 YouTube 網址'
                    : '字幕載入失敗'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {error.message}
                </p>
              </div>

              {error.code === 'CAPTIONS_NOT_AVAILABLE' && (
                <div className="bg-slate-900/80 p-3.5 rounded-xl max-w-md mx-auto text-left text-xs text-slate-300 space-y-2.5">
                  <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    推薦學習方案:
                  </p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    本影片無預先內嵌的 YouTube 官方英文字幕。您可以點擊「📰 美語精選頻道」觀看 100% 具備英文字幕的優質脫口秀與知識影片，或貼上其他具英文字幕之影片網址！
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewsModal(true)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <Newspaper className="w-3.5 h-3.5" />
                      <span>探索美語精選頻道</span>
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={retry}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              >
                重試載入
              </button>
            </div>
          )}

          {/* Subtitles Container (Reusing BilingualSubtitleCard.tsx) */}
          {subtitles.length > 0 && (
            <>
              {/* Voice Sync Toolbar: Ultra-Compact Slim Row (Minimizing vertical height) */}
              <div id="youtube-voice-sync-toolbar" className="mb-1.5">
                <div className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded-lg border text-xs ${
                  effectiveTheme === 'paper'
                    ? 'bg-[#EADDC2]/60 border-[#C8B282]/80 text-[#5C4830]'
                    : effectiveTheme === 'light'
                    ? 'bg-slate-100/90 border-slate-200 text-slate-700'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  {/* Left: Compact Title & Ahead toggle if offset > 0 */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SlidersHorizontal className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className={`text-[11px] font-bold truncate ${
                      effectiveTheme === 'paper' ? 'text-[#4A3B2C]' : 'text-slate-300'
                    }`}>
                      語音對齊
                    </span>
                    {videoSyncOffset > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPreRead((prev) => !prev)}
                        className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer select-none underline shrink-0 ml-0.5"
                      >
                        {showPreRead ? '收合超前' : `預覽+${videoSyncOffset}段`}
                      </button>
                    )}
                  </div>

                  {/* Right: Step controller [-] [ 慢 1 段 (+1) ↺ ] [+] - Micro compact */}
                  <div className="inline-flex items-center gap-0.5 shrink-0">
                    {/* Minus button */}
                    <button
                      type="button"
                      id="youtube-sync-minus-btn"
                      onClick={() => handleVideoSyncOffsetChange(videoSyncOffset - 1)}
                      disabled={videoSyncOffset <= -2}
                      title="減少延遲 (提前字幕)"
                      className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed active:scale-90 select-none ${
                        effectiveTheme === 'paper'
                          ? 'hover:bg-[#DBCBB0] text-[#4A3B2C]'
                          : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>

                    {/* Offset Display Pill - Click to reset to 0 */}
                    <button
                      type="button"
                      id="youtube-sync-reset-btn"
                      onClick={() => {
                        if (videoSyncOffset !== 0) {
                          handleVideoSyncOffsetChange(0);
                        }
                      }}
                      title={
                        videoSyncOffset === 0
                          ? '目前為標準時間軸同步，點擊 +/- 調整延遲段落'
                          : `目前語音延遲 ${videoSyncOffset} 段，點擊一鍵歸零重置`
                      }
                      className={`h-5 sm:h-5.5 px-2 rounded font-mono text-[10px] font-black flex items-center gap-1 transition-all select-none whitespace-nowrap cursor-pointer ${
                        videoSyncOffset === 0
                          ? effectiveTheme === 'paper'
                            ? 'bg-[#FFFDF7] text-[#5C4830] border border-[#E0CFAB]'
                            : effectiveTheme === 'light'
                            ? 'bg-white text-slate-700 border border-slate-300'
                            : 'bg-slate-800/90 text-slate-300 border border-slate-700/70'
                          : effectiveTheme === 'paper'
                          ? 'bg-amber-700 text-amber-100 ring-1 ring-amber-600/40 hover:bg-amber-800'
                          : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white ring-1 ring-blue-400/40 hover:from-blue-500 hover:to-indigo-500'
                      }`}
                    >
                      {videoSyncOffset === 0 ? (
                        <span>正常 (0)</span>
                      ) : videoSyncOffset > 0 ? (
                        <span className="flex items-center gap-0.5">
                          慢 {videoSyncOffset} 段 (+{videoSyncOffset})
                          <RotateCcw className="w-2.5 h-2.5 text-white/90 shrink-0" />
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          快 {Math.abs(videoSyncOffset)} 段 ({videoSyncOffset})
                          <RotateCcw className="w-2.5 h-2.5 text-white/90 shrink-0" />
                        </span>
                      )}
                    </button>

                    {/* Plus button */}
                    <button
                      type="button"
                      id="youtube-sync-plus-btn"
                      onClick={() => handleVideoSyncOffsetChange(videoSyncOffset + 1)}
                      disabled={videoSyncOffset >= 5}
                      title="增加延遲 (字幕超前語音時微調，最多 +5 段)"
                      className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed active:scale-90 select-none ${
                        effectiveTheme === 'paper'
                          ? 'hover:bg-[#DBCBB0] text-[#4A3B2C]'
                          : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Expandable Ahead Buffer Preview (Only rendered when explicitly opened) */}
                {showPreRead && aheadSubtitles.length > 0 && (
                  <div className="mt-1 space-y-1 p-2 rounded-xl bg-slate-900/90 border border-slate-700/80">
                    {aheadSubtitles.map((preSub, pIdx) => (
                      <div
                        key={preSub.id}
                        onClick={() => handleSeekToSentence(preSub.startMs)}
                        className="text-[11px] border-b border-slate-800/80 pb-1 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-800/50 p-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 font-bold mb-0.5">
                          <span>超前 +{pIdx + 1} 段</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            {Math.floor(preSub.startMs / 60000)}:{String(Math.floor((preSub.startMs % 60000) / 1000)).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="text-slate-200 font-medium">{preSub.english}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{preSub.traditionalChinese}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                ref={subtitleContainerRef}
                className="space-y-2.5 max-h-[calc(100dvh-210px)] sm:max-h-[calc(100dvh-230px)] lg:max-h-[calc(100vh-140px)] overflow-y-auto overscroll-y-auto pr-1 pb-36 sm:pb-44 scrollbar-thin scrollbar-thumb-slate-800"
              >
                {filteredSubtitles.map((ytItem, idx) => {
                  const subItem = toSubtitleItem(ytItem, idx);
                  const isActive = ytItem.id === (effectiveActiveId || activeSubtitleId);
                  const isPlayingThisSegment = isActive && playerState === 'playing';

                  // Calculate aheadOffset if card is in ahead preview buffer
                  let aheadOffset: number | undefined = undefined;
                  if (videoSyncOffset > 0 && effectiveActiveIndex >= 0) {
                    if (idx > effectiveActiveIndex && idx <= effectiveActiveIndex + videoSyncOffset) {
                      aheadOffset = idx - effectiveActiveIndex;
                    }
                  }

                  return (
                    <div
                      key={ytItem.id}
                      id={`yt-card-${ytItem.id}`}
                      onClick={() => handleSeekToSentence(ytItem.startMs)}
                      className={`transition-all duration-200 cursor-pointer rounded-2xl ${
                        isActive
                          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-xl shadow-blue-500/15'
                          : 'hover:opacity-95'
                      }`}
                    >
                      <BilingualSubtitleCard
                        subtitle={subItem}
                        onBookmarkToggle={handleBookmarkToggle}
                        onOpenDictionary={onOpenDictionary}
                        isLatest={isActive}
                        aheadOffset={aheadOffset}
                        liveSyncOffset={videoSyncOffset}
                        mode="video"
                        activeBadgeLabel="影音對齊"
                        searchQuery=""
                        fontSize={fontSize}
                        chineseVariant={chineseVariant}
                        highlightDifficulty={highlightDifficulty}
                        theme={effectiveTheme}
                        hideSpeedBookmark={true}
                        isPlayingSegment={isPlayingThisSegment}
                        onPlaySegment={() => {
                          if (isPlayingThisSegment) {
                            playerRef.current?.pause();
                          } else {
                            handleSeekToSentence(ytItem.startMs);
                          }
                        }}
                        isRepeatActive={repeatSegmentId === ytItem.id}
                        onToggleRepeatSegment={() => handleToggleRepeatSegment(ytItem.id, ytItem.startMs)}
                      />
                    </div>
                  );
                })}

                {/* Bottom Scroll Clearance Spacer: Guarantees the very last paragraph and translation can be scrolled completely above bottom bar/FAB */}
                <div className="h-36 sm:h-44 w-full shrink-0 select-none pointer-events-none" aria-hidden="true" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Return-to-Live Subtitle FAB (Bidirectional: Up or Down) */}
      {activeSubtitleRelativePos && subtitles.length > 0 && (
        <button
          type="button"
          key="yt-return-to-live-fab"
            onClick={handleReturnToLiveSubtitle}
            title={
              activeSubtitleRelativePos === 'above'
                ? '往上回歸目前播放字幕段落'
                : '往下回歸目前播放字幕段落'
            }
            aria-label={
              activeSubtitleRelativePos === 'above'
                ? '回歸即時播放段落（在上方）'
                : '回歸即時播放段落（在下方）'
            }
            id="yt-return-to-live-fab"
            className={`fixed right-5 sm:right-7 z-40 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-md cursor-pointer flex flex-col items-center justify-center gap-0.5 select-none transition-colors duration-150 group shadow-2xl ${
              effectiveTheme === 'paper'
                ? 'bg-[#FFFDF7]/90 border-[#C8B282]/90 text-[#3B2E1E] hover:bg-[#FFFDF7] shadow-[0_10px_28px_rgba(59,46,30,0.22)]'
                : effectiveTheme === 'light'
                ? 'bg-white/90 border-slate-300/90 text-slate-800 hover:bg-white shadow-[0_10px_28px_rgba(0,0,0,0.16)]'
                : 'bg-slate-900/90 border-slate-700/90 text-slate-100 hover:bg-slate-800 shadow-[0_10px_28px_rgba(0,0,0,0.65)]'
            }`}
            style={{
              bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
            }}
          >
            {activeSubtitleRelativePos === 'above' ? (
              <ArrowUp className="w-5 h-5 text-blue-500 dark:text-blue-400 group-hover:-translate-y-0.5 transition-transform duration-200" />
            ) : (
              <ArrowDown className="w-5 h-5 text-blue-500 dark:text-blue-400 group-hover:translate-y-0.5 transition-transform duration-200" />
            )}
            <span className="text-[9px] sm:text-[10px] font-black tracking-tighter leading-none opacity-90 group-hover:opacity-100 whitespace-nowrap">
              回歸即時
            </span>
          </button>
        )}

      {/* Live English News & Favorites Discovery Modal */}
      <YouTubeNewsDiscoveryModal
        isOpen={showNewsModal}
        onClose={() => setShowNewsModal(false)}
        onSelectVideo={handleSelectNewsVideo}
        effectiveTheme={effectiveTheme}
        savedUrls={savedUrls}
        activeVideoId={activeVideoId}
        onSelectSavedUrl={handleSelectSavedUrl}
        onDeleteSavedUrl={handleDeleteSavedUrl}
      />

      {/* Vocabulary Notebook & Flashcard Quiz Modal */}
      <VocabularyNotebookModal
        isOpen={showVocabModal}
        onClose={() => setShowVocabModal(false)}
        theme={currentTheme as 'dark' | 'light' | 'paper'}
        chineseVariant={chineseVariant}
        onOpenDictionary={onOpenDictionary}
      />

      {/* Bilingual Notes Export & Preview Modal */}
      <NotesExportModal
        isOpen={showNotesExportModal}
        onClose={() => setShowNotesExportModal(false)}
        videoTitle={title || '當前影片中英對照學習筆記'}
        videoUrl={urlInput}
        videoId={activeVideoId}
        subtitles={subtitles}
      />
    </div>
  );
};
