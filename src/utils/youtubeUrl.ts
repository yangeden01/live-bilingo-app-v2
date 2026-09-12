/**
 * YouTube URL Parser and Validator
 * Extracts and validates 11-character YouTube video IDs from various URL formats.
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If it's already a raw 11-character video ID
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Handle URL strings
  try {
    // If protocol is missing, add https:// to allow URL parsing
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();

    // 1. youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    // 2. youtube.com domains (including m.youtube.com, music.youtube.com)
    if (host.includes('youtube.com')) {
      // 2a. /watch?v=VIDEO_ID
      const v = url.searchParams.get('v');
      if (v && YOUTUBE_ID_REGEX.test(v)) {
        return v;
      }

      // 2b. /shorts/VIDEO_ID
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch && YOUTUBE_ID_REGEX.test(shortsMatch[1])) {
        return shortsMatch[1];
      }

      // 2c. /embed/VIDEO_ID
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch && YOUTUBE_ID_REGEX.test(embedMatch[1])) {
        return embedMatch[1];
      }

      // 2d. /v/VIDEO_ID or /e/VIDEO_ID
      const vMatch = url.pathname.match(/\/(?:v|e)\/([a-zA-Z0-9_-]{11})/);
      if (vMatch && YOUTUBE_ID_REGEX.test(vMatch[1])) {
        return vMatch[1];
      }
    }
  } catch {
    // If URL constructor fails, attempt regex fallback
  }

  // Fallback regex pattern across text
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/i);
  if (match && YOUTUBE_ID_REGEX.test(match[1])) {
    return match[1];
  }

  return null;
}
