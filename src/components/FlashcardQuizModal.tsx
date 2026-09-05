import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Volume2,
  VolumeX,
  RotateCw,
  CheckCircle2,
  HelpCircle,
  Trophy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Tag,
  Gauge
} from 'lucide-react';
import { speakText, stopSpeech } from '../utils/tts';
import { lookupQuickWord } from '../utils/quickDictionary';
import { convertChinese, ChineseVariant } from '../utils/chineseConverter';
import { getWordDifficulty } from '../utils/cefrDifficulty';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  words: string[];
  theme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  asyncWordTranslations?: Record<string, string>;
}

export const FlashcardQuizModal: React.FC<Props> = ({
  isOpen,
  onClose,
  words,
  theme = 'dark',
  chineseVariant = 'traditional',
  asyncWordTranslations = {},
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [shuffledWords, setShuffledWords] = useState<string[]>(words);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [reviewWords, setReviewWords] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  // Sync and reset when opened or words changed
  React.useEffect(() => {
    if (isOpen) {
      setShuffledWords([...words]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnownWords(new Set());
      setReviewWords(new Set());
      setIsCompleted(false);
    }
  }, [isOpen, words]);

  const handleShuffle = () => {
    const shuffled = [...shuffledWords].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const currentWord = shuffledWords[currentIndex] || '';
  const quickInfo = useMemo(() => lookupQuickWord(currentWord), [currentWord]);
  const diffInfo = useMemo(() => getWordDifficulty(currentWord), [currentWord]);
  const rawZh = quickInfo?.zh || asyncWordTranslations[currentWord] || '英語廣播常用生詞';
  const zhTranslation = chineseVariant === 'simplified' ? convertChinese(rawZh, 'simplified') : rawZh;

  const handleSpeak = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentWord) return;
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      speakText(
        currentWord,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false),
        speechRate
      );
    }
  };

  const handleMarkKnown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setKnownWords((prev) => new Set(prev).add(currentWord));
    moveToNext();
  };

  const handleMarkReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReviewWords((prev) => new Set(prev).add(currentWord));
    moveToNext();
  };

  const moveToNext = () => {
    setIsFlipped(false);
    if (currentIndex + 1 < shuffledWords.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const moveToPrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleToggleRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeechRate((prev) => (prev === 1.0 ? 0.75 : prev === 0.75 ? 0.5 : 1.0));
  };

  if (!isOpen) return null;

  const total = shuffledWords.length;
  const progressPercent = total > 0 ? Math.round(((currentIndex + (isCompleted ? 1 : 0)) / total) * 100) : 0;

  const modalBg =
    theme === 'paper'
      ? 'bg-[#FDF8EE] text-[#2C2115] border-[#D8C49E]'
      : theme === 'light'
      ? 'bg-white text-slate-900 border-slate-200'
      : 'bg-slate-900 text-slate-100 border-slate-700';

  const cardBg =
    theme === 'paper'
      ? 'bg-[#FFFDF7] border-[#C8B282] shadow-amber-900/10'
      : theme === 'light'
      ? 'bg-slate-50 border-slate-300 shadow-slate-300/30'
      : 'bg-slate-800/90 border-slate-700 shadow-black/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.2 }}
        className={`w-full max-w-lg rounded-3xl p-4 sm:p-6 shadow-2xl border flex flex-col max-h-[92vh] ${modalBg}`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              🎴
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
                單字翻卡測驗
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {total} 詞
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShuffle}
              title="隨機洗牌"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="關閉測驗"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="py-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs font-mono font-bold mb-1 opacity-80">
            <span>進度：第 {Math.min(currentIndex + 1, total)} / {total} 題</span>
            <span>已熟記: {knownWords.size} · 待複習: {reviewWords.size}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card Body / Completion Screen */}
        {isCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-4xl shadow-inner">
              <Trophy className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black">🎉 測驗完成！</h3>
            <p className="text-sm opacity-80 max-w-xs">
              你已完成本輪生詞翻卡記憶測驗！
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs pt-2">
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <div className="text-2xl font-black">{knownWords.size}</div>
                <div className="text-xs font-bold mt-0.5">已熟記單字</div>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400">
                <div className="text-2xl font-black">{reviewWords.size}</div>
                <div className="text-xs font-bold mt-0.5">需再加強</div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setIsCompleted(false);
                  setKnownWords(new Set());
                  setReviewWords(new Set());
                }}
                className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer transition-all active:scale-95"
              >
                再測驗一次
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
              >
                結束返回
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between py-2 min-h-[300px]">
            {/* Interactive Flashcard with Flip Action */}
            <div
              onClick={() => setIsFlipped((prev) => !prev)}
              className={`flex-1 rounded-3xl p-6 sm:p-8 border-2 flex flex-col justify-between cursor-pointer transition-all shadow-lg select-none relative overflow-hidden group hover:scale-[1.01] ${cardBg}`}
            >
              {/* Card Top Pill: Difficulty Level & Speed */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {diffInfo && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${diffInfo.badgeColor}`}>
                      {diffInfo.level} · {diffInfo.label}
                    </span>
                  )}
                  {quickInfo?.phonetic && (
                    <span className="text-xs font-mono font-bold opacity-70">
                      /{quickInfo.phonetic}/
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={handleToggleRate}
                    title="切換發音語速"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Gauge className="w-3 h-3 opacity-75" />
                    <span>{speechRate}x</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSpeak}
                    title="播放單字發音"
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Card Content (Front = English Word, Back = Chinese Definition) */}
              <div className="my-auto py-6 text-center">
                {!isFlipped ? (
                  <motion.div
                    key="front"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <h1 className="text-3xl sm:text-4xl font-black tracking-wide mb-2 text-emerald-600 dark:text-emerald-400">
                      {currentWord}
                    </h1>
                    <p className="text-xs opacity-60 flex items-center justify-center gap-1 mt-4">
                      <RotateCw className="w-3.5 h-3.5" />
                      點擊卡片翻面看中文釋義
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="back"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">
                      中文釋義
                    </div>
                    <p className="text-xl sm:text-2xl font-bold leading-relaxed">
                      {zhTranslation}
                    </p>
                    <p className="text-xs opacity-60 flex items-center justify-center gap-1 mt-4">
                      <RotateCw className="w-3.5 h-3.5" />
                      點擊卡片翻回正面
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Hint footer */}
              <div className="text-center text-[11px] opacity-50">
                {isFlipped ? '請評估記憶程度選擇下方按鈕' : '可點擊右上角喇叭聆聽標準發音'}
              </div>
            </div>

            {/* Bottom Evaluation Action Buttons */}
            <div className="flex items-center gap-3 pt-4 shrink-0">
              <button
                type="button"
                onClick={handleMarkReview}
                className="flex-1 py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <HelpCircle className="w-4 h-4" />
                <span>還不熟 (待複習)</span>
              </button>

              <button
                type="button"
                onClick={handleMarkKnown}
                className="flex-1 py-3 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>記住了 (已掌握)</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
