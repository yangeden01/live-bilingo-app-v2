import { useState, useEffect, useRef, useCallback } from 'react';
import { SubtitleItem } from '../types';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';
import { sanitizeTranscriptText, isHallucinationLoop } from '../utils/textSanitizer';
import { isStationUrlMatch } from '../utils/stationHelper';
import { getPersistentItem, setPersistentItem } from '../utils/persistentStorage';
import {
  YouTubeLiveNewsChannel,
  YOUTUBE_LIVE_NEWS_CHANNELS,
  matchLiveNewsChannel,
} from '../utils/youtubeLiveChannels';

interface UseYouTubeLiveGroqSubtitlesOptions {
  enabled: boolean;
  videoId?: string | null;
  title?: string | null;
  url?: string | null;
  isPlaying?: boolean;
}

export interface UseYouTubeLiveGroqSubtitlesReturn {
  liveSubtitles: SubtitleItem[];
  activeSubtitleId: string | null;
  activeChannel: YouTubeLiveNewsChannel;
  setActiveChannel: (channel: YouTubeLiveNewsChannel) => void;
  channels: YouTubeLiveNewsChannel[];
  isConnected: boolean;
  modelName: string;
  totalCapturedCount: number;
  clearSubtitles: () => void;
  toggleBookmark: (id: string) => void;
}

export function useYouTubeLiveGroqSubtitles({
  enabled,
  videoId,
  title,
  url,
  isPlaying = true,
}: UseYouTubeLiveGroqSubtitlesOptions): UseYouTubeLiveGroqSubtitlesReturn {
  const [activeChannel, setActiveChannelState] = useState<YouTubeLiveNewsChannel>(() =>
    matchLiveNewsChannel(videoId, title, url)
  );
  const activeChannelRef = useRef<YouTubeLiveNewsChannel>(activeChannel);
  activeChannelRef.current = activeChannel;

  const [liveSubtitles, setLiveSubtitles] = useState<SubtitleItem[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [modelName, setModelName] = useState<string>('Groq Whisper Large V3 Turbo');
  const [totalCapturedCount, setTotalCapturedCount] = useState<number>(0);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<any>(null);

  // When videoId or title changes, update the matched live channel if user hasn't overridden
  useEffect(() => {
    if (!enabled) return;
    const matched = matchLiveNewsChannel(videoId, title, url);
    setActiveChannelState(matched);
  }, [enabled, videoId, title, url]);

  // Load persistent cached subtitles for current channel on channel change
  useEffect(() => {
    if (!enabled) return;
    // Reset seenIds on channel switch so new channel has a fresh, isolated subtitle feed
    seenIdsRef.current.clear();

    const cacheKey = `youtube_live_subtitles_${activeChannel.id}`;
    try {
      const saved = getPersistentItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(
            (item: SubtitleItem) =>
              item &&
              item.id &&
              item.english &&
              !isHallucinationLoop(item.english) &&
              (!item.stationUrl || isStationUrlMatch(item.stationUrl, activeChannel.streamUrl))
          );
          if (valid.length > 0) {
            // Sort descending by createdAt so newest is at the top
            valid.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            valid.forEach((item: SubtitleItem) => seenIdsRef.current.add(item.id));
            setLiveSubtitles(valid);
            setTotalCapturedCount(valid.length);
            setActiveSubtitleId(valid[0]?.id || null);
            return;
          }
        }
      }
    } catch (_) {}

    // Initial welcoming subtitle for the channel
    const now = Date.now();
    const initItem: SubtitleItem = {
      id: `live-init-${activeChannel.id}-${now}`,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      createdAt: now,
      english: `Connected to ${activeChannel.englishName} 24/7 Live Stream. Groq Whisper AI speech recognition and bilingual translation pipeline active.`,
      traditionalChinese: `【${activeChannel.name} 即時連線】Groq Whisper AI 語音辨識與中英對齊翻譯引擎已成功連線，即時生成雙語學習字幕。`,
      isFinal: true,
      stationUrl: activeChannel.streamUrl,
      stationName: activeChannel.name,
    };
    seenIdsRef.current.add(initItem.id);
    setLiveSubtitles([initItem]);
    setActiveSubtitleId(initItem.id);
    setTotalCapturedCount(1);
  }, [enabled, activeChannel.id, activeChannel.streamUrl, activeChannel.englishName, activeChannel.name]);

  // Handle incoming subtitle
  const handleIncomingSubtitle = useCallback((item: SubtitleItem) => {
    if (!item || !item.id || !item.english) return;
    if (seenIdsRef.current.has(item.id)) return;

    // Filter out internal system messages
    if (item.id.startsWith('station-play-') || item.english.includes('Connected to live radio stream')) {
      return;
    }

    // Station Isolation: Subtitle must belong to the active channel
    const curStream = activeChannelRef.current.streamUrl;
    const curName = activeChannelRef.current.name;
    if (item.stationUrl && !isStationUrlMatch(item.stationUrl, curStream)) {
      const isNameMatch = item.stationName && (item.stationName.includes(curName) || curName.includes(item.stationName));
      if (!isNameMatch) {
        return; // Discard: belongs to a different channel!
      }
    }

    const cleanedEnglish = sanitizeTranscriptText(item.english);
    if (cleanedEnglish.length < 3 || isHallucinationLoop(cleanedEnglish)) {
      return;
    }

    seenIdsRef.current.add(item.id);

    const formattedItem: SubtitleItem = {
      ...item,
      english: cleanedEnglish,
      traditionalChinese: item.traditionalChinese || cleanedEnglish,
      stationUrl: curStream,
      stationName: activeChannelRef.current.name,
    };

    setLiveSubtitles((prev) => {
      // User requirement: 最新字幕在上面，舊資料往下 (Newest at top, older downwards)
      const filtered = prev.filter((p) => p.id !== formattedItem.id);
      const next = [formattedItem, ...filtered];
      // Keep up to 100 recent live subtitles
      if (next.length > 100) {
        next.pop();
      }
      try {
        const cacheKey = `youtube_live_subtitles_${activeChannelRef.current.id}`;
        setPersistentItem(cacheKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    setActiveSubtitleId(formattedItem.id);
    setTotalCapturedCount((cnt) => cnt + 1);

    // Propagate events to UI panels (including SttLatencyDebugPanel for live RPM tracking)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('new-subtitle', { detail: formattedItem }));
      window.dispatchEvent(new CustomEvent('native-subtitle', { detail: formattedItem }));
    }
  }, []);

  // Support Android Native Bridge (guarantees real-time subtitles in APK installation)
  useEffect(() => {
    if (!enabled) return;

    // 1. Notify Android Native Bridge that content mode is live-video and start background STT for this channel
    if (typeof window !== 'undefined') {
      try {
        if ((window as any).AndroidBridge?.setContentMode) {
          (window as any).AndroidBridge.setContentMode('live-video');
        }
        if ((window as any).AndroidBridge?.startLiveVideoStt) {
          (window as any).AndroidBridge.startLiveVideoStt(
            activeChannel.streamUrl,
            activeChannel.name
          );
        } else if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
          (window as any).AndroidBridge.onStationPlaybackChanged(
            activeChannel.streamUrl,
            activeChannel.name,
            true
          );
        }
      } catch (e) {
        console.warn('[YouTubeLiveGroq] AndroidBridge error:', e);
      }
    }

    // 2. Listen to native Android subtitle events dispatched by WebAppInterface
    const handleNativeEvent = (e: any) => {
      const sub = e.detail;
      if (sub && sub.id && sub.english) {
        setIsConnected(true);
        handleIncomingSubtitle({
          ...sub,
          isNative: true,
          stationUrl: activeChannel.streamUrl,
          stationName: activeChannel.name,
        });
      }
    };

    const handleWindowMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NEW_SUBTITLE' && e.data?.data) {
        setIsConnected(true);
        handleIncomingSubtitle({
          ...e.data.data,
          isNative: true,
          stationUrl: activeChannel.streamUrl,
          stationName: activeChannel.name,
        });
      }
    };

    const handleCustomSubtitle = (e: any) => {
      if (e.detail && e.detail.english) {
        setIsConnected(true);
        handleIncomingSubtitle(e.detail);
      }
    };

    window.addEventListener('native-subtitle', handleNativeEvent);
    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('new-subtitle', handleCustomSubtitle);

    const prevNativeHandler = (window as any).handleNativeSubtitle;
    (window as any).handleNativeSubtitle = (sub: any) => {
      if (sub && sub.id && sub.english) {
        setIsConnected(true);
        handleIncomingSubtitle({
          ...sub,
          isNative: true,
          stationUrl: activeChannel.streamUrl,
          stationName: activeChannel.name,
        });
      }
      if (typeof prevNativeHandler === 'function') {
        try {
          prevNativeHandler(sub);
        } catch (_) {}
      }
    };

    return () => {
      window.removeEventListener('native-subtitle', handleNativeEvent);
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('new-subtitle', handleCustomSubtitle);
      if ((window as any).handleNativeSubtitle) {
        (window as any).handleNativeSubtitle = prevNativeHandler;
      }
    };
  }, [enabled, activeChannel.streamUrl, activeChannel.name, isPlaying, handleIncomingSubtitle]);

  // Connect and sync backend stream when enabled
  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let isCancelled = false;

    const notifyBackend = async () => {
      try {
        // 1. Notify YouTube live sync endpoint
        const syncUrl = getApiUrl('/api/youtube-live/sync-stream');
        const res = await safeApiFetch<any>(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: activeChannel.id,
            customStreamUrl: activeChannel.streamUrl,
            name: activeChannel.name,
          }),
        });
        if (res?.data?.activeModel) {
          setModelName(
            res.data.activeModel === 'whisper-large-v3-turbo'
              ? 'Groq Whisper Large V3 Turbo'
              : 'Groq Whisper Large V3'
          );
        }

        // 2. Ensure backend radio playback state is active (unpauses STT engine)
        safeApiFetch(getApiUrl('/api/radio-playback-state'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isPlaying: true,
            streamUrl: activeChannel.streamUrl,
          }),
        }).catch(() => {});
      } catch (err) {
        console.warn('[YouTubeLiveGroq] Failed to sync stream with backend:', err);
      }
    };

    notifyBackend();

    // Immediately fetch existing recent subtitles so screen is not blank
    const fetchRecentSubtitles = async () => {
      try {
        const pollUrl = getApiUrl(
          `/api/live-subtitles?stationUrl=${encodeURIComponent(activeChannel.streamUrl)}&since=0`
        );
        const res = await safeApiFetch<any>(pollUrl);
        if (res?.data?.subtitles && Array.isArray(res.data.subtitles) && res.data.subtitles.length > 0) {
          if (!isCancelled) setIsConnected(true);
          res.data.subtitles.forEach((sub: SubtitleItem) => handleIncomingSubtitle(sub));
        }
      } catch (_) {}
    };
    fetchRecentSubtitles();

    // Concurrently run REST polling every 2.5s as rock-solid guarantee
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = setInterval(async () => {
      if (isCancelled || !enabled) return;
      try {
        const pollUrl = getApiUrl(
          `/api/live-subtitles?stationUrl=${encodeURIComponent(activeChannel.streamUrl)}&since=${Date.now() - 25000}`
        );
        const res = await safeApiFetch<any>(pollUrl);
        if (res?.data?.subtitles && Array.isArray(res.data.subtitles)) {
          if (res.data.subtitles.length > 0) setIsConnected(true);
          res.data.subtitles.forEach((sub: SubtitleItem) => handleIncomingSubtitle(sub));
        }
      } catch (_) {}
    }, 2500);

    // Setup SSE connection
    const sseUrl = getApiUrl(
      `/api/live-subtitles-stream?stationUrl=${encodeURIComponent(activeChannel.streamUrl)}`
    );

    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isCancelled) return;
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        if (isCancelled) return;
        try {
          if (!event.data || event.data === ': keepalive') return;
          const data = JSON.parse(event.data);
          if (data && data.type === 'connected') {
            setIsConnected(true);
            return;
          }
          if (data && data.english) {
            handleIncomingSubtitle(data);
          }
        } catch (e) {
          // parse error
        }
      };

      es.onerror = () => {
        if (isCancelled) return;
        // Don't mark offline if REST polling is keeping it connected
      };
    } catch (e) {
      // SSE unsupported or blocked, fallback polling already running
    }

    return () => {
      isCancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, activeChannel.streamUrl, activeChannel.id, handleIncomingSubtitle]);

  const setActiveChannel = useCallback((channel: YouTubeLiveNewsChannel) => {
    setActiveChannelState(channel);
  }, []);

  const clearSubtitles = useCallback(() => {
    setLiveSubtitles([]);
    seenIdsRef.current.clear();
    try {
      const cacheKey = `youtube_live_subtitles_${activeChannelRef.current.id}`;
      setPersistentItem(cacheKey, '[]');
    } catch (_) {}
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setLiveSubtitles((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, bookmarked: !item.bookmarked } : item
      )
    );
  }, []);

  return {
    liveSubtitles,
    activeSubtitleId,
    activeChannel,
    setActiveChannel,
    channels: YOUTUBE_LIVE_NEWS_CHANNELS,
    isConnected,
    modelName,
    totalCapturedCount,
    clearSubtitles,
    toggleBookmark,
  };
}
