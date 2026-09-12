/**
 * Haptic Vibration Utility
 * Supports Web Vibration API (navigator.vibrate) and Android WebView Native Vibrator Bridge
 */

export function vibrateDevice(pattern: number | number[] = 200): void {
  try {
    if (typeof window === 'undefined') return;

    // 1. Check Android Native Bridge if running inside Android APK
    const bridge = (window as any).AndroidBridge || (window as any).Android;
    if (bridge && typeof bridge.vibrate === 'function') {
      const duration = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
      bridge.vibrate(Math.min(Math.max(duration, 150), 500));
      return;
    }

    // 2. Check standard browser / mobile PWA Navigator Vibration API
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (err) {
    console.warn('[Haptics] Device vibration not supported or blocked:', err);
  }
}

/**
 * Vibrate for Git Push / Export update (two distinct pulses)
 */
export function vibrateGitPushSuccess(): void {
  // Strong dual pulse: 180ms on, 100ms off, 220ms on
  vibrateDevice([180, 100, 220]);
}

/**
 * Vibrate for ZIP build / completion
 */
export function vibrateZipExportSuccess(): void {
  // Triple pulse: 120ms, 80ms, 120ms, 80ms, 160ms
  vibrateDevice([120, 80, 120, 80, 160]);
}

/**
 * Micro-tick haptic feedback for reading mode magnetic snap detent
 */
export function vibrateDetentTick(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  } catch (_) {}
}
