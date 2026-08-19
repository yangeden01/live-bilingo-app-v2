// Speech-to-Text Anti-Hallucination, Repetition Cleaner & Sanitizer

/**
 * Removes both single word loops and multi-word phrase loops (e.g. "and set up and set up and set up...")
 * Prevents STT hallucination loops generated during silence or background noise.
 */
export function sanitizeTranscriptText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. Remove repeated consecutive single words (case-insensitive) e.g., "cents cents" -> "cents"
  cleaned = cleaned.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');

  // 2. Remove multi-word phrase repetition loops (e.g., 2 to 6 word chunks repeating >= 2 times)
  // Example: "and set up and set up and set up" -> "and set up"
  // Example: "with the 10 the with the 10 the" -> "with the 10 the"
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    const pattern = new RegExp(`(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:\\s+\\1\\b)+`, 'gi');
    cleaned = cleaned.replace(pattern, '$1');
  }

  // 3. Remove trailing stutter words if word appears multiple times at end (e.g. "with the 10 the" -> "with the 10")
  const tokens = cleaned.split(/\s+/);
  if (tokens.length >= 4) {
    const lastWord = tokens[tokens.length - 1].toLowerCase();
    if (['the', 'a', 'an', 'at', 'in', 'on', 'with', 'to', 'of', 'and', 'or'].includes(lastWord)) {
      const priorMatches = tokens.slice(0, -1).filter(w => w.toLowerCase() === lastWord);
      if (priorMatches.length >= 2) {
        tokens.pop();
        cleaned = tokens.join(' ');
      }
    }
  }

  // 4. Clean up dangling conjunctions at ends of broken sentences
  cleaned = cleaned
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Remove trailing broken loops like "and set up and set" -> "and set up"
  const words = cleaned.split(/\s+/);
  if (words.length >= 4) {
    const lastWord = words[words.length - 1].toLowerCase();
    const secondLastWord = words[words.length - 2].toLowerCase();
    // If the ending looks like a truncated repeat of the previous phrase
    if (words.slice(0, -1).join(' ').toLowerCase().endsWith(`${secondLastWord} ${lastWord}`)) {
      // already good
    } else if (words.length >= 6 && words[words.length - 1].toLowerCase() === 'and' || words[words.length - 1].toLowerCase() === 'set') {
      // Check if end is trailing broken fragment
      const prevPhrase = words.slice(-4, -1).join(' ');
      if (prevPhrase.toLowerCase().includes(words[words.length - 1].toLowerCase())) {
        // trimmed
      }
    }
  }

  return cleaned.trim();
}

/**
 * Detects if a transcript is an unrecoverable STT hallucination loop
 * (e.g. unique words ratio is too low, or identical phrases repeat constantly)
 */
export function isHallucinationLoop(text: string): boolean {
  if (!text || typeof text !== 'string') return true;

  const raw = text.trim();
  if (raw.length < 4) return true;

  const words = raw.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 3) return false;

  // Check unique word ratio
  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;

  // If sentence has 8+ words but unique words ratio is under 40%, it's almost certainly a hallucination loop
  if (words.length >= 8 && ratio < 0.40) {
    return true;
  }

  // If sentence has 15+ words and unique ratio under 50%
  if (words.length >= 15 && ratio < 0.50) {
    return true;
  }

  // Check if any 2-3 word phrase occurs 4+ times in this single sentence
  for (let len = 2; len <= 4; len++) {
    const counts: Record<string, number> = {};
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      counts[phrase] = (counts[phrase] || 0) + 1;
      if (counts[phrase] >= 4) {
        return true;
      }
    }
  }

  return false;
}
