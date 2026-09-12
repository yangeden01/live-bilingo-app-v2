import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, AlertCircle, Youtube } from 'lucide-react';

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
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubeBilingualPlayer = forwardRef<YouTubePlayerRef, Props>(({
  videoId,
  onTimeUpdate,
  onDurationChange,
  onStateChange,
  onError,
  initialTimeSeconds = 0,
  hideActionControls = false,
}, ref) => {
  const containerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 9)}`).current;
  const playerRef = useRef<any>(null);
  const timePollIntervalRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTimeSeconds || 0);
  const [duration, setDuration] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const hasAppliedInitialTimeRef = useRef(false);

  // Expose imperative player controls for seeking from subtitle clicks
  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        playerRef.current?.playVideo();
      } catch (e) {
        console.warn('[YouTubePlayer] play error:', e);
      }
    },
    pause: () => {
      try {
        playerRef.current?.pauseVideo();
      } catch (e) {
        console.warn('[YouTubePlayer] pause error:', e);
      }
    },
    seekTo: (seconds: number) => {
      try {
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(seconds, true);
          setCurrentTime(seconds);
          onTimeUpdate?.(seconds);
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
  }));

  // Polling helper for current time during playback (~250ms cadence)
  const startTimePolling = () => {
    stopTimePolling();
    timePollIntervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number' && !isNaN(time)) {
          setCurrentTime(time);
          onTimeUpdate?.(time);
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
    onTimeUpdate?.(initialTimeSeconds || 0);

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
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsReady(true);
              const dur = event.target.getDuration();
              if (dur > 0) {
                setDuration(dur);
                onDurationChange?.(dur);
              }
              if (initialTimeSeconds > 0) {
                event.target.seekTo(initialTimeSeconds, true);
                setCurrentTime(initialTimeSeconds);
                onTimeUpdate?.(initialTimeSeconds);
                hasAppliedInitialTimeRef.current = true;
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
              const stateCode = event.data;
              if (stateCode === 1) {
                setIsPlaying(true);
                startTimePolling();
                onStateChange?.('playing');
              } else if (stateCode === 2) {
                setIsPlaying(false);
                stopTimePolling();
                onStateChange?.('paused');
                const t = event.target.getCurrentTime();
                setCurrentTime(t);
                onTimeUpdate?.(t);
              } else if (stateCode === 3) {
                onStateChange?.('buffering');
              } else if (stateCode === 0) {
                setIsPlaying(false);
                stopTimePolling();
                onStateChange?.('ended');
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
              onError?.(userMsg);
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
        playerRef.current?.seekTo(initialTimeSeconds, true);
        setCurrentTime(initialTimeSeconds);
        onTimeUpdate?.(initialTimeSeconds);
      } catch (e) {
        console.warn('[YouTubePlayer] Error applying initial time:', e);
      }
    }
  }, [isReady, initialTimeSeconds, onTimeUpdate]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSeconds = parseFloat(e.target.value);
    setCurrentTime(targetSeconds);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(targetSeconds, true);
      onTimeUpdate?.(targetSeconds);
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

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
      {/* 16:9 Video Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full" />

        {playerError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-rose-400">{playerError}</p>
            <p className="text-xs text-slate-400 mt-1">請嘗試選擇其他影片或檢查網址</p>
          </div>
        )}
      </div>

      {/* Embedded Player Control Bar */}
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
                    onTimeUpdate?.(newTime);
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
    </div>
  );
});
