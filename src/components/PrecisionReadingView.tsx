import React, { useEffect, useRef, useState } from 'react';
import { SubtitleItem, RadioStation, ReadingMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Bookmark, BookmarkCheck, Sparkles, Radio, Play, Pause, ChevronLeft, ChevronRight, Lock, Eye, Compass, Sliders, FastForward, Rewind } from 'lucide-react';
import { speakText, stopSpeech } from '../utils/tts';

interface Props {
  subtitles: SubtitleItem[];
  interimSubtitle?: SubtitleItem | null;
  activeStation?: RadioStation;
  playbackStatus: 'IDLE' | 'BUFFERING' | 'PLAYING' | 'PAUSED' | 'ERROR';
  onTogglePlayPause: () => void;
  onBookmarkToggle?: (id: string) => void;
  onOpenDictionary?: (word?: string) => void;
  theme?: 'dark' | 'light' | 'paper';
  fontSize?: 'small' | 'medium' | 'large';
  autoFollow?: boolean;
  onToggleAutoFollow?: () => void;
}

export const PrecisionReadingView: React.FC<Props> = ({
  subtitles,
  interimSubtitle,
  activeStation,
  playbackStatus,
  onTogglePlayPause,
  onBookmarkToggle,
  onOpenDictionary,
  theme = 'dark',
  fontSize = 'medium',
  autoFollow = true,
  onToggleAutoFollow,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('radio_subtitle_sync_offset_ms');
      return saved ? Number(saved) || 3500 : 3500;
    } catch (e) {
      return 3500;
    }
  });
  const [showSyncSettings, setShowSyncSettings] = useState<boolean>(false);

  const handleAdjustSyncOffset = (deltaMs: number) => {
    const updated = Math.max(0, Math.min(10000, syncOffsetMs + deltaMs));
    setSyncOffsetMs(updated);
    try {
      localStorage.setItem('radio_subtitle_sync_offset_ms', String(updated));
    } catch (e) {}
  };

  // Active subtitle is either interim (if typing) or latest final subtitle
  const activeSubtitle = interimSubtitle || subtitles[0] || null;
  const activeId = activeSubtitle?.id;

  const activeCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll lock to keep active segment centered without user scrolling
  useEffect(() => {
    if (autoFollow && activeCardRef.current && containerRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeId, interimSubtitle?.english, autoFollow]);

  const handleSpeak = (sub: SubtitleItem) => {
    if (!sub.english) return;
    if (speakingId === sub.id) {
      stopSpeech();
      setSpeakingId(null);
    } else {
      speakText(
        sub.english,
        () => setSpeakingId(sub.id),
        () => setSpeakingId(null),
        () => setSpeakingId(null)
      );
    }
  };

  const fontSizeClasses = {
    small: { en: 'text-lg sm:text-xl', zh: 'text-base sm:text-lg' },
    medium: { en: 'text-xl sm:text-2xl', zh: 'text-lg sm:text-xl' },
    large: { en: 'text-2xl sm:text-3xl', zh: 'text-xl sm:text-2xl' },
  }[fontSize];

  const containerBg =
    theme === 'paper'
      ? 'bg-[#FAF4E8] text-[#3B2E1E]'
      : theme === 'light'
      ? 'bg-slate-50 text-slate-900'
      : 'bg-slate-950 text-slate-100';

  const spotlightBg =
    theme === 'paper'
      ? 'bg-[#FFFDF7] border-amber-600 shadow-xl shadow-amber-900/10 ring-4 ring-amber-500/20'
      : theme === 'light'
      ? 'bg-white border-blue-600 shadow-xl shadow-blue-500/15 ring-4 ring-blue-500/20'
      : 'bg-slate-900 border-blue-500 shadow-2xl shadow-blue-900/30 ring-4 ring-blue-500/25';

  const pastItemBg =
    theme === 'paper'
      ? 'bg-[#F4EAD5]/60 border-[#E2D2B0] opacity-65 hover:opacity-100'
      : theme === 'light'
      ? 'bg-white/70 border-slate-200 opacity-65 hover:opacity-100'
      : 'bg-slate-900/50 border-slate-800 opacity-55 hover:opacity-100';

  return (
    <div className="flex flex-col h-full relative">
      {/* Precision Mode Status Bar */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between text-xs select-none backdrop-blur-sm z-20 ${
        theme === 'paper'
          ? 'bg-[#EFE6D0]/90 border-[#D8C49E] text-[#3B2E1E]'
          : theme === 'light'
          ? 'bg-slate-100/90 border-slate-200 text-slate-800'
          : 'bg-slate-900/90 border-slate-800 text-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
          </div>
          <span className="font-extrabold tracking-wide">
            精準即時聚焦閱讀
          </span>
          <span className="hidden sm:inline-block text-[11px] opacity-75 font-normal">
            (自動鎖定廣播目前播放段落)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Calibration Offset Quick Adjuster */}
          <button
            type="button"
            onClick={() => setShowSyncSettings(!showSyncSettings)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              showSyncSettings
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 opacity-80 hover:opacity-100'
            }`}
            title="調整字幕與廣播聲音對齊時間差 (Sync Calibration)"
          >
            <Sliders className="w-3 h-3" />
            <span>校準同步</span>
          </button>

          {/* Auto Follow Toggle Button */}
          <button
            type="button"
            onClick={onToggleAutoFollow}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
              autoFollow
                ? 'bg-blue-600 text-white'
                : theme === 'paper'
                ? 'bg-amber-200 text-amber-900'
                : 'bg-slate-800 text-slate-400'
            }`}
            title={autoFollow ? '自動聚焦鎖定中：廣播播放到哪，畫面自動滑動到哪' : '手動滑動模式：點擊開啟自動聚焦'}
          >
            {autoFollow ? (
              <>
                <Lock className="w-3 h-3" />
                <span>鎖定跟隨</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span>自由滾動</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Offset Calibration Panel (Expandable) */}
      <AnimatePresence>
        {showSyncSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`px-4 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2 z-10 ${
              theme === 'paper'
                ? 'bg-[#E5D7BC] border-[#D0BF98] text-[#3B2E1E]'
                : theme === 'light'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">⏱️ 字幕時間差微調：</span>
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                {(syncOffsetMs / 1000).toFixed(1)} 秒
              </span>
              <span className="text-[11px] opacity-75 hidden sm:inline">
                (字幕太快請按 +延遲；字幕太慢請按 -提早)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustSyncOffset(-1000)}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 font-bold transition-all"
                title="提早 1 秒顯示"
              >
                -1.0s
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSyncOffset(-500)}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 font-bold transition-all"
                title="提早 0.5 秒顯示"
              >
                -0.5s
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSyncOffset(500)}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 font-bold transition-all"
                title="延遲 0.5 秒釋出"
              >
                +0.5s
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSyncOffset(1000)}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 font-bold transition-all"
                title="延遲 1 秒釋出"
              >
                +1.0s
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncOffsetMs(3500);
                  try { localStorage.setItem('radio_subtitle_sync_offset_ms', '3500'); } catch (e) {}
                }}
                className="ml-1 px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[11px]"
                title="恢復預設精準對齊值 (3.5s)"
              >
                重設
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtitles Scroll View */}
      <div
        ref={containerRef}
        className={`flex-1 p-3 sm:p-5 overflow-y-auto space-y-4 transition-colors duration-200 ${containerBg}`}
      >
        {subtitles.length === 0 && !interimSubtitle ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <h3 className="font-bold text-base mb-1">正在等待廣播語音串流...</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              點擊播放按鈕收聽廣播，精準閱讀模式將即時高亮目前語音段落與逐字對照。
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto pb-16">
            {/* Active Spotlight Card (Current broadcasting segment) */}
            {activeSubtitle && (
              <div ref={activeCardRef} className="scroll-mt-6">
                <motion.div
                  layout
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-2xl p-5 border-2 transition-all relative overflow-hidden ${spotlightBg}`}
                >
                  {/* Spotlight Banner Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                      <span>正在播放此段落 (NOW PLAYING)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onBookmarkToggle && (
                        <button
                          type="button"
                          onClick={() => onBookmarkToggle(activeSubtitle.id)}
                          className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer bg-slate-800/10 dark:bg-white/10"
                          title="收藏目前段落"
                        >
                          {activeSubtitle.bookmarked ? (
                            <BookmarkCheck className="w-5 h-5 text-amber-500 fill-current" />
                          ) : (
                            <Bookmark className="w-5 h-5 opacity-75" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSpeak(activeSubtitle)}
                        className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer bg-blue-600 text-white"
                        title="朗讀英文"
                      >
                        {speakingId === activeSubtitle.id ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Active English Text (Large & High Contrast) */}
                  <div className="mb-3">
                    <p className={`font-bold leading-relaxed tracking-wide ${fontSizeClasses.en} ${
                      theme === 'paper'
                        ? 'text-[#2C2115]'
                        : theme === 'light'
                        ? 'text-slate-900'
                        : 'text-white'
                    }`}>
                      {activeSubtitle.english.split(/(\s+|[^\w'])/).map((token, idx) => {
                        const isWord = /^[a-zA-Z0-9'-]+$/.test(token) && /^[a-zA-Z]/.test(token);
                        if (!isWord) return token;
                        return (
                          <span
                            key={idx}
                            onClick={() => onOpenDictionary?.(token)}
                            className="cursor-pointer hover:bg-amber-400 hover:text-slate-950 rounded px-0.5 transition-colors underline decoration-dotted decoration-blue-400 underline-offset-4"
                            title={`點擊查詢 '${token}'`}
                          >
                            {token}
                          </span>
                        );
                      })}
                    </p>
                  </div>

                  {/* Active Traditional Chinese Translation */}
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-start gap-2">
                    <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <p className={`font-semibold leading-relaxed ${fontSizeClasses.zh} ${
                      theme === 'paper'
                        ? 'text-[#8B4513]'
                        : theme === 'light'
                        ? 'text-blue-700'
                        : 'text-blue-300'
                    }`}>
                      {activeSubtitle.traditionalChinese}
                    </p>
                  </div>

                  {/* Streaming Audio Visualizer bar indicator */}
                  <div className="mt-4 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 rounded-full"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.2,
                        ease: 'linear',
                      }}
                    />
                  </div>
                </motion.div>
              </div>
            )}

            {/* Previous Transcript Paragraphs */}
            {subtitles.slice(interimSubtitle ? 0 : 1).map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`rounded-xl p-4 border transition-all ${pastItemBg}`}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs opacity-75">
                  <span className="font-mono">{sub.timestamp}</span>
                  <div className="flex items-center gap-2">
                    {onBookmarkToggle && (
                      <button
                        type="button"
                        onClick={() => onBookmarkToggle(sub.id)}
                        className="cursor-pointer"
                      >
                        {sub.bookmarked ? (
                          <BookmarkCheck className="w-4 h-4 text-amber-500 fill-current" />
                        ) : (
                          <Bookmark className="w-4 h-4 opacity-60" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSpeak(sub)}
                      className="cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 opacity-75 hover:opacity-100" />
                    </button>
                  </div>
                </div>

                <p className="font-medium text-sm sm:text-base leading-relaxed mb-1">
                  {sub.english}
                </p>
                <p className={`text-xs sm:text-sm font-medium ${
                  theme === 'paper' ? 'text-[#8B4513]' : 'text-blue-500 dark:text-blue-300'
                }`}>
                  {sub.traditionalChinese}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
