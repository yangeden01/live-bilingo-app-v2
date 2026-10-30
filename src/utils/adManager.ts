import { RewardType, RewardFeatureInfo } from '../types';
import { getPersistentItem, setPersistentItem } from './persistentStorage';

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

// Frequency cap: at least 2 minutes (120s) between interstitial ads
const MIN_INTERSTITIAL_GAP_MS = 120_000;

const getNativeBridge = (): any => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.AndroidBridge || win.Android || null;
};

export class AdManager {
  private static listeners: Set<() => void> = new Set();

  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static notify() {
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
      const stored = getPersistentItem(VIP_EXPIRY_KEY);
      const expiry = parseInt(stored || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  static getVipRemainingMinutes(): number {
    try {
      const stored = getPersistentItem(VIP_EXPIRY_KEY);
      const expiry = parseInt(stored || '0', 10);
      const remainMs = expiry - Date.now();
      return remainMs > 0 ? Math.ceil(remainMs / 60000) : 0;
    } catch {
      return 0;
    }
  }

  // --- AI Analysis Credits ---
  static getAiAnalysisCredits(): number {
    try {
      const stored = getPersistentItem(AI_CREDITS_KEY);
      const credits = parseInt(stored || '3', 10); // default 3 free queries
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
      const nextCredits = String(current - 1);
      setPersistentItem(AI_CREDITS_KEY, nextCredits);
      try { localStorage.setItem(AI_CREDITS_KEY, nextCredits); } catch (_) {}
      this.notify();
      return true;
    }
    return false;
  }

  // --- Export Notes Access ---
  static hasExportAccess(): boolean {
    if (this.isVipAdFree()) return true;
    try {
      const stored = getPersistentItem(EXPORT_EXPIRY_KEY);
      const expiry = parseInt(stored || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  // --- Unlimited TTS Access ---
  static hasUnlimitedTtsAccess(): boolean {
    if (this.isVipAdFree()) return true;
    try {
      const stored = getPersistentItem(TTS_EXPIRY_KEY);
      const expiry = parseInt(stored || '0', 10);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  // --- Grant Reward ---
  static grantReward(type: RewardType): void {
    const now = Date.now();
    switch (type) {
      case 'vip_pass': {
        // Grant 2 hours VIP
        const vipExpiry = String(now + 2 * 60 * 60 * 1000);
        setPersistentItem(VIP_EXPIRY_KEY, vipExpiry);
        try { localStorage.setItem(VIP_EXPIRY_KEY, vipExpiry); } catch (_) {}
        console.log(`[AdManager] Granted 2-hour VIP pass, expiry at: ${vipExpiry}`);
        break;
      }
      case 'ai_analysis': {
        // Grant 10 credits
        const curr = this.getAiAnalysisCredits();
        const updated = String(curr + 10);
        setPersistentItem(AI_CREDITS_KEY, updated);
        try { localStorage.setItem(AI_CREDITS_KEY, updated); } catch (_) {}
        break;
      }
      case 'export_notes': {
        // Grant 24 hours export access
        const expNotes = String(now + 24 * 60 * 60 * 1000);
        setPersistentItem(EXPORT_EXPIRY_KEY, expNotes);
        try { localStorage.setItem(EXPORT_EXPIRY_KEY, expNotes); } catch (_) {}
        break;
      }
      case 'unlimited_tts': {
        // Grant 24 hours unlimited pronunciation
        const expTts = String(now + 24 * 60 * 60 * 1000);
        setPersistentItem(TTS_EXPIRY_KEY, expTts);
        try { localStorage.setItem(TTS_EXPIRY_KEY, expTts); } catch (_) {}
        break;
      }
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
    const storedLast = getPersistentItem(LAST_INTERSTITIAL_KEY);
    const lastTime = parseInt(storedLast || '0', 10);
    if (now - lastTime < MIN_INTERSTITIAL_GAP_MS) {
      const remainingSec = Math.round((MIN_INTERSTITIAL_GAP_MS - (now - lastTime)) / 1000);
      console.log(`[AdManager] Interstitial frequency cap active (${remainingSec}s left). Source: ${source}`);
      return false;
    }

    setPersistentItem(LAST_INTERSTITIAL_KEY, String(now));
    try { localStorage.setItem(LAST_INTERSTITIAL_KEY, String(now)); } catch (_) {}

    // Check Android native bridge (supports both AndroidBridge and Android)
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.showInterstitialAd === 'function') {
      console.log(`[AdManager] Showing native AdMob interstitial ad via bridge (${source}).`);
      try {
        // Pause active YouTube video playback before displaying native full-screen ad
        window.dispatchEvent(new CustomEvent('youtube-pause-for-ad'));
        bridge.showInterstitialAd(false);
        return true;
      } catch (e) {
        console.error('[AdManager] bridge.showInterstitialAd error:', e);
      }
    }

    // Web fallback event for interactive testing in browser
    window.dispatchEvent(new CustomEvent('SHOW_WEB_INTERSTITIAL', { detail: { source } }));
    return true;
  }

  // --- Rewarded Ad Request ---
  static async requestRewardedAd(type: RewardType): Promise<boolean> {
    const bridge = getNativeBridge();

    if (bridge && typeof bridge.showRewardedAd === 'function') {
      return new Promise<boolean>((resolve) => {
        const callbackId = 'ad_cb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const win = window as any;
        if (!win.__ad_callbacks) win.__ad_callbacks = {};

        let isResolved = false;
        const doResolve = (status: boolean) => {
          if (isResolved) return;
          isResolved = true;
          if (win.__ad_callbacks && win.__ad_callbacks[callbackId]) {
            delete win.__ad_callbacks[callbackId];
          }
          window.removeEventListener('message', messageWatcher);
          resolve(status);
        };

        win.__ad_callbacks[callbackId] = (result: any) => {
          if (result && result.success) {
            console.log(`[AdManager] Native rewarded ad completed, granting ${type}`);
            AdManager.grantReward(type);
            doResolve(true);
          } else {
            if (type === 'vip_pass' && AdManager.isVipAdFree()) {
              console.log('[AdManager] Ad callback returned false but VIP is already active!');
              doResolve(true);
            } else {
              console.log(`[AdManager] Native rewarded ad closed without completion`);
              doResolve(false);
            }
          }
        };

        const messageWatcher = (e: MessageEvent) => {
          if (e.data?.type === 'ON_AD_REWARD_EARNED' && e.data?.rewardType === type) {
            console.log(`[AdManager] messageWatcher received ON_AD_REWARD_EARNED for ${type}`);
            AdManager.grantReward(type);
            doResolve(true);
          } else if (e.data?.type === 'ON_REWARDED_AD_CLOSED' && e.data?.rewardType === type) {
            console.log(`[AdManager] messageWatcher received ON_REWARDED_AD_CLOSED, earned: ${e.data?.earnedReward}`);
            if (e.data?.earnedReward || (type === 'vip_pass' && AdManager.isVipAdFree())) {
              AdManager.grantReward(type);
              doResolve(true);
            } else {
              setTimeout(() => {
                if (type === 'vip_pass' && AdManager.isVipAdFree()) {
                  doResolve(true);
                } else {
                  doResolve(false);
                }
              }, 400);
            }
          }
        };
        window.addEventListener('message', messageWatcher);

        // Safety timeout in case ad fails silently
        setTimeout(() => {
          if (!isResolved) {
            if (type === 'vip_pass' && AdManager.isVipAdFree()) {
              doResolve(true);
            } else {
              doResolve(false);
            }
          }
        }, 60000);

        try {
          window.dispatchEvent(new CustomEvent('youtube-pause-for-ad'));
          bridge.showRewardedAd(type, callbackId);
        } catch (e) {
          console.error('[AdManager] Error calling native showRewardedAd:', e);
          doResolve(false);
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

  static isNativeRewardedReady(): boolean {
    const bridge = getNativeBridge();
    return Boolean(bridge && typeof bridge.isRewardedAdReady === 'function' && bridge.isRewardedAdReady());
  }

  static isNativeInterstitialReady(): boolean {
    const bridge = getNativeBridge();
    return Boolean(bridge && typeof bridge.isInterstitialAdReady === 'function' && bridge.isInterstitialAdReady());
  }
}

// Global browser listeners for automatic synchronization across native Activity & WebView boundaries
if (typeof window !== 'undefined') {
  (window as any).AdManager = AdManager;

  window.addEventListener('message', (event) => {
    try {
      const data = event.data;
      if (data?.type === 'ON_AD_REWARD_EARNED' && data.rewardType) {
        console.log('[AdManager] Global event ON_AD_REWARD_EARNED:', data.rewardType);
        AdManager.grantReward(data.rewardType);
      }
      if (data?.type === 'ON_REWARDED_AD_CLOSED' && data.earnedReward && data.rewardType) {
        console.log('[AdManager] Global event ON_REWARDED_AD_CLOSED:', data.rewardType);
        AdManager.grantReward(data.rewardType);
      }
    } catch (e) {
      console.warn('[AdManager] message handler error:', e);
    }
  });

  window.addEventListener('focus', () => {
    AdManager.notify();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      AdManager.notify();
    }
  });
}

