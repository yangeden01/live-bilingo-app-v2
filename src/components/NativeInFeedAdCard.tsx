import React, { useState } from 'react';
import { ExternalLink, Sparkles, Star, Award, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface NativeAdItem {
  id: string;
  sponsor: string;
  sponsorBadge: string;
  title: string;
  englishHighlight: string;
  description: string;
  rating: string;
  reviewsCount: string;
  ctaText: string;
  accentColor: string;
  buttonGradient: string;
  linkUrl: string;
  tag: string;
}

const NATIVE_ADS: NativeAdItem[] = [
  {
    id: 'cambly-1',
    sponsor: 'Google Play 精選',
    sponsorBadge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    title: 'Cambly 1對1 外籍母語家教',
    englishHighlight: 'Practice real conversational English with native speakers 24/7.',
    description: '每日 20 分鐘，隨時與歐美外師實戰對話，快速建立英語口說肌肉記憶。',
    rating: '4.8 ★',
    reviewsCount: '24萬則好評',
    ctaText: '免費試聽 15 分鐘',
    accentColor: 'from-amber-500/10 via-orange-500/5 to-transparent',
    buttonGradient: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-600/30',
    linkUrl: 'https://play.google.com/store/apps/details?id=com.cambly.cambly',
    tag: '外師實戰',
  },
  {
    id: 'duolingo-max',
    sponsor: '語言學習熱門',
    sponsorBadge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    title: 'Duolingo Max AI 智能對話',
    englishHighlight: 'Roleplay real-world scenarios with AI-powered personalized feedback.',
    description: '情境模擬點餐、面試與日常閒聊，AI 即時解析文法錯誤並提供範例句子。',
    rating: '4.9 ★',
    reviewsCount: '1,200萬下載',
    ctaText: '免費體驗 7 天',
    buttonGradient: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30',
    accentColor: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    linkUrl: 'https://play.google.com/store/apps/details?id=com.duolingo',
    tag: 'AI 情境互動',
  },
  {
    id: 'voicetube-pro',
    sponsor: '新聞聽力推薦',
    sponsorBadge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    title: 'VoiceTube 雙語看新聞影片學英文',
    englishHighlight: 'Master authentic accents from BBC, CNN & NPR news broadcasts.',
    description: '同步搭配中英逐字對照字幕，內建單句重複播放與口說語速微調。',
    rating: '4.7 ★',
    reviewsCount: '500萬用戶推薦',
    ctaText: '立即下載 App',
    buttonGradient: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30',
    accentColor: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    linkUrl: 'https://play.google.com/store/apps/details?id=org.redso.voicetube',
    tag: '新聞聽力',
  },
  {
    id: 'elsa-speak',
    sponsor: '發音校正神器',
    sponsorBadge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    title: 'ELSA Speak AI 智能口音教練',
    englishHighlight: 'Accurate AI phoneme pronunciation and intonation analyzer.',
    description: '精準辨識連音、重音與音標發音，量身分析發音盲點並給出糾正建議。',
    rating: '4.8 ★',
    reviewsCount: '80萬評論',
    ctaText: '免費測評發音',
    buttonGradient: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/30',
    accentColor: 'from-purple-500/10 via-pink-500/5 to-transparent',
    linkUrl: 'https://play.google.com/store/apps/details?id=us.nobarriers.elsa',
    tag: '口音矯正',
  },
];

interface Props {
  index: number;
  theme?: 'dark' | 'light' | 'paper';
}

export const NativeInFeedAdCard: React.FC<Props> = ({ index, theme = 'dark' }) => {
  const ad = NATIVE_ADS[index % NATIVE_ADS.length];
  const [clicked, setClicked] = useState(false);

  const cardBgClass =
    theme === 'paper'
      ? 'bg-[#FAF3E3] border-[#DFCFB2] text-[#2C2115] shadow-amber-900/5'
      : theme === 'light'
      ? 'bg-gradient-to-br from-slate-50 to-blue-50/30 border-slate-200 text-slate-900 shadow-slate-200/50'
      : 'bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-slate-700/80 text-slate-100 shadow-black/20';

  const handleClick = (e: React.MouseEvent) => {
    setClicked(true);
    // If AndroidBridge exists, can also dispatch or track event
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.openExternalUrl) {
      e.preventDefault();
      try {
        (window as any).AndroidBridge.openExternalUrl(ad.linkUrl);
      } catch (err) {
        window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      className={`rounded-2xl p-3 sm:p-4 border transition-all duration-200 shadow-sm relative overflow-hidden my-2 select-none group ${cardBgClass}`}
    >
      {/* Subtle Background Radial Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${ad.accentColor} opacity-70 pointer-events-none`}
      />

      {/* Top Meta Bar: Ad Flag, Sponsor, Rating */}
      <div className="relative flex items-center justify-between gap-2 mb-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Official Google Play Native Ad Badge */}
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-400/40 tracking-wider shadow-2xs">
            廣告
          </span>

          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${ad.sponsorBadge}`}>
            {ad.sponsor}
          </span>

          <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
            theme === 'paper' ? 'bg-[#EFE3CA] text-[#5C4830]' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}>
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            {ad.tag}
          </span>
        </div>

        {/* Rating & Review Counter */}
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          <Star className="w-3 h-3 fill-current" />
          <span>{ad.rating}</span>
          <span className="text-[10px] opacity-70 font-normal hidden sm:inline">({ad.reviewsCount})</span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="relative">
        <h4 className="text-xs sm:text-sm font-extrabold tracking-tight mb-1 flex items-center gap-1.5">
          <span>{ad.title}</span>
          <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        </h4>

        {/* English Sample Text (matches Bilingual subtitle style) */}
        <div className={`p-2 rounded-xl mb-1.5 text-xs sm:text-[13px] font-medium leading-snug border ${
          theme === 'paper'
            ? 'bg-[#F2E7D0] border-[#E2D2B0] text-[#3B2E1E]'
            : theme === 'light'
            ? 'bg-blue-50/60 border-blue-100 text-blue-950'
            : 'bg-slate-800/80 border-slate-700/60 text-slate-200'
        }`}>
          <div className="flex items-start gap-1.5">
            <span className="text-amber-500 dark:text-amber-400 font-bold shrink-0">“</span>
            <span className="font-sans italic">{ad.englishHighlight}</span>
            <span className="text-amber-500 dark:text-amber-400 font-bold shrink-0">”</span>
          </div>
        </div>

        <p className={`text-[11px] sm:text-xs leading-relaxed mb-3 ${
          theme === 'paper'
            ? 'text-[#6E5A44]'
            : theme === 'light'
            ? 'text-slate-600'
            : 'text-slate-400'
        }`}>
          {ad.description}
        </p>

        {/* Bottom CTA Action Button */}
        <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Google Play 官方認證應用</span>
          </div>

          <a
            href={ad.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap ${ad.buttonGradient}`}
          >
            {clicked ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>已開啟連結</span>
              </>
            ) : (
              <>
                <span>{ad.ctaText}</span>
                <ExternalLink className="w-3 h-3 opacity-90" />
              </>
            )}
          </a>
        </div>
      </div>
    </div>
  );
};
