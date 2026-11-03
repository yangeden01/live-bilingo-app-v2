/**
 * 把整句字幕切成電影式的短段，只用於全螢幕顯示，不改動原本的字幕資料。
 *
 * - 英文每段最多約兩行（MAX_EN_CHARS），優先在標點、其次在連接詞前斷開
 * - 中文切成相同段數，優先在「，、；：」等標點處斷開
 * - 每段時間依英文字數比例分配這句的播放時間
 */

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  english: string;
  chinese: string;
}

const MAX_EN_CHARS = 96;
const EN_SEARCH_WINDOW = 28;
const ZH_SEARCH_WINDOW = 8;

const BREAK_BEFORE_WORDS = new Set([
  'and', 'but', 'or', 'so', 'because', 'which', 'that', 'who', 'whom', 'whose', 'when', 'where',
  'while', 'with', 'including', 'than', 'if', 'although', 'though', 'as', 'after', 'before',
  'since', 'until', 'unless', 'whether', 'to', 'for', 'in', 'on', 'at', 'from', 'by',
]);

const EN_PUNCT_END = /[,;:.!?)\]"'—–-]$/;
const ZH_BREAK_CHARS = '，、；：。！？,;:!?';
const ZH_TRIM_TRAILING = /[，、；：,;:]+$/;
const ZH_TRIM_LEADING = /^[，、；：。！？,;:!?\s]+/;

/** 在英文中找 target 附近最適合斷開的空白位置，回傳下一段的起點索引。 */
function findEnglishBreak(text: string, target: number, minPos: number): number {
  let best = -1;
  let bestScore = Infinity;
  const from = Math.max(minPos + 1, target - EN_SEARCH_WINDOW);
  const to = Math.min(text.length - 1, target + EN_SEARCH_WINDOW);

  for (let i = from; i <= to; i++) {
    if (text[i] !== ' ') continue;
    let score = Math.abs(i - target);
    const before = text.slice(0, i);
    if (EN_PUNCT_END.test(before)) {
      score -= 18;
    } else {
      const nextWord = text.slice(i + 1).match(/^[A-Za-z']+/)?.[0]?.toLowerCase();
      if (nextWord && BREAK_BEFORE_WORDS.has(nextWord)) score -= 8;
    }
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }

  if (best === -1) {
    // 視窗內沒有空白，退而求其次找 target 之後第一個空白
    const next = text.indexOf(' ', Math.max(target, minPos + 1));
    return next === -1 ? -1 : next + 1;
  }
  return best + 1;
}

/** 在中文中找 target 附近的標點斷點；找不到就直接在 target 斷開。 */
function findChineseBreak(text: string, target: number, minPos: number): number {
  let best = -1;
  let bestDist = Infinity;
  const from = Math.max(minPos + 1, target - ZH_SEARCH_WINDOW);
  const to = Math.min(text.length - 1, target + ZH_SEARCH_WINDOW);

  for (let i = from; i <= to; i++) {
    if (!ZH_BREAK_CHARS.includes(text[i])) continue;
    const dist = Math.abs(i + 1 - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i + 1;
    }
  }
  if (best !== -1) return best;
  return Math.min(Math.max(target, minPos + 1), text.length);
}

function splitEnglish(text: string, parts: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  for (let k = 1; k < parts; k++) {
    const target = Math.round((text.length * k) / parts);
    const cut = findEnglishBreak(text, target, start);
    if (cut <= start || cut >= text.length) break;
    chunks.push(text.slice(start, cut).trim());
    start = cut;
  }
  chunks.push(text.slice(start).trim());
  return chunks.filter(Boolean);
}

function splitChinese(text: string, parts: number): string[] {
  if (parts <= 1 || !text) return [text];
  const chunks: string[] = [];
  let start = 0;
  for (let k = 1; k < parts; k++) {
    const target = Math.round((text.length * k) / parts);
    const cut = findChineseBreak(text, target, start);
    if (cut <= start || cut >= text.length) break;
    chunks.push(text.slice(start, cut));
    start = cut;
  }
  chunks.push(text.slice(start));
  return chunks;
}

const cleanChinese = (s: string) => s.replace(ZH_TRIM_LEADING, '').replace(ZH_TRIM_TRAILING, '').trim();

export function splitSubtitleIntoCues(
  english: string,
  chinese: string,
  startMs: number,
  endMs: number
): SubtitleCue[] {
  const en = (english || '').replace(/\s+/g, ' ').trim();
  const zh = (chinese || '').trim();
  const duration = Math.max(0, endMs - startMs);

  if (en.length <= MAX_EN_CHARS) {
    return [{ startMs, endMs, english: en, chinese: zh }];
  }

  const enChunks = splitEnglish(en, Math.ceil(en.length / MAX_EN_CHARS));
  // 中文切不出相同段數（例如太短）時，每段都顯示整句中文
  const splitZh = splitChinese(zh, enChunks.length);
  const zhChunks = splitZh.length === enChunks.length ? splitZh : enChunks.map(() => zh);

  const totalChars = enChunks.reduce((sum, c) => sum + c.length, 0) || 1;
  const cues: SubtitleCue[] = [];
  let cursor = startMs;
  enChunks.forEach((chunk, i) => {
    const isLast = i === enChunks.length - 1;
    const cueEnd = isLast ? endMs : cursor + Math.round((duration * chunk.length) / totalChars);
    cues.push({
      startMs: cursor,
      endMs: cueEnd,
      english: chunk,
      chinese: cleanChinese(zhChunks[i] ?? ''),
    });
    cursor = cueEnd;
  });
  return cues;
}

/** 依目前播放時間挑出應顯示的短段；時間落在範圍外時取最接近的一段。 */
export function pickCueAt(cues: SubtitleCue[], nowMs: number): SubtitleCue | null {
  if (cues.length === 0) return null;
  for (const cue of cues) {
    if (nowMs < cue.endMs) return cue;
  }
  return cues[cues.length - 1];
}
