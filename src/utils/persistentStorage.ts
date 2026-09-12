/**
 * Persistent Storage Helper
 * 
 * Provides unified dual-layer persistence using browser localStorage and
 * Android native SharedPreferences via JavascriptInterface.
 * 
 * Guarantees that subtitles, history, bookmarks, stations, vocabulary,
 * and user preferences survive app restarts and system process recycling.
 */

export function getPersistentItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') {
      // 1. Try browser localStorage first
      const localVal = window.localStorage?.getItem(key);
      if (localVal !== null && localVal !== undefined && localVal !== '') {
        return localVal;
      }

      // 2. Fallback to Android Native SharedPreferences
      const nativeBridge = (window as any).AndroidBridge;
      if (nativeBridge && typeof nativeBridge.getPersistentData === 'function') {
        const nativeVal = nativeBridge.getPersistentData(key);
        if (nativeVal && typeof nativeVal === 'string' && nativeVal.trim() !== '') {
          // Synchronize back to localStorage for faster subsequent reads
          try {
            window.localStorage?.setItem(key, nativeVal);
          } catch (_) {}
          return nativeVal;
        }
      }
    }
  } catch (e) {
    console.warn('[PersistentStorage] getPersistentItem error for key:', key, e);
  }
  return null;
}

export function setPersistentItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      // 1. Save to browser localStorage
      try {
        window.localStorage?.setItem(key, value);
      } catch (e) {
        console.warn('[PersistentStorage] localStorage setItem error:', e);
      }

      // 2. Dual-save to Android Native SharedPreferences
      const nativeBridge = (window as any).AndroidBridge;
      if (nativeBridge && typeof nativeBridge.savePersistentData === 'function') {
        try {
          nativeBridge.savePersistentData(key, value);
        } catch (e) {
          console.warn('[PersistentStorage] AndroidBridge savePersistentData error:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[PersistentStorage] setPersistentItem error for key:', key, e);
  }
}

export function removePersistentItem(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(key);
      } catch (_) {}

      const nativeBridge = (window as any).AndroidBridge;
      if (nativeBridge && typeof nativeBridge.savePersistentData === 'function') {
        try {
          nativeBridge.savePersistentData(key, '');
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('[PersistentStorage] removePersistentItem error for key:', key, e);
  }
}
