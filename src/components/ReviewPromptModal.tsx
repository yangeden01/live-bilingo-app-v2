import React, { useState, useEffect } from 'react';
import { Star, Heart, X, Sparkles, ExternalLink } from 'lucide-react';
import { ReviewManager } from '../utils/reviewManager';

export const ReviewPromptModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setSelectedRating(5);
    };

    window.addEventListener('SHOW_WEB_REVIEW_MODAL', handleOpen);
    return () => window.removeEventListener('SHOW_WEB_REVIEW_MODAL', handleOpen);
  }, []);

  const handleGoToStore = () => {
    ReviewManager.openPlayStoreReview();
    setIsOpen(false);
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          aria-label="關閉"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/20 mb-4 ring-4 ring-amber-500/10">
          <Heart className="w-8 h-8 text-white fill-current animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>英語學習的好夥伴</span>
        </div>

        <h3 className="text-xl font-black text-white tracking-tight mb-2">
          喜歡 Live Bilingo 嗎？
        </h3>

        <p className="text-xs text-stone-300 leading-relaxed mb-5 px-1">
          您的寶貴 5 星好評，是我們持續優化 YouTube 雙語字幕、即時精準斷句與免費學習資源的最大動力！
        </p>

        {/* 5 Stars Interactive Selector */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setSelectedRating(star)}
              className="p-1 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
              title={`${star} 顆星`}
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  star <= selectedRating
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'text-stone-600'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleGoToStore}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 hover:from-amber-400 to-yellow-500 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Star className="w-4 h-4 fill-current" />
            <span>前往 Google Play 留下好評</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 transition cursor-pointer"
          >
            稍後再說
          </button>
        </div>
      </div>
    </div>
  );
};
