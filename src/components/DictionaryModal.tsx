import React, { useState, useEffect } from 'react';
import { Search, Volume2, BookOpen, X, Sparkles, Copy, Check, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speakText } from '../utils/tts';

import { getApiUrl } from '../utils/apiUrl';

interface DictionaryMeaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
  chineseTranslation?: string;
}

interface DictionaryResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  chineseTranslation?: string;
  meanings: DictionaryMeaning[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialWord?: string;
}

const COMMON_BROADCAST_WORDS = [
  'factor',
  'emissions',
  'climate',
  'transit',
  'commute',
  'forecast',
  'community',
  'infrastructure',
  'breezes',
  'resilience',
];

export const DictionaryModal: React.FC<Props> = ({ isOpen, onClose, initialWord = '' }) => {
  const [searchWord, setSearchWord] = useState(initialWord);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('saved_dict_words') || '[]');
    } catch (e) {
      return [];
    }
  });

  const fetchDefinition = async (wordToSearch: string) => {
    const cleanWord = wordToSearch.trim().toLowerCase().replace(/[^a-z'-]/g, '');
    if (!cleanWord) return;

    setLoading(true);
    setSearchWord(cleanWord);

    try {
      let serverSuccess = false;
      try {
        const res = await fetch(getApiUrl(`/api/dictionary?word=${encodeURIComponent(cleanWord)}`));
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data && data.word) {
            setResult(data);
            serverSuccess = true;
          }
        }
      } catch (serverErr) {
        // server fetch failed, fallback below
      }

      if (!serverSuccess) {
        // Client-side fallback to Free Dictionary API directly
        const clientRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
        if (clientRes.ok) {
          const jsonArr = await clientRes.json();
          const item = jsonArr[0];
          const phonetic = item?.phonetic || item?.phonetics?.find((p: any) => p.text)?.text || '';
          const audioUrl = item?.phonetics?.find((p: any) => p.audio)?.audio || '';

          const meanings: DictionaryMeaning[] = (item?.meanings || []).map((m: any) => ({
            partOfSpeech: m.partOfSpeech || 'n.',
            definition: m.definitions?.[0]?.definition || '',
            example: m.definitions?.[0]?.example || '',
          }));

          // Translate to Traditional Chinese via MyMemory
          let chineseTranslation = '';
          try {
            const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanWord)}&langpair=en|zh-TW`);
            if (transRes.ok) {
              const transJson = await transRes.json();
              chineseTranslation = transJson.responseData?.translatedText || '';
            }
          } catch (e) {
            // ignore
          }

          setResult({
            word: cleanWord,
            phonetic,
            audioUrl,
            chineseTranslation,
            meanings,
          });
        }
      }
    } catch (err) {
      console.error('Dictionary fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialWord) {
      fetchDefinition(initialWord);
    }
  }, [isOpen, initialWord]);

  const handleSpeak = (textToSpeak?: string) => {
    const targetWord = textToSpeak || result?.word;
    if (targetWord) {
      speakText(
        targetWord,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false)
      );
    }
  };

  // Automatically pronounce the original English word when definition result is loaded
  useEffect(() => {
    if (result?.word) {
      handleSpeak(result.word);
    }
  }, [result?.word]);

  const toggleSaveWord = (word: string) => {
    setSavedWords((prev) => {
      const isSaved = prev.includes(word);
      const updated = isSaved ? prev.filter((w) => w !== word) : [...prev, word];
      localStorage.setItem('saved_dict_words', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `${result.word} ${result.phonetic || ''}\n${result.chineseTranslation || ''}\n${result.meanings
      .map((m) => `[${m.partOfSpeech}] ${m.definition}`)
      .join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 rounded-xl">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  隨選即時英語字典
                  <span className="text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    100% 免費無廣告
                  </span>
                </h2>
                <p className="text-xs text-blue-100/80">輕點廣播單字即刻查閱音標與中文釋義</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchDefinition(searchWord);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="輸入英語單字查詢 (例如 factor, emissions)..."
                  value={searchWord}
                  onChange={(e) => setSearchWord(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
              >
                {loading ? '查詢中...' : '查詢'}
              </button>
            </form>

            {/* Quick Word Suggestion Chips */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] shrink-0">廣播高頻詞:</span>
              {COMMON_BROADCAST_WORDS.map((w) => (
                <button
                  key={w}
                  onClick={() => fetchDefinition(w)}
                  className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg text-slate-600 dark:text-slate-300 font-mono text-[11px] shrink-0 transition-colors"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Result Area */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-xs font-medium">正在為您調閱本機免費字典庫與音標...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Word Title & Pronunciation */}
                <div className="flex items-start justify-between bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                        {result.word}
                      </h3>
                      {result.phonetic && (
                        <span className="text-sm font-mono text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded-lg">
                          {result.phonetic}
                        </span>
                      )}
                    </div>

                    {result.chineseTranslation && (
                      <p className="mt-1 text-base font-bold text-slate-700 dark:text-slate-200">
                        {result.chineseTranslation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSpeak}
                      title="真人標準英語語音發音"
                      className={`p-2 rounded-xl border transition-all ${
                        isSpeaking
                          ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleSaveWord(result.word)}
                      title="收藏單字"
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors"
                    >
                      {savedWords.includes(result.word) ? (
                        <BookmarkCheck className="w-4 h-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={handleCopy}
                      title="複製釋義"
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Meanings & Definitions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" /> 詞性與詳細解釋
                  </h4>

                  {result.meanings.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold rounded-md uppercase">
                          {m.partOfSpeech}
                        </span>
                        {m.chineseTranslation && (
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {m.chineseTranslation}
                          </span>
                        )}
                      </div>

                      {m.definition && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          {m.definition}
                        </p>
                      )}

                      {m.example && (
                        <p className="text-[11px] italic text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-indigo-400">
                          "{m.example}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
                <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">請輸入或點擊廣播中的英語單字</p>
                <p className="text-xs text-slate-400 mt-1">完全使用本機免費字典資源，無額外費用</p>
              </div>
            )}
          </div>

          {/* Saved Words Tray Footer */}
          {savedWords.length > 0 && (
            <div className="bg-slate-100 dark:bg-slate-850 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">已收藏單字 ({savedWords.length})</span>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[240px]">
                {savedWords.map((w) => (
                  <button
                    key={w}
                    onClick={() => fetchDefinition(w)}
                    className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40 rounded-full text-[10px] font-mono shrink-0 hover:bg-amber-500/20"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
