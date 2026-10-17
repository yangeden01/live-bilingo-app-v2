import React, { useState } from 'react';
import {
  Radio,
  Sparkles,
  Search,
  Star,
  Tv,
  Info,
  CheckCircle2,
  BookmarkCheck,
  Compass,
} from 'lucide-react';

interface YouTubeLiveStreamCardProps {
  title?: string;
  videoId: string;
  url: string;
  isSaved: boolean;
  onToggleSave: () => void;
  onOpenDictionary?: (word: string) => void;
  onOpenNewsModal?: () => void;
  currentTheme?: 'dark' | 'paper' | 'light';
}

export const YouTubeLiveStreamCard: React.FC<YouTubeLiveStreamCardProps> = ({
  title,
  videoId,
  url,
  isSaved,
  onToggleSave,
  onOpenDictionary,
  onOpenNewsModal,
  currentTheme = 'dark',
}) => {
  const [lookupWord, setLookupWord] = useState('');

  const isLight = currentTheme === 'light';
  const isPaper = currentTheme === 'paper';

  const containerBg = isPaper
    ? 'bg-[#FAF4E8] border-[#E2D2B0] text-[#3B2E1E]'
    : isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
    : 'bg-slate-900/80 border-slate-800 text-white';

  const subBoxBg = isPaper
    ? 'bg-[#F4EBD7]/80 border-[#E2D2B0]'
    : isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-slate-950/60 border-slate-800/80';

  const inputBg = isPaper
    ? 'bg-white border-[#D9C4A1] text-[#3B2E1E]'
    : isLight
    ? 'bg-white border-slate-300 text-slate-900'
    : 'bg-slate-900 border-slate-700 text-white';

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = lookupWord.trim();
    if (word && onOpenDictionary) {
      onOpenDictionary(word);
      setLookupWord('');
    }
  };

  return (
    <div className={`rounded-2xl border p-5 space-y-4 transition-colors ${containerBg}`}>
      {/* Live Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="text-rose-500">🔴 即時新聞直播模式</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                LIVE CC
              </span>
            </h3>
            <p className="text-xs opacity-70">
              {title || 'YouTube 24/7 即時新聞直播串流'}
            </p>
          </div>
        </div>

        {/* Action Button: Bookmark Live Stream */}
        <button
          type="button"
          onClick={onToggleSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isSaved
              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
          }`}
        >
          {isSaved ? (
            <>
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>已收藏此直播</span>
            </>
          ) : (
            <>
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>儲存此直播頻道</span>
            </>
          )}
        </button>
      </div>

      {/* Subtitle Status Banner */}
      <div className={`p-4 rounded-xl border space-y-2 ${subBoxBg}`}>
        <div className="flex items-start gap-2.5">
          <Tv className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-blue-400 flex items-center gap-1.5">
              <span>即時英文字幕 (Live Closed Captions) 運作中</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </p>
            <p className="opacity-80 leading-relaxed">
              此頻道為 24 小時即時新聞直播，官方即時英文字幕由 YouTube 串流技術直接推播，<strong>已於上方影片畫面中自動啟用與同步呈現</strong>。
            </p>
            <p className="opacity-60 text-[11px] leading-relaxed">
              💡 提示：持續進行中的 24 小時直播串流尚未存檔結算，完整的靜態逐句雙語對照表需待直播存檔轉換為一般影片 (VOD) 後提供。
            </p>
          </div>
        </div>
      </div>

      {/* Live Learning Tools: Instant Dictionary Lookup */}
      <div className="pt-1">
        <form onSubmit={handleLookupSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              value={lookupWord}
              onChange={(e) => setLookupWord(e.target.value)}
              placeholder="直播中聽到不懂的單字？輸入英文單字立即查字典..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
            />
          </div>
          <button
            type="submit"
            disabled={!lookupWord.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>查字典</span>
          </button>
        </form>
      </div>

      {/* Suggestion: Switch to VOD News with full dual subtitles */}
      {onOpenNewsModal && (
        <div className="flex items-center justify-between pt-1 text-xs opacity-75">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            想要體驗完整逐句中文翻譯與單句重複播放？
          </span>
          <button
            type="button"
            onClick={onOpenNewsModal}
            className="font-semibold text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>精選雙語新聞影片</span>
          </button>
        </div>
      )}
    </div>
  );
};
