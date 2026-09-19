import React, { useRef, useEffect, useState } from 'react';
import { SubtitleItem, ReadingMode, ChineseVariant, SubtitleFontSize } from '../types';
import { BilingualSubtitleCard } from './BilingualSubtitleCard';
import {
  YouTubeLiveNewsChannel,
  YOUTUBE_LIVE_NEWS_CHANNELS,
} from '../utils/youtubeLiveChannels';
import {
  Radio,
  Sparkles,
  RefreshCw,
  Trash2,
  Tv,
  CheckCircle2,
  ChevronDown,
  Volume2,
  Layers,
  ArrowDown,
  Star,
  ExternalLink,
} from 'lucide-react';

interface YouTubeLiveGroqSubtitlesCardProps {
  videoId?: string;
  url?: string;
  videoTitle?: string;
  isSavedVideo: boolean;
  onToggleSaveVideo: () => void;
  liveSubtitles: SubtitleItem[];
  activeSubtitleId: string | null;
  activeChannel: YouTubeLiveNewsChannel;
  onSelectChannel: (channel: YouTubeLiveNewsChannel) => void;
  isConnected: boolean;
  modelName: string;
  onBookmarkToggle: (id: string) => void;
  onOpenDictionary?: (word?: string) => void;
  onClearSubtitles: () => void;
  readingMode?: ReadingMode;
  chineseVariant?: ChineseVariant;
  fontSize?: SubtitleFontSize;
  currentTheme?: 'dark' | 'paper' | 'light';
  onShowRawCcCard?: () => void;
}

export const YouTubeLiveGroqSubtitlesCard: React.FC<YouTubeLiveGroqSubtitlesCardProps> = ({
  videoId,
  url,
  videoTitle,
  isSavedVideo,
  onToggleSaveVideo,
  liveSubtitles,
  activeSubtitleId,
  activeChannel,
  onSelectChannel,
  isConnected,
  modelName,
  onBookmarkToggle,
  onOpenDictionary,
  onClearSubtitles,
  readingMode = 'system',
  chineseVariant = 'traditional',
  fontSize = 'small',
  currentTheme = 'dark',
  onShowRawCcCard,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [showChannelDropdown, setShowChannelDropdown] = useState<boolean>(false);

  const isLight = currentTheme === 'light';
  const isPaper = currentTheme === 'paper';

  const containerBg = isPaper
    ? 'bg-[#FAF4E8] border-[#E2D2B0] text-[#3B2E1E]'
    : isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-slate-900/90 border-slate-800 text-white';

  const bannerBg = isPaper
    ? 'bg-[#F3E8D0] border-[#E2D2B0]'
    : isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-slate-950/70 border-slate-800/80';

  // Smooth scroll to latest subtitle whenever new subtitles arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const container = containerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [liveSubtitles.length, activeSubtitleId, autoScroll]);

  return (
    <div className={`rounded-2xl border p-4 space-y-4 transition-colors ${containerBg}`}>
      {/* Top Banner: Groq AI Live Status & Channel Switcher */}
      <div className={`p-3.5 rounded-xl border space-y-3 ${bannerBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Groq AI 雙語語音辨識已連線
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {modelName.replace('Groq ', '')}
                </span>
              </div>
              <p className="text-[11px] opacity-70 mt-0.5">
                每 3.5 秒即時對齊串流語音・英中雙語即時呈現
              </p>
            </div>
          </div>

          {/* Controls: Bookmark Video & AutoScroll */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSaveVideo}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isSavedVideo
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isSavedVideo ? 'fill-amber-400 text-amber-400' : ''}`} />
              {isSavedVideo ? '已收藏此直播' : '收藏此直播'}
            </button>

            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                autoScroll
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
              }`}
              title={autoScroll ? '自動滾動開' : '自動滾動關'}
            >
              <ArrowDown className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
              自動滾動
            </button>

            {liveSubtitles.length > 1 && (
              <button
                type="button"
                onClick={onClearSubtitles}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="清空字幕快取"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Channel Switcher Pills */}
        <div className="pt-2 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>目前 Groq 辨識頻道：</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {YOUTUBE_LIVE_NEWS_CHANNELS.map((ch) => {
              const isSelected = ch.id === activeChannel.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelectChannel(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : isPaper
                      ? 'bg-[#EBDDC3] text-[#5C4A32] hover:bg-[#E2D2B0]'
                      : isLight
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{ch.badge}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subtitles Stream List */}
      <div
        ref={containerRef}
        className="space-y-3 max-h-[62vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {liveSubtitles.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 text-blue-400 animate-pulse">
              <Radio className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold opacity-90">
              正在連線至 {activeChannel.name} 音訊串流...
            </p>
            <p className="text-xs opacity-60 max-w-sm mx-auto">
              Groq Whisper AI 正在為您即時切片語音並進行中英雙語對齊翻譯，字幕即將滾動呈現。
            </p>
          </div>
        ) : (
          liveSubtitles.map((subItem, idx) => {
            const isLatest = subItem.id === activeSubtitleId || idx === liveSubtitles.length - 1;
            return (
              <div
                key={subItem.id}
                id={`live-card-${subItem.id}`}
                className={`transition-all duration-200 rounded-2xl ${
                  isLatest
                    ? 'ring-2 ring-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'hover:opacity-95'
                }`}
              >
                <BilingualSubtitleCard
                  subtitle={subItem}
                  onBookmarkToggle={onBookmarkToggle}
                  onOpenDictionary={onOpenDictionary}
                  isLatest={isLatest}
                  fontSize={fontSize}
                  chineseVariant={chineseVariant}
                  segmentNumber={idx + 1}
                  theme={currentTheme}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[11px] opacity-60">
        <span>已擷取 {liveSubtitles.length} 筆雙語對齊語句</span>
        <span>點擊英文字詞可即時查詢單字庫釋義</span>
      </div>
    </div>
  );
};
