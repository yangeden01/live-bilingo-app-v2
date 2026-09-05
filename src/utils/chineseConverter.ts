import * as OpenCC from 'opencc-js';

export type ChineseVariant = 'traditional' | 'simplified';

// Initialize converters
let t2sConverter: ((text: string) => string) | null = null;
let s2tConverter: ((text: string) => string) | null = null;

try {
  if (OpenCC && typeof OpenCC.Converter === 'function') {
    t2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });
    s2tConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  }
} catch (err) {
  console.warn('[ChineseConverter] OpenCC initialization fallback:', err);
}

// In-memory LRU cache to prevent re-converting identical strings repeatedly
const cacheT2S = new Map<string, string>();
const cacheS2T = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

export function toSimplified(text: string): string {
  if (!text) return '';
  if (cacheT2S.has(text)) return cacheT2S.get(text)!;

  let result = text;
  if (t2sConverter) {
    try {
      result = t2sConverter(text);
    } catch (e) {
      result = text;
    }
  }

  if (cacheT2S.size >= MAX_CACHE_SIZE) {
    const firstKey = cacheT2S.keys().next().value;
    if (firstKey) cacheT2S.delete(firstKey);
  }
  cacheT2S.set(text, result);
  return result;
}

export function toTraditional(text: string): string {
  if (!text) return '';
  if (cacheS2T.has(text)) return cacheS2T.get(text)!;

  let result = text;
  if (s2tConverter) {
    try {
      result = s2tConverter(text);
    } catch (e) {
      result = text;
    }
  }

  if (cacheS2T.size >= MAX_CACHE_SIZE) {
    const firstKey = cacheS2T.keys().next().value;
    if (firstKey) cacheS2T.delete(firstKey);
  }
  cacheS2T.set(text, result);
  return result;
}

export function convertChinese(text: string, variant: ChineseVariant): string {
  if (!text) return '';
  if (variant === 'simplified') {
    return toSimplified(text);
  }
  return toTraditional(text);
}
