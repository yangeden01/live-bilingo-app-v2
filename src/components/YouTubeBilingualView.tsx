import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { YouTubeBilingualPlayer, YouTubePlayerRef } from './YouTubeBilingualPlayer';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { useYouTubeSubtitles } from '../hooks/useYouTubeSubtitles';
import { extractYouTubeVideoId } from '../utils/youtubeUrl';
import { YouTubeSubtitleItem, SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize, YouTubeNewsVideo } from '../types';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { vibrateDetentTick } from '../utils/haptics';
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
  Clock,
  HelpCircle,
  Trash2,
  X,
  ChevronDown,
  History,
  Newspaper,
} from 'lucide-react';
import { ReadingModeAndFontToolbar } from './ReadingModeAndFontToolbar';
import { YouTubeNewsDiscoveryModal } from './YouTubeNewsDiscoveryModal';

interface Props {
  onOpenDictionary?: (word?: string) => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize?: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
  onPlaybackStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'idle') => void;
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

// Helper to retrieve saved progress for a specific video ID
const getSavedProgressForVideo = (vid: string): number => {
  try {
    const specific = getPersistentItem(`youtube_progress_${vid}`);
    if (specific) {
      const p = parseFloat(specific);
      if (!isNaN(p) && p > 0) return p;
    }
    const lastVid = getPersistentItem('youtube_last_video_id');
    if (lastVid === vid) {
      const lastTime = getPersistentItem('youtube_last_time');
      if (lastTime) {
        const p = parseFloat(lastTime);
        if (!isNaN(p) && p > 0) return p;
      }
    }
  } catch (_) {}
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
  onPlaybackStateChange,
}) => {
  // Pre-fill YouTube URL and video ID from persistent storage or default test video
  const [urlInput, setUrlInput] = useState<string>(() => {
    return getPersistentItem('youtube_last_url') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url;
  });
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
      ? 'bg-[#EFE5CE] hover:bg-[#E5D9BE] active:bg-[#DBCFB3] text-emerald-800 border-[#CDB58A]'
      : currentTheme === 'light'
      ? 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border-emerald-200'
      : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm';

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
  const [initialTimeSeconds, setInitialTimeSeconds] = useState<number>(() => {
    const initialVid = getPersistentItem('youtube_last_video_id') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id;
    return getSavedProgressForVideo(initialVid);
  });
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => {
    const initialVid = getPersistentItem('youtube_last_video_id') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id;
    return getSavedProgressForVideo(initialVid);
  });

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
  const historyDropdownRef = useRef<HTMLDivElement | null>(null);

  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const isLoopSeekingRef = useRef<boolean>(false);

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

  // Update initial time and current time when active video ID changes
  useEffect(() => {
    if (!activeVideoId) return;
    const saved = getSavedProgressForVideo(activeVideoId);
    setInitialTimeSeconds(saved);
    setCurrentTimeSeconds(saved);
  }, [activeVideoId]);

  // Persist URL input so whatever the user typed or pasted is preserved across modes
  useEffect(() => {
    if (urlInput && urlInput.trim()) {
      setPersistentItem('youtube_last_url', urlInput.trim());
    }
  }, [urlInput]);

  // Throttled time updater that persists playback progress and handles segment repeating loop
  const handleTimeUpdate = useCallback((secs: number) => {
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
    }
  }, [activeVideoId, title]);

  // Load the verified caption test video through the exact standard production pipeline
  const handleLoadTestVideo = () => {
    setUrlInput(VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url);
    setActiveVideoId(VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id);
    setPersistentItem('youtube_last_url', VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url);
    setPersistentItem('youtube_last_video_id', VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id);
    saveUrlToHistory(VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url, VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id, VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title);
    setShowHistoryDropdown(false);
  };

  // Select a news video from the Live English News discovery modal
  const handleSelectNewsVideo = (video: YouTubeNewsVideo) => {
    const fullUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    setUrlInput(fullUrl);
    setActiveVideoId(video.videoId);
    setPersistentItem('youtube_last_url', fullUrl);
    setPersistentItem('youtube_last_video_id', video.videoId);
    saveUrlToHistory(fullUrl, video.videoId, video.title);
    setShowNewsModal(false);
  };

  // Load video handler
  const handleLoadVideo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = extractYouTubeVideoId(urlInput);
    if (!id) {
      alert('請輸入有效的 YouTube 影片網址或 ID (例如: https://www.youtube.com/watch?v=...)');
      return;
    }
    setActiveVideoId(id);
    setPersistentItem('youtube_last_url', urlInput.trim());
    setPersistentItem('youtube_last_video_id', id);
    saveUrlToHistory(urlInput.trim(), id);
    setShowHistoryDropdown(false);
  };

  // Select a URL from the history dropdown
  const handleSelectHistoryItem = (item: YouTubeHistoryItem) => {
    setUrlInput(item.url);
    setActiveVideoId(item.videoId);
    setPersistentItem('youtube_last_url', item.url);
    setPersistentItem('youtube_last_video_id', item.videoId);
    // Move selected to top of history
    saveUrlToHistory(item.url, item.videoId, item.title);
    setShowHistoryDropdown(false);
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

  // Floating Return-To-Live Subtitle Button State:
  // 'above' = active subtitle is above the visible area (user scrolled DOWN to view future subtitles)
  // 'below' = active subtitle is below the visible area (user scrolled UP to view earlier subtitles)
  // null = active subtitle is currently within the visible reading area
  const [activeSubtitleRelativePos, setActiveSubtitleRelativePos] = useState<'above' | 'below' | null>(null);
  const [isUserScrolledAway, setIsUserScrolledAway] = useState<boolean>(false);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const rafCheckId = useRef<number | null>(null);

  const checkSubtitlePosition = useCallback(() => {
    if (!activeSubtitleId || !subtitleContainerRef.current) {
      setActiveSubtitleRelativePos(null);
      return;
    }

    const container = subtitleContainerRef.current;
    const cardEl = document.getElementById(`yt-card-${activeSubtitleId}`);
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
  }, [activeSubtitleId]);

  const scheduleCheck = useCallback(() => {
    if (rafCheckId.current) cancelAnimationFrame(rafCheckId.current);
    rafCheckId.current = requestAnimationFrame(() => {
      checkSubtitlePosition();
    });
  }, [checkSubtitlePosition]);

  // Monitor scroll on both subtitleContainerRef and window
  useEffect(() => {
    const container = subtitleContainerRef.current;

    const handleUserScrollOrTouch = () => {
      if (!isProgrammaticScrollRef.current) {
        setIsUserScrolledAway(true);
      }
      scheduleCheck();
    };

    container?.addEventListener('scroll', handleUserScrollOrTouch, { passive: true });
    container?.addEventListener('wheel', handleUserScrollOrTouch, { passive: true });
    container?.addEventListener('touchmove', handleUserScrollOrTouch, { passive: true });
    window.addEventListener('scroll', handleUserScrollOrTouch, { passive: true });
    window.addEventListener('resize', scheduleCheck, { passive: true });

    scheduleCheck();

    return () => {
      container?.removeEventListener('scroll', handleUserScrollOrTouch);
      container?.removeEventListener('wheel', handleUserScrollOrTouch);
      container?.removeEventListener('touchmove', handleUserScrollOrTouch);
      window.removeEventListener('scroll', handleUserScrollOrTouch);
      window.removeEventListener('resize', scheduleCheck);
      if (rafCheckId.current) cancelAnimationFrame(rafCheckId.current);
    };
  }, [scheduleCheck]);

  // Check visibility whenever active subtitle ID changes
  useEffect(() => {
    scheduleCheck();
  }, [activeSubtitleId, scheduleCheck]);

  // Auto-scroll ONLY inside the dedicated subtitle container when NOT scrolled away
  useEffect(() => {
    if (!autoScroll || isUserScrolledAway || !activeSubtitleId || !subtitleContainerRef.current) return;
    const container = subtitleContainerRef.current;
    const cardEl = document.getElementById(`yt-card-${activeSubtitleId}`);
    if (!cardEl) return;

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
  }, [activeSubtitleId, autoScroll, isUserScrolledAway, scheduleCheck]);

  // Handler to return to currently active subtitle segment
  const handleReturnToLiveSubtitle = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    vibrateDetentTick();

    const targetId = activeSubtitleId || (subtitles.length > 0 ? subtitles[0].id : null);
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
  }, [activeSubtitleId, subtitles, scheduleCheck]);

  const filteredSubtitles = subtitles;

  return (
    <div className="space-y-6">
      {/* Top YouTube URL Input & Search Bar */}
      <div className={`backdrop-blur-md rounded-2xl p-4 sm:p-5 border transition-colors duration-200 shadow-xl space-y-3 ${cardBgClass}`}>
        <form onSubmit={handleLoadVideo} className="flex flex-col sm:flex-row gap-2">
          <div ref={historyDropdownRef} className="relative flex-1">
            <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500 pointer-events-none" />
            <input
              ref={urlInputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={() => {
                if (urlHistory.length > 0) setShowHistoryDropdown(true);
              }}
              placeholder="貼上 YouTube 影片網址 (例如: https://youtu.be/... 或 watch?v=...)"
              className={`w-full rounded-xl pl-10 ${
                urlInput ? 'pr-20' : 'pr-12'
              } py-2.5 text-xs sm:text-sm border focus:outline-none transition-colors ${inputBgClass}`}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {urlInput && (
                <button
                  type="button"
                  id="youtube-url-clear-btn"
                  onClick={handleClearUrlInput}
                  aria-label="清除網址"
                  title="清除網址"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    currentTheme === 'paper'
                      ? 'text-[#7A6853] hover:text-[#3B2E1E] hover:bg-[#EFE5CE]'
                      : currentTheme === 'light'
                      ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                id="youtube-history-toggle-btn"
                onClick={() => setShowHistoryDropdown((prev) => !prev)}
                aria-label="展開歷史輸入網址"
                title="歷史輸入網址清單"
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
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
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showHistoryDropdown ? 'rotate-180 text-rose-500' : ''}`} />
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="youtube-live-news-btn"
              onClick={() => setShowNewsModal(true)}
              aria-label="即時美語新聞"
              title="探索最近 48 小時具備完整英文字幕之權威美語新聞"
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border shadow-sm transition-all shrink-0 cursor-pointer whitespace-nowrap ${testBtnClass}`}
            >
              <Newspaper className="w-4 h-4 text-emerald-400" />
              <span>即時美語新聞</span>
            </button>
            <button
              type="submit"
              id="youtube-load-btn"
              disabled={!urlInput.trim() || status === 'loading' || status === 'translating'}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow-lg shadow-rose-600/20 transition-all shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>載入雙語字幕</span>
            </button>
          </div>
        </form>

        {/* Bottom Utility Bar: Reading Mode, Chinese Variant & Subtitle Font Size Controls */}
        <ReadingModeAndFontToolbar
          readingMode={readingMode}
          onReadingModeChange={onReadingModeChange}
          effectiveTheme={effectiveTheme}
          chineseVariant={chineseVariant}
          onChineseVariantChange={onChineseVariantChange}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          idPrefix="youtube"
        />
      </div>

      {/* Main Learning Interface: Video Player & Subtitles Grid */}
      <div id="youtube-player-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Player (Clean fixed/sticky reading mode) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div id="youtube-player-anchor" className={`sticky top-[56px] z-20 sm:static pb-2 sm:pb-0 transition-colors duration-200 ${playerAnchorBg}`}>
            <YouTubeBilingualPlayer
              ref={playerRef}
              videoId={activeVideoId}
              initialTimeSeconds={initialTimeSeconds}
              onTimeUpdate={handleTimeUpdate}
              onStateChange={handlePlayerStateChange}
              hideActionControls
            />
          </div>
        </div>

        {/* Right Column: Bilingual Subtitle Stream (Clean reading mode) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Subtitle Idle / Ready to Load State */}
          {status === 'idle' && subtitles.length === 0 && (
            <div className={`rounded-2xl p-10 border flex flex-col items-center justify-center text-center space-y-3 transition-colors duration-200 ${statusCardBgClass}`}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Newspaper className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className={`text-sm font-semibold ${statusTitleClass}`}>點擊「即時美語新聞」立即探索</h4>
                <p className={`text-xs mt-1 leading-relaxed ${statusDescClass}`}>
                  探索最近 48 小時具備完整英文字幕的權威新聞影片，點擊即可自動填入網址並啟動 Gemini 雙語對照學習。
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
                  <span>瀏覽即時美語新聞</span>
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

          {/* Error State (Handled cleanly without ASR fallback) */}
          {status === 'error' && error && (
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
                <div className="bg-slate-900/80 p-3 rounded-xl max-w-md mx-auto text-left text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    學習建議:
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    目前第一階段僅支援原生具備英文字幕 (CC) 的影片。您可以嘗試點擊上方的推薦測試影片，或貼上具備英文字幕的英語演講或訪談影片。
                  </p>
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
            <div
              ref={subtitleContainerRef}
              className="space-y-3 max-h-[70vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {filteredSubtitles.map((ytItem, idx) => {
                const subItem = toSubtitleItem(ytItem, idx);
                const isActive = ytItem.id === activeSubtitleId;
                const isPlayingThisSegment = isActive && playerState === 'playing';

                return (
                  <div
                    key={ytItem.id}
                    id={`yt-card-${ytItem.id}`}
                    onClick={() => handleSeekToSentence(ytItem.startMs)}
                    className={`transition-all duration-200 cursor-pointer rounded-2xl ${
                      isActive
                        ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/10 scale-[1.01]'
                        : 'hover:opacity-95'
                    }`}
                  >
                    <BilingualSubtitleCard
                      subtitle={subItem}
                      onBookmarkToggle={handleBookmarkToggle}
                      onOpenDictionary={onOpenDictionary}
                      isLatest={isActive}
                      searchQuery=""
                      fontSize={fontSize}
                      chineseVariant={chineseVariant}
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
            </div>
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

      {/* Live English News Discovery Modal */}
      <YouTubeNewsDiscoveryModal
        isOpen={showNewsModal}
        onClose={() => setShowNewsModal(false)}
        onSelectVideo={handleSelectNewsVideo}
        effectiveTheme={effectiveTheme}
      />
    </div>
  );
};
