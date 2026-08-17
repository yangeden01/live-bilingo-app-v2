import React, { useState, useEffect, useRef } from 'react';
import { Search, Volume2, BookOpen, X, Sparkles, Copy, Check, Bookmark, BookmarkCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speakText, stopSpeech } from '../utils/tts';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';

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

// Clean word of punctuation and casing
function cleanWordToken(token: string): string {
  return token.trim().toLowerCase().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

// Generate base candidates for words with inflection/suffixes
function getWordCandidates(rawWord: string): string[] {
  const clean = cleanWordToken(rawWord);
  if (!clean) return [];

  const candidates: string[] = [clean];

  // Remove possessive 's
  if (clean.endsWith("'s")) {
    candidates.push(clean.slice(0, -2));
  }
  // Plural / verb forms
  if (clean.endsWith('ies') && clean.length > 4) {
    candidates.push(clean.slice(0, -3) + 'y');
  }
  if (clean.endsWith('es') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
  }
  if (clean.endsWith('s') && !clean.endsWith('ss') && clean.length > 3) {
    candidates.push(clean.slice(0, -1));
  }
  // -ing forms
  if (clean.endsWith('ing') && clean.length > 5) {
    candidates.push(clean.slice(0, -3));
    candidates.push(clean.slice(0, -3) + 'e');
  }
  // -ed forms
  if (clean.endsWith('ed') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
    candidates.push(clean.slice(0, -1));
  }
  // -ers / -or forms
  if (clean.endsWith('ers') && clean.length > 5) {
    candidates.push(clean.slice(0, -1));
    candidates.push(clean.slice(0, -3));
  }

  return Array.from(new Set(candidates.filter((w) => w.length > 1)));
}

export const DictionaryModal: React.FC<Props> = ({ isOpen, onClose, initialWord = '' }) => {
  const [searchWord, setSearchWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenWordRef = useRef<string>('');

  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('saved_dict_words') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleSpeak = (textToSpeak?: string) => {
    const targetWord = textToSpeak || result?.word || searchWord;
    if (targetWord) {
      speakText(
        targetWord,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        () => setIsSpeaking(false)
      );
    }
  };

  const fetchDefinition = async (wordToSearch: string) => {
    const clean = cleanWordToken(wordToSearch);
    if (!clean) return;

    setLoading(true);
    setSearchWord(clean);
    setResult(null);

    // Immediately trigger instant pronunciation for the word so user hears it right away
    if (lastSpokenWordRef.current !== clean) {
      lastSpokenWordRef.current = clean;
      handleSpeak(clean);
    }

    try {
      // 1. Fetch Chinese translation in parallel
      let chineseTranslation = '';
      const transPromise = (async () => {
        // Try Google GTX
        try {
          const gtxRes = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(clean)}`
          );
          if (gtxRes.ok) {
            const json = await gtxRes.json();
            if (Array.isArray(json) && Array.isArray(json[0])) {
              const str = json[0].map((part: any) => (Array.isArray(part) ? part[0] : '')).join('').trim();
              if (str && !/^[a-zA-Z\s.,!?'"-]+$/.test(str)) {
                return str;
              }
            }
          }
        } catch (e) {}

        // Try MyMemory
        try {
          const transRes = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|zh-TW`
          );
          if (transRes.ok) {
            const transJson = await transRes.json();
            const translated = transJson.responseData?.translatedText;
            if (translated && typeof translated === 'string' && !translated.includes('MYMEMORY')) {
              return translated;
            }
          }
        } catch (e) {}

        return '';
      })();

      // 2. Fetch dictionary definitions (Free Dictionary API + Candidate Fallbacks + Server Endpoint)
      let dictData: any = null;
      const candidates = getWordCandidates(clean);

      // Try server endpoint first if available
      try {
        const serverRes = await safeApiFetch<DictionaryResult>(
          getApiUrl(`/api/dictionary?word=${encodeURIComponent(clean)}`)
        );
        if (serverRes.ok && serverRes.data && serverRes.data.word) {
          dictData = serverRes.data;
        }
      } catch (e) {}

      // If server didn't provide complete meanings, query Free Dictionary API directly
      if (!dictData || !dictData.meanings || dictData.meanings.length === 0) {
        for (const cand of candidates) {
          try {
            const clientRes = await fetch(
              `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cand)}`
            );
            if (clientRes.ok) {
              const jsonArr = await clientRes.json();
              if (Array.isArray(jsonArr) && jsonArr.length > 0) {
                const item = jsonArr[0];
                const phonetic =
                  item?.phonetic || item?.phonetics?.find((p: any) => p.text)?.text || '';
                const audioUrl = item?.phonetics?.find((p: any) => p.audio)?.audio || '';

                const meanings: DictionaryMeaning[] = (item?.meanings || []).map((m: any) => ({
                  partOfSpeech: m.partOfSpeech || 'n.',
                  definition: m.definitions?.[0]?.definition || '',
                  example: m.definitions?.[0]?.example || '',
                }));

                dictData = {
                  word: clean,
                  phonetic,
                  audioUrl,
                  meanings,
                };
                break;
              }
            }
          } catch (e) {}
        }
      }

      chineseTranslation = await transPromise;

      if (dictData) {
        setResult({
          word: clean,
          phonetic: dictData.phonetic || '',
          audioUrl: dictData.audioUrl || '',
          chineseTranslation: dictData.chineseTranslation || chineseTranslation || '英語廣播即時單字',
          meanings:
            dictData.meanings && dictData.meanings.length > 0
              ? dictData.meanings
              : [
                  {
                    partOfSpeech: '單字',
                    definition: `English vocabulary word '${clean}' from live radio broadcast.`,
                    chineseTranslation: chineseTranslation || clean,
                  },
                ],
        });
      } else {
        // Fallback card with Chinese translation, pronunciation guide, and instant playback
        setResult({
          word: clean,
          phonetic: `/${clean}/`,
          chineseTranslation: chineseTranslation || '雙語廣播重要詞彙',
          meanings: [
            {
              partOfSpeech: '詞彙',
              definition: `廣播新聞專用詞彙：「${clean}」`,
              chineseTranslation: chineseTranslation || clean,
            },
          ],
        });
      }
    } catch (err) {
      console.error('Dictionary fetch failed:', err);
      setResult({
        word: clean,
        phonetic: `/${clean}/`,
        chineseTranslation: '雙語即時詞彙',
        meanings: [
          {
            partOfSpeech: '詞彙',
            definition: `英語廣播重點單字 '${clean}'`,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  // When modal is opened with an initialWord, search immediately
  useEffect(() => {
    if (isOpen) {
      if (initialWord) {
        const cleaned = cleanWordToken(initialWord);
        setSearchWord(cleaned);
        fetchDefinition(cleaned);
      } else if (!searchWord && COMMON_BROADCAST_WORDS.length > 0) {
        const defaultWord = COMMON_BROADCAST_WORDS[0];
        setSearchWord(defaultWord);
        fetchDefinition(defaultWord);
      }
    } else {
      stopSpeech();
      setIsSpeaking(false);
      lastSpokenWordRef.current = '';
    }
  }, [isOpen, initialWord]);

  const toggleSaveWord = (word: string) => {
    setSavedWords((prev) => {
      const isSaved = prev.includes(word);
      const updated = isSaved ? prev.filter((w) => w !== word) : [...prev, word];
      try {
        localStorage.setItem('saved_dict_words', JSON.stringify(updated));
      } catch (e) {}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/15 rounded-xl shadow-inner">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-lg flex items-center gap-2 text-white">
                  隨選即時英語字典
                  <span className="text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full">
                    即時標準發音
                  </span>
                </h2>
                <p className="text-xs text-blue-100/90">輕點廣播單字即刻查閱音標、中文釋義與真人口音發音</p>
              </div>
            </div>
            <button
              onClick={() => {
                stopSpeech();
                onClose();
              }}
              className="p-1.5 hover:bg-white/20 active:scale-95 rounded-full transition-colors text-white/90 cursor-pointer"
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
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {loading ? '查詢中...' : '查詢'}
              </button>
            </form>

            {/* Quick Word Suggestion Chips */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] shrink-0 font-medium">廣播常用詞:</span>
              {COMMON_BROADCAST_WORDS.map((w) => (
                <button
                  key={w}
                  onClick={() => fetchDefinition(w)}
                  className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg text-slate-600 dark:text-slate-300 font-mono text-[11px] shrink-0 transition-colors cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
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
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">正在調閱單字釋義、音標並進行真人發音...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Word Title & Pronunciation */}
                <div className="flex items-start justify-between bg-blue-50/70 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 shadow-sm">
                  <div className="pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                        {result.word}
                      </h3>
                      {result.phonetic && (
                        <span className="text-xs sm:text-sm font-mono text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/60 px-2 py-0.5 rounded-lg font-semibold">
                          {result.phonetic}
                        </span>
                      )}
                    </div>

                    {result.chineseTranslation && (
                      <p className="mt-1.5 text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                        {result.chineseTranslation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleSpeak(result.word)}
                      title="標準英語真人發音 (點擊立即播放)"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 ${
                        isSpeaking
                          ? 'bg-blue-600 text-white border-blue-600 animate-pulse ring-2 ring-blue-400'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => toggleSaveWord(result.word)}
                      title="收藏此單字"
                      className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      {savedWords.includes(result.word) ? (
                        <BookmarkCheck className="w-5 h-5 text-amber-500 fill-amber-500" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      onClick={handleCopy}
                      title="複製單字與釋義"
                      className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-300 hover:text-blue-500 transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
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
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {m.chineseTranslation}
                          </span>
                        )}
                      </div>

                      {m.definition && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          {m.definition}
                        </p>
                      )}

                      {m.example && (
                        <p className="text-xs italic text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-indigo-400">
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
                <p className="text-xs text-slate-400 mt-1">點擊段落中的任何英文單字，即可自動調閱並立即發音</p>
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
                    className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40 rounded-full text-[10px] font-mono shrink-0 hover:bg-amber-500/20 cursor-pointer"
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
