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
    <div className={`rounded-2xl border p-2.5 sm:p-3 space-y-2.5 transition-colors ${containerBg}`}>
      {/* Sleek Minimal Toolbar: Live Indicator, Channel Selector & Controls */}
      <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${bannerBg}`}>
        {/* Left: Live Status + Channel Switcher Pill */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>

          <span className="font-semibold text-emerald-400 text-xs shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span className="hidden xs:inline">Groq</span> 即時雙語
          </span>

          {/* Quick Channel Pill Trigger */}
          <button
            type="button"
            onClick={() => setShowChannelDropdown(!showChannelDropdown)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 border shrink-0 ${
              showChannelDropdown
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : isPaper
                ? 'bg-[#E8DAC0] text-[#5C4A32] border-[#D9C4A1] hover:bg-[#DFD0B4]'
                : isLight
                ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="切換 24/7 新聞頻道"
          >
            <Radio className="w-3 h-3 text-blue-400" />
            <span className="font-semibold">{activeChannel.badge}</span>
            <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${showChannelDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border flex items-center gap-1 ${
              autoScroll
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={autoScroll ? '自動滾動：開啟' : '自動滾動：關閉'}
          >
            <ArrowDown className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">滾動</span>
          </button>

          <button
            type="button"
            onClick={onToggleSaveVideo}
            className={`p-1 rounded-lg text-xs transition-colors cursor-pointer border ${
              isSavedVideo
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={isSavedVideo ? '已收藏此直播' : '收藏此直播'}
          >
            <Star className={`w-3.5 h-3.5 ${isSavedVideo ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          {onShowRawCcCard && (
            <button
              type="button"
              onClick={onShowRawCcCard}
              className="px-1.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              title="查看 YouTube 原生 CC 說明"
            >
              <Tv className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">原生 CC</span>
            </button>
          )}

          {liveSubtitles.length > 1 && (
            <button
              type="button"
              onClick={onClearSubtitles}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="清空字幕"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Channel Switcher Bar (Only visible when user toggles) */}
      {showChannelDropdown && (
        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center gap-1.5 animate-fadeIn">
          <span className="text-[11px] text-slate-400 font-medium mr-1">選擇 24/7 直播頻道：</span>
          {YOUTUBE_LIVE_NEWS_CHANNELS.map((ch) => {
            const isSelected = ch.id === activeChannel.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  onSelectChannel(ch);
                  setShowChannelDropdown(false);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
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
      )}

      {/* Subtitles Stream List */}
      <div
        ref={containerRef}
        className="space-y-2.5 max-h-[70vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {liveSubtitles.length === 0 ? (
          <div className="py-10 text-center space-y-2.5">
            <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 animate-pulse">
              <Radio className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold opacity-90">
              正在即時接收 {activeChannel.name} 語音辨識字幕...
            </p>
            <p className="text-[11px] opacity-60 max-w-sm mx-auto">
              Groq Whisper AI 正在切片串流音訊並進行英中對齊，字幕即將自動呈現。
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
      <div className="pt-1.5 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[11px] opacity-60 px-1">
        <span>已接收 {liveSubtitles.length} 筆雙語對齊語句</span>
        <span>點擊英文字詞可即時查詢單字釋義</span>
      </div>
    </div>
  );
};
