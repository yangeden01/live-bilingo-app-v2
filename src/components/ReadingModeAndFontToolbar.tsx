import React from 'react';
import { BookOpen, Sparkles, Sun, Moon, Type } from 'lucide-react';
import { motion } from 'motion/react';
import { ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { playBeanWallImpactSound } from '../utils/sound';

export interface ReadingModeAndFontToolbarProps {
  readingMode: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'paper' | 'light' | 'dark';
  chineseVariant: ChineseVariant;
  onChineseVariantChange?: (variant: ChineseVariant) => void;
  fontSize: SubtitleFontSize;
  onFontSizeChange?: (size: SubtitleFontSize) => void;
  idPrefix?: string;
  className?: string;
}

export const ReadingModeAndFontToolbar: React.FC<ReadingModeAndFontToolbarProps> = ({
  readingMode,
  onReadingModeChange,
  effectiveTheme,
  chineseVariant,
  onChineseVariantChange,
  fontSize,
  onFontSizeChange,
  idPrefix = '',
  className = '',
}) => {
  const currentTheme = effectiveTheme || (readingMode === 'paper' ? 'paper' : readingMode === 'light' ? 'light' : 'dark');

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

  const prefix = idPrefix ? `${idPrefix}-` : '';

  return (
    <div className={`flex flex-col gap-2 w-full text-xs pt-0.5 mt-0.5 ${className}`}>
      {/* Row 1: Reading Mode Selector Bar */}
      <div className={`flex items-center gap-1.5 p-1 rounded-xl shadow-inner border transition-colors duration-200 ${readingModeContainerClass} w-full`}>
        <div className="flex items-center justify-center text-amber-500 font-bold px-1.5 shrink-0" title="閱讀模式選擇 (護眼與深淺色)">
          <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
        </div>
        <div className={`w-[1px] h-4 mx-0.5 shrink-0 ${readingModeDividerClass}`} />
        
        <div className="relative inline-flex items-center select-none p-0.5 flex-1 w-full">
          {(() => {
            const modesList = ['system', 'paper', 'light', 'dark'] as const;
            const selectedIndex = modesList.indexOf(readingMode as typeof modesList[number]);
            const idx = selectedIndex >= 0 ? selectedIndex : 0;
            
            return (
              <motion.div
                className="absolute top-0.5 bottom-0.5 rounded-lg bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_8px_rgba(180,83,9,0.5)] pointer-events-none flex items-center justify-center z-0"
                initial={false}
                animate={{
                  left: `calc(${idx * 25}% + 1px)`,
                  width: 'calc(25% - 2px)',
                }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              >
                <div className="w-1.5 h-3 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
              </motion.div>
            );
          })()}

          <div className="relative z-10 flex items-center justify-between w-full">
            {(
              [
                { mode: 'system', label: '自動', icon: Sparkles, color: 'text-blue-400', title: '自動模式：夜間(18:00起)自動護眼暗黑，並跟隨環境光線與系統' },
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
                  id={`${prefix}reading-mode-btn-${mode}`}
                  onClick={() => {
                    if (readingMode !== mode) {
                      onReadingModeChange?.(mode);
                      setTimeout(playBeanWallImpactSound, 135);
                    }
                  }}
                  title={title}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-bold text-xs sm:text-sm transition-colors duration-150 cursor-pointer select-none ${
                    isSelected
                      ? 'text-amber-100 font-black'
                      : currentTheme === 'paper'
                      ? 'text-[#7A6853] hover:text-[#3B2E1E]'
                      : currentTheme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSelected ? 'text-amber-200' : color}`} />
                  <span className="inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Subtitle Settings (Type Icon | 繁 簡 | 小 中 大 特大) */}
      <div className={`flex items-center gap-1.5 p-1 rounded-xl shadow-inner border transition-colors duration-200 ${readingModeContainerClass} w-full text-xs`}>
        <div className="flex items-center justify-center text-amber-500 font-bold px-1.5 shrink-0" title="字幕字體與繁簡設定">
          <Type className="w-4 h-4 text-amber-500 shrink-0" />
        </div>
        <div className={`w-[1px] h-4 mx-0.5 shrink-0 ${readingModeDividerClass}`} />

        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 w-full">
          {/* Mechanical Sliding Traditional / Simplified Chinese Switcher (繁 / 簡) */}
          <div
            id={`${prefix}chinese-variant-switcher`}
            className="relative inline-flex items-center p-0.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 flex-1 shadow-inner select-none"
          >
            {(() => {
              const variants: ChineseVariant[] = ['traditional', 'simplified'];
              const selectedIndex = variants.indexOf(chineseVariant as ChineseVariant);
              const idx = selectedIndex >= 0 ? selectedIndex : 0;
              return (
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_6px_rgba(180,83,9,0.4)] pointer-events-none flex items-center justify-center z-0"
                  initial={false}
                  animate={{
                    left: `calc(${idx * 50}% + 1px)`,
                    width: 'calc(50% - 2px)',
                  }}
                  transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                >
                  <div className="w-1 h-2.5 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
                </motion.div>
              );
            })()}

            <div className="relative z-10 flex items-center w-full">
              {(['traditional', 'simplified'] as const).map((variant) => {
                const labels = { traditional: '繁', simplified: '簡' };
                const fullNames = { traditional: '繁體中文', simplified: '簡體中文' };
                const isSelected = chineseVariant === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    id={`${prefix}chinese-variant-btn-${variant}`}
                    onClick={() => {
                      if (chineseVariant !== variant) {
                        onChineseVariantChange?.(variant);
                        setTimeout(playBeanWallImpactSound, 135);
                      }
                    }}
                    title={`切換為${fullNames[variant]}`}
                    className={`flex-1 h-6 sm:h-6.5 flex items-center justify-center text-center font-bold text-xs transition-colors duration-150 cursor-pointer select-none rounded-md active:scale-95 ${
                      isSelected
                        ? 'text-amber-100 font-black'
                        : currentTheme === 'paper'
                        ? 'text-[#7A6853] hover:text-[#3B2E1E]'
                        : currentTheme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {labels[variant]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mechanical Sliding Font Size Switcher (小 / 中 / 大 / 特大) */}
          <div
            id={`${prefix}font-size-switcher`}
            className="relative inline-flex items-center p-0.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 flex-[2] shadow-inner select-none"
          >
            {(() => {
              const fontSizes: SubtitleFontSize[] = ['small', 'medium', 'large', 'xlarge'];
              const selectedIndex = fontSizes.indexOf(fontSize as SubtitleFontSize);
              const idx = selectedIndex >= 0 ? selectedIndex : 0;
              return (
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_6px_rgba(180,83,9,0.4)] pointer-events-none flex items-center justify-center z-0"
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

            <div className="relative z-10 flex items-center w-full">
              {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => {
                const labels = { small: '小', medium: '中', large: '大', xlarge: '特大' };
                const sizeStyles = {
                  small: 'text-[11px] font-semibold',
                  medium: 'text-xs font-bold',
                  large: 'text-xs font-black',
                  xlarge: 'text-[11px] font-black tracking-tighter',
                };
                const isSelected = fontSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    id={`${prefix}font-size-btn-${size}`}
                    onClick={() => {
                      if (fontSize !== size) {
                        onFontSizeChange?.(size);
                        setTimeout(playBeanWallImpactSound, 135);
                      }
                    }}
                    title={`字幕字體大小：${labels[size]}`}
                    className={`flex-1 h-6 sm:h-6.5 flex items-center justify-center text-center font-bold transition-colors duration-150 cursor-pointer select-none rounded-md active:scale-95 ${
                      sizeStyles[size]
                    } ${
                      isSelected
                        ? 'text-amber-100 font-black'
                        : currentTheme === 'paper'
                        ? 'text-[#7A6853] hover:text-[#3B2E1E]'
                        : currentTheme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {labels[size]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
