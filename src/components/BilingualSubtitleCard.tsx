import React, { useState, useMemo } from 'react';
import { SubtitleItem } from '../types';
import { Clock, Volume2, VolumeX, Bookmark, BookmarkCheck, Tag, Gauge } from 'lucide-react';
import { speakText, stopSpeech } from '../utils/tts';
import { convertChinese, ChineseVariant } from '../utils/chineseConverter';
import { getWordDifficulty } from '../utils/cefrDifficulty';

interface Props {
  subtitle: SubtitleItem;
  onBookmarkToggle?: (id: string) => void;
  onOpenDictionary?: (word?: string) => void;
  isLatest?: boolean;
  searchQuery?: string;
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  chineseVariant?: ChineseVariant;
  segmentNumber?: number;
  theme?: 'dark' | 'light' | 'paper';
  isInterim?: boolean;
  highlightDifficulty?: boolean;
}

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const BilingualSubtitleCard: React.FC<Props> = ({
  subtitle,
  onBookmarkToggle,
  onOpenDictionary,
  isLatest = false,
  searchQuery = '',
  fontSize = 'small',
  chineseVariant = 'traditional',
  segmentNumber,
  theme = 'dark',
  isInterim = false,
  highlightDifficulty = true,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  const handleToggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate = speechRate === 1.0 ? 0.75 : speechRate === 0.75 ? 0.5 : 1.0;
    setSpeechRate(nextRate);
    if (isSpeaking && subtitle.english) {
      speakText(
        subtitle.english,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false),
        nextRate
      );
    }
  };

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
        () => setIsSpeaking(false),
        speechRate
      );
    }
  };

  // Split english text into interactive words and punctuation tokens
  const wordTokens = useMemo(() => {
    if (!subtitle.english) return [];
    const tokens = subtitle.english.split(/(\s+|[^\w'])/);
    return tokens;
  }, [subtitle.english]);

  // Render English text with search query highlighting, CEFR difficulty badges, and interactive dictionary tokens
  const renderEnglishText = () => {
    const q = searchQuery ? searchQuery.trim() : '';
    const hoverStyles =
      theme === 'paper'
        ? 'hover:bg-amber-200/80 hover:text-amber-950 underline decoration-dotted decoration-amber-600/60'
        : 'hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-dotted decoration-blue-400/50';

    if (!q || !subtitle.english) {
      return wordTokens.map((token, i) => {
        const isWord = /^[a-zA-Z0-9'-]+$/.test(token) && /^[a-zA-Z]/.test(token);
        if (!isWord) return token;

        const diff = highlightDifficulty ? getWordDifficulty(token) : null;

        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDictionary?.(token);
            }}
            title={
              diff
                ? `【${diff.level} ${diff.label}】點擊查詢 '${token}' 字典釋義與音標發音`
                : `點擊查詢 '${token}' 字典釋義與音標發音`
            }
            className={`cursor-pointer rounded px-0.5 transition-all underline-offset-4 ${hoverStyles} ${
              diff ? `font-semibold ${diff.textColor} ${diff.bgColor} border-b-2 border-amber-400/80 rounded-sm mx-0.5` : ''
            }`}
          >
            {token}
            {diff && (
              <sup className="inline-block text-[9px] font-mono font-black ml-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 leading-none align-super select-none">
                {diff.level}
              </sup>
            )}
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
            onClick={(e) => {
              e.stopPropagation();
              onOpenDictionary?.(part);
            }}
            title={`【搜尋相符關鍵字】'${part}'（點擊查字典與發音）`}
            className="bg-amber-300 text-slate-950 font-bold border-b-2 border-amber-600 rounded px-1 py-0.5 shadow-sm cursor-pointer mx-0.5 inline-block"
          >
            {part}
          </mark>
        );
      }

      const tokens = part.split(/(\s+|[^\w'])/);
      return tokens.map((token, tokenIdx) => {
        const isWord = /^[a-zA-Z0-9'-]+$/.test(token) && /^[a-zA-Z]/.test(token);
        if (!isWord) return token;

        const diff = highlightDifficulty ? getWordDifficulty(token) : null;

        return (
          <span
            key={`token-${partIdx}-${tokenIdx}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDictionary?.(token);
            }}
            title={
              diff
                ? `【${diff.level} ${diff.label}】點擊查詢 '${token}' 字典釋義與發音`
                : `點擊查詢 '${token}' 字典釋義與發音`
            }
            className={`cursor-pointer rounded px-0.5 transition-all underline-offset-4 ${hoverStyles} ${
              diff ? `font-semibold ${diff.textColor} ${diff.bgColor} border-b-2 border-amber-400/80 rounded-sm mx-0.5` : ''
            }`}
          >
            {token}
            {diff && (
              <sup className="inline-block text-[9px] font-mono font-black ml-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 leading-none align-super select-none">
                {diff.level}
              </sup>
            )}
          </span>
        );
      });
    });
  };

  // Render Traditional / Simplified Chinese text with search query highlighting
  const renderChineseText = () => {
    const rawChinese = subtitle.traditionalChinese || '';
    const chineseText =
      chineseVariant === 'simplified' ? convertChinese(rawChinese, 'simplified') : rawChinese;
    const q = searchQuery ? searchQuery.trim() : '';
    if (!q || !chineseText) {
      return chineseText;
    }

    const qConverted =
      chineseVariant === 'simplified' ? convertChinese(q, 'simplified') : convertChinese(q, 'traditional');
    const escapedQ = escapeRegExp(qConverted);
    const escapedRawQ = escapeRegExp(q);
    const regex = new RegExp(`(${escapedQ}|${escapedRawQ})`, 'gi');
    const parts = chineseText.split(regex);

    return parts.map((part, i) => {
      if (
        part.toLowerCase() === qConverted.toLowerCase() ||
        part.toLowerCase() === q.toLowerCase()
      ) {
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
    xlarge: 'text-2xl sm:text-3xl font-semibold',
  }[fontSize];

  // Dynamic theme style definitions - Consistent border thickness to prevent layout jumping
  const cardBgClass =
    theme === 'paper'
      ? `bg-[#FFFDF7] text-[#3B2E1E] ${
          isLatest
            ? 'border-amber-600/80 shadow-md shadow-amber-900/10'
            : 'border-[#E8D8B8] hover:border-[#D8C49E]'
        }`
      : theme === 'light'
      ? `bg-white text-slate-900 ${
          isLatest
            ? 'border-blue-600/80 shadow-md shadow-blue-500/10'
            : 'border-slate-200 hover:border-slate-300'
        }`
      : `bg-slate-800 text-slate-100 ${
          isLatest
            ? 'border-blue-500/80 shadow-lg shadow-blue-500/15'
            : 'border-slate-700/60 hover:border-slate-600'
        }`;

  const timestampBg =
    theme === 'paper'
      ? 'bg-[#F4EAD5] text-[#5C4830]'
      : theme === 'light'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-slate-700/80 text-slate-300';

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
      ? 'text-[#2C2115] font-medium leading-relaxed font-sans'
      : theme === 'light'
      ? 'text-slate-800 font-medium leading-relaxed font-sans'
      : 'text-slate-100 font-medium leading-relaxed font-sans';

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
    <div
      className={`rounded-2xl p-3 sm:p-3.5 shadow-sm border transition-[border-color,box-shadow,background-color] duration-300 hover:shadow-md relative group ${cardBgClass}`}
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
      <div className="flex items-center justify-between mb-1.5 text-xs opacity-90">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLatest && !isInterim && (
            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              即時廣播
            </span>
          )}

          {isInterim && (
            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              即時辨識中
            </span>
          )}

          <span className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded-full text-[11px] ${timestampBg}`}>
            <Clock className="w-3 h-3 text-amber-600 dark:text-blue-400" />
            {subtitle.createdAt
              ? new Date(subtitle.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
              : subtitle.timestamp}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Speed Toggle Pill (1.0x / 0.75x / 0.5x) */}
          <button
            type="button"
            onClick={handleToggleSpeed}
            title={`切換朗讀語速（目前：${speechRate}x，點擊切換 0.75x 慢速 / 0.5x 極慢）`}
            className={`h-7 sm:h-8 px-2 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border active:scale-95 select-none ${
              speechRate < 1.0
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 ring-1 ring-amber-400/50 font-black'
                : theme === 'paper'
                ? 'bg-[#F4EAD5] text-[#5C4830] border-[#E0CFAB] hover:bg-[#E8D8B8]'
                : theme === 'light'
                ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Gauge className="w-3 h-3 opacity-75 shrink-0" />
            <span>{speechRate}x</span>
          </button>

          {onBookmarkToggle && (
            <button
              onClick={() => onBookmarkToggle(subtitle.id)}
              title={subtitle.bookmarked ? '已收藏 (點擊取消)' : '收藏此句'}
              className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95 ${bookmarkBtnClass}`}
            >
              {subtitle.bookmarked ? (
                <BookmarkCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current" />
              ) : (
                <Bookmark className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              )}
            </button>
          )}

          {/* Equal-sized Audio Speak / Playback Button */}
          <button
            onClick={handleSpeak}
            title={isSpeaking ? '按一下停止朗讀' : `以 ${speechRate}x 語速朗讀全句 (English TTS)`}
            className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-sm active:scale-95 ${speakBtnClass}`}
          >
            {isSpeaking ? (
              <VolumeX className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>

      {/* English Original Transcript with Clickable Words & Search Highlighting */}
      <div className="mb-1.5">
        <p className={`${englishTextClass} ${fontSizeClasses}`}>
          {renderEnglishText()}
        </p>
      </div>

      {/* Traditional Chinese Translation with Search Highlighting */}
      <div className="pt-0.5 flex items-start gap-2">
        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${bulletDotClass}`}></div>
        <p className={`${chineseTextClass} ${fontSizeClasses}`}>
          {renderChineseText()}
        </p>
      </div>
    </div>
  );
};
