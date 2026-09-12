import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { playBeanWallImpactSound } from '../utils/sound';
import { PlaybackStatus, RadioStation, SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { Radio, Signal, Sparkles, SlidersHorizontal, MapPin, RefreshCw } from 'lucide-react';
import { MarqueeText } from './MarqueeText';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';
import { useSubtitleSync } from '../hooks/useSubtitleSync';
import { useRadioAudio } from '../hooks/useRadioAudio';
import { ReadingModeAndFontToolbar } from './ReadingModeAndFontToolbar';

interface Props {
  playbackStatus: PlaybackStatus;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  onNewSubtitle: (item: SubtitleItem) => void;
  onInterimSubtitle?: (item: SubtitleItem | null) => void;
  sttConnected: boolean;
  setSttConnected: (connected: boolean) => void;
  activeStation: RadioStation;
  onOpenStationManager: () => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize?: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
}

export const AudioPlayerController: React.FC<Props> = ({
  playbackStatus,
  setPlaybackStatus,
  onNewSubtitle,
  onInterimSubtitle,
  sttConnected,
  setSttConnected,
  activeStation,
  onOpenStationManager,
  readingMode = 'system',
  onReadingModeChange,
  effectiveTheme,
  chineseVariant = 'traditional',
  onChineseVariantChange,
  fontSize = 'small',
  onFontSizeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const CLIENT_VERSION = '1.6.0';

  // Canvas visualizer waveform
  const setupAudioVisualizer = useCallback(() => {
    if (!canvasRef.current) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barCount = 32;
    let step = 0;

    const render = () => {
      if (document.hidden) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / barCount) * 0.8;
      let x = 0;
      step += 0.15;

      for (let i = 0; i < barCount; i++) {
        const heightMultiplier = Math.abs(Math.sin(step + i * 0.35) * Math.cos(step * 0.8 + i * 0.2));
        const barHeight = Math.max(3, heightMultiplier * canvas.height * 0.85);

        ctx.fillStyle = playbackStatus === 'PLAYING' ? '#3B82F6' : '#94A3B8';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth + 2;
      }

      if (playbackStatus === 'PLAYING') {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();
  }, [playbackStatus]);

  // Audio streaming & playback lifecycle
  const {
    audioRef,
    togglePlayPause,
    handleAutoReconnect,
    getProxiedStreamUrl,
  } = useRadioAudio({
    activeStation,
    playbackStatus,
    setPlaybackStatus,
    onClearSubtitleQueue: () => {
      clearQueue();
    },
    onStartVisualizer: setupAudioVisualizer,
  });

  // Hook 3: Subtitle synchronization (SSE + Polling + Bridge + DecoupledTimeAligner)
  const { clearQueue } = useSubtitleSync({
    playbackStatus,
    activeStation,
    onNewSubtitle,
    onInterimSubtitle,
    setSttConnected,
    audioRef,
  });

  // Check version & ServiceWorker updates
  useEffect(() => {
    const checkVersion = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const res = await safeApiFetch<{ version: string; buildTime?: string | number }>(
        '/api/version?t=' + Date.now()
      );

      if (res.ok && res.data && res.data.version) {
        const data = res.data;
        const storedBuildTime = localStorage.getItem('installed_build_time');
        const storedVersion = localStorage.getItem('installed_version');

        if (!storedBuildTime || !storedVersion) {
          localStorage.setItem('installed_build_time', String(data.buildTime || '1770500000000'));
          localStorage.setItem('installed_version', data.version);
          setHasNewUpdate(false);
        } else {
          if (data.version !== storedVersion || (data.buildTime && String(data.buildTime) !== storedBuildTime)) {
            setHasNewUpdate(true);
          } else {
            setHasNewUpdate(false);
          }
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && (reg.waiting || reg.installing)) {
            const storedVersion = localStorage.getItem('installed_version');
            if (storedVersion !== CLIENT_VERSION) {
              setHasNewUpdate(true);
            }
          }
        } catch (e) {}
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateProgress(10);
    setRefreshNotice('正在準備更新...');

    try {
      await new Promise((r) => setTimeout(r, 200));
      setUpdateProgress(35);
      setRefreshNotice('正在清理舊版快取與服務 Worker...');

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active) {
            reg.active.postMessage({ type: 'PURGE_CACHE' });
          }
          await reg.unregister();
        }
      }

      setUpdateProgress(60);
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }

      setUpdateProgress(85);
      setRefreshNotice('正在下載最新版本...');
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(getApiUrl('/api/version?t=' + Date.now())).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          localStorage.setItem('installed_build_time', String(data.buildTime || '1770500000000'));
          localStorage.setItem('installed_version', data.version || CLIENT_VERSION);
        }
      } else {
        localStorage.setItem('installed_version', CLIENT_VERSION);
      }

      setUpdateProgress(100);
      setRefreshNotice('更新完成！正在重新載入...');
      await new Promise((r) => setTimeout(r, 300));

      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    } catch (e) {
      console.error('Apply update error:', e);
      window.location.reload();
    }
  };

  const handleHiddenRefresh = async () => {
    setIsSpinning(true);

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    setRefreshNotice('正在重新載入最新版...');

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active) {
            reg.active.postMessage({ type: 'PURGE_CACHE' });
          }
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.error('Refresh cache clear error:', e);
    }

    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 400);
  };

  // App Visibility & Lifecycle
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      } else {
        if (playbackStatus === 'PLAYING') {
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
          setupAudioVisualizer();

          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch((err) => {
              if (err?.name === 'AbortError' || err?.message?.includes('interrupted by a new load request')) {
                return;
              }
              console.warn('[Foreground] Auto-resume blocked:', err);
              setPlaybackStatus('PAUSED');
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, [playbackStatus, setPlaybackStatus, setupAudioVisualizer, audioRef]);

  const currentTheme = effectiveTheme || (readingMode === 'paper' ? 'paper' : readingMode === 'light' ? 'light' : 'dark');

  const cardBgClass =
    currentTheme === 'paper'
      ? 'bg-[#FAF4E8] text-[#3B2E1E] border-[#E2D2B0] shadow-xl shadow-amber-900/5'
      : currentTheme === 'light'
      ? 'bg-white/95 text-slate-900 border-slate-200 shadow-xl shadow-slate-200/60'
      : 'bg-slate-900/90 text-white border-slate-800/80 shadow-xl';

  const ambientGlowClass =
    currentTheme === 'paper'
      ? 'from-amber-100/40 via-orange-100/30 to-amber-200/30'
      : currentTheme === 'light'
      ? 'from-blue-50/60 via-indigo-50/40 to-slate-100/60'
      : 'from-blue-900/10 via-indigo-900/10 to-purple-900/10';

  const stationTitleClass =
    currentTheme === 'paper'
      ? 'text-[#3B2E1E]'
      : currentTheme === 'light'
      ? 'text-slate-900'
      : 'text-white';

  const subtextClass =
    currentTheme === 'paper'
      ? 'text-[#6E5B42]'
      : currentTheme === 'light'
      ? 'text-slate-600'
      : 'text-slate-300';

  const subtextMutedClass =
    currentTheme === 'paper'
      ? 'text-[#8C765C]'
      : currentTheme === 'light'
      ? 'text-slate-500'
      : 'text-slate-400';

  const radioBtnClass =
    playbackStatus === 'PLAYING'
      ? 'bg-gradient-to-br from-rose-500/20 via-red-500/15 to-amber-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/40 shadow-rose-500/10'
      : currentTheme === 'paper'
      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-900 border border-amber-600/30 shadow-sm'
      : currentTheme === 'light'
      ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 shadow-sm'
      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-sm';

  const stationSwitchBtnClass =
    currentTheme === 'paper'
      ? 'bg-gradient-to-r from-[#EFE6D0] to-[#E5D7BE] hover:from-[#E5D7BE] hover:to-[#D8C49E] text-[#3B2E1E] border-[#CBB387] shadow-sm'
      : currentTheme === 'light'
      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 border-blue-200 shadow-sm'
      : 'bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-indigo-950/80 hover:from-blue-900/90 hover:to-indigo-900/90 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-950/50';

  return (
    <div className={`backdrop-blur-md rounded-2xl p-4 sm:p-5 border relative z-10 flex flex-col gap-3 transition-colors duration-200 ${cardBgClass}`}>
      {/* Background Ambient Glow */}
      <div className={`absolute inset-0 bg-gradient-to-r pointer-events-none rounded-2xl overflow-hidden transition-colors duration-200 ${ambientGlowClass}`} />

      <audio
        ref={audioRef}
        src={getProxiedStreamUrl(activeStation.streamUrl)}
        preload="auto"
        onWaiting={() => setPlaybackStatus('BUFFERING')}
        onPlaying={() => {
          setPlaybackStatus('PLAYING');
          setupAudioVisualizer();
        }}
        onEnded={() => {
          console.warn('[Audio Tag] Live stream ended unexpectedly.');
          if (playbackStatus === 'PLAYING') {
            handleAutoReconnect();
          }
        }}
        onPause={() => {}}
        onStalled={() => {
          console.log('[Audio Tag] Network delay (stalled). Waiting for buffer...');
        }}
        onError={() => {
          handleAutoReconnect();
        }}
      />

      {playbackStatus === 'ERROR' && (
        <div className="relative z-10 flex items-center justify-between p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-xs text-rose-200 animate-fadeIn">
          <span>串流連線失敗，請重試或切換電台。</span>
          <button
            onClick={togglePlayPause}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shrink-0 transition-colors"
          >
            重試連線
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3">
        {refreshNotice && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-900/50 border border-emerald-400/30 whitespace-nowrap pointer-events-none animate-fadeIn">
            <RefreshCw className="w-3 h-3 animate-spin text-white shrink-0" />
            <span>{refreshNotice}</span>
          </div>
        )}

        {/* Top Row: Radio Station Identity + Top-Right Radio Station Switcher */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={hasNewUpdate ? handleApplyUpdate : handleHiddenRefresh}
                title={hasNewUpdate ? '發現新版本！點擊此處內容更新' : (playbackStatus === 'PLAYING' ? 'LIVE 廣播即時連線中 (點擊重載)' : '廣播電台 (點擊重載)')}
                className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer group shadow-sm mt-0.5 select-none ${radioBtnClass}`}
              >
                {/* Standard Blue ((o)) Radio wave broadcast icon with LIVE badge */}
                <Radio className={`w-5 h-5 text-blue-400 transition-transform ${playbackStatus === 'PLAYING' ? 'animate-pulse' : ''} ${isSpinning ? 'rotate-[360deg] text-emerald-400' : 'group-hover:scale-110'}`} />
                <span className="text-[8px] font-black tracking-wider leading-none mt-1 uppercase text-blue-400">
                  LIVE
                </span>
                {hasNewUpdate && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-amber-300 ring-2 ring-amber-200 animate-ping" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                {/* Station Name - Full display without harsh clipping */}
                <h2 className={`text-base sm:text-lg font-black tracking-tight leading-snug break-words ${stationTitleClass}`}>
                  {activeStation.name}
                </h2>
                {/* Category if present */}
                {activeStation.category && (
                  <p className={`text-[11px] sm:text-xs font-medium mt-0.5 leading-normal opacity-75 break-words ${subtextMutedClass}`}>
                    {activeStation.category}
                  </p>
                )}
              </div>
            </div>

            {/* Top Right Action: Beautified Radio Station Switcher */}
            <div className="flex flex-col items-end gap-1.5 shrink-0 mt-0.5">
              <button
                onClick={onOpenStationManager}
                title="切換與管理廣播電台頻道"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer border ${stationSwitchBtnClass}`}
              >
                <div className="w-4 h-4 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-2.5 h-2.5 text-blue-400" />
                </div>
                <span className="tracking-tight">切換電台</span>
              </button>

              {(hasNewUpdate || isUpdating) && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleApplyUpdate}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm transition-all whitespace-nowrap ${
                    isUpdating
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 cursor-wait'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer active:scale-95 animate-pulse'
                  }`}
                  title={isUpdating ? `正在更新 ${updateProgress}%` : '點擊更新至最新版本'}
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                      <span>正在更新 {updateProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span>點此更新</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Details Row: Frequency Tag + Complete Location (No Truncation) */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            {activeStation.freq && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                currentTheme === 'paper'
                  ? 'bg-[#E5D7BE]/70 text-[#5C4830] border-[#D8C49E]'
                  : currentTheme === 'light'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-slate-800/80 text-blue-300/90 border-slate-700/60'
              }`}>
                {activeStation.freq}
              </span>
            )}
            {activeStation.location && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                currentTheme === 'paper'
                  ? 'text-[#5C4830] bg-[#E5D7BE]/40 border-[#D8C49E]/60'
                  : currentTheme === 'light'
                  ? 'text-slate-600 bg-slate-100/70 border-slate-200/80'
                  : 'text-slate-300 bg-slate-800/50 border-slate-700/50'
              }`}>
                <MapPin className="w-3 h-3 text-amber-400/90 shrink-0" />
                <span>{activeStation.location}</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom Utility Bar: Reading Mode, Chinese Variant & Subtitle Font Size Controls */}
        <ReadingModeAndFontToolbar
          readingMode={readingMode}
          onReadingModeChange={onReadingModeChange}
          effectiveTheme={effectiveTheme}
          chineseVariant={chineseVariant}
          onChineseVariantChange={onChineseVariantChange}
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          idPrefix="radio"
        />
      </div>
    </div>
  );
};
