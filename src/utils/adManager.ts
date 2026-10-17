import { RewardType, RewardFeatureInfo } from '../types';

export const REWARD_FEATURES: Record<RewardType, RewardFeatureInfo> = {
  vip_pass: {
    title: '👑 今日 VIP 免廣告學習卡',
    description: '觀看 1 則 30 秒贊助短片，即可享受 2 小時完全無插頁廣告的純淨沉浸學習！',
    badge: '最受歡迎',
    icon: '👑',
    durationText: '解鎖 2 小時全站免廣告',
  },
  ai_analysis: {
    title: '✨ AI 語境深度解析 & 搭配詞',
    description: '深度分析當前句子語法結構、母語者道地習慣搭配、易混淆同義詞與即時例句生成。',
    badge: '高效提分',
    icon: '✨',
    durationText: '解鎖 10 次 AI 深度解析',
  },
  export_notes: {
    title: '📝 完整雙語字幕 & 單字筆記匯出',
    description: '一鍵將當前影片的中英完整雙語對照字幕與標記生字匯出為 TXT / Anki 牌組。',
    badge: '溫習必備',
    icon: '📝',
    durationText: '解鎖 24 小時無限制匯出',
  },
  unlimited_tts: {
    title: '🔊 原生擬真英語發音無限制聽',
    description: '無限制朗讀單字與例句，支援 0.5x~2.0x 慢速精準跟讀特訓。',
    badge: '口說聽力',
    icon: '🔊',
    durationText: '解鎖 24 小時無限發音',
  },
};

const VIP_EXPIRY_KEY = 'bilingo_vip_expiry_ts';
const AI_CREDITS_KEY = 'bilingo_ai_analysis_credits';
const EXPORT_EXPIRY_KEY = 'bilingo_export_expiry_ts';
const TTS_EXPIRY_KEY = 'bilingo_tts_expiry_ts';
const LAST_INTERSTITIAL_KEY = 'bilingo_last_interstitial_ts';

// Frequency cap: at least 3 minutes between interstitial ads
const MIN_INTERSTITIAL_GAP_MS = 180_000;

export class AdManager {
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
        console.error('[AdManager] listener error:', e);
      }
    });
  }

  // --- VIP Ad-Free Status ---
  static isVipAdFree(): boolean {
    try {
      const expiry = parseInt(localStorage.getItem(VIP_EXPIRY_KEY) || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  static getVipRemainingMinutes(): number {
    try {
      const expiry = parseInt(localStorage.getItem(VIP_EXPIRY_KEY) || '0', 10);
      const remainMs = expiry - Date.now();
      return remainMs > 0 ? Math.ceil(remainMs / 60000) : 0;
    } catch {
      return 0;
    }
  }

  // --- AI Analysis Credits ---
  static getAiAnalysisCredits(): number {
    try {
      const credits = parseInt(localStorage.getItem(AI_CREDITS_KEY) || '3', 10); // default 3 free queries
      return Math.max(0, credits);
    } catch {
      return 3;
    }
  }

  static hasAiAnalysisCredits(): boolean {
    return this.isVipAdFree() || this.getAiAnalysisCredits() > 0;
  }

  static consumeAiAnalysisCredit(): boolean {
    if (this.isVipAdFree()) return true;
    const current = this.getAiAnalysisCredits();
    if (current > 0) {
      localStorage.setItem(AI_CREDITS_KEY, String(current - 1));
      this.notify();
      return true;
    }
    return false;
  }

  // --- Export Notes Access ---
  static hasExportAccess(): boolean {
    if (this.isVipAdFree()) return true;
    try {
      const expiry = parseInt(localStorage.getItem(EXPORT_EXPIRY_KEY) || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  // --- Unlimited TTS Access ---
  static hasUnlimitedTtsAccess(): boolean {
    if (this.isVipAdFree()) return true;
    try {
      const expiry = parseInt(localStorage.getItem(TTS_EXPIRY_KEY) || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  // --- Grant Reward ---
  static grantReward(type: RewardType): void {
    const now = Date.now();
    switch (type) {
      case 'vip_pass':
        // Grant 2 hours VIP
        localStorage.setItem(VIP_EXPIRY_KEY, String(now + 2 * 60 * 60 * 1000));
        break;
      case 'ai_analysis':
        // Grant 10 credits
        const curr = this.getAiAnalysisCredits();
        localStorage.setItem(AI_CREDITS_KEY, String(curr + 10));
        break;
      case 'export_notes':
        // Grant 24 hours export access
        localStorage.setItem(EXPORT_EXPIRY_KEY, String(now + 24 * 60 * 60 * 1000));
        break;
      case 'unlimited_tts':
        // Grant 24 hours unlimited pronunciation
        localStorage.setItem(TTS_EXPIRY_KEY, String(now + 24 * 60 * 60 * 1000));
        break;
    }
    this.notify();
  }

  // --- Interstitial Ad Trigger ---
  static triggerInterstitialAd(source = 'navigation'): boolean {
    if (this.isVipAdFree()) {
      console.log('[AdManager] VIP Ad-Free active, skipping interstitial.');
      return false;
    }

    const now = Date.now();
    const lastTime = parseInt(localStorage.getItem(LAST_INTERSTITIAL_KEY) || '0', 10);
    if (now - lastTime < MIN_INTERSTITIAL_GAP_MS) {
      console.log(`[AdManager] Interstitial frequency cap active. Source: ${source}`);
      return false;
    }

    localStorage.setItem(LAST_INTERSTITIAL_KEY, String(now));

    // Check Android native
    const android = (window as unknown as { Android?: { showInterstitialAd?: (isVip: boolean) => void } }).Android;
    if (android && typeof android.showInterstitialAd === 'function') {
      console.log('[AdManager] Showing native interstitial ad via Android bridge.');
      android.showInterstitialAd(false);
      return true;
    }

    // Web fallback event for interactive testing
    window.dispatchEvent(new CustomEvent('SHOW_WEB_INTERSTITIAL', { detail: { source } }));
    return true;
  }

  // --- Rewarded Ad Request ---
  static async requestRewardedAd(type: RewardType): Promise<boolean> {
    const android = (window as unknown as {
      Android?: { showRewardedAd?: (type: string, callbackId: string) => void };
      __ad_callbacks?: Record<string, (res: { success: boolean; rewardType: string }) => void>;
    }).Android;

    if (android && typeof android.showRewardedAd === 'function') {
      return new Promise<boolean>((resolve) => {
        const callbackId = 'ad_cb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const win = window as unknown as {
          __ad_callbacks?: Record<string, (res: { success: boolean; rewardType: string }) => void>;
        };
        if (!win.__ad_callbacks) win.__ad_callbacks = {};

        win.__ad_callbacks[callbackId] = (result) => {
          if (result && result.success) {
            AdManager.grantReward(type);
            resolve(true);
          } else {
            resolve(false);
          }
        };

        // Safety timeout in case ad fails silently
        setTimeout(() => {
          if (win.__ad_callbacks && win.__ad_callbacks[callbackId]) {
            delete win.__ad_callbacks[callbackId];
            resolve(false);
          }
        }, 60000);

        try {
          android.showRewardedAd(type, callbackId);
        } catch (e) {
          console.error('[AdManager] Error calling native showRewardedAd:', e);
          resolve(false);
        }
      });
    }

    // Web fallback: Dispatch custom event to open Web Rewarded Ad Modal
    return new Promise<boolean>((resolve) => {
      const handler = (e: Event) => {
        const customEvent = e as CustomEvent<{ success: boolean; rewardType: RewardType }>;
        if (customEvent.detail.rewardType === type) {
          window.removeEventListener('WEB_REWARDED_AD_RESULT', handler);
          if (customEvent.detail.success) {
            AdManager.grantReward(type);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };

      window.addEventListener('WEB_REWARDED_AD_RESULT', handler);
      window.dispatchEvent(new CustomEvent('SHOW_WEB_REWARDED_MODAL', { detail: { rewardType: type } }));
    });
  }
}
