// Active Subtitle Tracker & Audio Sync Tracker
// Manages precise segment tracking, auto-scroll locking, and playback-pause sync realignment

import { SubtitleItem } from '../types';

export interface ActiveSubtitleState {
  currentSubtitleId: string | null;
  activeWordIndex: number;
  progressPercent: number; // 0 to 100 within the active subtitle chunk
  isUserScrolling: boolean;
}

export class SubtitleSyncTracker {
  private currentActiveId: string | null = null;
  private listeners: Array<(state: ActiveSubtitleState) => void> = [];
  private isUserScrolling = false;
  private scrollTimeout: NodeJS.Timeout | null = null;

  public subscribe(callback: (state: ActiveSubtitleState) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public notify(currentSubtitleId: string | null, activeWordIndex = 0, progressPercent = 0) {
    this.currentActiveId = currentSubtitleId;
    const state: ActiveSubtitleState = {
      currentSubtitleId,
      activeWordIndex,
      progressPercent,
      isUserScrolling: this.isUserScrolling,
    };
    this.listeners.forEach(cb => cb(state));
  }

  public setUserScrolling(scrolling: boolean) {
    this.isUserScrolling = scrolling;
    if (scrolling) {
      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isUserScrolling = false;
      }, 3500); // Re-engage auto-follow 3.5s after user stops dragging
    }
  }
}

export const subtitleSyncTracker = new SubtitleSyncTracker();
