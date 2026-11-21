export const BACKEND_URL = 'https://ais-pre-2ezjlg7ygolcgvkdlo7zla-290275720433.asia-northeast1.run.app';

export function getApiUrl(path: string): string {
  if (!path) return path;
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  // Prepend remote BACKEND_URL ONLY when running inside native Android app or local asset environment
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      window.location.origin === 'null' ||
      window.location.href.startsWith('file://') ||
      window.location.hostname === 'appassets.android.com' ||
      !!(window as any).AndroidBridge)
  ) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${BACKEND_URL}${cleanPath}`;
  }

  // Web Browser / Localhost / Cloud Run preview uses same-origin relative path
  return path;
}

export function getWsApiUrl(path: string): string {
  const httpUrl = getApiUrl(path);
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  if (httpUrl.startsWith('http://')) {
    return httpUrl.replace('http://', 'ws://');
  }
  // Relative path on web browser
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${path.startsWith('/') ? path : '/' + path}`;
  }
  return `ws://localhost:3000${path.startsWith('/') ? path : '/' + path}`;
}


// ---- 後端暫時無法連線的記憶（2026-11-21）----
// App 內的後端（AI Studio 預覽服務）常常連不上（被導向登入頁或逾時）。為了不要每次備援都白等數秒，
// 失敗一次後 10 分鐘內直接跳過後端，之後再試。後端本身不移除，恢復正常時會自動再用。
const BACKEND_DOWN_MS = 10 * 60 * 1000;
let backendDownUntil = 0;

export function isBackendUrl(url: string): boolean {
  return url.startsWith(BACKEND_URL);
}

export function isBackendTemporarilyDown(): boolean {
  return Date.now() < backendDownUntil;
}

export function markBackendDown(): void {
  backendDownUntil = Date.now() + BACKEND_DOWN_MS;
}

export function markBackendUp(): void {
  backendDownUntil = 0;
}

/** 是否在 Android App 內（原生層注入了 AndroidBridge） */
export function isNativeAndroidApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).AndroidBridge;
}
