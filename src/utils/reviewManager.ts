// ReviewManager: Handles Google Play In-App Review and store ratings
// Policy compliant: No rating gating/filtering, friendly timing, and frequency capping.

import { AdManager } from './adManager';

const REVIEWED_KEY = 'bilingo_has_reviewed_app';
const LAST_PROMPT_KEY = 'bilingo_last_review_prompt_ts';
const PROMPT_COUNT_KEY = 'bilingo_review_prompt_count';
const LAUNCH_COUNT_KEY = 'bilingo_app_launch_count';

// Frequency cap: At least 7 days (604,800,000 ms) between prompts
const MIN_PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUTO_PROMPTS = 2;
const MIN_LAUNCHES_FOR_REVIEW = 3;
const MIN_SAVED_WORDS_FOR_REVIEW = 10;
const LAUNCH_PROMPT_DELAY_MS = 15 * 1000;
// A native review sheet cannot appear over a full-screen interstitial
const AD_QUIET_PERIOD_MS = 60 * 1000;

const getNativeBridge = (): any => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.AndroidBridge || win.Android || null;
};

export class ReviewManager {
  private static listeners: Set<() => void> = new Set();
  private static launchRecorded = false;
  private static nativeReviewPending = false;
  private static nativeResultListening = false;

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

  /**
   * Count this app launch and prompt shortly after the user's third one
   */
  static recordAppLaunch(): void {
    if (this.launchRecorded) return;
    this.launchRecorded = true;

    try {
      const launches = parseInt(localStorage.getItem(LAUNCH_COUNT_KEY) || '0', 10) + 1;
      localStorage.setItem(LAUNCH_COUNT_KEY, String(launches));

      if (launches >= MIN_LAUNCHES_FOR_REVIEW) {
        setTimeout(() => this.promptIfEligible('app_launch'), LAUNCH_PROMPT_DELAY_MS);
      }
    } catch (e) {
      console.warn('[ReviewManager] recordAppLaunch error:', e);
    }
  }

  static recordQuizCompleted(): void {
    this.promptIfEligible('quiz_completed');
  }

  static recordSavedWordCount(count: number): void {
    if (count >= MIN_SAVED_WORDS_FOR_REVIEW) {
      this.promptIfEligible('words_saved');
    }
  }

  private static promptIfEligible(source: string): void {
    if (this.isEligibleForAutoPrompt()) {
      this.triggerInAppReview(source);
    }
  }

  /**
   * Check if user is eligible for automatic review prompt
   */
  static isEligibleForAutoPrompt(): boolean {
    if (this.hasReviewed() || this.nativeReviewPending) return false;

    try {
      const promptCount = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
      if (promptCount >= MAX_AUTO_PROMPTS) return false;

      const lastPromptTime = parseInt(localStorage.getItem(LAST_PROMPT_KEY) || '0', 10);
      const now = Date.now();
      if (now - lastPromptTime < MIN_PROMPT_INTERVAL_MS) return false;
      if (now - AdManager.getLastInterstitialTime() < AD_QUIET_PERIOD_MS) return false;

      return true;
    } catch {
      return false;
    }
  }

  private static consumePromptQuota(): void {
    try {
      const count = parseInt(localStorage.getItem(PROMPT_COUNT_KEY) || '0', 10);
      localStorage.setItem(PROMPT_COUNT_KEY, String(count + 1));
      localStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
    } catch {}
  }

  // Native flow posts ON_IN_APP_REVIEW_FINISHED back through the WebView
  private static listenForNativeResult(): void {
    if (this.nativeResultListening || typeof window === 'undefined') return;
    this.nativeResultListening = true;

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type !== 'ON_IN_APP_REVIEW_FINISHED') return;
      this.nativeReviewPending = false;
      if (event.data.success) {
        this.consumePromptQuota();
      }
    });
  }

  /**
   * Triggers the Google Play In-App Review flow or web modal
   */
  static triggerInAppReview(source = 'manual'): void {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.requestInAppReview === 'function') {
      console.log(`[ReviewManager] Requesting official Google Play In-App Review flow (source: ${source})`);
      try {
        this.listenForNativeResult();
        this.nativeReviewPending = true;
        bridge.requestInAppReview();
        return;
      } catch (e) {
        this.nativeReviewPending = false;
        console.error('[ReviewManager] bridge.requestInAppReview error:', e);
      }
    }

    // Web or browser fallback dialog
    if (typeof window !== 'undefined') {
      this.consumePromptQuota();
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
