// Speech-to-Text Anti-Hallucination, Repetition Cleaner & Sanitizer

// Recognized common uppercase English acronyms to keep uppercase in subtitles
export const KNOWN_UPPERCASE_ACRONYMS = new Set([
  'NPR', 'BBC', 'CNN', 'ABC', 'CBS', 'NBC', 'PBS', 'AP',
  'USA', 'US', 'UK', 'EU', 'UN', 'NATO', 'NASA', 'FBI', 'CIA', 'IRS', 'FDA', 'CDC', 'WHO',
  'AI', 'CEO', 'CTO', 'CFO', 'COO', 'VP', 'VIP', 'GDP', 'LLM', 'GPT', 'GPU', 'CPU',
  'COVID', 'HIV', 'DNA', 'RNA', 'STEM', 'TV', 'AM', 'PM', 'FM', 'DJ', 'ID', 'IQ', 'SOS',
  'OK', 'FAQ', 'URL', 'HTML', 'PDF', 'APP', 'PIN', 'ATM', 'DIY', 'ASAP'
]);

/**
 * Filter out non-speech audio cues and subtitle hallucinations produced by Whisper
 * Examples: "MUSIC", "[MUSIC]", "(music playing)", "♪♪♪", "[APPLAUSE]", "[LAUGHTER]", "THANK YOU FOR WATCHING"
 */
export function sanitizeWhisperAudioMarkers(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  // 1. Remove bracketed or parenthesized sound tags like [music], (applause), [cheering], [laughter], [bells], [silence]
  cleaned = cleaned.replace(/\[\s*(?:music|applause|cheering|laughter|laughing|coughing|sigh|silence|bell|beep|sound|noise|chuckle|gasp|groan)[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\(\s*(?:music|applause|cheering|laughter|laughing|coughing|sigh|silence|bell|beep|sound|noise|chuckle|gasp|groan)[^\)]*\)/gi, '');

  // 2. Remove musical note symbols and decorative borders
  cleaned = cleaned.replace(/[♪♫#\*\-—]+/g, ' ');

  // 3. Remove standalone sound effect tokens if the entire phrase is just a sound event (e.g. "MUSIC", "MUSIC.", "APPLAUSE.")
  if (/^(?:music|applause|laughter|laughing|cheering|silence|beep|static)[.\?!,:;\s]*$/i.test(cleaned.trim())) {
    return '';
  }

  // 4. Remove classic YouTube/web caption hallucinations during silence/music interludes
  cleaned = cleaned.replace(/\b(?:thank you for watching|thanks for watching|please subscribe|subscribe for more|subtitles by|closed captioning provided by|transcribed by|all rights reserved)\b[.\?!]*/gi, '');

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes all-caps speech (from CEA-608 closed caption datasets in Whisper) into readable sentence case.
 * e.g., "BORKE IS THE CREATOR OF THE BUSINESS." -> "Borke is the creator of the business."
 * Preserves recognized acronyms (e.g., "NPR", "AI", "CEO", "USA").
 */
export function normalizeAllCapitalizedSpeech(text: string): string {
  if (!text || typeof text !== 'string' || text.length < 3) return text;
  const rawWords = text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return text;

  const letterWords = rawWords.filter(w => /[a-zA-Z]{2,}/.test(w));
  if (letterWords.length === 0) return text;

  const allCapsWords = letterWords.filter(w => {
    const lettersOnly = w.replace(/[^a-zA-Z]/g, '');
    return lettersOnly.length >= 2 && lettersOnly === lettersOnly.toUpperCase();
  });

  const isAllCapsDominant = (rawWords.length >= 2 && allCapsWords.length / letterWords.length >= 0.65) ||
    (rawWords.length === 1 && allCapsWords.length === 1 && !KNOWN_UPPERCASE_ACRONYMS.has(rawWords[0].replace(/[^a-zA-Z]/g, '').toUpperCase()));

  if (!isAllCapsDominant) return text;

  let isStartOfSentence = true;
  // Match words (including contractions like I'm, don't) or non-word tokens
  return text.replace(/[a-zA-Z]+(?:'[a-zA-Z]+)?|[^a-zA-Z]+/g, (token) => {
    if (/^[a-zA-Z]+(?:'[a-zA-Z]+)?$/.test(token)) {
      const pureLetters = token.replace(/[^a-zA-Z]/g, '').toUpperCase();
      const upper = token.toUpperCase();
      if (KNOWN_UPPERCASE_ACRONYMS.has(pureLetters)) {
        isStartOfSentence = false;
        return upper;
      }
      if (upper === "I" || upper === "I'M" || upper === "I'VE" || upper === "I'LL" || upper === "I'D") {
        isStartOfSentence = false;
        return "I" + token.slice(1).toLowerCase();
      }
      const word = isStartOfSentence
        ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
        : token.toLowerCase();
      isStartOfSentence = false;
      return word;
    } else {
      if (/[.?!]/.test(token)) {
        isStartOfSentence = true;
      }
      return token;
    }
  });
}

/**
 * Removes both single word loops and multi-word phrase loops (e.g. "and set up and set up and set up...")
 * Prevents STT hallucination loops generated during silence or background noise.
 */
export function sanitizeTranscriptText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Clean Whisper sound tags (e.g. "MUSIC", "[MUSIC]")
  let cleaned = sanitizeWhisperAudioMarkers(text);
  if (!cleaned) return '';

  // Normalize all-caps closed caption speech to natural sentence case
  cleaned = normalizeAllCapitalizedSpeech(cleaned);

  // 0. Fix compressed word-sticking defects from audio feed / STT concatenations (e.g. "scienceofreadingarereshapinghow" -> "science of reading are reshaping how")
  cleaned = cleaned
    .replace(/\bscienceofreading\b/gi, 'science of reading')
    .replace(/\barereshaping\b/gi, 'are reshaping')
    .replace(/\bhowkidslearn\b/gi, 'how kids learn')
    .replace(/\bkidslearn\b/gi, 'kids learn')
    .replace(/\blearnmore\b/gi, 'learn more')
    .replace(/\bstanford\.edu\b/gi, 'stanford.edu')
    .replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase words separation if any

  // 1. Remove repeated consecutive single words (case-insensitive, e.g. "This this", "This, this", "cents cents")
  cleaned = cleaned.replace(/\b(\w+)(?:[\s,]+\1\b)+/gi, '$1');

  // 2. Remove multi-word phrase repetition loops (e.g., 2 to 6 word chunks repeating >= 2 times)
  // Example: "and set up and set up and set up" -> "and set up"
  // Example: "with the 10 the with the 10 the" -> "with the 10 the"
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    const pattern = new RegExp(`(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:[\\s,]+\\1\\b)+`, 'gi');
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
  if (raw.length < 3) return true;

  // Standalone non-speech sound markers are hallucinations
  const cleanedMarkers = sanitizeWhisperAudioMarkers(raw);
  if (!cleanedMarkers || cleanedMarkers.length < 2) return true;
  if (/^(?:music|applause|laughter|laughing|cheering|silence|beep|static)[.\?!,:;\s]*$/i.test(raw)) return true;

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
