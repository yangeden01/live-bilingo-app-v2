import { CachedYouTubeData, YouTubeSubtitleItem } from '../types';
import { getPersistentItem, setPersistentItem } from './persistentStorage';
import { PRESET_YOUTUBE_DATA } from './presetYouTubeData';

export const YOUTUBE_CACHE_VERSION = 1;
const CACHE_KEY_PREFIX = 'yt_subtitles_';

export function getCachedYouTubeData(videoId: string): CachedYouTubeData | null {
  if (!videoId) return null;
  try {
    const raw = getPersistentItem(`${CACHE_KEY_PREFIX}${videoId}`);
    if (raw) {
      const parsed: CachedYouTubeData = JSON.parse(raw);

      // Check version compatibility
      if (parsed.version === YOUTUBE_CACHE_VERSION && Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`[YouTubeCache] Error reading cache for ${videoId}:`, e);
  }

  // Fallback to verified preset dataset if available
  if (PRESET_YOUTUBE_DATA[videoId]) {
    return PRESET_YOUTUBE_DATA[videoId];
  }

  return null;
}

export function saveCachedYouTubeData(
  videoId: string,
  title: string,
  duration: number,
  subtitles: YouTubeSubtitleItem[],
  captionSource = 'youtube-timedtext',
  lastPlaybackPositionMs = 0
): CachedYouTubeData {
  const existing = getCachedYouTubeData(videoId);
  const now = Date.now();

  const data: CachedYouTubeData = {
    version: YOUTUBE_CACHE_VERSION,
    videoId,
    title: title || existing?.title || 'YouTube Video',
    duration: duration || existing?.duration || 0,
    captionSource,
    subtitles,
    lastPlaybackPositionMs: lastPlaybackPositionMs || existing?.lastPlaybackPositionMs || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    setPersistentItem(`${CACHE_KEY_PREFIX}${videoId}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`[YouTubeCache] Failed to persist data for ${videoId}:`, e);
  }

  return data;
}

export function updateCachedPlaybackPosition(videoId: string, positionMs: number): void {
  const cached = getCachedYouTubeData(videoId);
  if (!cached) return;

  cached.lastPlaybackPositionMs = positionMs;
  cached.updatedAt = Date.now();

  try {
    setPersistentItem(`${CACHE_KEY_PREFIX}${videoId}`, JSON.stringify(cached));
  } catch (e) {
    // ignore
  }
}
