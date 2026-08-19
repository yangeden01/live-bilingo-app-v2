// Subtitle Decoupled Time Alignment & Buffer Synchronization Engine
// Preserves pristine audio playback while dynamically pacing subtitle release according to actual audio playback clock

import { SubtitleItem } from '../types';

interface QueuedSubtitle {
  item: SubtitleItem;
  receivedAt: number; // Wall-clock timestamp when received
  releaseAt: number;  // Projected release timestamp based on audio buffer latency
}

export class DecoupledTimeAligner {
  private queue: QueuedSubtitle[] = [];
  private onReleaseCallback: ((item: SubtitleItem) => void) | null = null;
  private onInterimCallback: ((item: SubtitleItem | null) => void) | null = null;
  private timer: NodeJS.Timeout | null = null;
  private currentInterim: SubtitleItem | null = null;
  private isRunning = false;

  // Calibrated default radio playback buffer latency offset (2800ms)
  // Ensures subtitles lead the spoken audio by ~0.5s - 0.7s so user's eyes absorb the subtitle just ahead of listening
  private targetBufferDelayMs = 2800;

  constructor(onRelease: (item: SubtitleItem) => void, onInterim?: (item: SubtitleItem | null) => void) {
    this.onReleaseCallback = onRelease;
    this.onInterimCallback = onInterim || null;

    try {
      const savedOffset = localStorage.getItem('radio_subtitle_sync_offset_ms');
      if (savedOffset) {
        const parsed = Number(savedOffset);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 12000) {
          this.targetBufferDelayMs = parsed;
        }
      }
    } catch (e) {}
  }

  public setSyncOffsetMs(offsetMs: number) {
    this.targetBufferDelayMs = Math.max(0, Math.min(12000, offsetMs));
    try {
      localStorage.setItem('radio_subtitle_sync_offset_ms', String(this.targetBufferDelayMs));
    } catch (e) {}
  }

  public getSyncOffsetMs(): number {
    return this.targetBufferDelayMs;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.tick(), 150);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.currentInterim = null;
    if (this.onInterimCallback) {
      this.onInterimCallback(null);
    }
  }

  public clear() {
    this.queue = [];
    this.currentInterim = null;
    if (this.onInterimCallback) {
      this.onInterimCallback(null);
    }
  }

  /**
   * Enqueue a new subtitle from SSE, REST polling, or Android Native Bridge
   */
  public enqueue(item: SubtitleItem, audioCurrentTime?: number) {
    const now = Date.now();

    // If subtitle is an interim partial result, update the interim slot directly
    if (item.isInterim) {
      this.currentInterim = item;
      if (this.onInterimCallback) {
        this.onInterimCallback(item);
      }
      return;
    }

    // Check for duplicates in current queue
    const isAlreadyQueued = this.queue.some(q => q.item.id === item.id || (q.item.english === item.english && Math.abs((q.item.createdAt || 0) - (item.createdAt || 0)) < 3000));
    if (isAlreadyQueued) return;

    // Check if subtitle arrived from native Android bridge or late from history poll
    const age = now - (item.createdAt || now);
    const isNative = Boolean((item as any).isNative || (typeof window !== 'undefined' && (window as any).AndroidBridge));
    const effectiveDelay = isNative ? 500 : this.targetBufferDelayMs;
    const delay = age > 6000 ? 0 : effectiveDelay;

    this.queue.push({
      item: {
        ...item,
        audioTime: audioCurrentTime,
      },
      receivedAt: now,
      releaseAt: now + delay,
    });

    // Clear interim since final chunk arrived
    if (this.currentInterim) {
      this.currentInterim = null;
      if (this.onInterimCallback) {
        this.onInterimCallback(null);
      }
    }
  }

  /**
   * Periodic clock evaluation
   */
  private tick() {
    if (!this.isRunning || this.queue.length === 0) return;

    const now = Date.now();

    // Release all subtitles whose scheduled release timestamp has arrived
    while (this.queue.length > 0 && this.queue[0].releaseAt <= now) {
      const top = this.queue.shift();
      if (top && this.onReleaseCallback) {
        this.onReleaseCallback(top.item);
      }
    }

    // Safety: prevent queue from growing infinitely if user paused
    if (this.queue.length > 25) {
      while (this.queue.length > 20) {
        const top = this.queue.shift();
        if (top && this.onReleaseCallback) {
          this.onReleaseCallback(top.item);
        }
      }
    }
  }

  /**
   * Fast release all pending subtitles (e.g. on manual seek or station switch)
   */
  public flushAll() {
    while (this.queue.length > 0) {
      const top = this.queue.shift();
      if (top && this.onReleaseCallback) {
        this.onReleaseCallback(top.item);
      }
    }
    this.currentInterim = null;
    if (this.onInterimCallback) {
      this.onInterimCallback(null);
    }
  }
}
