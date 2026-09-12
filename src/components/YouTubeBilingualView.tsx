import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { YouTubeBilingualPlayer, YouTubePlayerRef } from './YouTubeBilingualPlayer';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import { useYouTubeSubtitles } from '../hooks/useYouTubeSubtitles';
import { extractYouTubeVideoId } from '../utils/youtubeUrl';
import { YouTubeSubtitleItem, SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { motion, AnimatePresence } from 'motion/react';
import { vibrateDetentTick } from '../utils/haptics';
import {
  Youtube,
  RotateCw,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Play,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Bookmark,
  Clock,
  HelpCircle,
  Trash2,
  X,
} from 'lucide-react';

interface Props {
  onOpenDictionary?: (word?: string) => void;
  readingMode?: ReadingMode;
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  fontSize?: SubtitleFontSize;
  onPlaybackStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'idle') => void;
}

// Preset verified caption test video (passes all 6 backend extraction criteria 100%)
export const VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO = {
  id: 'MiAl9CNZUuo',
  url: 'https://youtu.be/MiAl9CNZUuo?si=Qwpeu5kv-iGQheJU',
  title: 'Jensen Huang Outlines AI Future (雙語影音示範)',
};

// Preset recommended English listening practice videos
const SAMPLE_VIDEOS = [
  {
    title: 'Jensen Huang Outlines AI Future',
    url: 'https://youtu.be/MiAl9CNZUuo?si=Qwpeu5kv-iGQheJU',
    id: 'MiAl9CNZUuo',
  },
  {
    title: 'Steve Jobs 2005 Stanford Commencement Speech',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    id: 'UF8uR6Z6KLc',
  },
  {
    title: 'English Speech Listening Practice',
    url: 'https://www.youtube.com/watch?v=wHGqp8vVEdY',
    id: 'wHGqp8vVEdY',
  },
];

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
  readingMode = 'dark',
  effectiveTheme = 'dark',
  chineseVariant = 'traditional',
  fontSize = 'medium',
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
  const [initialTimeSeconds, setInitialTimeSeconds] = useState<number>(() => {
    const initialVid = getPersistentItem('youtube_last_video_id') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id;
    return getSavedProgressForVideo(initialVid);
  });
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => {
    const initialVid = getPersistentItem('youtube_last_video_id') || VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id;
    return getSavedProgressForVideo(initialVid);
  });
  const [playerState, setPlayerState] = useState<'playing' | 'paused' | 'buffering' | 'idle'>('idle');
  const [autoScroll, setAutoScroll] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const subtitleContainerRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

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

  // Throttled time updater that persists playback progress
  const handleTimeUpdate = useCallback((secs: number) => {
    setCurrentTimeSeconds(secs);
    if (Math.abs(secs - lastSavedTimeRef.current) >= 1.5) {
      lastSavedTimeRef.current = secs;
      if (activeVideoId && secs > 0) {
        setPersistentItem('youtube_last_time', String(secs));
        setPersistentItem(`youtube_progress_${activeVideoId}`, String(secs));
      }
    }
  }, [activeVideoId]);

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

  // Clear URL input field and immediately refocus without affecting loaded video or subtitles
  const handleClearUrlInput = () => {
    setUrlInput('');
    setPersistentItem('youtube_last_url', '');
    urlInputRef.current?.focus();
  };

  // Load the verified caption test video through the exact standard production pipeline
  const handleLoadTestVideo = () => {
    setUrlInput(VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url);
    setActiveVideoId(VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id);
    setPersistentItem('youtube_last_url', VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.url);
    setPersistentItem('youtube_last_video_id', VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id);
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
    const secs = startMs / 1000;
    setIsUserScrolledAway(false);
    setActiveSubtitleRelativePos(null);
    playerRef.current?.seekTo(secs);
    playerRef.current?.play();
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
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3">
        <form onSubmit={handleLoadVideo} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Youtube className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500 pointer-events-none" />
            <input
              ref={urlInputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="貼上 YouTube 影片網址 (例如: https://youtu.be/... 或 watch?v=...)"
              className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 ${
                urlInput ? 'pr-12' : 'pr-4'
              } py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors`}
            />
            {urlInput && (
              <button
                type="button"
                id="youtube-url-clear-btn"
                onClick={handleClearUrlInput}
                aria-label="清除網址"
                title="清除網址"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="youtube-load-test-btn"
              onClick={handleLoadTestVideo}
              aria-label="載入字幕測試影片"
              title="載入已在後端環境 100% 驗證通過的英文字幕測試影片"
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 shadow-sm transition-all shrink-0 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>載入字幕測試影片</span>
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

        {/* Sample preset recommendations */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none text-xs">
          <span className="text-slate-400 shrink-0 flex items-center gap-1 font-medium">
            <Play className="w-3 h-3 text-rose-400" />
            推薦測試:
          </span>
          <button
            id="verified-caption-test-chip"
            type="button"
            onClick={handleLoadTestVideo}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeVideoId === VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>【已驗證可提取】{VERIFIED_YOUTUBE_CAPTION_TEST_VIDEO.title}</span>
          </button>
          {SAMPLE_VIDEOS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setUrlInput(sample.url);
                setActiveVideoId(sample.id);
                setPersistentItem('youtube_last_url', sample.url);
                setPersistentItem('youtube_last_video_id', sample.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                activeVideoId === sample.id
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Learning Interface: Video Player & Subtitles Grid */}
      <div id="youtube-player-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Player (Clean fixed/sticky reading mode) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div id="youtube-player-anchor" className="sticky top-[56px] z-20 bg-slate-950 sm:static pb-2 sm:pb-0">
            <YouTubeBilingualPlayer
              ref={playerRef}
              videoId={activeVideoId}
              initialTimeSeconds={initialTimeSeconds}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={() => {}}
              onStateChange={handlePlayerStateChange}
              hideActionControls
            />
          </div>
        </div>

        {/* Right Column: Bilingual Subtitle Stream (Clean reading mode) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Subtitle Idle / Ready to Load State */}
          {status === 'idle' && subtitles.length === 0 && (
            <div className="bg-slate-900/60 rounded-2xl p-10 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-semibold text-white">點擊「載入字幕測試影片」立即驗證</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  系統已預填後端環境 100% 驗證通過的測試影片。點擊按鈕即可透過真實生產管線取得英文字幕並進行 Gemini 雙語對照學習。
                </p>
              </div>
              <button
                type="button"
                id="youtube-load-test-btn-inline"
                onClick={handleLoadTestVideo}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>立即載入已驗證字幕測試影片</span>
              </button>
            </div>
          )}

          {/* Subtitle Loading State */}
          {status === 'loading' && (
            <div className="bg-slate-900/60 rounded-2xl p-12 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <RotateCw className="w-8 h-8 text-blue-400 animate-spin" />
              <div>
                <h4 className="text-sm font-semibold text-white">正在取得 YouTube 原始字幕...</h4>
                <p className="text-xs text-slate-400 mt-1">解析英文字幕軌道並提取時間軸標記</p>
              </div>
            </div>
          )}

          {/* Subtitle Translating State */}
          {status === 'translating' && subtitles.length === 0 && (
            <div className="bg-slate-900/60 rounded-2xl p-12 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <div>
                <h4 className="text-sm font-semibold text-white">Gemini 批次翻譯首批字幕中...</h4>
                <p className="text-xs text-slate-400 mt-1">完成第一批段落後即可立刻開始影音學習</p>
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
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Return-to-Live Subtitle FAB (Bidirectional: Up or Down) */}
      <AnimatePresence>
        {activeSubtitleRelativePos && subtitles.length > 0 && (
          <motion.button
            key="yt-return-to-live-fab"
            initial={{ opacity: 0, scale: 0.6, y: activeSubtitleRelativePos === 'above' ? 20 : -20 }}
            animate={{ opacity: 0.92, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: activeSubtitleRelativePos === 'above' ? 20 : -20 }}
            whileHover={{ opacity: 1, scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 26 }}
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
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
