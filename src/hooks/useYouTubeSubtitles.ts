import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { YouTubeSubtitleItem, YouTubeErrorCode } from '../types';
import { getCachedYouTubeData, saveCachedYouTubeData } from '../utils/youtubeCache';
import { normalizeCaptionSegments } from '../utils/captionNormalizer';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';

const BATCH_SIZE = 12;

export interface YouTubeSubtitlesState {
  subtitles: YouTubeSubtitleItem[];
  activeSubtitleId: string | null;
  activeSubtitleIndex: number;
  status: 'idle' | 'loading' | 'translating' | 'ready' | 'error';
  title: string;
  duration: number;
  progress: {
    translated: number;
    total: number;
    percent: number;
  };
  error: {
    code: YouTubeErrorCode;
    message: string;
  } | null;
  retry: () => void;
}

export function useYouTubeSubtitles(
  videoId: string | null,
  currentTimeSeconds: number
): YouTubeSubtitlesState {
  const [subtitles, setSubtitles] = useState<YouTubeSubtitleItem[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'translating' | 'ready' | 'error'>('idle');
  const [title, setTitle] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [progress, setProgress] = useState({ translated: 0, total: 0, percent: 0 });
  const [error, setError] = useState<{ code: YouTubeErrorCode; message: string } | null>(null);

  // Cancellation token for videoId changes
  const activeVideoIdRef = useRef<string | null>(videoId);
  const subtitlesRef = useRef<YouTubeSubtitleItem[]>([]);
  subtitlesRef.current = subtitles;

  const loadSubtitles = useCallback(async (targetVideoId: string) => {
    activeVideoIdRef.current = targetVideoId;
    setError(null);
    setSubtitles([]);
    setActiveSubtitleId(null);
    setActiveSubtitleIndex(-1);
    setProgress({ translated: 0, total: 0, percent: 0 });

    // 1. Check local persistent cache first
    const cached = getCachedYouTubeData(targetVideoId);
    if (cached && cached.subtitles && cached.subtitles.length > 0) {
      if (activeVideoIdRef.current !== targetVideoId) return;
      setSubtitles(cached.subtitles);
      setTitle(cached.title || 'YouTube Video');
      setDuration(cached.duration || 0);
      setProgress({
        translated: cached.subtitles.length,
        total: cached.subtitles.length,
        percent: 100,
      });
      setStatus('ready');
      return;
    }

    // 2. Fetch transcript from provider (Prefer Android Native Bridge when running inside Android APK)
    setStatus('loading');
    try {
      let data: any = null;

      const isAndroidBridgeAvailable = typeof (window as any).AndroidBridge?.fetchYouTubeTranscript === 'function';

      if (isAndroidBridgeAvailable) {
        console.log(`[YouTubeTranscript] Fetching via AndroidBridge for ${targetVideoId}`);
        data = await new Promise((resolve) => {
          const callbackId = 'yt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          (window as any).__yt_callbacks = (window as any).__yt_callbacks || {};

          const timeoutTimer = setTimeout(() => {
            if ((window as any).__yt_callbacks?.[callbackId]) {
              delete (window as any).__yt_callbacks[callbackId];
              console.warn(`[YouTubeTranscript] Native bridge timeout for ${targetVideoId}`);
              resolve({
                success: false,
                code: 'TRANSCRIPT_FETCH_FAILED',
                message: 'Android 原生字幕擷取超時 (Native bridge timeout)',
              });
            }
          }, 15000);

          (window as any).__yt_callbacks[callbackId] = (result: any) => {
            clearTimeout(timeoutTimer);
            const count = result?.result?.segments?.length || 0;
            console.log(`[YouTubeTranscript] Native bridge returned for ${targetVideoId}. Success: ${result?.success}, Segments: ${count}`);
            resolve(result);
          };

          try {
            (window as any).AndroidBridge.fetchYouTubeTranscript(targetVideoId, callbackId);
          } catch (e: any) {
            clearTimeout(timeoutTimer);
            delete (window as any).__yt_callbacks[callbackId];
            console.error('[YouTubeTranscript] Failed to call AndroidBridge.fetchYouTubeTranscript:', e);
            resolve({
              success: false,
              code: 'TRANSCRIPT_FETCH_FAILED',
              message: `調用原生介面失敗: ${e?.message || e}`,
            });
          }
        });
      } else {
        const transcriptUrl = getApiUrl(`/api/youtube/transcript?videoId=${encodeURIComponent(targetVideoId)}`);
        const res = await safeApiFetch<any>(transcriptUrl);
        data = res.data;
      }

      if (activeVideoIdRef.current !== targetVideoId) return;

      if (!data || !data.success || !data.result) {
        const errCode: YouTubeErrorCode = data?.code || 'TRANSCRIPT_FETCH_FAILED';
        const errMsg = data?.message || '無法取得影片英文字幕 (No captions found)';
        setError({ code: errCode, message: errMsg });
        setStatus('error');
        return;
      }

      const rawSegments = data.result.segments || [];
      const videoTitle = data.result.title || 'YouTube Video';
      const videoDuration = data.result.durationSeconds || 0;

      setTitle(videoTitle);
      setDuration(videoDuration);

      if (rawSegments.length === 0) {
        setError({
          code: 'CAPTIONS_NOT_AVAILABLE',
          message: '此影片未提供英文字幕 (English captions are not available)',
        });
        setStatus('error');
        return;
      }

      // 3. Normalize fragmented segments into natural sentences with exact timing
      const normalizedItems = normalizeCaptionSegments(targetVideoId, rawSegments);
      if (normalizedItems.length === 0) {
        setError({
          code: 'CAPTIONS_NOT_AVAILABLE',
          message: '無法解析有效的字幕句型 (Could not parse subtitle sentences)',
        });
        setStatus('error');
        return;
      }

      const totalSentences = normalizedItems.length;
      setProgress({ translated: 0, total: totalSentences, percent: 0 });
      setStatus('translating');

      // Create chunks for batch translation
      const batches: YouTubeSubtitleItem[][] = [];
      for (let i = 0; i < totalSentences; i += BATCH_SIZE) {
        batches.push(normalizedItems.slice(i, i + BATCH_SIZE));
      }

      // 4. Batch 1: Immediate translation for progressive availability
      const firstBatch = batches[0];
      const allSubtitlesState = [...normalizedItems];

      const translateBatch = async (batch: YouTubeSubtitleItem[]): Promise<Map<string, string>> => {
        const map = new Map<string, string>();
        const items = batch.map((b) => ({ id: b.id, text: b.english }));

        // 1. Android Native Bridge: bypasses Cloud Run cookie authentication wall in production APK
        const isAndroidTranslateAvailable =
          typeof (window as any).AndroidBridge?.batchTranslate === 'function';

        if (isAndroidTranslateAvailable) {
          try {
            console.log(`[useYouTubeSubtitles] Translating batch (${items.length} items) via AndroidBridge`);
            const data: any = await new Promise((resolve) => {
              const callbackId = 'tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
              (window as any).__yt_translate_callbacks = (window as any).__yt_translate_callbacks || {};

              const timeoutTimer = setTimeout(() => {
                if ((window as any).__yt_translate_callbacks?.[callbackId]) {
                  delete (window as any).__yt_translate_callbacks[callbackId];
                  console.warn('[useYouTubeSubtitles] Native bridge batchTranslate timeout');
                  resolve(null);
                }
              }, 15000);

              (window as any).__yt_translate_callbacks[callbackId] = (result: any) => {
                clearTimeout(timeoutTimer);
                resolve(result);
              };

              try {
                (window as any).AndroidBridge.batchTranslate(JSON.stringify(items), callbackId);
              } catch (bridgeErr) {
                clearTimeout(timeoutTimer);
                delete (window as any).__yt_translate_callbacks[callbackId];
                console.error('[useYouTubeSubtitles] Failed to call AndroidBridge.batchTranslate:', bridgeErr);
                resolve(null);
              }
            });

            if (data && data.success && Array.isArray(data.translations)) {
              for (const item of data.translations) {
                if (item.id && item.traditionalChinese) {
                  map.set(item.id, item.traditionalChinese);
                }
              }
              if (map.size > 0) {
                console.log(`[useYouTubeSubtitles] Native bridge translation succeeded: ${map.size} items`);
                return map;
              }
            }
          } catch (bridgeException) {
            console.warn('[useYouTubeSubtitles] Android native batchTranslate exception, falling back:', bridgeException);
          }
        }

        // 2. Web Backend Endpoint /api/youtube/batch-translate (Gemini API server-side translation)
        try {
          const payload = { items };
          const translateUrl = getApiUrl('/api/youtube/batch-translate');
          const tRes = await safeApiFetch<any>(translateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const tData = tRes.data;
          if (tData && tData.success && Array.isArray(tData.translations)) {
            for (const item of tData.translations) {
              if (item.id && item.traditionalChinese) {
                map.set(item.id, item.traditionalChinese);
              }
            }
          }
          if (map.size > 0) {
            return map;
          }
        } catch (e) {
          console.warn('[useYouTubeSubtitles] Web backend batch translation warning:', e);
        }

        return map;
      };

      const firstTranslations = await translateBatch(firstBatch);
      if (activeVideoIdRef.current !== targetVideoId) return;

      // Apply first batch translations
      for (let i = 0; i < firstBatch.length; i++) {
        const item = allSubtitlesState[i];
        const translated = firstTranslations.get(item.id);
        if (translated) {
          item.traditionalChinese = translated;
        }
      }

      // Progressive availability: unlock playback & reading immediately!
      setSubtitles([...allSubtitlesState]);
      setProgress({
        translated: firstBatch.length,
        total: totalSentences,
        percent: Math.round((firstBatch.length / totalSentences) * 100),
      });
      setStatus('ready');

      // 5. Translate remaining batches progressively in the background
      let translatedSoFar = firstBatch.length;
      for (let bIndex = 1; bIndex < batches.length; bIndex++) {
        if (activeVideoIdRef.current !== targetVideoId) return;

        const currentBatch = batches[bIndex];
        const translations = await translateBatch(currentBatch);
        if (activeVideoIdRef.current !== targetVideoId) return;

        const startIndex = bIndex * BATCH_SIZE;
        for (let j = 0; j < currentBatch.length; j++) {
          const targetIndex = startIndex + j;
          if (targetIndex < allSubtitlesState.length) {
            const translated = translations.get(allSubtitlesState[targetIndex].id);
            if (translated) {
              allSubtitlesState[targetIndex].traditionalChinese = translated;
            }
          }
        }

        translatedSoFar += currentBatch.length;
        setSubtitles([...allSubtitlesState]);
        setProgress({
          translated: translatedSoFar,
          total: totalSentences,
          percent: Math.round((translatedSoFar / totalSentences) * 100),
        });
      }

      // 6. When all batches finish, save to persistent cache
      if (activeVideoIdRef.current === targetVideoId) {
        saveCachedYouTubeData(
          targetVideoId,
          videoTitle,
          videoDuration,
          allSubtitlesState,
          'youtube-timedtext'
        );
      }
    } catch (err: any) {
      if (activeVideoIdRef.current !== targetVideoId) return;
      console.error('[useYouTubeSubtitles] Error in loadSubtitles:', err);
      setError({
        code: 'TRANSCRIPT_FETCH_FAILED',
        message: err?.message || '載入影片字幕時發生異常 (Failed to load captions)',
      });
      setStatus('error');
    }
  }, []);

  // Trigger load when videoId changes
  useEffect(() => {
    if (!videoId) {
      setStatus('idle');
      setSubtitles([]);
      setActiveSubtitleId(null);
      setActiveSubtitleIndex(-1);
      setError(null);
      return;
    }

    loadSubtitles(videoId);
  }, [videoId, loadSubtitles]);

  // Efficient subtitle synchronization based on player currentTime
  useEffect(() => {
    const list = subtitlesRef.current;
    if (list.length === 0) return;

    const currentMs = Math.round(currentTimeSeconds * 1000);

    // Fast check if active subtitle is still valid
    if (activeSubtitleIndex >= 0 && activeSubtitleIndex < list.length) {
      const active = list[activeSubtitleIndex];
      if (currentMs >= active.startMs && currentMs <= active.endMs + 300) {
        return; // Current item is still active, no state update needed
      }
    }

    // Binary search for candidate index
    let low = 0;
    let high = list.length - 1;
    let foundIndex = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const item = list[mid];

      if (currentMs >= item.startMs && currentMs <= item.endMs + 350) {
        foundIndex = mid;
        break;
      } else if (currentMs < item.startMs) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // If gap between sentences, find closest preceding sentence
    if (foundIndex === -1 && low > 0 && low <= list.length) {
      const prev = list[low - 1];
      if (currentMs >= prev.startMs && currentMs - prev.endMs <= 1500) {
        foundIndex = low - 1;
      }
    }

    if (foundIndex !== -1 && foundIndex !== activeSubtitleIndex) {
      setActiveSubtitleIndex(foundIndex);
      setActiveSubtitleId(list[foundIndex].id);
    } else if (foundIndex === -1 && activeSubtitleId !== null && (currentMs > (list[list.length - 1]?.endMs || 0) + 2000 || currentMs < list[0].startMs - 1000)) {
      setActiveSubtitleIndex(-1);
      setActiveSubtitleId(null);
    }
  }, [currentTimeSeconds, activeSubtitleIndex, activeSubtitleId]);

  return {
    subtitles,
    activeSubtitleId,
    activeSubtitleIndex,
    status,
    title,
    duration,
    progress,
    error,
    retry: () => {
      if (videoId) loadSubtitles(videoId);
    },
  };
}
