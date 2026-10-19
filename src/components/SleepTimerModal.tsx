import React from 'react';
import { motion } from 'motion/react';
import { X, Moon, Clock, Plus, BellOff, Volume2, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sleepMinutes: number;
  remainingSeconds: number | null;
  onSelectMinutes: (minutes: number) => void;
  onAddMinutes?: (extra: number) => void;
  theme?: 'dark' | 'light' | 'paper';
}

export const SleepTimerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sleepMinutes,
  remainingSeconds,
  onSelectMinutes,
  onAddMinutes,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const presets = [
    { minutes: 15, label: '15 分鐘' },
    { minutes: 30, label: '30 分鐘' },
    { minutes: 45, label: '45 分鐘' },
    { minutes: 60, label: '60 分鐘 (1小時)' },
    { minutes: 90, label: '90 分鐘 (1.5小時)' },
    { minutes: 120, label: '120 分鐘 (2小時)' },
    { minutes: 150, label: '150 分鐘 (2.5小時)' },
    { minutes: 180, label: '180 分鐘 (3小時)' },
  ];

  const formatRemaining = (totalSec: number | null) => {
    if (totalSec === null || totalSec <= 0) return '00:00';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h} 小時 ${m} 分 ${s < 10 ? '0' : ''}${s} 秒`;
    }
    return `${m} 分 ${s < 10 ? '0' : ''}${s} 秒`;
  };

  const modalBg =
    theme === 'paper'
      ? 'bg-[#FDF8EE] text-[#2C2115] border-[#D8C49E]'
      : theme === 'light'
      ? 'bg-white text-slate-900 border-slate-200'
      : 'bg-slate-900 text-slate-100 border-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.2 }}
        className={`w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl border flex flex-col ${modalBg}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-tight">睡眠定時器</h2>
              <p className="text-[11px] opacity-70">睡前聆聽 · 自動平滑淡出關閉</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 30s Fade-Out Smart Banner */}
        <div className="mt-3.5 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            <strong>30秒平滑淡出</strong>：定時結束前 30 秒，系統會將廣播音量無聲漸變淡出，避免音訊突然中斷驚醒睡眠。
          </p>
        </div>

        {/* Current Active Countdown Status */}
        {remainingSeconds !== null && remainingSeconds > 0 ? (
          <div className="my-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-indigo-400/40 text-center">
            <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
              倒數計時中
            </div>
            <div className="text-3xl font-mono font-black my-1 text-indigo-600 dark:text-indigo-300">
              {formatRemaining(remainingSeconds)}
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onAddMinutes?.(5)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> +5 分鐘
              </button>
              <button
                type="button"
                onClick={() => onAddMinutes?.(15)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> +15 分鐘
              </button>
            </div>
          </div>
        ) : null}

        {/* Preset Duration Buttons */}
        <div className="mt-4">
          <div className="text-xs font-bold opacity-75 mb-2">設定定時時長：</div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const isActive = sleepMinutes === p.minutes;
              return (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() => {
                    onSelectMinutes(p.minutes);
                    onClose();
                  }}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between active:scale-95 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{p.label}</span>
                  {isActive && <Moon className="w-3.5 h-3.5 fill-current" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Turn off Sleep Timer button if active */}
        {sleepMinutes > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onSelectMinutes(0);
                onClose();
              }}
              className="w-full py-2.5 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <BellOff className="w-4 h-4" />
              關閉睡眠定時器
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
