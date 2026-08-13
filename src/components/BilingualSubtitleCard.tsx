import React, { useState, useMemo } from 'react';
import { SubtitleItem } from '../types';
import { Clock, Volume2, VolumeX, Bookmark, BookmarkCheck, Zap, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { speakText, stopSpeech } from '../utils/tts';

interface Props {
  subtitle: SubtitleItem;
  onBookmarkToggle?: (id: string) => void;
  onOpenDictionary?: (word?: string) => void;
  isLatest?: boolean;
  searchQuery?: string;
  fontSize?: 'small' | 'medium' | 'large';
  segmentNumber?: number;
  theme?: 'dark' | 'light' | 'paper';
}

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const BilingualSubtitleCard: React.FC<Props> = ({
  subtitle,
  onBookmarkToggle,
  onOpenDictionary,
  isLatest = false,
  searchQuery = '',
  fontSize = 'small',
  segmentNumber,
  theme = 'dark',
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (!subtitle.english) return;

    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      speakText(
        subtitle.english,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false)
      );
    }
  };

  // Split english text into interactive words and punctuation tokens
  const wordTokens = useMemo(() => {
    if (!subtitle.english) return [];
    const tokens = subtitle.english.split(/(\s+|[^\w'])/);
    return tokens;
  }, [subtitle.english]);

  // Render English text with search query highlighting and interactive dictionary tokens
  const renderEnglishText = () => {
    const q = searchQuery ? searchQuery.trim() : '';
    const hoverStyles =
      theme === 'paper'
        ? 'hover:bg-amber-200/80 hover:text-amber-950 underline decoration-dotted decoration-amber-600/60'
        : 'hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-dotted decoration-blue-400/50';

    if (!q || !subtitle.english) {
      return wordTokens.map((token, i) => {
        const isWord = /^[a-zA-Z0-9'-]+$/.test(token) && token.length > 1;
        if (!isWord) return token;

        return (
          <span
            key={i}
            onClick={() => onOpenDictionary?.(token)}
            title={`點擊查詢 '${token}' 字典釋義與音標`}
            className={`cursor-pointer rounded px-0.5 transition-colors underline-offset-4 ${hoverStyles}`}
          >
            {token}
          </span>
        );
      });
    }

    const escapedQ = escapeRegExp(q);
    const regex = new RegExp(`(${escapedQ})`, 'gi');
    const parts = subtitle.english.split(regex);

    return parts.map((part, partIdx) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return (
          <mark
            key={`match-${partIdx}`}
            onClick={() => onOpenDictionary?.(part)}
            title={`【搜尋相符關鍵字】'${part}'（點擊可查字典）`}
            className="bg-amber-300 text-slate-950 font-bold border-b-2 border-amber-600 rounded px-1 py-0.5 shadow-sm cursor-pointer mx-0.5 inline-block"
          >
            {part}
          </mark>
        );
      }

      const tokens = part.split(/(\s+|[^\w'])/);
      return tokens.map((token, tokenIdx) => {
        const isWord = /^[a-zA-Z0-9'-]+$/.test(token) && token.length > 1;
        if (!isWord) return token;

        return (
          <span
            key={`token-${partIdx}-${tokenIdx}`}
            onClick={() => onOpenDictionary?.(token)}
            title={`點擊查詢 '${token}' 字典釋義`}
            className={`cursor-pointer rounded px-0.5 transition-colors underline-offset-4 ${hoverStyles}`}
          >
            {token}
          </span>
        );
      });
    });
  };

  // Render Traditional Chinese text with search query highlighting
  const renderChineseText = () => {
    const q = searchQuery ? searchQuery.trim() : '';
    if (!q || !subtitle.traditionalChinese) {
      return subtitle.traditionalChinese;
    }

    const escapedQ = escapeRegExp(q);
    const regex = new RegExp(`(${escapedQ})`, 'gi');
    const parts = subtitle.traditionalChinese.split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return (
          <mark
            key={i}
            className="bg-amber-300 text-slate-950 font-bold border-b-2 border-amber-600 rounded px-1 py-0.5 shadow-sm mx-0.5 inline-block"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const fontSizeClasses = {
    small: 'text-base sm:text-lg',
    medium: 'text-lg sm:text-xl',
    large: 'text-xl sm:text-2xl',
  }[fontSize];

  // Dynamic theme style definitions
  const cardBgClass =
    theme === 'paper'
      ? `bg-[#FFFDF7] text-[#3B2E1E] ${
          isLatest
            ? 'border-amber-600 ring-2 ring-amber-500/30 shadow-amber-900/10'
            : 'border-[#E8D8B8] hover:border-[#D8C49E]'
        }`
      : theme === 'light'
      ? `bg-white text-slate-900 ${
          isLatest
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10'
            : 'border-slate-200 hover:border-slate-300'
        }`
      : `bg-slate-800 text-slate-100 ${
          isLatest
            ? 'border-blue-500/80 ring-2 ring-blue-500/30 shadow-blue-500/10'
            : 'border-slate-700/60 hover:border-slate-600'
        }`;

  const timestampBg =
    theme === 'paper'
      ? 'bg-[#F4EAD5] text-[#5C4830]'
      : theme === 'light'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-slate-700/80 text-slate-300';

  const tagBg =
    theme === 'paper'
      ? 'bg-amber-100/90 text-amber-900 font-medium'
      : theme === 'light'
      ? 'bg-emerald-50 text-emerald-700 font-medium'
      : 'bg-emerald-950/40 text-emerald-300 font-medium';

  const bookmarkBtnClass = subtitle.bookmarked
    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-300'
    : theme === 'paper'
    ? 'bg-[#F4EAD5] hover:bg-[#E8D8B8] text-[#5C4830] border border-[#E0CFAB]'
    : theme === 'light'
    ? 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200'
    : 'bg-slate-800 hover:bg-amber-950/40 text-slate-300 hover:text-amber-400 border border-slate-700';

  const speakBtnClass = isSpeaking
    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-2 ring-rose-400 shadow-rose-500/30'
    : theme === 'paper'
    ? 'bg-amber-700 hover:bg-amber-800 text-white border border-amber-800 shadow-amber-900/20'
    : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/80 shadow-blue-500/25';

  const englishTextClass =
    theme === 'paper'
      ? 'text-[#2C2115] font-medium leading-relaxed font-serif sm:font-sans'
      : theme === 'light'
      ? 'text-slate-800 font-medium leading-relaxed'
      : 'text-slate-100 font-medium leading-relaxed';

  const chineseTextClass =
    theme === 'paper'
      ? 'text-[#8B4513] font-semibold leading-relaxed'
      : theme === 'light'
      ? 'text-blue-700 font-semibold leading-relaxed'
      : 'text-blue-300 font-semibold leading-relaxed';

  const bulletDotClass =
    theme === 'paper'
      ? 'bg-[#8B4513]'
      : 'bg-blue-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl p-4 sm:p-5 shadow-sm border transition-all hover:shadow-md relative group ${cardBgClass}`}
    >
      {/* Bookmark Index Tab (Pinned on Top-Left Corner Edge, Page-Flag Style) */}
      {segmentNumber !== undefined && (
        <div className={`absolute -top-3 left-1.5 z-10 inline-flex items-center gap-1 font-mono font-extrabold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-t-md rounded-br-md shadow-md border-t border-x select-none tracking-tight ${
          theme === 'paper'
            ? 'bg-amber-800 text-amber-100 border-amber-700'
            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-400/50'
        }`}>
          <Tag className="w-2.5 h-2.5 shrink-0 opacity-80" />
          #{segmentNumber} 段落
        </div>
      )}

      {/* Top Bar: Timestamp & Action Buttons */}
      <div className="flex items-center justify-between mb-3 text-xs opacity-90">
        <div className="flex items-center gap-2 flex-wrap">
          {isLatest && (
            <span className="inline-flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-600 border border-red-500/30 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
              即時廣播
            </span>
          )}

          <span className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-full ${timestampBg}`}>
            <Clock className="w-3 h-3 text-amber-600 dark:text-blue-400" />
            {subtitle.createdAt
              ? new Date(subtitle.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
              : subtitle.timestamp}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${tagBg}`}>
            <Zap className="w-3 h-3 text-emerald-500" />
            本機即時翻譯
          </span>
        </div>

        <div className="flex items-center gap-3.5 sm:gap-4">
          {onBookmarkToggle && (
            <button
              onClick={() => onBookmarkToggle(subtitle.id)}
              title={subtitle.bookmarked ? '已收藏 (點擊取消)' : '收藏此句'}
              className={`w-11 h-11 sm:w-13 sm:h-12 rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95 ${bookmarkBtnClass}`}
            >
              {subtitle.bookmarked ? (
                <BookmarkCheck className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              ) : (
                <Bookmark className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          )}

          {/* Equal-sized Audio Speak / Playback Button (Icon-only) */}
          <button
            onClick={handleSpeak}
            title={isSpeaking ? '按一下停止朗讀' : '全句英文朗讀 (English TTS)'}
            className={`w-11 h-11 sm:w-13 sm:h-12 rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95 ${speakBtnClass}`}
          >
            {isSpeaking ? (
              <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        </div>
      </div>

      {/* English Original Transcript with Clickable Words & Search Highlighting */}
      <div className="mb-2">
        <p className={`${englishTextClass} ${fontSizeClasses}`}>
          {renderEnglishText()}
        </p>
      </div>

      {/* Traditional Chinese Translation with Search Highlighting */}
      <div className="pt-1 flex items-start gap-2">
        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${bulletDotClass}`}></div>
        <p className={`${chineseTextClass} ${fontSizeClasses}`}>
          {renderChineseText()}
        </p>
      </div>
    </motion.div>
  );
};
