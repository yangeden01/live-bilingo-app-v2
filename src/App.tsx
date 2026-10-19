// Live Bilingo App - YouTube Bilingual Video Learning Platform
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ReadingMode, ChineseVariant, SubtitleFontSize, APP_VERSION } from './types';
import { YouTubeBilingualView } from './components/YouTubeBilingualView';
import { DictionaryModal } from './components/DictionaryModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import { InterstitialAdModal } from './components/InterstitialAdModal';
import { safeApiFetch } from './utils/safeFetch';
import { vibrateGitPushSuccess, vibrateDetentTick } from './utils/haptics';
import { getPersistentItem, setPersistentItem } from './utils/persistentStorage';
import {
  Youtube,
  CheckCircle2,
  Sparkles,
  Download,
  Copy,
  Play,
  Pause,
  Power,
  ArrowUp,
  ArrowDown,
  Repeat,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(25);
  const [initStatusText, setInitStatusText] = useState('初始化雙語影音學習模組...');

  // Reading Mode & Typography Settings
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => {
    return (getPersistentItem('bilingo_reading_mode') as ReadingMode) || 'system';
  });

  const [chineseVariant, setChineseVariant] = useState<ChineseVariant>(() => {
    return (getPersistentItem('bilingo_chinese_variant') as ChineseVariant) || 'traditional';
  });

  const [subtitleFontSize, setSubtitleFontSize] = useState<SubtitleFontSize>(() => {
    return (getPersistentItem('bilingo_subtitle_font_size') as SubtitleFontSize) || 'medium';
  });

  const [highlightDifficulty, setHighlightDifficulty] = useState<boolean>(false);

  const handleHighlightDifficultyChange = useCallback((enabled: boolean) => {
    setHighlightDifficulty(enabled);
    setPersistentItem('bilingo_highlight_difficulty', String(enabled));
  }, []);

  // System Dark Mode Detection
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const effectiveTheme = useMemo<'paper' | 'light' | 'dark'>(() => {
    if (readingMode === 'paper') return 'paper';
    if (readingMode === 'light') return 'light';
    if (readingMode === 'dark') return 'dark';
    return isSystemDark ? 'dark' : 'light';
  }, [readingMode, isSystemDark]);

  useEffect(() => {
    setPersistentItem('bilingo_reading_mode', readingMode);
    setPersistentItem('bilingo_chinese_variant', chineseVariant);
    setPersistentItem('bilingo_subtitle_font_size', subtitleFontSize);
  }, [readingMode, chineseVariant, subtitleFontSize]);

  // Online / Offline Detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Smooth App Initialization
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setInitProgress(100);
        setIsInitializing(false);
      }
    }, 900);

    const timer1 = setTimeout(() => {
      if (!isMounted) return;
      setInitProgress(65);
      setInitStatusText('載入 YouTube 雙語字幕模組...');
    }, 150);

    const timer2 = setTimeout(() => {
      if (!isMounted) return;
      setInitProgress(100);
      setIsInitializing(false);
      clearTimeout(safetyTimer);
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Git Push & Server Build Haptic Vibration Notification
  const [gitUpdateToast, setGitUpdateToast] = useState<{ commit?: string; time: number } | null>(null);

  useEffect(() => {
    let lastBuildTime = 0;
    let lastCommit = '';
    let isInitialCheck = true;

    const checkServerVersion = async () => {
      try {
        const res = await safeApiFetch<{ buildTime?: number; commit?: string; version?: string }>('/api/version', { cache: 'no-store' });
        if (res.ok && res.data) {
          const currentBuildTime = Number(res.data.buildTime || 0);
          const currentCommit = String(res.data.commit || '');

          if (currentBuildTime > 0 || currentCommit) {
            const hasChanged = (lastBuildTime > 0 && currentBuildTime > 0 && currentBuildTime !== lastBuildTime) ||
                              (lastCommit && currentCommit && currentCommit !== 'dev' && currentCommit !== lastCommit);

            if (!isInitialCheck && hasChanged) {
              vibrateGitPushSuccess();
              setGitUpdateToast({ commit: currentCommit, time: Date.now() });
              setTimeout(() => setGitUpdateToast(null), 6000);
            }

            if (currentBuildTime > 0) lastBuildTime = currentBuildTime;
            if (currentCommit) lastCommit = currentCommit;
            isInitialCheck = false;
          }
        }
      } catch {
        // ignore offline / network glitches
      }
    };

    checkServerVersion();
    const interval = setInterval(checkServerVersion, 3000);
    return () => clearInterval(interval);
  }, []);

  // PWA & Browser Installation State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const isAndroidWebView = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /AndroidApp|wv|Android.*Version\/[0-9.]+/i.test(ua) || (window as any).Android !== undefined;
  }, []);

  const isInAppBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isLine = /Line/i.test(ua);
    const isFB = /FBAV|FBAN|FB_IAB/i.test(ua);
    const isIG = /Instagram/i.test(ua);
    const isWeChat = /MicroMessenger/i.test(ua);
    const isIframe = window.self !== window.top;
    return isLine || isFB || isIG || isWeChat || isIframe;
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleCopyUrl = () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        setCopyStatus('已複製網址！請至 Chrome / Safari 貼上開啟');
        setTimeout(() => setCopyStatus(''), 3000);
      });
    } catch {
      setCopyStatus('複製失敗，請手動複製網址');
    }
  };

  // Exit Modal State
  const [showExitModal, setShowExitModal] = useState(false);

  // Free Local Dictionary Modal State
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [dictWord, setDictWord] = useState('');

  const handleOpenDictionary = useCallback((word?: string) => {
    setDictWord(word || '');
    setIsDictOpen(true);
  }, []);

  // YouTube Whole Video Loop Playback State
  const [isYouTubeLoopEnabled, setIsYouTubeLoopEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bilingo_youtube_loop_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleYouTubeLoop = useCallback(() => {
    setIsYouTubeLoopEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bilingo_youtube_loop_enabled', String(next));
      } catch {}
      window.dispatchEvent(new CustomEvent('youtube-loop-toggle', { detail: { enabled: next } }));
      vibrateDetentTick();
      return next;
    });
  }, []);

  // YouTube Playback State for sticky Header Play Button
  const [youtubePlaybackState, setYoutubePlaybackState] = useState<'playing' | 'paused' | 'buffering' | 'idle'>('idle');

  const snapToYouTubeReadingMode = useCallback(() => {
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

  // Floating Watermark Reading FAB Visibility
  const [showBackToReadingFab, setShowBackToReadingFab] = useState(false);
  const [showScrollDownToReadingFab, setShowScrollDownToReadingFab] = useState(false);

  useEffect(() => {
    const checkScrollState = () => {
      const header = document.querySelector('header');
      const headerBottom = header ? header.getBoundingClientRect().bottom : 56;
      const targetEl = document.getElementById('youtube-player-section') || document.getElementById('youtube-player-anchor');

      if (!targetEl) {
        setShowBackToReadingFab(false);
        setShowScrollDownToReadingFab(false);
        return;
      }

      const rect = targetEl.getBoundingClientRect();
      const isPastReading = rect.top < headerBottom - 20;
      const isTooHighAbove = rect.top > headerBottom + 50;

      setShowBackToReadingFab(isPastReading);
      setShowScrollDownToReadingFab(isTooHighAbove);
    };

    window.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState, { passive: true });
    checkScrollState();

    return () => {
      window.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, []);

  const handleReturnToReadingMode = useCallback(() => {
    snapToYouTubeReadingMode();
    vibrateDetentTick();
  }, [snapToYouTubeReadingMode]);

  useEffect(() => {
    const handleYouTubeScrollEvent = () => {
      snapToYouTubeReadingMode();
    };
    window.addEventListener('scroll-to-youtube-reading', handleYouTubeScrollEvent);
    return () => {
      window.removeEventListener('scroll-to-youtube-reading', handleYouTubeScrollEvent);
    };
  }, [snapToYouTubeReadingMode]);

  const handleTopHeaderPlayToggle = () => {
    const isCurrentlyPlaying = youtubePlaybackState === 'playing';
    window.dispatchEvent(new CustomEvent('youtube-toggle-play'));
    if (!isCurrentlyPlaying) {
      setTimeout(() => {
        snapToYouTubeReadingMode();
      }, 50);
    }
  };

  const handleConfirmExit = () => {
    try {
      sessionStorage.clear();
    } catch {}

    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.exitApp) {
      (window as any).AndroidBridge.exitApp(true);
    } else {
      setShowExitModal(false);
      setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 400);
    }
  };

  // Theme-based Styles
  const bgClass =
    effectiveTheme === 'paper'
      ? 'bg-[#F4EBD7] text-[#2C1D0F]'
      : effectiveTheme === 'light'
      ? 'bg-slate-50 text-slate-900'
      : 'bg-slate-950 text-slate-100';

  const headerClass =
    effectiveTheme === 'paper'
      ? 'bg-[#F4EBD7]/95 border-[#E2D2B0] text-[#2C1D0F]'
      : effectiveTheme === 'light'
      ? 'bg-white/95 border-slate-200 text-slate-900'
      : 'bg-slate-950/90 border-slate-800/80 text-white';

  return (
    <div
      className={`min-h-screen transition-colors duration-200 flex flex-col font-sans selection:bg-rose-500 selection:text-white ${bgClass}`}
    >
      {/* Top Safe Area Spacer */}
      <div
        className="w-full shrink-0 select-none pointer-events-none transition-colors duration-200"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
        aria-hidden="true"
      />

      {/* Splash / Loading Overlay */}
      <AnimatePresence>
        {isInitializing && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none pointer-events-none"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div className="relative flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shadow-2xl shadow-rose-600/40 border border-rose-400/30 mb-6">
                <Youtube className="w-10 h-10 text-white fill-current" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white mb-2">Live Bilingo</h1>
              <p className="text-xs font-semibold text-rose-300 tracking-wider uppercase mb-8">
                YouTube 雙語影音英語學習
              </p>
              <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3 border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-400 transition-all duration-300 rounded-full"
                  style={{ width: `${initProgress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono tracking-tight">{initStatusText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Browser Warning Header Banner */}
      {isInAppBrowser && !isInstalled && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-3 sm:px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 z-40 relative shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-sm shrink-0">⚠️</span>
            <span className="truncate text-[11px] sm:text-xs">
              <b>提醒：</b>目前在 LINE/FB 內建瀏覽器或預覽頁，請用獨立 Chrome/Safari 開啟才能成功安裝！
            </span>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow transition-transform active:scale-95"
          >
            安裝 App 說明
          </button>
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-red-600/90 text-white border-b border-red-500/50 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-2 z-40 relative shadow-md">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-base shrink-0 animate-pulse">📡</span>
            <span className="truncate text-[11px] sm:text-xs">
              <b>航空/離線模式：</b>網路未連線，可複習本機已儲存之生詞筆記與收藏影音。
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 bg-white text-red-700 hover:bg-slate-100 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow transition-all active:scale-95"
          >
            重試連線
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <header
        className={`backdrop-blur-md border-b sticky z-50 shadow-md transition-colors duration-200 py-1.5 ${headerClass}`}
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex flex-nowrap items-center justify-between gap-2">
          {/* Left: Power Button + App Brand */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Quick Exit Button */}
            <button
              onClick={() => setShowExitModal(true)}
              title="退出應用程式並清理快取"
              className={`p-1.5 sm:p-2 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm ${
                effectiveTheme === 'paper'
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-red-900/5'
                  : effectiveTheme === 'light'
                  ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200 shadow-red-500/5'
                  : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30 shadow-red-500/10'
              }`}
              aria-label="退出應用程式"
            >
              <Power className="w-4 h-4" />
            </button>

            {/* Brand Logo & Title */}
            <div
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all shadow-sm select-none ${
                effectiveTheme === 'paper'
                  ? 'bg-[#EADDC2]/90 border-[#C8B282] text-[#2C1D0F]'
                  : effectiveTheme === 'light'
                  ? 'bg-slate-100/90 border-slate-300 text-slate-900'
                  : 'bg-slate-900/95 border-slate-700/80 text-white'
              }`}
            >
              {/* Desktop App Icon Match: Dark base, Rose gradient video card, White play arrow, Cyan/Amber subtitle lines */}
              <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-xl bg-slate-950 p-1 flex flex-col items-center justify-between shrink-0 shadow-md border border-slate-800/80 ring-1 ring-rose-500/20">
                <div className="w-full h-3.5 rounded-[4px] bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shadow-xs">
                  <div className="w-0 h-0 border-y-[2.5px] border-y-transparent border-l-[4.5px] border-l-white ml-0.5" />
                </div>
                <div className="w-full flex flex-col gap-0.5 px-0.5 pb-0.5">
                  <div className="w-full h-[1.5px] rounded-full bg-sky-400" />
                  <div className="w-3/4 h-[1.5px] rounded-full bg-amber-400" />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-xs sm:text-sm tracking-tight truncate">
                  Bilingo 雙語
                </span>
                <span className="text-[10px] opacity-70 font-medium truncate hidden sm:inline">
                  YouTube 影音雙語學習
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Loop Button + Sticky Play/Pause + Install Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Whole Video Loop Button */}
            <button
              type="button"
              onClick={handleToggleYouTubeLoop}
              title={
                isYouTubeLoopEnabled
                  ? '整部影片循環播放中（點擊取消循環）'
                  : '點擊開啟整部影片循環播放（影片結束自動重播）'
              }
              aria-label="YouTube整部影片循環播放切換"
              className={`px-2 sm:px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border select-none ${
                isYouTubeLoopEnabled
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/40 font-black'
                  : effectiveTheme === 'paper'
                  ? 'bg-[#EFE6D2] text-[#3B2E1E] border-[#D8C49E] hover:bg-[#E5D7BF]'
                  : effectiveTheme === 'light'
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 shrink-0 ${isYouTubeLoopEnabled ? 'stroke-[2.5] text-white animate-pulse' : ''}`} />
              <span>{isYouTubeLoopEnabled ? '循環中' : '循環'}</span>
            </button>

            {/* Sticky Play/Pause Toggle */}
            <button
              onClick={handleTopHeaderPlayToggle}
              title={
                youtubePlaybackState === 'playing'
                  ? '暫停 YouTube 影音播放'
                  : '播放 YouTube 影音（進入最佳閱讀畫面）'
              }
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
                youtubePlaybackState === 'playing'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 ring-2 ring-amber-400/40'
                  : youtubePlaybackState === 'buffering'
                  ? 'bg-rose-600/80 text-white shadow-rose-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/40'
              }`}
            >
              {youtubePlaybackState === 'buffering' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>連線中...</span>
                </>
              ) : youtubePlaybackState === 'playing' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
                  </span>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>暫停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  <span>播放</span>
                </>
              )}
            </button>

            {/* PWA Install Button (for browsers) */}
            {!isInstalled && !isAndroidWebView && (
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>安裝 App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main YouTube Bilingual Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-12 pb-[max(3rem,env(safe-area-inset-bottom))] space-y-6 flex-1">
        <YouTubeBilingualView
          onOpenDictionary={handleOpenDictionary}
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          effectiveTheme={effectiveTheme}
          chineseVariant={chineseVariant}
          onChineseVariantChange={setChineseVariant}
          fontSize={subtitleFontSize}
          onFontSizeChange={setSubtitleFontSize}
          highlightDifficulty={highlightDifficulty}
          onHighlightDifficultyChange={handleHighlightDifficultyChange}
          onPlaybackStateChange={setYoutubePlaybackState}
          isVideoLoopEnabled={isYouTubeLoopEnabled}
        />
      </main>

      {/* Free Local Dictionary Modal */}
      <DictionaryModal
        isOpen={isDictOpen}
        onClose={() => setIsDictOpen(false)}
        initialWord={dictWord}
      />

      {/* PWA Install Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white">安裝 Live Bilingo 到手機桌面</h3>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {deferredPrompt && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>系統已偵測到一鍵安裝支援！</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        setIsInstalled(true);
                      }
                      setDeferredPrompt(null);
                      setShowInstallModal(false);
                    } catch (e) {
                      console.error('Direct install prompt error:', e);
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  點此立即跳出 Chrome 原生安裝 App 視窗
                </button>
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2">
                <div className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                  <span>📱 安卓 Chrome 安裝步驟：</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                  <li>點選瀏覽器右上角 <span className="font-mono bg-slate-700 px-1.5 py-0.5 rounded text-white font-bold">⋮</span> 選單</li>
                  <li>尋找並點擊 <span className="font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">「安裝應用程式」</span> 或 <span className="font-bold text-emerald-400">「新增至主螢幕」</span></li>
                  <li>點擊 <span className="font-bold text-white">「新增」</span>，即可在手機桌面建立獨立 App 圖示！</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2">
                <div className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                  <span>🍎 iPhone / iPad (Safari) 安裝步驟：</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                  <li>請務必使用 <span className="font-bold text-white">Safari 瀏覽器</span> 開啟本頁</li>
                  <li>點擊 Safari 底部工具列的 <span className="font-bold text-sky-400">「分享 📤」</span> 按鈕</li>
                  <li>向上滑動選單，點擊 <span className="font-bold text-emerald-400">「加入主螢幕 ➕」</span> 即完成！</li>
                </ol>
              </div>

              <div className="space-y-1.5 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <span>🔗 複製獨立 App 網址在外部 Chrome/Safari 開啟</span>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="w-full mt-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  複製 App 專屬網址
                </button>
                {copyStatus && (
                  <div className="text-[11px] text-emerald-300 font-semibold text-center mt-1">
                    {copyStatus}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                關閉說明視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認退出應用程式？</h3>
                <p className="text-[11px] text-slate-400">Live Bilingo YouTube 雙語學習</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p className="text-slate-200 text-xs">
                確定要關閉並退出 <b>Live Bilingo</b> 嗎？
              </p>
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>儲存當前影片播放進度與書籤記錄</span>
                </div>
                <div className="flex items-center gap-2 text-rose-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>暫停影音並釋放本機記憶體資源</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleConfirmExit}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Power className="w-4 h-4" />
                <span>儲存進度並退出</span>
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Watermark Back-to-Reading-Mode Buttons */}
      <AnimatePresence>
        {(showBackToReadingFab || showScrollDownToReadingFab) && (
          <motion.button
            key={showBackToReadingFab ? 'back-to-reading-up' : 'back-to-reading-down'}
            initial={{ opacity: 0, scale: 0.6, y: showBackToReadingFab ? 20 : -20 }}
            animate={{ opacity: 0.92, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: showBackToReadingFab ? 20 : -20 }}
            whileHover={{ opacity: 1, scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 26 }}
            onClick={handleReturnToReadingMode}
            title={
              showBackToReadingFab
                ? '回到最佳閱讀畫面（影片置頂）'
                : '回到最佳閱讀畫面（影片置頂）'
            }
            aria-label="回到最佳閱讀畫面"
            id={showBackToReadingFab ? 'back-to-reading-mode-fab' : 'scroll-down-to-reading-fab'}
            className={`fixed right-5 sm:right-7 z-40 p-2.5 sm:p-3 rounded-2xl border backdrop-blur-md cursor-pointer flex flex-col items-center justify-center gap-0.5 select-none transition-colors duration-150 group shadow-2xl ring-2 ${
              showBackToReadingFab ? 'ring-rose-500/30' : 'ring-emerald-500/30'
            } ${
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
            {showBackToReadingFab ? (
              <>
                <motion.div
                  animate={{
                    y: [0, -3, 0],
                    opacity: [0.75, 1, 0.75],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="flex items-center justify-center"
                >
                  <ArrowUp className="w-5 h-5 text-rose-500 dark:text-rose-400 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </motion.div>
                <span className="text-[9px] sm:text-[10px] font-black tracking-tighter leading-none opacity-90 group-hover:opacity-100 whitespace-nowrap">
                  最佳閱讀畫面
                </span>
              </>
            ) : (
              <>
                <motion.div
                  animate={{
                    y: [0, 3, 0],
                    opacity: [0.75, 1, 0.75],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="flex items-center justify-center"
                >
                  <ArrowDown className="w-5 h-5 text-emerald-500 dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform duration-200" />
                </motion.div>
                <span className="text-[9px] sm:text-[10px] font-black tracking-tighter leading-none opacity-90 group-hover:opacity-100 whitespace-nowrap">
                  最佳閱讀畫面
                </span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Git Update Toast Notification */}
      {gitUpdateToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/95 border border-rose-500/50 text-rose-300 font-medium text-xs rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>最新版本已同步更新！</span>
        </div>
      )}

      {/* Option C Monetization Modals: Rewarded & Interstitial Ads */}
      <RewardedAdModal />
      <InterstitialAdModal />
    </div>
  );
}
