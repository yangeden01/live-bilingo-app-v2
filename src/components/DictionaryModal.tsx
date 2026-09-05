import React, { useState, useEffect, useRef } from 'react';
import { Search, Volume2, BookOpen, X, Sparkles, Copy, Check, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speakText, stopSpeech } from '../utils/tts';
import { getApiUrl } from '../utils/apiUrl';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import { lookupQuickWord, generateContextualExample } from '../utils/quickDictionary';
import { translateEnglishToChinese } from '../utils/clientTranslation';
import { convertChinese } from '../utils/chineseConverter';
import { BannerAd } from './BannerAd';

interface DictionaryMeaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
  exampleTranslation?: string;
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

// Render example sentence with queried word (and inflected forms) bolded
function renderBoldedSentence(sentence: string, targetWord: string) {
  if (!sentence) return null;
  const clean = cleanWordToken(targetWord);
  if (!clean) return <span>{sentence}</span>;

  // Gather target word variations & inflections
  const stems = Array.from(new Set([clean, ...getWordCandidates(clean)]));
  stems.sort((a, b) => b.length - a.length);

  const regexParts = stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const wordRegex = new RegExp(`\\b(${regexParts.join('|')}(?:s|es|ed|ing|d)?)\\b`, 'gi');

  const tokens: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(sentence)) !== null) {
    const matchStart = match.index;
    const matchEnd = wordRegex.lastIndex;
    if (matchStart > lastIndex) {
      tokens.push({ text: sentence.slice(lastIndex, matchStart), isMatch: false });
    }
    tokens.push({ text: match[0], isMatch: true });
    lastIndex = matchEnd;
  }

  if (lastIndex < sentence.length) {
    tokens.push({ text: sentence.slice(lastIndex), isMatch: false });
  }

  if (tokens.length === 0) {
    return <span>{sentence}</span>;
  }

  return (
    <span>
      {tokens.map((token, i) =>
        token.isMatch ? (
          <strong
            key={i}
            className="font-bold text-indigo-700 dark:text-indigo-300 not-italic underline decoration-indigo-400/50 underline-offset-2"
          >
            {token.text}
          </strong>
        ) : (
          <React.Fragment key={i}>{token.text}</React.Fragment>
        )
      )}
    </span>
  );
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
  // Plural forms (clubs -> club, cities -> city, boxes -> box)
  if (clean.endsWith('ies') && clean.length > 4) {
    candidates.push(clean.slice(0, -3) + 'y');
  }
  if (clean.endsWith('es') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
    candidates.push(clean.slice(0, -1));
  }
  if (clean.endsWith('s') && !clean.endsWith('ss') && clean.length > 3) {
    candidates.push(clean.slice(0, -1));
  }
  // -ing forms (graduating -> graduate, running -> run)
  if (clean.endsWith('ing') && clean.length > 5) {
    candidates.push(clean.slice(0, -3));
    candidates.push(clean.slice(0, -3) + 'e');
    if (clean.length > 6 && clean[clean.length - 4] === clean[clean.length - 5]) {
      candidates.push(clean.slice(0, -4));
    }
  }
  // -ed forms (scheduled -> schedule, stopped -> stop)
  if (clean.endsWith('ed') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
    candidates.push(clean.slice(0, -1));
    if (clean.length > 5 && clean[clean.length - 3] === clean[clean.length - 4]) {
      candidates.push(clean.slice(0, -3));
    }
  }
  // -ly forms (quickly -> quick)
  if (clean.endsWith('ly') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
  }

  return Array.from(new Set(candidates.filter((w) => w.length > 1)));
}

export const DictionaryModal: React.FC<Props> = ({ isOpen, onClose, initialWord = '' }) => {
  const [searchWord, setSearchWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [detailedMeanings, setDetailedMeanings] = useState<DictionaryMeaning[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenWordRef = useRef<string>('');

  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try {
      const saved = getPersistentItem('saved_dict_words');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Always synchronize savedWords whenever modal is opened or storage changes
  useEffect(() => {
    const syncSavedWords = () => {
      try {
        const saved = getPersistentItem('saved_dict_words');
        setSavedWords(saved ? JSON.parse(saved) : []);
      } catch (e) {
        setSavedWords([]);
      }
    };

    syncSavedWords();

    window.addEventListener('storage', syncSavedWords);
    window.addEventListener('focus', syncSavedWords);
    return () => {
      window.removeEventListener('storage', syncSavedWords);
      window.removeEventListener('focus', syncSavedWords);
    };
  }, [isOpen]);

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

    setSearchWord(clean);
    setIsDetailsExpanded(false);

    // Immediately trigger instant pronunciation for the word so user hears it right away
    if (lastSpokenWordRef.current !== clean) {
      lastSpokenWordRef.current = clean;
      handleSpeak(clean);
    }

    // 0. Stage 1 Fast Path: Instant <10ms offline dictionary check
    const quickMatch = lookupQuickWord(clean);
    if (quickMatch) {
      const primaryZh = quickMatch.zh;
      setResult({
        word: quickMatch.word,
        phonetic: quickMatch.phonetic,
        chineseTranslation: primaryZh,
        meanings: [],
      });
      setDetailedMeanings(
        quickMatch.def
          ? [
              {
                partOfSpeech: quickMatch.pos || '詞彙',
                definition: quickMatch.def,
                example: quickMatch.example,
                exampleTranslation: quickMatch.exampleZh,
                chineseTranslation: primaryZh,
              },
            ]
          : []
      );
      setIsDetailsLoading(false);
      setLoading(false);
      return;
    }

    // Stage 1: Ultra-fast display + Synchronous background detailed dictionary download
    setLoading(true);
    setResult(null);
    setDetailedMeanings([]);
    setIsDetailsLoading(true);

    try {
      // 1. Fast parallel Chinese translation (<100ms)
      const transPromise = translateEnglishToChinese(clean).catch(() => clean);

      // 2. Stage 2 Background Download: Multi-source reliable dictionary fetcher
      const dictPromise = (async (): Promise<{ phonetic?: string; audioUrl?: string; meanings: DictionaryMeaning[] } | null> => {
        const candidates = getWordCandidates(clean);

        // Source 1: Direct Datamuse API (100% uptime, handles inflections like 'clubs', 'graduating', 'scheduled')
        for (const cand of candidates.slice(0, 3)) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const dmRes = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(cand)}&md=dp&max=4`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (dmRes.ok) {
              const dmList = await dmRes.json();
              for (const item of dmList) {
                if (item.defs && item.defs.length > 0) {
                  const usedSentences = new Set<string>();
                  const meanings: DictionaryMeaning[] = item.defs.slice(0, 4).map((dStr: string, idx: number) => {
                    const parts = dStr.split('\t');
                    const posRaw = (parts[0] || 'n').trim();
                    const posMap: Record<string, string> = {
                      n: '名詞 (Noun)',
                      v: '動詞 (Verb)',
                      adj: '形容詞 (Adj)',
                      adv: '副詞 (Adv)',
                      u: '詞彙',
                    };
                    const pos = posMap[posRaw] || `${posRaw}.`;
                    let defText = (parts[1] || dStr).replace(/^\([^)]+\)\s*/, '').trim();
                    if (defText) {
                      defText = defText.charAt(0).toUpperCase() + defText.slice(1);
                    }
                    const contextual = generateContextualExample(cand, pos, idx, defText, usedSentences);
                    return {
                      partOfSpeech: pos,
                      definition: defText,
                      example: contextual.sentence,
                      exampleTranslation: contextual.translation,
                    };
                  });

                  if (meanings.length > 0) {
                    return {
                      phonetic: `/${cand}/`,
                      meanings,
                    };
                  }
                }
              }
            }
          } catch (e) {}
        }

        // Source 2: Backend Multi-source proxy endpoint
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const serverRes = await fetch(getApiUrl(`/api/dictionary?word=${encodeURIComponent(clean)}`), {
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (serverRes.ok) {
            const data = await serverRes.json();
            if (data && data.meanings && data.meanings.length > 0) {
              return data;
            }
          }
        } catch (e) {}

        // Source 3: Free Dictionary API fallback
        for (const cand of candidates.slice(0, 2)) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            const clientRes = await fetch(
              `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cand)}`,
              { signal: controller.signal }
            );
            clearTimeout(timer);
            if (clientRes.ok) {
              const jsonArr = await clientRes.json();
              if (Array.isArray(jsonArr) && jsonArr.length > 0) {
                const item = jsonArr[0];
                const phonetic = item?.phonetic || item?.phonetics?.find((p: any) => p.text)?.text || '';
                const audioUrl = item?.phonetics?.find((p: any) => p.audio)?.audio || '';
                const rawMeanings = (item?.meanings || []).slice(0, 4);
                const usedSentences = new Set<string>();
                const meanings: DictionaryMeaning[] = [];
                for (let idx = 0; idx < rawMeanings.length; idx++) {
                  const m = rawMeanings[idx];
                  const pos = m.partOfSpeech || 'n.';
                  const def = m.definitions?.[0]?.definition || '';
                  let ex = m.definitions?.[0]?.example || '';
                  let exZh = '';
                  if (ex) {
                    usedSentences.add(ex);
                  } else {
                    const contextual = generateContextualExample(cand, pos, idx, def, usedSentences);
                    ex = contextual.sentence;
                    exZh = contextual.translation;
                  }
                  if (def || ex) {
                    meanings.push({
                      partOfSpeech: pos,
                      definition: def,
                      example: ex,
                      exampleTranslation: exZh,
                    });
                  }
                }
                if (meanings.length > 0) {
                  return { phonetic, audioUrl, meanings };
                }
              }
            }
          } catch (e) {}
        }

        return null;
      })();

      // Fast-path: Await primary translation first (typically ~80-120ms)
      const chineseTranslation = await transPromise;

      // Stage 1 Immediate Reveal: Show core word card, translation & pronunciation instantly
      const initialPhonetic = `/${clean}/`;
      setResult({
        word: clean,
        phonetic: initialPhonetic,
        chineseTranslation: chineseTranslation || '英語廣播重點單字',
        meanings: [],
      });
      setLoading(false);

      // Stage 2 Background Arrival: Upgrade detailed definitions without any UI blocking
      dictPromise.then(async (dictData) => {
        setIsDetailsLoading(false);
        if (dictData && dictData.meanings && dictData.meanings.length > 0) {
          setDetailedMeanings(dictData.meanings);
          setResult((prev) => {
            if (!prev || prev.word !== clean) return prev;
            return {
              ...prev,
              phonetic: dictData.phonetic || prev.phonetic,
              audioUrl: dictData.audioUrl || prev.audioUrl,
            };
          });

          // Auto-translate any missing example translations asynchronously
          const missingTrans = dictData.meanings.some((m) => m.example && !m.exampleTranslation);
          if (missingTrans) {
            const updated = await Promise.all(
              dictData.meanings.map(async (m) => {
                if (m.example && !m.exampleTranslation) {
                  try {
                    const zh = await translateEnglishToChinese(m.example);
                    return { ...m, exampleTranslation: zh };
                  } catch (e) {
                    return m;
                  }
                }
                return m;
              })
            );
            setDetailedMeanings((curr) => {
              return curr.map((c, i) => ({
                ...c,
                exampleTranslation: updated[i]?.exampleTranslation || c.exampleTranslation,
              }));
            });
          }
        }
      }).catch(() => {
        setIsDetailsLoading(false);
      });
    } catch (err) {
      console.error('Dictionary fetch error:', err);
      setResult({
        word: clean,
        phonetic: `/${clean}/`,
        chineseTranslation: '英語廣播重點單字',
        meanings: [],
      });
      setLoading(false);
      setIsDetailsLoading(false);
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
    let currentSaved: string[] = [];
    try {
      const saved = getPersistentItem('saved_dict_words');
      currentSaved = saved ? JSON.parse(saved) : [];
    } catch (e) {
      currentSaved = [];
    }

    const isSaved = currentSaved.includes(word);
    const updated = isSaved ? currentSaved.filter((w) => w !== word) : [...currentSaved, word];
    setSavedWords(updated);
    try {
      setPersistentItem('saved_dict_words', JSON.stringify(updated));
      setTimeout(() => {
        window.dispatchEvent(new Event('storage'));
      }, 0);
    } catch (e) {}
  };

  const isSimplified = getPersistentItem('radio_chinese_variant') === 'simplified';
  const formatZh = (text?: string) => {
    if (!text) return '';
    return isSimplified ? convertChinese(text, 'simplified') : text;
  };

  const handleCopy = () => {
    if (!result) return;
    const textParts = [
      `${result.word} ${result.phonetic || ''}`,
      formatZh(result.chineseTranslation) || '',
    ];
    if (detailedMeanings.length > 0) {
      textParts.push(
        detailedMeanings
          .map(
            (m) =>
              `[${m.partOfSpeech}] ${m.definition}${
                m.example
                  ? ` (例: ${m.example}${m.exampleTranslation ? ` - ${formatZh(m.exampleTranslation)}` : ''})`
                  : ''
              }`
          )
          .join('\n')
      );
    }
    navigator.clipboard.writeText(textParts.filter(Boolean).join('\n'));
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
                {/* Stage 1 Card: Instant Header with Core Translation & Actions */}
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
                        {formatZh(result.chineseTranslation)}
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

                {/* Stage 2 Interactive Section: Background-Loaded Detailed Definitions */}
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-850/50">
                  <button
                    type="button"
                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                        {isDetailsExpanded ? '收起詳細詞性與實用例句' : '展開詳細詞性與實用例句'}
                      </span>
                      {isDetailsLoading ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          背景載入中...
                        </span>
                      ) : detailedMeanings.length > 0 ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300/40">
                          已就緒 ({detailedMeanings.length} 項釋義)
                        </span>
                      ) : null}
                    </div>

                    <div className="text-slate-400">
                      {isDetailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isDetailsExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-4 py-3.5 space-y-3"
                      >
                        {isDetailsLoading ? (
                          <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            正在同步完整英英字典與例句...
                          </div>
                        ) : detailedMeanings.length > 0 ? (
                          (() => {
                            const renderedSentencesSet = new Set<string>();
                            return detailedMeanings.map((m, idx) => {
                              const isVerb = m.partOfSpeech.includes('動詞') || m.partOfSpeech.toLowerCase().startsWith('v');
                              const isNoun = m.partOfSpeech.includes('名詞') || m.partOfSpeech.toLowerCase().startsWith('n');
                              const isAdj = m.partOfSpeech.includes('形容詞') || m.partOfSpeech.toLowerCase().includes('adj');
                              const isAdv = m.partOfSpeech.includes('副詞') || m.partOfSpeech.toLowerCase().includes('adv');

                              const badgeStyle = isVerb
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                : isNoun
                                ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                                : isAdj
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                : isAdv
                                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                              let effectiveExample = m.example || '';
                              let effectiveTranslation = m.exampleTranslation || '';

                              if (!effectiveExample || renderedSentencesSet.has(effectiveExample)) {
                                const generated = generateContextualExample(
                                  result?.word || searchWord,
                                  m.partOfSpeech,
                                  idx,
                                  m.definition,
                                  renderedSentencesSet
                                );
                                effectiveExample = generated.sentence;
                                if (!effectiveTranslation) {
                                  effectiveTranslation = generated.translation;
                                }
                              } else {
                                renderedSentencesSet.add(effectiveExample);
                              }

                              return (
                                <div
                                  key={idx}
                                  className="bg-slate-50/90 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-1.5 shadow-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 font-mono text-[11px] font-bold rounded-md border uppercase tracking-wider ${badgeStyle}`}>
                                      {m.partOfSpeech}
                                    </span>
                                    {m.chineseTranslation && (
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {formatZh(m.chineseTranslation)}
                                      </span>
                                    )}
                                  </div>

                                  {m.definition && (
                                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                                      {m.definition}
                                    </p>
                                  )}

                                  {effectiveExample && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                          實用例句
                                        </span>
                                      </div>
                                      <p className="text-xs italic text-slate-700 dark:text-slate-200 pl-2.5 border-l-2 border-indigo-400 dark:border-indigo-500 leading-relaxed font-serif">
                                        "{renderBoldedSentence(effectiveExample, result?.word || searchWord)}"
                                      </p>
                                      {effectiveTranslation && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300 pl-2.5 border-l-2 border-indigo-200 dark:border-indigo-800 leading-relaxed font-sans">
                                          {formatZh(effectiveTranslation)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                            已提供上方即時中文釋義與標準發音，此單字暫無額外英英詳細延伸句。
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
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

          {/* Monetization / AdMob Banner Ad Area */}
          <div className="overflow-hidden rounded-b-2xl border-t border-slate-200 dark:border-slate-800">
            <BannerAd />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
