import React, { useState, useEffect } from 'react';
import { AdManager } from '../utils/adManager';

export const InterstitialAdModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      // Check VIP status again
      if (AdManager.isVipAdFree()) return;
      setIsOpen(true);
      setCountdown(5);
      setCanClose(false);
    };

    window.addEventListener('SHOW_WEB_INTERSTITIAL', handleOpen);
    return () => window.removeEventListener('SHOW_WEB_INTERSTITIAL', handleOpen);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isOpen && countdown === 0) {
      setCanClose(true);
    }
    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpenVipPass = () => {
    setIsOpen(false);
    AdManager.requestRewardedAd('vip_pass');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg aspect-[9/16] sm:aspect-auto sm:h-[600px] bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-stone-100">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 bg-stone-950/80 border-b border-stone-800/80">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-stone-800 text-stone-300 px-2 py-0.5 rounded border border-stone-700">
              贊助推薦
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!canClose ? (
              <span className="text-xs text-stone-400 font-mono bg-stone-800/80 px-2.5 py-1 rounded-full border border-stone-700">
                {countdown} 秒後可關閉
              </span>
            ) : (
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 flex items-center justify-center font-bold text-sm transition"
                aria-label="關閉廣告"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Ad Body */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-4xl shadow-xl mb-4 border border-white/10">
            🎯
          </div>

          <h3 className="text-2xl font-black text-white tracking-tight mb-2">
            Duolingo 沉浸式語言遊戲
          </h3>

          <p className="text-sm text-stone-300 max-w-xs leading-relaxed mb-6">
            每日 10 分鐘，輕鬆累積 3,000+ 道地生活英語單字與常用句型，全球超過 5 億學員信賴。
          </p>

          <div className="flex items-center gap-4 text-xs text-stone-400 mb-6 bg-stone-900/80 px-4 py-2 rounded-xl border border-stone-800">
            <span>⭐ 4.8 顆星評價</span>
            <span>•</span>
            <span>🏆 最佳學習應用</span>
          </div>

          <button
            onClick={() => window.open('https://play.google.com/store', '_blank')}
            className="w-full max-w-xs py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 shadow-lg active:scale-[0.98] transition mb-3"
          >
            免費安裝體驗
          </button>
        </div>

        {/* VIP Ad-Free Upsell Bottom Strip */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">👑</span>
            <span className="text-xs text-stone-300 font-medium">不想看到插頁廣告？</span>
          </div>
          <button
            onClick={handleOpenVipPass}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/50 border border-amber-800/60 px-3 py-1.5 rounded-lg transition"
          >
            看 1 則短片享 2hr 免廣告
          </button>
        </div>
      </div>
    </div>
  );
};
