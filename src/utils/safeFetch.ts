// Safe API Client with Auto-Debug Trigger & Self-Healing Fallback
import { getApiUrl } from './apiUrl';

export interface SafeApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  source: 'network' | 'cache' | 'fallback';
}

export interface AutoDebugEvent {
  type: 'API_404_NOT_FOUND' | 'API_HTTP_ERROR' | 'API_NETWORK_EXCEPTION' | 'UNHANDLED_ERROR';
  url?: string;
  status?: number;
  message: string;
  timestamp: number;
  details?: any;
}

// In-memory diagnostic events buffer for auto-trigger debug logs
const debugLogsBuffer: AutoDebugEvent[] = [];

export function triggerAutoDebug(event: AutoDebugEvent) {
  debugLogsBuffer.push(event);
  if (debugLogsBuffer.length > 50) {
    debugLogsBuffer.shift();
  }

  // Format log message for Android Logcat and Web Console
  const formattedMsg = `[AutoDebug][${event.type}] Status: ${event.status || 'N/A'} - ${event.url || ''} => ${event.message}`;
  console.warn(formattedMsg);

  // Send diagnostic telemetry to Android native layer if bridge is present
  try {
    if (typeof (window as any).AndroidBridge?.onDiagnosticLog === 'function') {
      (window as any).AndroidBridge.onDiagnosticLog(JSON.stringify(event));
    }
  } catch (e) {
    // Ignore bridge serialization errors
  }

  // Dispatch custom DOM event so React UI debug panels / banners can react if needed
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('bilingo:debug-event', { detail: event }));
    }
  } catch (e) {}
}

export function getDebugLogs(): AutoDebugEvent[] {
  return [...debugLogsBuffer];
}

/**
 * Universal safe API fetcher:
 * 1. Never throws fatal unhandled Promise rejections on 404 / 500 or CORS failure.
 * 2. Automatically intercepts 404 and triggers structured auto-debug logging.
 * 3. Gracefully returns provided fallbackData to keep the app rendering without white/black screens.
 */
export async function safeApiFetch<T = any>(
  endpointOrUrl: string,
  options?: RequestInit,
  fallbackData?: T
): Promise<SafeApiResponse<T>> {
  const finalUrl = endpointOrUrl.startsWith('http://') || endpointOrUrl.startsWith('https://')
    ? endpointOrUrl
    : getApiUrl(endpointOrUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout limit

  try {
    const response = await fetch(finalUrl, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    // Handle 404 or other non-2xx HTTP responses gracefully
    if (!response.ok) {
      const errorMsg = `HTTP ${response.status} (${response.statusText || 'Error'}) from ${finalUrl}`;
      
      // Auto-trigger debug diagnosis
      triggerAutoDebug({
        type: response.status === 404 ? 'API_404_NOT_FOUND' : 'API_HTTP_ERROR',
        url: finalUrl,
        status: response.status,
        message: errorMsg,
        timestamp: Date.now(),
      });

      // Attempt to read JSON error payload if available, but do not crash on HTML 404 page
      let errorBody: any = null;
      try {
        const text = await response.text();
        if (text.startsWith('{') || text.startsWith('[')) {
          errorBody = JSON.parse(text);
        }
      } catch (_) {}

      return {
        ok: false,
        status: response.status,
        data: fallbackData !== undefined ? fallbackData : null,
        error: errorMsg,
        source: fallbackData !== undefined ? 'fallback' : 'network',
      };
    }

    // Parse JSON safely
    const text = await response.text();
    if (!text || !text.trim()) {
      return {
        ok: true,
        status: response.status,
        data: (fallbackData !== undefined ? fallbackData : ({} as T)),
        source: 'network',
      };
    }

    try {
      const parsedData = JSON.parse(text) as T;
      return {
        ok: true,
        status: response.status,
        data: parsedData,
        source: 'network',
      };
    } catch (parseErr: any) {
      const parseErrorMsg = `JSON parsing failed for ${finalUrl}: ${parseErr.message}`;
      triggerAutoDebug({
        type: 'API_HTTP_ERROR',
        url: finalUrl,
        status: response.status,
        message: parseErrorMsg,
        timestamp: Date.now(),
      });

      return {
        ok: false,
        status: response.status,
        data: fallbackData !== undefined ? fallbackData : null,
        error: parseErrorMsg,
        source: fallbackData !== undefined ? 'fallback' : 'network',
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err.name === 'AbortError';
    const errorMsg = isAbort ? `Request timeout for ${finalUrl}` : `Network/CORS failure for ${finalUrl}: ${err.message}`;

    // Auto-trigger debug diagnosis without interrupting App rendering
    triggerAutoDebug({
      type: 'API_NETWORK_EXCEPTION',
      url: finalUrl,
      status: 0,
      message: errorMsg,
      timestamp: Date.now(),
    });

    return {
      ok: false,
      status: 0,
      data: fallbackData !== undefined ? fallbackData : null,
      error: errorMsg,
      source: fallbackData !== undefined ? 'fallback' : 'network',
    };
  }
}
