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

