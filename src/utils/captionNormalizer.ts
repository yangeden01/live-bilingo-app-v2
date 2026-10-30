import { TranscriptSegment, YouTubeSubtitleItem } from '../types';

/**
 * Decodes common HTML / XML entities returned by YouTube timedtext.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#38;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips bracketed sound effects like [♪♪♪], [Music], [Applause], [laughter].
 * Returns cleaned text, or empty string if segment was purely sound effect.
 */
export function cleanSoundEffects(text: string): string {
  if (!text) return '';
  const decoded = decodeHtmlEntities(text);
  // Remove standalone musical symbols: ♪, ♫
  const withoutMusicSymbols = decoded.replace(/[♪♫]/g, '').trim();
  // If segment is strictly [Music], [Applause], [Cheering], etc.
  if (/^\[?(?:music|applause|laughter|laughing|cheering|silence|beep|inaudible)\]?[.\?!,:;\s]*$/i.test(withoutMusicSymbols)) {
    return '';
  }
  return withoutMusicSymbols;
}

/**
 * Normalizes fragmented YouTube caption segments into complete, natural sentences
 * while strictly preserving original start and end timestamps.
 * 
 * Rules:
 * 1. startMs = first fragment startMs
 * 2. endMs = last fragment endMs
 * 3. Never invent timestamps.
 */
export function normalizeCaptionSegments(
  videoId: string,
  rawSegments: TranscriptSegment[]
): YouTubeSubtitleItem[] {
  if (!rawSegments || rawSegments.length === 0) return [];

  const items: YouTubeSubtitleItem[] = [];
  let currentGroup: TranscriptSegment[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const combinedText = currentGroup
      .map((s) => cleanSoundEffects(s.text))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (combinedText) {
      const firstSegment = currentGroup[0];
      const lastSegment = currentGroup[currentGroup.length - 1];
      const id = `${videoId}_${items.length + 1}`;

      items.push({
        id,
        videoId,
        startMs: firstSegment.startMs,
        endMs: Math.max(lastSegment.endMs, firstSegment.startMs + 500),
        english: combinedText,
        traditionalChinese: '', // Filled during batch translation
      });
    }

    currentGroup = [];
  };

  for (let i = 0; i < rawSegments.length; i++) {
    const segment = rawSegments[i];
    const cleanedText = cleanSoundEffects(segment.text);

    // Skip pure noise segments if not currently accumulating
    if (!cleanedText && currentGroup.length === 0) {
      continue;
    }

    // Check pause between segments (> 1500ms suggests a natural sentence break)
    if (currentGroup.length > 0) {
      const prevSegment = currentGroup[currentGroup.length - 1];
      const gapMs = segment.startMs - prevSegment.endMs;
      if (gapMs > 1500) {
        flushGroup();
      }
    }

    currentGroup.push(segment);

    // Check if segment ends with strong sentence-terminating punctuation
    const endsWithTerminal = /[.!?]['"]?$/.test(cleanedText);
    // Or if accumulated sentence is getting excessively long (>140 chars or >20 words)
    const currentAccumulatedLength = currentGroup.reduce((acc, s) => acc + s.text.length, 0);

    if (endsWithTerminal || currentAccumulatedLength > 160) {
      flushGroup();
    }
  }

  // Flush any trailing segment
  flushGroup();

  return items;
}
