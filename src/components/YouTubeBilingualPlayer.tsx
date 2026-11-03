import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';
import { Play, Pause, RotateCcw, Volume2, AlertCircle, Youtube, Maximize2, Minimize2 } from 'lucide-react';

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface Props {
  videoId: string;
  onTimeUpdate?: (currentTimeSeconds: number) => void;
  onDurationChange?: (durationSeconds: number) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'buffering' | 'ended') => void;
  onError?: (errorCode: string) => void;
  initialTimeSeconds?: number;
  hideActionControls?: boolean;
  isLoopEnabled?: boolean;
  isLive?: boolean;
  autoPlay?: boolean;
  onLoopReplay?: () => void;
  // 全螢幕（橫向）：按鈕進入或播放頁手機打橫自動進入，字幕疊在畫面下方
  fullscreenEnabled?: boolean;
  isActive?: boolean;
  overlaySubtitle?: { english: string; chinese: string } | null;
  overlayFontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  onFullscreenChange?: (isFullscreen: boolean) => void;
  ref?: React.Ref<YouTubePlayerRef>;
}

type FullscreenMode = 'rotate' | 'button' | null;

const OVERLAY_FONT_SCALE = { small: 0.85, medium: 1, large: 1.15, xlarge: 1.3 } as const;

const getAndroidBridge = (): any => (typeof window !== 'undefined' ? (window as any).AndroidBridge : undefined);

// 畫面上已有 Bilingo 雙語字幕，關掉 YouTube 自帶字幕（含影片作者預設開啟的情況）
const disableYouTubeCaptions = (player: any) => {
  try {
    if (typeof player?.unloadModule !== 'function') return;
    player.unloadModule('captions');
    player.unloadModule('cc');
  } catch (_) {}
};

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubeBilingualPlayer: React.FC<Props> = ({
  videoId,
  onTimeUpdate,
  onDurationChange,
  onStateChange,
  onError,
  initialTimeSeconds = 0,
  hideActionControls = false,
  isLoopEnabled = false,
  isLive = false,
  autoPlay = false,
  onLoopReplay,
  fullscreenEnabled = false,
  isActive = true,
  overlaySubtitle = null,
  overlayFontSize = 'medium',
  onFullscreenChange,
  ref,
}) => {
  const containerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`).current;
  const playerRef = useRef<any>(null);
  const timePollIntervalRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const prevVideoIdRef = useRef(videoId);
  const currentTimeRef = useRef(initialTimeSeconds || 0);
  const [currentTime, setCurrentTime] = useState(initialTimeSeconds || 0);

  // Synchronously reset currentTimeRef when videoId prop changes
  if (prevVideoIdRef.current !== videoId) {
    prevVideoIdRef.current = videoId;
    currentTimeRef.current = initialTimeSeconds || 0;
  }

  const [duration, setDuration] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const hasAppliedInitialTimeRef = useRef(false);
  const bufferingTimeoutRef = useRef<any>(null);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  // Keep a stable ref for isLoopEnabled
  const isLoopEnabledRef = useRef(isLoopEnabled);
  isLoopEnabledRef.current = isLoopEnabled;

  const onLoopReplayRef = useRef(onLoopReplay);
  onLoopReplayRef.current = onLoopReplay;

  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  // 自動播放請求鎖存：字幕可能比播放器先就緒，上層會提早把 autoPlay 關掉；
  // 在 YouTube 真正回報「播放中」之前保留這個請求，播放器就緒時照樣自動開播。
  const autoPlayLatchRef = useRef(autoPlay);
  if (autoPlay) autoPlayLatchRef.current = true;
  const autoPlayRetryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Stable callback refs to prevent effect re-triggering and render-phase update cascades
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const onDurationChangeRef = useRef(onDurationChange);
  onDurationChangeRef.current = onDurationChange;

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>(null);
  const fullscreenModeRef = useRef<FullscreenMode>(null);
  fullscreenModeRef.current = fullscreenMode;
  const isFullscreen = fullscreenMode !== null;
  const [showFsControls, setShowFsControls] = useState(false);
  const fsControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFullscreenChangeRef = useRef(onFullscreenChange);
  onFullscreenChangeRef.current = onFullscreenChange;
  const isRotationAllowed = fullscreenEnabled && isActive && !!videoId;
  const isRotationAllowedRef = useRef(isRotationAllowed);
  isRotationAllowedRef.current = isRotationAllowed;

  // Expose imperative player controls for seeking from subtitle clicks
  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        if (playerRef.current) {
          const state = typeof playerRef.current.getPlayerState === 'function'
            ? playerRef.current.getPlayerState()
            : -1;
          if (state === -1 || state === 5) {
            if (typeof playerRef.current.loadVideoById === 'function') {
              // Always start from 0:00 unless a specific initial time was intentionally requested
              const startAt = initialTimeSeconds > 0 ? initialTimeSeconds : 0;
              playerRef.current.loadVideoById({
                videoId,
                startSeconds: startAt,
              });
              currentTimeRef.current = startAt;
              setCurrentTime(startAt);
            } else {
              playerRef.current.playVideo();
            }
          } else {
            playerRef.current.playVideo();
          }
          setIsPlaying(true);
          onStateChangeRef.current?.('playing');
        }
      } catch (e) {
        console.warn('[YouTubePlayer] play error:', e);
      }
    },
    pause: () => {
      try {
        autoPlayLatchRef.current = false;
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
        onStateChangeRef.current?.('paused');
      } catch (e) {
        console.warn('[YouTubePlayer] pause error:', e);
      }
    },
    seekTo: (seconds: number) => {
      try {
        if (playerRef.current) {
          const state = typeof playerRef.current.getPlayerState === 'function'
            ? playerRef.current.getPlayerState()
            : -1;

          // If the player is unstarted (-1) or cued (5), calling seekTo alone can be ignored by YouTube iframe.
          // We use loadVideoById to reliably initialize and start playback directly at target seconds.
          if (state === -1 || state === 5) {
            if (typeof playerRef.current.loadVideoById === 'function') {
              playerRef.current.loadVideoById({
                videoId,
                startSeconds: seconds,
              });
            } else {
              playerRef.current.seekTo(seconds, true);
              playerRef.current.playVideo();
            }
          } else {
            // Already active / playing / paused / buffering / ended
            playerRef.current.seekTo(seconds, true);
            if (state === 2 || state === 0) {
              // If paused or ended, start playback
              playerRef.current.playVideo();
            }
          }
          setCurrentTime(seconds);
          onTimeUpdateRef.current?.(seconds);
        }
      } catch (e) {
        console.warn('[YouTubePlayer] seekTo error:', e);
      }
    },
    getCurrentTime: () => {
      try {
        return playerRef.current?.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    },
    getDuration: () => {
      try {
        return playerRef.current?.getDuration() || 0;
      } catch {
        return 0;
      }
    },
  }), [videoId]);

  // Polling helper for current time during playback (~250ms cadence)
  const startTimePolling = () => {
    stopTimePolling();
    timePollIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number' && !isNaN(time)) {
          setCurrentTime(time);
          onTimeUpdateRef.current?.(time);
        }
      }
    }, 250);
  };

  const stopTimePolling = () => {
    if (timePollIntervalRef.current) {
      clearInterval(timePollIntervalRef.current);
      timePollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    setPlayerError(null);
    setIsReady(false);
    setIsPlaying(false);
    hasAppliedInitialTimeRef.current = false;
    setCurrentTime(initialTimeSeconds || 0);
    onStateChangeRef.current?.('paused');

    if (!videoId) {
      return;
    }

    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted) return;
      if (!window.YT || !window.YT.Player) return;

      // Clean up previous instance if exists
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch (_) {}

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: autoPlayRef.current ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            // 畫面下方已有 Bilingo 雙語字幕，不顯示 YouTube 自帶字幕
            cc_load_policy: 0,
            hl: 'en',
            start: initialTimeSeconds > 0 ? Math.floor(initialTimeSeconds) : 0,
            origin:
              typeof window !== 'undefined' &&
              window.location.origin &&
              window.location.origin !== 'null' &&
              window.location.protocol !== 'file:'
                ? window.location.origin
                : 'https://www.youtube.com',
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsReady(true);
              disableYouTubeCaptions(event.target);
              const dur = event.target.getDuration();
              if (dur > 0) {
                setDuration(dur);
                onDurationChangeRef.current?.(dur);
              }
              if (autoPlayRef.current || autoPlayLatchRef.current) {
                // 播放可能被延遲擋下，短時間內再補送幾次，直到 YouTube 回報播放中
                autoPlayRetryTimersRef.current.forEach(clearTimeout);
                autoPlayRetryTimersRef.current = [800, 2000, 4000].map((ms) =>
                  setTimeout(() => {
                    if (!isMounted || !autoPlayLatchRef.current) return;
                    try {
                      const st = event.target.getPlayerState?.();
                      if (st !== 1 && st !== 3) event.target.playVideo();
                    } catch (_) {}
                  }, ms)
                );
                if (initialTimeSeconds > 0) {
                  event.target.seekTo(initialTimeSeconds, true);
                  currentTimeRef.current = initialTimeSeconds;
                  setCurrentTime(initialTimeSeconds);
                  hasAppliedInitialTimeRef.current = true;
                } else {
                  event.target.seekTo(0, true);
                  currentTimeRef.current = 0;
                  setCurrentTime(0);
                }
                event.target.playVideo();
                setIsPlaying(true);
                startTimePolling();
                onStateChangeRef.current?.('playing');
              } else if (initialTimeSeconds > 0) {
                // Seek to initial position quietly without triggering autoplay
                event.target.seekTo(initialTimeSeconds, false);
                event.target.pauseVideo();
                currentTimeRef.current = initialTimeSeconds;
                setCurrentTime(initialTimeSeconds);
                hasAppliedInitialTimeRef.current = true;
                onStateChangeRef.current?.('paused');
              } else {
                event.target.seekTo(0, false);
                event.target.pauseVideo();
                currentTimeRef.current = 0;
                setCurrentTime(0);
                onStateChangeRef.current?.('paused');
              }
            },
            // YouTube 載入字幕模組時會觸發 onApiChange，在這裡關掉才不會被重新顯示
            onApiChange: (event: any) => {
              if (!isMounted) return;
              disableYouTubeCaptions(event.target);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
              const stateCode = event.data;
              if (stateCode === 1) {
                // 字幕模組常在開始播放後才載入，播放時再關一次
                disableYouTubeCaptions(event.target);
                autoPlayLatchRef.current = false;
                if (bufferingTimeoutRef.current) {
                  clearTimeout(bufferingTimeoutRef.current);
                  bufferingTimeoutRef.current = null;
                }
                // Guard: If starting from beginning, verify YouTube didn't resume mid-stream from user watch history
                if (!hasAppliedInitialTimeRef.current && (!initialTimeSeconds || initialTimeSeconds === 0)) {
                  hasAppliedInitialTimeRef.current = true;
                  try {
                    const currentPos = event.target.getCurrentTime();
                    if (typeof currentPos === 'number' && currentPos > 1.5) {
                      event.target.seekTo(0, true);
                      currentTimeRef.current = 0;
                      setCurrentTime(0);
                      onTimeUpdateRef.current?.(0);
                    }
                  } catch (_) {}
                }
                setIsPlaying(true);
                startTimePolling();
                onStateChangeRef.current?.('playing');
              } else if (stateCode === 2) {
                if (bufferingTimeoutRef.current) {
                  clearTimeout(bufferingTimeoutRef.current);
                  bufferingTimeoutRef.current = null;
                }
                setIsPlaying(false);
                stopTimePolling();
                onStateChangeRef.current?.('paused');
                const t = event.target.getCurrentTime();
                setCurrentTime(t);
                onTimeUpdateRef.current?.(t);
              } else if (stateCode === 3) {
                onStateChangeRef.current?.('buffering');
                // Guard against indefinite spinning on mobile / slow connections
                if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                bufferingTimeoutRef.current = setTimeout(() => {
                  if (isMounted && !isPlayingRef.current) {
                    onStateChangeRef.current?.('paused');
                  }
                }, 2000);
              } else if (stateCode === 5 || stateCode === -1) {
                if (bufferingTimeoutRef.current) {
                  clearTimeout(bufferingTimeoutRef.current);
                  bufferingTimeoutRef.current = null;
                }
                setIsPlaying(false);
                stopTimePolling();
                onStateChangeRef.current?.('paused');
              } else if (stateCode === 0) {
                if (isLoopEnabledRef.current) {
                  try {
                    // Loop whole video! Seek to start and play immediately
                    event.target.seekTo(0, true);
                    event.target.playVideo();
                    setCurrentTime(0);
                    onTimeUpdateRef.current?.(0);
                    setIsPlaying(true);
                    startTimePolling();
                    onStateChangeRef.current?.('playing');
                    onLoopReplayRef.current?.();
                    return;
                  } catch (e) {
                    console.warn('[YouTubePlayer] Loop rewind error:', e);
                  }
                }
                setIsPlaying(false);
                stopTimePolling();
                onStateChangeRef.current?.('ended');
              }
            },
            onError: (event: any) => {
              if (!isMounted) return;
              const errCode = String(event.data);
              console.warn(`[YouTubePlayer] Error event code: ${errCode}`);
              let userMsg = 'YouTube 播放器發生問題';
              if (errCode === '101' || errCode === '150') {
                userMsg = '此影片擁有者禁止在站外播放嵌入影片 (Embedding disabled)';
              } else if (errCode === '100') {
                userMsg = '影片不存在或設為私人 (Video not found / private)';
              } else if (errCode === '2') {
                userMsg = '無效的 YouTube 參數 (Invalid parameters)';
              }
              setPlayerError(userMsg);
              onErrorRef.current?.(userMsg);
            },
          },
        });
      } catch (err: any) {
        console.error('[YouTubePlayer] Error creating YT.Player:', err);
        setPlayerError('無法初始化 YouTube 播放器');
      }
    };

    // Load IFrame API script if not already present
    if (typeof window !== 'undefined' && !window.YT) {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      isMounted = false;
      stopTimePolling();
      autoPlayRetryTimersRef.current.forEach(clearTimeout);
      autoPlayRetryTimersRef.current = [];
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch (_) {}
    };
  }, [videoId]);

  // Ensure initialTimeSeconds is applied even if ready callback fired before initialTime was set
  useEffect(() => {
    if (isReady && initialTimeSeconds > 0 && !hasAppliedInitialTimeRef.current) {
      hasAppliedInitialTimeRef.current = true;
      try {
        playerRef.current?.seekTo(initialTimeSeconds, false);
        playerRef.current?.pauseVideo();
        setCurrentTime(initialTimeSeconds);
      } catch (e) {
        console.warn('[YouTubePlayer] Error applying initial time:', e);
      }
    }
  }, [isReady, initialTimeSeconds]);

  // Whenever autoPlay prop becomes true while player is ready, automatically trigger playback
  useEffect(() => {
    if (autoPlay && isReady && playerRef.current) {
      try {
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
          setIsPlaying(true);
          startTimePolling();
          onStateChangeRef.current?.('playing');
        }
      } catch (err) {
        console.warn('[YouTubePlayer] autoPlay playVideo error:', err);
      }
    }
  }, [autoPlay, isReady]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const enterFullscreen = (mode: Exclude<FullscreenMode, null>) => {
    if (fullscreenModeRef.current) return;
    fullscreenModeRef.current = mode;
    setFullscreenMode(mode);
    setShowFsControls(false);
    onFullscreenChangeRef.current?.(true);
    try {
      getAndroidBridge()?.setVideoFullscreen?.(true, mode === 'button');
    } catch (_) {}
  };

  const exitFullscreen = () => {
    if (!fullscreenModeRef.current) return;
    fullscreenModeRef.current = null;
    setFullscreenMode(null);
    setShowFsControls(false);
    onFullscreenChangeRef.current?.(false);
    try {
      getAndroidBridge()?.setVideoFullscreen?.(false, false);
    } catch (_) {}
  };

  const exitFullscreenRef = useRef(exitFullscreen);
  exitFullscreenRef.current = exitFullscreen;

  // 播放頁顯示且有影片時，允許手機隨旋轉；離開或隱藏時恢復直向並退出全螢幕
  // （未啟用全螢幕的播放器，例如直播頁，不碰原生旋轉設定）
  useEffect(() => {
    if (!fullscreenEnabled) return;
    try {
      getAndroidBridge()?.setVideoRotationAllowed?.(isRotationAllowed);
    } catch (_) {}
    if (!isRotationAllowed) exitFullscreenRef.current();
    return () => {
      try {
        const bridge = getAndroidBridge();
        if (fullscreenModeRef.current) bridge?.setVideoFullscreen?.(false, false);
        bridge?.setVideoRotationAllowed?.(false);
      } catch (_) {}
    };
  }, [isRotationAllowed, fullscreenEnabled]);

  // 手機打橫自動進入全螢幕；由打橫進入的，轉回直向時自動離開。
  // 只在旋轉「發生時」判斷，避免手動離開後因仍是橫向而立刻又進入。
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(orientation: landscape)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!getAndroidBridge()) return;
      if (e.matches) {
        if (isRotationAllowedRef.current && !fullscreenModeRef.current) enterFullscreen('rotate');
      } else if (fullscreenModeRef.current === 'rotate') {
        exitFullscreenRef.current();
      }
    };
    mql.addEventListener?.('change', handleChange);
    return () => mql.removeEventListener?.('change', handleChange);
  }, []);

  // 原生返回鍵透過這個函式離開全螢幕
  useEffect(() => {
    if (!isFullscreen) return;
    const w = window as any;
    w.__bilingoExitFullscreen = () => exitFullscreenRef.current();
    return () => {
      if (w.__bilingoExitFullscreen) delete w.__bilingoExitFullscreen;
    };
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (fsControlsTimerRef.current) clearTimeout(fsControlsTimerRef.current);
    };
  }, []);

  const revealFsControls = () => {
    setShowFsControls(true);
    if (fsControlsTimerRef.current) clearTimeout(fsControlsTimerRef.current);
    fsControlsTimerRef.current = setTimeout(() => setShowFsControls(false), 3000);
  };

  const handleVideoTap = () => {
    if (!isFullscreen) {
      togglePlayPause();
      return;
    }
    if (showFsControls) {
      if (fsControlsTimerRef.current) clearTimeout(fsControlsTimerRef.current);
      setShowFsControls(false);
    } else {
      revealFsControls();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSeconds = parseFloat(e.target.value);
    setCurrentTime(targetSeconds);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(targetSeconds, true);
      onTimeUpdateRef.current?.(targetSeconds);
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const mins = Math.floor(s / 60);
    const remainderSecs = s % 60;
    return `${mins}:${remainderSecs < 10 ? '0' : ''}${remainderSecs}`;
  };

  if (!videoId) {
    return (
      <div className="w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-xl aspect-video flex flex-col items-center justify-center p-6 text-center space-y-2">
        <Youtube className="w-12 h-12 text-slate-700" />
        <p className="text-sm font-medium text-slate-300">尚未載入影片</p>
        <p className="text-xs text-slate-500 max-w-xs">
          網址已預填測試影片，點擊上方「載入雙語字幕」或「載入字幕測試影片」即可開始
        </p>
      </div>
    );
  }

  const overlayScale = OVERLAY_FONT_SCALE[overlayFontSize] ?? 1;
  const hasOverlayText = !!(overlaySubtitle && (overlaySubtitle.english || overlaySubtitle.chinese));
  const isPausedInFullscreen = isFullscreen && !isLive && !isPlaying && !playerError;

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[10000] bg-black'
          : 'w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-xl'
      }
    >
      {/* 16:9 Video Container（全螢幕時填滿整個畫面） */}
      <div
        className={`relative w-full bg-black flex items-center justify-center overflow-hidden group [&_iframe]:w-full [&_iframe]:h-full ${
          isFullscreen ? 'h-full' : 'aspect-video'
        }`}
      >
        <div id={containerId} className="w-full h-full pointer-events-none" />

        {/* Clean transparent overlay: allows user tap to play/pause without native YouTube buttons popping up */}
        <div
          onClick={handleVideoTap}
          className="absolute inset-0 cursor-pointer z-5"
          title={isFullscreen ? '點擊顯示控制鍵' : isPlaying ? '點擊暫停影片' : '點擊播放影片'}
        />

        {/* 全螢幕暫停時遮住 YouTube 自帶的暫停介面（標題、分享、推薦影片） */}
        {isPausedInFullscreen && (
          <div className="absolute inset-0 z-[6] bg-black/85 pointer-events-none" />
        )}

        {/* 全螢幕：雙語字幕疊在畫面下方 */}
        {isFullscreen && hasOverlayText && (
          <div className="absolute inset-x-0 bottom-0 z-[6] flex justify-center px-[6%] pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
            <div className="max-w-full rounded-xl bg-black/60 px-4 py-1.5 text-center [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
              {overlaySubtitle!.english && (
                <p
                  className="font-semibold leading-snug text-white"
                  style={{ fontSize: `calc(clamp(15px, 4.6vh, 30px) * ${overlayScale})` }}
                >
                  {overlaySubtitle!.english}
                </p>
              )}
              {overlaySubtitle!.chinese && (
                <p
                  className="font-medium leading-snug text-amber-200"
                  style={{ fontSize: `calc(clamp(14px, 4.3vh, 28px) * ${overlayScale})` }}
                >
                  {overlaySubtitle!.chinese}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 全螢幕：點畫面後顯示的控制鍵，3 秒後自動隱藏；暫停時一直顯示 */}
        {isFullscreen && (showFsControls || isPausedInFullscreen) && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                exitFullscreen();
              }}
              className="absolute z-[7] top-[max(0.75rem,env(safe-area-inset-top))] right-[max(1.25rem,env(safe-area-inset-right))] w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
              title="離開全螢幕"
              aria-label="離開全螢幕"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            {!isLive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                  revealFsControls();
                }}
                className="absolute z-[7] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95"
                title={isPlaying ? '暫停' : '播放'}
                aria-label={isPlaying ? '暫停' : '播放'}
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
            )}
          </>
        )}

        {/* 直播沒有控制列，全螢幕鍵放在畫面右下角 */}
        {fullscreenEnabled && isLive && !isFullscreen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              enterFullscreen('button');
            }}
            className="absolute z-[7] bottom-2 right-2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer active:scale-95"
            title="全螢幕"
            aria-label="全螢幕"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {playerError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-rose-400">{playerError}</p>
            <p className="text-xs text-slate-400 mt-1">請嘗試選擇其他影片或檢查網址</p>
          </div>
        )}
      </div>

      {/* Embedded Player Control Bar (Hidden completely in live streaming mode) */}
      {!isLive && !isFullscreen && (
        <div className={`px-4 ${hideActionControls ? 'py-2' : 'py-3'} bg-slate-900 border-t border-slate-800/80 flex flex-col gap-2`}>
          {/* Progress seek slider */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={!isReady || duration <= 0}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
            />
            <span className="text-[11px] font-mono text-slate-400 w-10 text-left shrink-0">
              {formatTime(duration)}
            </span>
            {fullscreenEnabled && (
              <button
                type="button"
                onClick={() => enterFullscreen('button')}
                disabled={!isReady}
                className="shrink-0 p-1 -mr-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                title="全螢幕"
                aria-label="全螢幕"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Controls (Hidden in reading mode to maximize subtitle area) */}
          {!hideActionControls && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  disabled={!isReady}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>暫停</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>播放</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (playerRef.current) {
                      const newTime = Math.max(0, currentTime - 5);
                      playerRef.current.seekTo(newTime, true);
                      setCurrentTime(newTime);
                      onTimeUpdateRef.current?.(newTime);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  title="後退 5 秒"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>-5s</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">雙語學習同步模式</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
