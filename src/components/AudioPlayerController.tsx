import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { playBeanWallImpactSound } from '../utils/sound';
import { PlaybackStatus, RadioStation, SubtitleItem, ReadingMode } from '../types';
import { Radio, Signal, Sparkles, ListMusic, Timer, RefreshCw, Check, ChevronDown, Sun, Moon, BookOpen } from 'lucide-react';
import { MarqueeText } from './MarqueeText';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';
import { useSubtitleSync } from '../hooks/useSubtitleSync';
import { useRadioAudio } from '../hooks/useRadioAudio';
import { useSleepTimer } from '../hooks/useSleepTimer';

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

  // Hook 1: Sleep Timer
  const {
    sleepMinutes,
    remainingSeconds,
    isTimerDropdownOpen,
    setIsTimerDropdownOpen,
    timerDropdownRef,
    selectSleepTimer,
  } = useSleepTimer({
    playbackStatus,
    onTimerEnd: () => {
      setPlaybackStatus('PAUSED');
      if (audioRef.current) {
        audioRef.current.pause();
      }
    },
  });

  // Hook 2: Audio streaming & playback lifecycle
  const {
    audioRef,
    togglePlayPause,
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

  const liveTagClass =
    playbackStatus === 'PLAYING'
      ? currentTheme === 'paper'
        ? 'bg-emerald-600/15 text-emerald-800 border border-emerald-600/30'
        : currentTheme === 'light'
        ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      : currentTheme === 'paper'
      ? 'bg-[#E5D7BD] text-[#6E5B42]'
      : currentTheme === 'light'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-slate-800 text-slate-400';

  const radioBtnClass =
    hasNewUpdate
      ? 'bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
      : currentTheme === 'paper'
      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-900 border border-amber-600/30 shadow-sm'
      : currentTheme === 'light'
      ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 shadow-sm'
      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-sm';

  const stationSwitchBtnClass =
    currentTheme === 'paper'
      ? 'bg-[#EFE6D0] hover:bg-[#E2D2B0] text-[#3B2E1E] border-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
      : 'bg-slate-800/80 hover:bg-slate-700/80 text-blue-300 border-slate-700/70';

  const sleepTimerBtnClass =
    remainingSeconds !== null && playbackStatus === 'PLAYING'
      ? currentTheme === 'paper'
        ? 'bg-amber-200/90 border-amber-600/70 text-amber-950 shadow-sm ring-1 ring-amber-600/40 font-bold'
        : currentTheme === 'light'
        ? 'bg-amber-100 border-amber-500/80 text-amber-950 shadow-sm ring-1 ring-amber-500/50 font-bold'
        : 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-400/40 font-bold'
      : remainingSeconds !== null
      ? currentTheme === 'paper'
        ? 'bg-[#EFE6D0] border-[#D8C49E] text-amber-950 font-bold'
        : currentTheme === 'light'
        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
        : 'bg-slate-800/80 border-slate-700/80 text-amber-300/90 font-bold'
      : currentTheme === 'paper'
      ? 'bg-[#EFE6D0] border-[#D8C49E] text-[#3B2E1E] hover:bg-[#E2D2B0]'
      : currentTheme === 'light'
      ? 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-700/80';

  const popoverClass =
    currentTheme === 'paper'
      ? 'bg-[#FFFDF7] border-[#D8C49E] text-[#3B2E1E] shadow-2xl ring-1 ring-[#E2D2B0]'
      : currentTheme === 'light'
      ? 'bg-white border-slate-200 text-slate-800 shadow-2xl ring-1 ring-slate-200'
      : 'bg-slate-900 border-slate-700/80 text-slate-300 shadow-2xl ring-1 ring-slate-700/60';

  const readingModeContainerClass =
    currentTheme === 'paper'
      ? 'bg-[#EFE6D0] border-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-100 border-slate-200'
      : 'bg-slate-900/90 border-slate-700/80';

  const readingModeDividerClass =
    currentTheme === 'paper'
      ? 'bg-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-300'
      : 'bg-slate-700/80';

  return (
    <div className={`backdrop-blur-md rounded-2xl p-4 sm:p-5 border relative z-30 flex flex-col gap-3 transition-colors duration-200 ${cardBgClass}`}>
      {/* Background Ambient Glow */}
      <div className={`absolute inset-0 bg-gradient-to-r pointer-events-none rounded-2xl overflow-hidden transition-colors duration-200 ${ambientGlowClass}`} />

      <audio
        ref={audioRef}
        src={getProxiedStreamUrl(activeStation.streamUrl)}
        preload="auto"
        onWaiting={() => setPlaybackStatus('BUFFERING')}
        onPlaying={() => setPlaybackStatus('PLAYING')}
        onPause={() => {}}
        onError={() => setPlaybackStatus('ERROR')}
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
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={hasNewUpdate ? handleApplyUpdate : handleHiddenRefresh}
              title={hasNewUpdate ? '發現新版本！點擊此處內容更新' : '檢查更新：廣播與字幕持續播放中'}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer group ${radioBtnClass}`}
            >
              {hasNewUpdate ? (
                <Sparkles className="w-4 h-4 text-amber-100 transition-transform group-hover:scale-110" />
              ) : (
                <Radio className={`w-4.5 h-4.5 text-blue-400 transition-transform duration-700 ${isSpinning ? 'rotate-[360deg] text-emerald-400' : 'group-hover:scale-110'}`} />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                  hasNewUpdate ? 'bg-amber-300 ring-2 ring-amber-200 animate-ping' : 'bg-emerald-400'
                }`}
              />
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <MarqueeText text={activeStation.name} className={`text-base sm:text-lg font-bold tracking-tight ${stationTitleClass}`} />
              <div className={`flex items-center gap-2 mt-0.5 text-xs flex-wrap ${subtextMutedClass}`}>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${liveTagClass}`}>
                  <Signal className={`w-2.5 h-2.5 ${playbackStatus === 'PLAYING' ? 'animate-pulse text-emerald-400' : ''}`} />
                  {playbackStatus === 'PLAYING' ? 'LIVE' : '離線'}
                </span>
                {activeStation.freq && (
                  <span className={`text-[11px] font-medium ${subtextClass}`}>
                    {activeStation.freq}
                  </span>
                )}
                <span className="opacity-50">•</span>
                <span className={`text-xs truncate ${subtextMutedClass}`}>
                  {activeStation.location}
                </span>
              </div>
            </div>
          </div>

          {/* Top Right Action: Radio Station Selection & Sleep Timer */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={onOpenStationManager}
                title="切換廣播電台"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer border ${stationSwitchBtnClass}`}
              >
                <ListMusic className="w-3.5 h-3.5 text-blue-400" />
                <span>切換電台</span>
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

            {/* Sleep Timer Custom Dropdown */}
            <div className="relative shrink-0" ref={timerDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTimerDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${sleepTimerBtnClass}`}
                title={
                  remainingSeconds !== null && playbackStatus === 'PLAYING'
                    ? '睡眠定時器正在倒數中，點擊修改'
                    : remainingSeconds !== null
                    ? '已設定睡眠定時器（播放時將開始倒數），點擊修改'
                    : '點擊開啟睡眠自動關閉定時下拉選單'
                }
              >
                <Timer
                  className={`w-3.5 h-3.5 shrink-0 ${
                    remainingSeconds !== null && playbackStatus === 'PLAYING'
                      ? currentTheme === 'dark'
                        ? 'text-amber-300 animate-spin'
                        : 'text-amber-950 animate-spin'
                      : remainingSeconds !== null
                      ? currentTheme === 'dark'
                        ? 'text-amber-300/90'
                        : 'text-amber-950'
                      : currentTheme === 'paper'
                      ? 'text-[#5C4830]'
                      : currentTheme === 'light'
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                />
                {remainingSeconds !== null ? (
                  <span
                    className={`font-mono font-extrabold text-xs tracking-tight ${
                      playbackStatus === 'PLAYING'
                        ? currentTheme === 'dark'
                          ? 'text-amber-300'
                          : 'text-amber-950'
                        : currentTheme === 'dark'
                        ? 'text-amber-300/90'
                        : 'text-amber-900'
                    }`}
                  >
                    {Math.floor(remainingSeconds / 3600) > 0 ? `${Math.floor(remainingSeconds / 3600)}:` : ''}
                    {String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0')}:
                    {String(remainingSeconds % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <span>
                    {sleepMinutes > 0 ? `${sleepMinutes}分鐘` : '關閉定時'}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${isTimerDropdownOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`} />
              </button>

              {/* Floating Dropdown Popover */}
              {isTimerDropdownOpen && (
                <div className={`absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-0.5 max-h-[400px] overflow-y-auto border ${popoverClass}`}>
                  <div className={`px-2.5 py-1.5 text-[10px] font-bold opacity-70 border-b flex items-center justify-between ${
                    currentTheme === 'paper' ? 'border-[#D8C49E]' : currentTheme === 'light' ? 'border-slate-200' : 'border-slate-700/40'
                  }`}>
                    <span>睡眠定時器</span>
                    <span className="opacity-70 font-normal">最長 3 小時</span>
                  </div>
                  {[
                    { minutes: 0, label: '關閉定時' },
                    { minutes: 15, label: '15 分鐘' },
                    { minutes: 30, label: '30 分鐘' },
                    { minutes: 45, label: '45 分鐘' },
                    { minutes: 60, label: '60 分鐘 (1 小時)' },
                    { minutes: 90, label: '90 分鐘 (1.5 小時)' },
                    { minutes: 120, label: '120 分鐘 (2 小時)' },
                    { minutes: 150, label: '150 分鐘 (2.5 小時)' },
                    { minutes: 180, label: '180 分鐘 (3 小時)' },
                  ].map((opt) => {
                    const isSelected = sleepMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => selectSleepTimer(opt.minutes)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : currentTheme === 'paper'
                            ? 'text-[#3B2E1E] hover:bg-[#EFE6D0]'
                            : currentTheme === 'light'
                            ? 'text-slate-800 hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Utility Bar: Reading Mode Selector Bar */}
        <div className="flex items-center justify-start w-full text-xs pt-1">
          <div className={`flex items-center gap-1 p-1 rounded-xl shadow-inner w-full sm:w-auto border transition-colors duration-200 ${readingModeContainerClass}`}>
            <div className="flex items-center justify-center text-amber-500 font-bold px-1.5" title="閱讀模式選擇 (護眼與深淺色)">
              <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className={`w-[1px] h-3.5 mx-0.5 ${readingModeDividerClass}`} />
            
            <div className="relative inline-flex items-center flex-1 sm:flex-initial select-none p-0.5">
              {(() => {
                const modesList = ['system', 'paper', 'light', 'dark'] as const;
                const selectedIndex = modesList.indexOf(readingMode as typeof modesList[number]);
                const idx = selectedIndex >= 0 ? selectedIndex : 0;
                
                return (
                  <motion.div
                    className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_8px_rgba(180,83,9,0.5)] pointer-events-none flex items-center justify-center z-0"
                    initial={false}
                    animate={{
                      left: `calc(${idx * 25}% + 1px)`,
                      width: 'calc(25% - 2px)',
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                  >
                    <div className="w-1 h-2.5 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
                  </motion.div>
                );
              })()}

              <div className="relative z-10 flex items-center w-full sm:w-auto">
                {(
                  [
                    { mode: 'system', label: '自動', icon: Sparkles, color: 'text-blue-400', title: '跟隨環境光線感應與系統設定自動切換 (避亮防眩)' },
                    { mode: 'paper', label: '紙張', icon: BookOpen, color: 'text-amber-500', title: '護眼紙張模式：溫潤羊皮紙色系，長時間閱讀不疲勞' },
                    { mode: 'light', label: '明亮', icon: Sun, color: 'text-amber-400', title: '固定日間高對比明亮模式' },
                    { mode: 'dark', label: '暗黑', icon: Moon, color: 'text-indigo-300', title: '固定夜間低光護眼暗黑模式' },
                  ] as const
                ).map(({ mode, label, icon: Icon, color, title }) => {
                  const isSelected = readingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (readingMode !== mode) {
                          onReadingModeChange?.(mode);
                          setTimeout(playBeanWallImpactSound, 135);
                        }
                      }}
                      title={title}
                      className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 rounded-md font-bold text-xs transition-colors duration-150 cursor-pointer select-none ${
                        isSelected
                          ? 'text-amber-100 font-black'
                          : currentTheme === 'paper'
                          ? 'text-[#7A6853] hover:text-[#3B2E1E]'
                          : currentTheme === 'light'
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-200' : color}`} />
                      <span className="inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
