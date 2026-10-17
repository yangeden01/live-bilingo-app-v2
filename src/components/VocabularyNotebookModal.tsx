import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookMarked,
  Volume2,
  Trash2,
  Search,
  Plus,
  RotateCcw,
  Sparkles,
  BookOpen,
  Eye,
  EyeOff,
  Layers,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { speakText, stopSpeech } from '../utils/tts';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { lookupQuickWord } from '../utils/quickDictionary';
import { getWordDifficulty } from '../utils/cefrDifficulty';
import { convertChinese, ChineseVariant } from '../utils/chineseConverter';
import { translateEnglishToChinese } from '../utils/clientTranslation';
import { FlashcardQuizModal } from './FlashcardQuizModal';
import { vibrateDetentTick } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light' | 'paper';
  chineseVariant?: ChineseVariant;
  onOpenDictionary?: (word?: string) => void;
}

export interface CachedWordTranslation {
  zh: string;
  pos?: string;
  def?: string;
  example?: string;
}

const DEFAULT_SAMPLE_WORDS = [
  'transit',
  'commute',
  'infrastructure',
  'emissions',
  'climate',
  'resilience',
  'forecast',
  'community',
  'breezes',
  'factor',
];

export const VocabularyNotebookModal: React.FC<Props> = ({
  isOpen,
  onClose,
  theme = 'dark',
  chineseVariant = 'traditional',
  onOpenDictionary,
}) => {
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try {
      const saved = getPersistentItem('saved_dict_words');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [cachedTranslations, setCachedTranslations] = useState<Record<string, CachedWordTranslation>>(() => {
    try {
      const raw = getPersistentItem('vocab_translations_cache');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [newWordInput, setNewWordInput] = useState('');
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [showChinese, setShowChinese] = useState(true);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<'newest' | 'alpha' | 'difficulty'>('newest');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Synchronize savedWords and cachedTranslations from persistentStorage
  useEffect(() => {
    const syncData = () => {
      try {
        const saved = getPersistentItem('saved_dict_words');
        setSavedWords(saved ? JSON.parse(saved) : []);
      } catch (e) {
        setSavedWords([]);
      }
      try {
        const rawCache = getPersistentItem('vocab_translations_cache');
        if (rawCache) {
          setCachedTranslations(JSON.parse(rawCache));
        }
      } catch (e) {}
    };

    if (isOpen) {
      syncData();
    }

    window.addEventListener('storage', syncData);
    window.addEventListener('focus', syncData);
    return () => {
      window.removeEventListener('storage', syncData);
      window.removeEventListener('focus', syncData);
      stopSpeech();
      setSpeakingWord(null);
    };
  }, [isOpen]);

  // Background auto-resolver for missing vocabulary translations
  useEffect(() => {
    if (!isOpen || savedWords.length === 0) return;

    const wordsNeedingTranslation = savedWords.filter((w) => {
      const clean = w.toLowerCase().trim();
      if (!clean) return false;
      const builtin = lookupQuickWord(clean);
      if (builtin?.zh) return false;
      if (cachedTranslations[clean]?.zh) return false;
      return true;
    });

    if (wordsNeedingTranslation.length === 0) return;

    let isCancelled = false;

    const fetchMissing = async () => {
      let hasChanges = false;
      const updatedCache = { ...cachedTranslations };

      for (const w of wordsNeedingTranslation) {
        if (isCancelled) break;
        const clean = w.toLowerCase().trim();
        try {
          const zh = await translateEnglishToChinese(clean);
          if (zh && !isCancelled) {
            updatedCache[clean] = {
              zh,
              pos: '詞彙',
            };
            hasChanges = true;

            // Attempt fast Datamuse query for POS & definition
            try {
              const dmRes = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(clean)}&md=dp&max=1`);
              if (dmRes.ok) {
                const dmList = await dmRes.json();
                if (dmList && dmList[0]?.defs?.[0]) {
                  const [pRaw, dText] = dmList[0].defs[0].split('\t');
                  const posMap: Record<string, string> = { n: '名詞', v: '動詞', adj: '形容詞', adv: '副詞', u: '詞彙' };
                  if (updatedCache[clean]) {
                    updatedCache[clean].pos = posMap[pRaw.trim()] || `${pRaw.trim()}.`;
                    if (dText) updatedCache[clean].def = dText.trim();
                  }
                }
              }
            } catch (e) {}

            setCachedTranslations({ ...updatedCache });
            try {
              setPersistentItem('vocab_translations_cache', JSON.stringify(updatedCache));
            } catch (e) {}
          }
        } catch (e) {
          console.warn('Failed to resolve word meaning for', clean, e);
        }
      }
    };

    fetchMissing();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, savedWords, cachedTranslations]);

  const updateStoredWords = (newWords: string[]) => {
    setSavedWords(newWords);
    try {
      setPersistentItem('saved_dict_words', JSON.stringify(newWords));
      setTimeout(() => {
        window.dispatchEvent(new Event('storage'));
      }, 0);
    } catch (e) {}
  };

  const handleAddWord = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newWordInput.trim().toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    if (!clean) return;

    if (savedWords.some((w) => w.toLowerCase() === clean)) {
      setNewWordInput('');
      return;
    }

    vibrateDetentTick();
    const updated = [clean, ...savedWords.filter((w) => w.toLowerCase() !== clean)];
    updateStoredWords(updated);
    setNewWordInput('');

    // Instant pronunciation on add
    speakText(
      clean,
      () => setSpeakingWord(clean),
      () => setSpeakingWord(null),
      () => setSpeakingWord(null)
    );
  };

  const handleDeleteWord = (wordToDelete: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    vibrateDetentTick();
    const updated = savedWords.filter((w) => w.toLowerCase() !== wordToDelete.toLowerCase());
    updateStoredWords(updated);
  };

  const handleClearAll = () => {
    vibrateDetentTick();
    updateStoredWords([]);
    setShowClearConfirm(false);
  };

  const handleLoadSampleWords = () => {
    vibrateDetentTick();
    const merged = Array.from(new Set([...savedWords, ...DEFAULT_SAMPLE_WORDS]));
    updateStoredWords(merged);
  };

  const handleSpeak = (word: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (speakingWord === word) {
      stopSpeech();
      setSpeakingWord(null);
    } else {
      stopSpeech();
      speakText(
        word,
        () => setSpeakingWord(word),
        () => setSpeakingWord(null),
        () => setSpeakingWord(null)
      );
    }
  };

  const toggleRevealWord = (word: string) => {
    setRevealedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  // Filtered and sorted words
  const processedWords = useMemo(() => {
    let list = [...savedWords];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((w) => {
        const clean = w.toLowerCase().trim();
        const quick = lookupQuickWord(clean);
        const cached = cachedTranslations[clean];
        return (
          clean.includes(q) ||
          (quick?.zh && quick.zh.toLowerCase().includes(q)) ||
          (quick?.def && quick.def.toLowerCase().includes(q)) ||
          (cached?.zh && cached.zh.toLowerCase().includes(q))
        );
      });
    }

    if (sortMode === 'alpha') {
      list.sort((a, b) => a.localeCompare(b));
    } else if (sortMode === 'difficulty') {
      const diffRank: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, TOEIC: 4.5, C1: 5, C2: 6 };
      list.sort((a, b) => {
        const diffA = getWordDifficulty(a)?.level || '';
        const diffB = getWordDifficulty(b)?.level || '';
        return (diffRank[diffB] || 0) - (diffRank[diffA] || 0);
      });
    }
    return list;
  }, [savedWords, searchQuery, sortMode, cachedTranslations]);

  const flashcardTranslationMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(cachedTranslations) as [string, CachedWordTranslation][]) {
      if (v?.zh) map[k] = v.zh;
    }
    return map;
  }, [cachedTranslations]);

  if (!isOpen) return null;

  const isLightOrPaper = theme === 'light' || theme === 'paper';

  const modalBgClass =
    theme === 'paper'
      ? 'bg-[#FAF4E8] text-[#09090B] border-[#D6C49F]'
      : theme === 'light'
      ? 'bg-white text-[#09090B] border-slate-200'
      : 'bg-slate-900 text-white border-slate-800';

  const cardItemBg =
    theme === 'paper'
      ? 'bg-[#FFFDF7] border-[#E2D2B0] shadow-sm hover:border-amber-400'
      : theme === 'light'
      ? 'bg-slate-50 border-slate-200 shadow-sm hover:border-indigo-300'
      : 'bg-slate-850 border-slate-750 shadow-sm hover:border-indigo-500/50';

  const formatZh = (text?: string) => {
    if (!text) return '';
    return chineseVariant === 'simplified' ? convertChinese(text, 'simplified') : text;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden z-10 ${modalBgClass}`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isLightOrPaper
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                }`}
              >
                <BookMarked className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">生字本</h2>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      isLightOrPaper
                        ? 'bg-amber-100 text-[#09090B] border-amber-300'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    共 {savedWords.length} 個生詞
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  收藏單字、例句釋義與真人發音，隨時啟動測試卡複習
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Flashcard Quiz Action Button */}
              <button
                type="button"
                onClick={() => {
                  vibrateDetentTick();
                  if (savedWords.length === 0) {
                    handleLoadSampleWords();
                  }
                  setIsQuizOpen(true);
                }}
                title="啟動測試卡翻牌測驗 (Flashcard Quiz)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>測試卡</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Controls Bar: Search & Quick Add */}
          <div className="p-3 sm:p-4 border-b border-black/5 dark:border-white/5 space-y-2.5 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
            {/* Quick Add Form */}
            <form onSubmit={handleAddWord} className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={newWordInput}
                  onChange={(e) => setNewWordInput(e.target.value)}
                  placeholder="快速新增單字（例如：resilience）..."
                  className={`w-full pl-3 pr-8 py-2 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 font-medium ${
                    isLightOrPaper
                      ? 'bg-white text-[#09090B] border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                      : 'bg-slate-800 text-white border-slate-700 focus:border-indigo-400 focus:ring-indigo-400/20'
                  }`}
                />
                {newWordInput && (
                  <button
                    type="button"
                    onClick={() => setNewWordInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!newWordInput.trim()}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm shrink-0 cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增</span>
              </button>
            </form>

            {/* Filter & Options Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋生詞或中文..."
                  className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border focus:outline-none ${
                    isLightOrPaper
                      ? 'bg-white text-[#09090B] border-slate-200 focus:border-indigo-400'
                      : 'bg-slate-800 text-white border-slate-700 focus:border-indigo-400'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Toggle Chinese & Sort */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowChinese((prev) => !prev)}
                  title={showChinese ? '隱藏中文釋義（自我默背模式）' : '顯示中文釋義'}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                    isLightOrPaper
                      ? showChinese
                        ? 'bg-white text-[#09090B] border-slate-300 hover:bg-slate-100'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                      : showChinese
                      ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {showChinese ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{showChinese ? '遮蔽中文' : '顯示中文'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSortMode((prev) => (prev === 'newest' ? 'alpha' : prev === 'alpha' ? 'difficulty' : 'newest'));
                  }}
                  title="切換排序方式"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                    isLightOrPaper
                      ? 'bg-white text-[#09090B] border-slate-300 hover:bg-slate-100'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortMode === 'newest' ? '最新' : sortMode === 'alpha' ? 'A-Z' : '難度'}</span>
                </button>

                {savedWords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    title="清空生字本"
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clear Confirmation Prompt */}
          {showClearConfirm && (
            <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>確定要清空所有 {savedWords.length} 個已收藏生字嗎？此動作無法復原。</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-md text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
                >
                  確定清空
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Word List Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[220px]">
            {savedWords.length === 0 ? (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border ${
                    isLightOrPaper
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  }`}
                >
                  <BookMarked className="w-7 h-7" />
                </div>
                <h3 className="text-sm sm:text-base font-black mb-1">生字本目前是空的</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
                  在影片字幕或字典中點擊書籤圖示 🔖 即可加入生字本，或點擊下方按鈕預載精選英語生詞立即體驗測試卡！
                </p>
                <button
                  type="button"
                  onClick={handleLoadSampleWords}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>載入精選廣播生詞（10 個）</span>
                </button>
              </div>
            ) : processedWords.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                找不到符合「{searchQuery}」的生詞。
              </div>
            ) : (
              processedWords.map((word) => {
                const cleanWord = word.toLowerCase().trim();
                const quick = lookupQuickWord(cleanWord);
                const cached = cachedTranslations[cleanWord];
                const diff = getWordDifficulty(cleanWord);
                const rawZh = quick?.zh || cached?.zh || '';
                const posText = quick?.pos || cached?.pos || '';
                const exampleText = quick?.example || cached?.example || '';
                const zhText = rawZh ? formatZh(rawZh) : '';
                const isRevealed = showChinese || revealedWords.has(word);
                const isSpeakingCurrent = speakingWord === word;

                return (
                  <div
                    key={word}
                    className={`rounded-xl p-3 sm:p-3.5 border transition-all duration-150 flex flex-col gap-1.5 ${cardItemBg}`}
                  >
                    {/* Top Row: Word, CEFR, Phonetic, Pronounce, Dict, Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-black text-sm sm:text-base tracking-tight text-indigo-700 dark:text-indigo-400">
                          {word}
                        </span>

                        {quick?.phonetic && (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {quick.phonetic}
                          </span>
                        )}

                        {diff?.level && (
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                              diff.level.startsWith('A')
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : diff.level.startsWith('B')
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                : diff.level === 'TOEIC'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {diff.level}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Audio Speak */}
                        <button
                          type="button"
                          onClick={(e) => handleSpeak(word, e)}
                          title="真人語音標準發音"
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-90 ${
                            isSpeakingCurrent
                              ? 'bg-blue-600 text-white border-blue-600 animate-pulse ring-2 ring-blue-400'
                              : isLightOrPaper
                              ? 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'
                              : 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Open in full Dictionary */}
                        {onOpenDictionary && (
                          <button
                            type="button"
                            onClick={() => {
                              vibrateDetentTick();
                              onOpenDictionary(word);
                            }}
                            title="查閱完整英漢字典與例句"
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isLightOrPaper
                                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-indigo-400'
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Word */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteWord(word, e)}
                          title="自生字本移除"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Chinese Meaning & Examples */}
                    <div
                      onClick={() => !showChinese && toggleRevealWord(word)}
                      className={`text-xs transition-all ${
                        !showChinese && !isRevealed
                          ? 'cursor-pointer select-none bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-500 flex items-center justify-between'
                          : ''
                      }`}
                    >
                      {!showChinese && !isRevealed ? (
                        <>
                          <span className="italic">點擊揭示中文釋義（自測練習）</span>
                          <Eye className="w-3 h-3 text-slate-400" />
                        </>
                      ) : (
                        <div className="space-y-1">
                          {rawZh ? (
                            <p className={`font-bold ${isLightOrPaper ? 'text-[#09090B]' : 'text-slate-200'}`}>
                              {posText && <span className="font-mono text-[11px] text-slate-400 mr-1.5">[{posText}]</span>}
                              {zhText}
                            </p>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-500/80 dark:text-indigo-400/80 py-0.5">
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                              <span className="text-[11px] font-medium">正在解析中文字義...</span>
                            </div>
                          )}
                          {exampleText && (
                            <p className="text-[11px] italic text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-indigo-400/50">
                              "{exampleText}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-3 sm:p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              提示：生字本即時同步所有字典收藏與測驗進度
            </span>
            <button
              type="button"
              onClick={() => {
                vibrateDetentTick();
                if (savedWords.length === 0) {
                  handleLoadSampleWords();
                }
                setIsQuizOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>啟動單字測試卡 ({savedWords.length})</span>
            </button>
          </div>
        </motion.div>

        {/* Embedded Flashcard Quiz Modal */}
        <FlashcardQuizModal
          isOpen={isQuizOpen}
          onClose={() => setIsQuizOpen(false)}
          words={savedWords}
          theme={theme}
          chineseVariant={chineseVariant}
          asyncWordTranslations={flashcardTranslationMap}
        />
      </div>
    </AnimatePresence>
  );
};
