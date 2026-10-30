// ReviewManager: Handles Google Play In-App Review and store ratings
// Policy compliant: No rating gating/filtering, friendly timing, and frequency capping.

const REVIEWED_KEY = 'bilingo_has_reviewed_app';
const LAST_PROMPT_KEY = 'bilingo_last_review_prompt_ts';
const PROMPT_COUNT_KEY = 'bilingo_review_prompt_count';
const COMPLETED_VIDEOS_KEY = 'bilingo_completed_videos_count';

// Frequency cap: At least 7 days (604,800,000 ms) between prompts
const MIN_PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUTO_PROMPTS = 2;
const MIN_COMPLETED_VIDEOS_FOR_REVIEW = 2;

const getNativeBridge = (): any => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.AndroidBridge || win.Android || null;
};

export class ReviewManager {
  private static listeners: Set<() => void> = new Set();

  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('[ReviewManager] listener error:', e);
      }
    });
  }

  static hasReviewed(): boolean {
    try {
      return localStorage.getItem(REVIEWED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  static markReviewed(): void {
    try {
      localStorage.setItem(REVIEWED_KEY, 'true');
      this.notify();
    } catch {}
  }

  static getCompletedVideosCount(): number {
    try {
      return parseInt(localStorage.getItem(COMPLETED_VIDEOS_KEY) || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Record that a user has finished watching a video and check if eligible for review
   */
  static recordVideoCompletionAndCheckReview(): void {
    try {
      const current = this.getCompletedVideosCount();
      const updated = current + 1;
      localStorage.setItem(COMPLETED_VIDEOS_KEY, String(updated));
      console.log(`[ReviewManager] Completed video recorded: ${updated}/${MIN_COMPLETED_VIDEOS_FOR_REVIEW}`);

      if (this.isEligibleForAutoPrompt()) {
        // Delay slightly (1.5s) after video completion for a natural pause
        setTimeout(() => {
          this.triggerInAppReview('video_completed');
        }, 1500);
      }
    } catch (e) {
      console.warn('[ReviewManager] recordVideoCompletion error:', e);
    }
  }

  /**
   * Check if user is eligible for automatic review prompt
   */
  static isEligibleForAutoPrompt(): boolean {
    if (this.hasReviewed()) return false;

    try {
      const promptCount = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
      if (promptCount >= MAX_AUTO_PROMPTS) return false;

      const completed = this.getCompletedVideosCount();
      if (completed < MIN_COMPLETED_VIDEOS_FOR_REVIEW) return false;

      const lastPromptTime = parseInt(localStorage.getItem(LAST_PROMPT_KEY) || '0', 10);
      const now = Date.now();
      if (now - lastPromptTime < MIN_PROMPT_INTERVAL_MS) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Triggers the Google Play In-App Review flow or web modal
   */
  static triggerInAppReview(source = 'manual'): void {
    const now = Date.now();
    try {
      const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
      localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1));
      localStorage.setItem(LAST_PROMPT_KEY, String(now));
    } catch {}

    const bridge = getNativeBridge();
    if (bridge && typeof bridge.requestInAppReview === 'function') {
      console.log(`[ReviewManager] Requesting official Google Play In-App Review flow (source: ${source})`);
      try {
        bridge.requestInAppReview();
        return;
      } catch (e) {
        console.error('[ReviewManager] bridge.requestInAppReview error:', e);
      }
    }

    // Web or browser fallback dialog
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('SHOW_WEB_REVIEW_MODAL', { detail: { source } }));
    }
  }

  /**
   * Open the Google Play Store directly to write a review
   */
  static openPlayStoreReview(): void {
    this.markReviewed();
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.openPlayStoreReview === 'function') {
      console.log('[ReviewManager] Opening Play Store review via native bridge');
      bridge.openPlayStoreReview();
      return;
    }

    // Direct browser redirect to Google Play
    if (typeof window !== 'undefined') {
      const storeUrl = 'https://play.google.com/store/apps/details?id=com.livebilingo.radio';
      window.open(storeUrl, '_blank');
    }
  }
}
