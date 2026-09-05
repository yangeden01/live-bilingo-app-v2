export interface WordDifficulty {
  level: 'B1' | 'B2' | 'C1' | 'C2' | 'TOEIC';
  label: string;
  badgeColor: string;
  textColor: string;
  bgColor: string;
}

// Common Broadcast Vocabulary with CEFR / TOEIC ratings
const CEFR_DICT: Record<string, 'B1' | 'B2' | 'C1' | 'C2' | 'TOEIC'> = {
  // B2 - Upper Intermediate (Common news & professional terms)
  appliances: 'B2',
  appliance: 'B2',
  expertise: 'C1',
  locations: 'B1',
  location: 'B1',
  residents: 'B2',
  resident: 'B2',
  controversy: 'B2',
  controversies: 'B2',
  infrastructure: 'B2',
  concession: 'C1',
  concessions: 'C1',
  candidate: 'B2',
  candidates: 'B2',
  legislation: 'C1',
  legislature: 'C1',
  negotiation: 'B2',
  negotiations: 'B2',
  economy: 'B1',
  economic: 'B2',
  inflation: 'B2',
  recession: 'B2',
  deficit: 'C1',
  sanctions: 'C1',
  sanction: 'C1',
  allegation: 'C1',
  allegations: 'C1',
  prosecutor: 'B2',
  prosecutors: 'B2',
  verdict: 'B2',
  indictment: 'C1',
  administration: 'B2',
  investigation: 'B2',
  investigators: 'B2',
  sustainable: 'B2',
  sustainability: 'B2',
  renewable: 'B2',
  biodiversity: 'C1',
  emissions: 'B2',
  emission: 'B2',
  diplomat: 'B2',
  diplomats: 'B2',
  diplomatic: 'B2',
  humanitarian: 'B2',
  sovereignty: 'C1',
  coalition: 'C1',
  parliament: 'B2',
  referendum: 'C1',
  mortgage: 'B2',
  mortgages: 'B2',
  expenditure: 'C1',
  expenditures: 'C1',
  revenue: 'B2',
  revenues: 'B2',
  liability: 'C1',
  liabilities: 'C1',
  epidemic: 'B2',
  pandemic: 'B2',
  symptoms: 'B1',
  vaccination: 'B2',
  diagnosis: 'B2',
  pharmaceutical: 'B2',
  technology: 'B1',
  artificial: 'B2',
  intelligence: 'B2',
  algorithm: 'B2',
  algorithms: 'B2',
  cybersecurity: 'B2',
  surveillance: 'C1',
  autonomous: 'C1',
  breakthrough: 'B2',
  perspective: 'B2',
  perspectives: 'B2',
  significant: 'B2',
  substantially: 'B2',
  crucial: 'B2',
  fundamental: 'B2',
  comprehensive: 'B2',
  inevitable: 'B2',
  vulnerable: 'B2',
  unprecedented: 'C1',
  scrutiny: 'C1',
  resilience: 'C1',
  deteriorate: 'C1',
  deteriorating: 'C1',
  escalate: 'C1',
  escalating: 'C1',
  mitigate: 'C1',
  mitigating: 'C1',
  disclose: 'C1',
  disclosed: 'C1',
  advocate: 'B2',
  advocates: 'B2',
  endorse: 'B2',
  endorsed: 'B2',
  implement: 'B2',
  implemented: 'B2',
  reinforce: 'B2',
  reinforced: 'B2',
  undermine: 'C1',
  undermined: 'C1',
};

// Suffixes indicating higher-level academic / professional vocabulary
const ADVANCED_SUFFIXES = [
  'ization', 'isation', 'lessness', 'fulness', 'ologist',
  'ology', 'ability', 'ibility', 'ification', 'aceous'
];

export function getWordDifficulty(rawWord: string): WordDifficulty | null {
  if (!rawWord) return null;
  const clean = rawWord.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 4) return null;

  // 1. Direct dictionary match
  let level = CEFR_DICT[clean];

  // 2. Stem match for plurals or -ed/-ing
  if (!level) {
    if (clean.endsWith('ies') && CEFR_DICT[clean.slice(0, -3) + 'y']) {
      level = CEFR_DICT[clean.slice(0, -3) + 'y'];
    } else if (clean.endsWith('es') && CEFR_DICT[clean.slice(0, -2)]) {
      level = CEFR_DICT[clean.slice(0, -2)];
    } else if (clean.endsWith('s') && CEFR_DICT[clean.slice(0, -1)]) {
      level = CEFR_DICT[clean.slice(0, -1)];
    } else if (clean.endsWith('ing') && CEFR_DICT[clean.slice(0, -3)]) {
      level = CEFR_DICT[clean.slice(0, -3)];
    } else if (clean.endsWith('ed') && CEFR_DICT[clean.slice(0, -2)]) {
      level = CEFR_DICT[clean.slice(0, -2)];
    }
  }

  // 3. Heuristic length & morphological complexity for news broadcast words
  if (!level) {
    for (const sfx of ADVANCED_SUFFIXES) {
      if (clean.endsWith(sfx)) {
        level = 'C1';
        break;
      }
    }
  }

  if (!level && clean.length >= 10) {
    if (clean.endsWith('tion') || clean.endsWith('ment') || clean.endsWith('ance') || clean.endsWith('ence')) {
      level = 'B2';
    }
  }

  if (!level) return null;

  const styleMap: Record<string, { label: string; badgeColor: string; textColor: string; bgColor: string }> = {
    B1: {
      label: '中級實用',
      badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-400/30',
      textColor: 'text-sky-600 dark:text-sky-300 font-semibold',
      bgColor: 'bg-sky-500/10',
    },
    B2: {
      label: '多益/中高階',
      badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40',
      textColor: 'text-amber-700 dark:text-amber-300 font-bold',
      bgColor: 'bg-amber-500/15',
    },
    C1: {
      label: '雅思/進階詞',
      badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40',
      textColor: 'text-emerald-700 dark:text-emerald-300 font-bold',
      bgColor: 'bg-emerald-500/15',
    },
    C2: {
      label: '母語精通詞',
      badgeColor: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40',
      textColor: 'text-purple-700 dark:text-purple-300 font-black',
      bgColor: 'bg-purple-500/15',
    },
    TOEIC: {
      label: '多益高頻',
      badgeColor: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40',
      textColor: 'text-indigo-700 dark:text-indigo-300 font-bold',
      bgColor: 'bg-indigo-500/15',
    },
  };

  const meta = styleMap[level] || styleMap.B2;

  return {
    level,
    label: meta.label,
    badgeColor: meta.badgeColor,
    textColor: meta.textColor,
    bgColor: meta.bgColor,
  };
}
