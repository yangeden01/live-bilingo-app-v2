import React, { useEffect, useRef, useState } from 'react';
import { SubtitleItem, RadioStation, ReadingMode } from '../types';
import { motion } from 'motion/react';
import { Volume2, VolumeX, Bookmark, BookmarkCheck, Radio, Lock, Eye } from 'lucide-react';
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
            雙語即時閱讀流
          </span>
          <span className="hidden sm:inline-block text-[11px] opacity-75 font-normal">
            (語音辨識與翻譯同步更新)
          </span>
        </div>

        <div className="flex items-center gap-2">
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
            title={autoFollow ? '自動聚焦滾動中' : '手動自由滾動'}
          >
            {autoFollow ? (
              <>
                <Lock className="w-3 h-3" />
                <span>自動跟隨</span>
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
              點擊播放按鈕收聽廣播，系統將即時產生雙語字幕與逐字對照。
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
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span className="font-mono text-[11px]">{activeSubtitle.timestamp || '即時串流'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onBookmarkToggle && (
                        <button
                          type="button"
                          onClick={() => onBookmarkToggle(activeSubtitle.id)}
                          className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer bg-slate-800/10 dark:bg-white/10"
                          title="收藏此段落"
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
