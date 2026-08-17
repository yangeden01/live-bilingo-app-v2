import React, { useState, useEffect } from 'react';
import { ExternalLink, Info, X } from 'lucide-react';

interface AdContent {
  id: number;
  sponsor: string;
  title: string;
  description: string;
  cta: string;
  badgeBg: string;
  accentColor: string;
  linkUrl: string;
}

const SAMPLE_ADS: AdContent[] = [
  {
    id: 1,
    sponsor: 'Google Play 精選',
    title: 'Cambly 1對1外籍家教',
    description: '每日20分鐘，隨時隨地與母語外師實戰英語對話',
    cta: '免費試聽',
    badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    accentColor: 'from-amber-500/10 to-orange-500/10',
    linkUrl: 'https://play.google.com/store',
  },
  {
    id: 2,
    sponsor: '贊助商廣告',
    title: 'VoiceTube 雙語看影片學英文',
    description: '看新聞短片練聽力，AI 智慧單字庫同步背誦',
    cta: '下載 App',
    badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    accentColor: 'from-blue-500/10 to-cyan-500/10',
    linkUrl: 'https://play.google.com/store',
  },
  {
    id: 3,
    sponsor: '公益贊助',
    title: 'Global Public Radio Foundation',
    description: '支持全球公共新聞廣播，隨時掌握國際新聞第一手動態',
    cta: '了解更多',
    badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    accentColor: 'from-emerald-500/10 to-teal-500/10',
    linkUrl: 'https://play.google.com/store',
  },
];

export const BannerAd: React.FC = () => {
  const [adIndex, setAdIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Auto rotate ad every 12 seconds
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % SAMPLE_ADS.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const currentAd = SAMPLE_ADS[adIndex];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-slate-100/90 dark:bg-slate-850/90 border-t border-slate-200/80 dark:border-slate-800/80 px-3 py-2 relative overflow-hidden transition-all select-none"
    >
      {/* Background Subtle Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${currentAd.accentColor} opacity-50 transition-opacity pointer-events-none`}
      />

      <div className="relative flex items-center justify-between gap-2 max-w-full">
        {/* Left Ad Tag & Info */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 tracking-wider">
            廣告
          </span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            title="廣告資訊"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Ad Content */}
        <a
          href={currentAd.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 flex items-center justify-between gap-3 group cursor-pointer py-0.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-semibold px-1 py-0.2 rounded border ${currentAd.badgeBg}`}>
                {currentAd.sponsor}
              </span>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {currentAd.title}
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {currentAd.description}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-sm transition-all group-hover:scale-105">
            <span>{currentAd.cta}</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </div>
        </a>
      </div>

      {/* Popup Info Dialog if clicked */}
      {showInfo && (
        <div className="absolute inset-0 bg-slate-900/95 text-slate-200 p-2.5 flex items-center justify-between text-xs z-30 animate-fadeIn">
          <div className="flex-1 pr-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-400">Google AdMob 橫幅廣告 (已綁定)</span>
              <span className="text-[10px] font-mono bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                ID: ca-app-pub-7732369001198376/8530309826
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              本 App 為 100% 免費服務，已設置底部非侵入式橫幅廣告以支持伺服器營運。
            </p>
          </div>
          <button
            onClick={() => setShowInfo(false)}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
