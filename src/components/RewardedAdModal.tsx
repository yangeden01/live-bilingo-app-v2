import React, { useState, useEffect } from 'react';
import { RewardType } from '../types';
import { REWARD_FEATURES } from '../utils/adManager';

interface RewardedAdModalProps {
  onRewardEarned?: (type: RewardType) => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({ onRewardEarned }) => {
  const [activeReward, setActiveReward] = useState<RewardType | null>(null);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [canSkip, setCanSkip] = useState(false);
  const [earnedSuccess, setEarnedSuccess] = useState(false);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ rewardType: RewardType }>;
      if (customEvent.detail && customEvent.detail.rewardType) {
        setActiveReward(customEvent.detail.rewardType);
        setIsPlayingAd(false);
        setEarnedSuccess(false);
        setCountdown(15);
        setCanSkip(false);
      }
    };

    window.addEventListener('SHOW_WEB_REWARDED_MODAL', handleOpen);
    return () => window.removeEventListener('SHOW_WEB_REWARDED_MODAL', handleOpen);
  }, []);

  // Ad playback timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingAd && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
        if (countdown <= 10) {
          setCanSkip(true);
        }
      }, 1000);
    } else if (isPlayingAd && countdown === 0) {
      // Completed full ad!
      setEarnedSuccess(true);
      setIsPlayingAd(false);
      if (activeReward) {
        onRewardEarned?.(activeReward);
        window.dispatchEvent(
          new CustomEvent('WEB_REWARDED_AD_RESULT', {
            detail: { success: true, rewardType: activeReward },
          })
        );
      }
    }
    return () => clearTimeout(timer);
  }, [isPlayingAd, countdown, activeReward, onRewardEarned]);

  const handleStartWatch = () => {
    setIsPlayingAd(true);
    setCountdown(15);
    setCanSkip(false);
  };

  const handleCancelOrClose = () => {
    if (activeReward && !earnedSuccess) {
      window.dispatchEvent(
        new CustomEvent('WEB_REWARDED_AD_RESULT', {
          detail: { success: false, rewardType: activeReward },
        })
      );
    }
    setActiveReward(null);
    setIsPlayingAd(false);
    setEarnedSuccess(false);
  };

  const handleSkipAdEarly = () => {
    if (window.confirm('提早跳過廣告將無法獲得獎勵，確定要放棄解鎖嗎？')) {
      handleCancelOrClose();
    }
  };

  if (!activeReward) return null;

  const info = REWARD_FEATURES[activeReward];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* State 1: Reward Info Dialog (Before watching) */}
      {!isPlayingAd && !earnedSuccess && (
        <div className="relative w-full max-w-md bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-3xl shadow-lg mb-4 ring-4 ring-amber-500/20">
            {info.icon}
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            {info.badge}
          </div>

          <h3 className="text-xl font-bold text-stone-100 mb-2 tracking-tight">
            {info.title}
          </h3>

          <p className="text-sm text-stone-300 leading-relaxed mb-6 px-2">
            {info.description}
          </p>

          <div className="w-full bg-stone-800/80 rounded-2xl p-4 border border-stone-700/60 mb-6 flex items-center justify-between text-left">
            <div>
              <div className="text-xs text-stone-400">解鎖福利</div>
              <div className="text-sm font-bold text-amber-400">{info.durationText}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-stone-400">所需條件</div>
              <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                觀看 1 則短片
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2.5">
            <button
              onClick={handleStartWatch}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-base bg-gradient-to-r from-amber-500 hover:from-amber-400 to-yellow-500 text-stone-950 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              觀看廣告立即解鎖
            </button>

            <button
              onClick={handleCancelOrClose}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 transition"
            >
              稍後再說
            </button>
          </div>
        </div>
      )}

      {/* State 2: Full Screen High-Converting Sponsor Video Simulation */}
      {isPlayingAd && (
        <div className="relative w-full max-w-lg aspect-[9/16] sm:aspect-auto sm:h-[620px] bg-stone-950 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {/* Top Header Bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/90 text-stone-950 text-[10px] font-black uppercase tracking-wider">
                贊助短片
              </span>
              <span className="text-xs font-mono text-stone-300 bg-black/50 px-2 py-0.5 rounded-full border border-stone-700">
                {countdown} 秒後獲得獎勵
              </span>
            </div>

            {canSkip ? (
              <button
                onClick={handleSkipAdEarly}
                className="text-xs text-stone-400 hover:text-rose-400 bg-black/60 px-2.5 py-1 rounded-full border border-stone-700 hover:border-rose-500/50 transition"
              >
                放棄跳過 ✕
              </button>
            ) : (
              <span className="text-[11px] text-stone-500">
                {countdown - 10} 秒後可跳過
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-stone-800 absolute top-0 left-0 z-30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-1000 ease-linear"
              style={{ width: `${((15 - countdown) / 15) * 100}%` }}
            />
          </div>

          {/* Ad Creative Visual */}
          <div className="flex-1 relative flex flex-col justify-end p-6 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 text-stone-100 overflow-hidden">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="mb-auto mt-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-4xl shadow-2xl mb-4 border border-white/20">
                🌍
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                ELSA AI 國際英語口說特訓
              </h2>
              <p className="text-xs text-stone-300 max-w-xs leading-relaxed">
                全球超過 5,000 萬用戶推薦！結合母語音頻即時診斷，30 天自信開口說英語。
              </p>
            </div>

            {/* Simulated Live Rating & Proof */}
            <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 backdrop-blur-md mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-black text-amber-400">4.9 ★</div>
                <div className="text-left text-xs text-stone-400 leading-tight">
                  <span className="text-stone-200 font-semibold block">Google Play 編輯推薦</span>
                  超過 100,000+ 五星好評
                </div>
              </div>
              <span className="text-[11px] font-bold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-1 rounded-lg">
                免費體驗
              </span>
            </div>

            {/* Ad Call to Action */}
            <button
              onClick={() => window.open('https://play.google.com/store', '_blank')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 hover:from-sky-400 to-blue-600 text-white font-bold text-sm shadow-xl active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>立即下載了解更多</span>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* State 3: Reward Unlocked Success Celebration */}
      {earnedSuccess && (
        <div className="relative w-full max-w-md bg-stone-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-4xl mb-4 animate-bounce">
            🎉
          </div>

          <h3 className="text-2xl font-black text-white mb-2">
            恭喜解鎖成功！
          </h3>

          <p className="text-sm text-stone-300 leading-relaxed mb-6">
            已為您啟用 <span className="font-bold text-amber-400">{info.title}</span>！
            <br />
            感謝您的觀看與支持，祝您英語學習收穫滿滿！
          </p>

          <button
            onClick={handleCancelOrClose}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition"
          >
            立即開始使用
          </button>
        </div>
      )}
    </div>
  );
};
