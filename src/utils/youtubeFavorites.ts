import { YouTubeSavedUrl } from '../types';
import { getPersistentItem, setPersistentItem } from './persistentStorage';

export const YOUTUBE_SAVED_URLS_STORAGE_KEY = 'bilingo_youtube_saved_urls';

// Default initial favorites to provide immediate value if user has no saved URLs
export const DEFAULT_YOUTUBE_FAVORITES: YouTubeSavedUrl[] = [
  {
    id: 'fav-vOTiJkg1voo',
    videoId: 'vOTiJkg1voo',
    url: 'https://www.youtube.com/live/vOTiJkg1voo',
    title: 'Watch ABC NEWS Australia live | ABC NEWS (24/7 即時新聞直播)',
    channelName: 'ABC News (Australia)',
    savedAt: 1710800000000,
    isLive: true,
  },
  {
    id: 'fav-MiAl9CNZUuo',
    videoId: 'MiAl9CNZUuo',
    url: 'https://www.youtube.com/watch?v=MiAl9CNZUuo',
    title: 'Nvidia CEO Jensen Huang Outlines AI Future (具備完整雙語字幕)',
    channelName: 'Bloomberg Technology',
    savedAt: 1710700000000,
    isLive: false,
  },
];

/**
 * Retrieve saved YouTube URLs from persistent storage.
 */
export function getSavedYouTubeUrls(): YouTubeSavedUrl[] {
  try {
    const raw = getPersistentItem(YOUTUBE_SAVED_URLS_STORAGE_KEY);
    if (!raw) {
      // First time initialization with default favorites
      setPersistentItem(YOUTUBE_SAVED_URLS_STORAGE_KEY, JSON.stringify(DEFAULT_YOUTUBE_FAVORITES));
      return DEFAULT_YOUTUBE_FAVORITES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[YouTubeFavorites] Failed to parse saved URLs:', err);
  }
  return DEFAULT_YOUTUBE_FAVORITES;
}

/**
 * Save a new YouTube URL to favorites.
 */
export function saveYouTubeUrl(item: {
  videoId: string;
  url: string;
  title?: string;
  channelName?: string;
  isLive?: boolean;
}): YouTubeSavedUrl[] {
  if (!item.videoId || !item.url) return getSavedYouTubeUrls();

  const current = getSavedYouTubeUrls();
  const existingIdx = current.findIndex((fav) => fav.videoId === item.videoId);

  const isLive =
    item.isLive !== undefined
      ? item.isLive
      : item.url.includes('/live/') || (item.title && item.title.toLowerCase().includes('live'));

  const newEntry: YouTubeSavedUrl = {
    id: existingIdx >= 0 ? current[existingIdx].id : `fav-${item.videoId}-${Date.now()}`,
    videoId: item.videoId,
    url: item.url.trim(),
    title: item.title?.trim() || (isLive ? `YouTube 直播 (${item.videoId})` : `YouTube 影片 (${item.videoId})`),
    channelName: item.channelName,
    savedAt: Date.now(),
    isLive: !!isLive,
  };

  // Move to the top if already exists, otherwise prepend
  const filtered = current.filter((fav) => fav.videoId !== item.videoId);
  const updated = [newEntry, ...filtered];

  try {
    setPersistentItem(YOUTUBE_SAVED_URLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[YouTubeFavorites] Failed to save favorites:', err);
  }

  return updated;
}

/**
 * Remove a YouTube URL from favorites.
 */
export function removeSavedYouTubeUrl(videoIdOrId: string): YouTubeSavedUrl[] {
  const current = getSavedYouTubeUrls();
  const updated = current.filter(
    (fav) => fav.id !== videoIdOrId && fav.videoId !== videoIdOrId
  );

  try {
    setPersistentItem(YOUTUBE_SAVED_URLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[YouTubeFavorites] Failed to remove favorite:', err);
  }

  return updated;
}

/**
 * Check whether a videoId is currently saved in favorites.
 */
export function isYouTubeUrlSaved(videoId: string | null | undefined): boolean {
  if (!videoId) return false;
  const current = getSavedYouTubeUrls();
  return current.some((fav) => fav.videoId === videoId);
}

/**
 * Update the title of an existing saved URL.
 */
export function updateSavedYouTubeUrlTitle(
  videoId: string,
  newTitle: string
): YouTubeSavedUrl[] {
  if (!videoId || !newTitle.trim()) return getSavedYouTubeUrls();

  const current = getSavedYouTubeUrls();
  let changed = false;

  const updated = current.map((fav) => {
    if (fav.videoId === videoId) {
      changed = true;
      return { ...fav, title: newTitle.trim() };
    }
    return fav;
  });

  if (changed) {
    try {
      setPersistentItem(YOUTUBE_SAVED_URLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('[YouTubeFavorites] Failed to update title:', err);
    }
  }

  return updated;
}
