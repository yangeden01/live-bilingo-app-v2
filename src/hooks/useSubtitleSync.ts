import React, { useEffect, useRef, useCallback } from 'react';
import { SubtitleItem, PlaybackStatus, RadioStation } from '../types';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';
import { clientSubtitleEngine } from '../utils/clientSubtitleEngine';
import { DecoupledTimeAligner } from '../utils/DecoupledTimeAligner';
import { sanitizeTranscriptText, isHallucinationLoop } from '../utils/textSanitizer';
import { recordSttStreamLatency } from '../main';

interface UseSubtitleSyncOptions {
  playbackStatus: PlaybackStatus;
  activeStation: RadioStation;
  onNewSubtitle: (item: SubtitleItem) => void;
  onInterimSubtitle?: (item: SubtitleItem | null) => void;
  setSttConnected: (connected: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useSubtitleSync({
  playbackStatus,
  activeStation,
  onNewSubtitle,
  onInterimSubtitle,
  setSttConnected,
  audioRef,
}: UseSubtitleSyncOptions) {
  const timeAlignerRef = useRef<DecoupledTimeAligner | null>(null);
  const playbackStatusRef = useRef(playbackStatus);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastProcessedSubtitleIdRef = useRef<Set<string>>(new Set());
  const lastSubtitleReceivedTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    playbackStatusRef.current = playbackStatus;
  }, [playbackStatus]);

  // Initialize DecoupledTimeAligner
  useEffect(() => {
    const aligner = new DecoupledTimeAligner(
      (item) => {
        onNewSubtitle(item);
      },
      (interimItem) => {
        if (onInterimSubtitle) {
          onInterimSubtitle(interimItem);
        }
      }
    );
    aligner.start();
    timeAlignerRef.current = aligner;

    return () => {
      aligner.stop();
      timeAlignerRef.current = null;
    };
  }, [onNewSubtitle, onInterimSubtitle]);

  // Unified ingestion & dispatch method for all subtitle sources
  const ingestSubtitle = useCallback(
    (item: SubtitleItem) => {
      if (!item || !item.id || !item.english) return;

      lastSubtitleReceivedTimeRef.current = Date.now();

      // Filter out internal system connection notifications
      if (item.id.startsWith('station-play-') || item.english.includes('Connected to live radio stream')) {
        return;
      }

      // Sanitize text loops and discard hallucination loops
      const cleanedEnglish = sanitizeTranscriptText(item.english);
      if (cleanedEnglish.length < 3) return;
      if (isHallucinationLoop(cleanedEnglish)) {
        console.log('[Subtitle] Filtered out speech hallucination loop:', cleanedEnglish.substring(0, 40));
        return;
      }

      const sanitizedItem: SubtitleItem = {
        ...item,
        english: cleanedEnglish,
      };

      // De-duplicate final subtitles (keep memory size capped at 100)
      if (sanitizedItem.isFinal) {
        if (lastProcessedSubtitleIdRef.current.has(sanitizedItem.id)) return;
        lastProcessedSubtitleIdRef.current.add(sanitizedItem.id);
        if (lastProcessedSubtitleIdRef.current.size > 100) {
          const firstKey = lastProcessedSubtitleIdRef.current.values().next().value;
          if (firstKey) lastProcessedSubtitleIdRef.current.delete(firstKey);
        }
      }

      if (timeAlignerRef.current) {
        const currentTime = audioRef.current?.currentTime;
        timeAlignerRef.current.enqueue(sanitizedItem, currentTime);
      } else {
        onNewSubtitle(sanitizedItem);
      }
    },
    [audioRef, onNewSubtitle]
  );

  const clearQueue = useCallback(() => {
    if (timeAlignerRef.current) {
      timeAlignerRef.current.clear();
    }
  }, []);

  // 1. Native Android Subtitle & Bridge Synchronization Listener
  useEffect(() => {
    (window as any).handleNativeSubtitle = (sub: any) => {
      if (sub && sub.id && sub.english) {
        lastSubtitleReceivedTimeRef.current = Date.now();
        const zh = sub.traditionalChinese || sub.english;
        const latencyMs = sub.createdAt ? Math.max(0, Date.now() - Number(sub.createdAt)) : 120;
        recordSttStreamLatency('Android Native STT', latencyMs, {
          english: sub.english,
          id: sub.id,
          createdAt: sub.createdAt,
        });
        setSttConnected(true);
        ingestSubtitle({ ...sub, traditionalChinese: zh, isNative: true });
      }
    };

    const handleNativeEvent = (e: any) => {
      const sub = e.detail;
      if (sub && sub.id && sub.english) {
        lastSubtitleReceivedTimeRef.current = Date.now();
        const zh = sub.traditionalChinese || sub.english;
        const latencyMs = sub.createdAt ? Math.max(0, Date.now() - Number(sub.createdAt)) : 120;
        recordSttStreamLatency('Android Native STT', latencyMs, {
          english: sub.english,
          id: sub.id,
          createdAt: sub.createdAt,
        });
        setSttConnected(true);
        ingestSubtitle({ ...sub, traditionalChinese: zh, isNative: true });
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'STT_CONNECTION_STATE') {
        setSttConnected(!!e.data.connected);
      } else if (e.data?.type === 'NEW_SUBTITLE' && e.data?.data) {
        const sub = e.data.data;
        if (sub && sub.id && sub.english) {
          lastSubtitleReceivedTimeRef.current = Date.now();
          const zh = sub.traditionalChinese || sub.english;
          const latencyMs = sub.createdAt ? Math.max(0, Date.now() - Number(sub.createdAt)) : 120;
          recordSttStreamLatency('Android Native STT', latencyMs, {
            english: sub.english,
            id: sub.id,
            createdAt: sub.createdAt,
          });
          setSttConnected(true);
          ingestSubtitle({ ...sub, traditionalChinese: zh, isNative: true });
        }
      }
    };

    window.addEventListener('native-subtitle', handleNativeEvent);
    window.addEventListener('message', handleMessage);

    return () => {
      delete (window as any).handleNativeSubtitle;
      window.removeEventListener('native-subtitle', handleNativeEvent);
      window.removeEventListener('message', handleMessage);
    };
  }, [ingestSubtitle, setSttConnected]);

  // 2. Notify Android Bridge & Backend Server on Station / Playback State Change
  useEffect(() => {
    const isPlaying = playbackStatus === 'PLAYING' || playbackStatus === 'BUFFERING';

    const notifyBridge = () => {
      try {
        if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
          (window as any).AndroidBridge.onStationPlaybackChanged(
            activeStation.streamUrl,
            activeStation.name,
            isPlaying
          );
        }
      } catch (e) {
        console.warn('AndroidBridge STT sync notice:', e);
      }
    };

    notifyBridge();
    // Retry in 500ms if bridge was initializing
    const bridgeRetry = setTimeout(notifyBridge, 500);

    safeApiFetch('/api/radio-playback-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying, streamUrl: activeStation.streamUrl }),
    }).catch(() => {});

    return () => clearTimeout(bridgeRetry);
  }, [activeStation.streamUrl, activeStation.name, playbackStatus]);

  // 3. Primary SSE Stream with REST polling fallback & Autonomous Recovery Watchdog
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let livenessWatchdogInterval: NodeJS.Timeout | null = null;
    let es: EventSource | null = null;
    let lastPollTimestamp = 0;
    let lastSubtitleReceivedTime = Date.now();

    const pollSubtitles = async (forceRecent = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (playbackStatusRef.current !== 'PLAYING' && playbackStatusRef.current !== 'BUFFERING') return;

      try {
        const queryTimestamp = forceRecent ? Math.max(0, Date.now() - 8000) : lastPollTimestamp;
        const url = getApiUrl(`/api/live-subtitles?since=${queryTimestamp}`);
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.subtitles) && json.subtitles.length > 0) {
            setSttConnected(true);
            lastSubtitleReceivedTime = Date.now();
            json.subtitles.forEach((sub: any) => {
              if (sub && sub.id && sub.english && sub.traditionalChinese) {
                const subCreatedAt = sub.createdAt || Date.now();
                if (subCreatedAt > lastPollTimestamp) {
                  lastPollTimestamp = Math.max(lastPollTimestamp, subCreatedAt);
                }
                const localFormattedTime = new Date(subCreatedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                });
                const newItem: SubtitleItem = {
                  id: sub.id,
                  timestamp: localFormattedTime,
                  createdAt: subCreatedAt,
                  english: sub.english,
                  traditionalChinese: sub.traditionalChinese,
                  isFinal: true,
                };
                const latencyMs = Math.max(0, Date.now() - subCreatedAt);
                recordSttStreamLatency('REST Polling Fallback', latencyMs, {
                  english: sub.english,
                  id: sub.id,
                  createdAt: subCreatedAt,
                });
                clientSubtitleEngine.recordExternalSubtitle();
                if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
                  ingestSubtitle(newItem);
                }
              }
            });
          }
        }
      } catch (err) {
        // quiet fallback
      }
    };

    const connectSSE = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSttConnected(false);
        return;
      }

      if (es) {
        es.close();
      }

      try {
        es = new EventSource(getApiUrl('/api/live-subtitles-stream'));
        eventSourceRef.current = es;

        es.onopen = () => {
          setSttConnected(true);
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id && data.english && data.traditionalChinese) {
              const createdAt = data.createdAt || Date.now();
              lastPollTimestamp = Math.max(lastPollTimestamp, createdAt);
              lastSubtitleReceivedTime = Date.now();

              if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
                const localFormattedTime = new Date(createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                });

                const newItem: SubtitleItem = {
                  id: data.id,
                  timestamp: localFormattedTime,
                  createdAt: createdAt,
                  english: data.english,
                  traditionalChinese: data.traditionalChinese,
                  isFinal: true,
                };

                const latencyMs = Math.max(0, Date.now() - createdAt);
                recordSttStreamLatency('Server SSE Stream', latencyMs, {
                  english: data.english,
                  id: data.id,
                  createdAt: createdAt,
                });

                clientSubtitleEngine.recordExternalSubtitle();
                ingestSubtitle(newItem);
              }
            }
          } catch (err) {
            console.error('SSE JSON parse error:', err);
          }
        };

        es.onerror = () => {
          setSttConnected(false);
          if (es) {
            try {
              es.close();
            } catch (e) {}
          }
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          if (typeof navigator === 'undefined' || navigator.onLine) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connectSSE();
            }, 3000);
          }
        };
      } catch (e) {
        setSttConnected(false);
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSSE();
          }, 3000);
        }
      }
    };

    connectSSE();
    pollSubtitles();
    pollInterval = setInterval(pollSubtitles, 2500);

    // Subtitle Liveness Watchdog: Ensures subtitles resume immediately if stalled
    livenessWatchdogInterval = setInterval(() => {
      if (playbackStatusRef.current === 'PLAYING') {
        const now = Date.now();
        const isNativeApp = typeof window !== 'undefined' && !!(window as any).AndroidBridge;

        // In Native Android APK mode, RadioStreamSttManager has its own independent audio packet watchdog.
        // We only trigger web server notification if non-native web mode is stalled > 30s.
        if (!isNativeApp && now - lastSubtitleReceivedTimeRef.current > 30000) {
          console.log('[Subtitle Watchdog] Stalled web subtitle flow detected (>30s). Re-syncing STT pipeline...');
          lastSubtitleReceivedTimeRef.current = now;
          safeApiFetch('/api/notify-station-playing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name, forceRestart: true }),
          }).catch(() => {});

          pollSubtitles(true);
          if (!es || es.readyState === EventSource.CLOSED) {
            connectSSE();
          }
        }
      }
    }, 5000);

    const triggerComprehensiveSubtitleRecovery = () => {
      console.log('[Subtitle Sync] Restoring subtitle sync across SSE, Android Bridge & REST polling...');
      lastPollTimestamp = Math.max(0, Date.now() - 6000);
      lastSubtitleReceivedTimeRef.current = Date.now();

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      connectSSE();
      pollSubtitles(true);
      clientSubtitleEngine.onNetworkRestored();

      try {
        if ((window as any).AndroidBridge?.onNetworkRestored) {
          (window as any).AndroidBridge.onNetworkRestored();
        }
        if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
          (window as any).AndroidBridge.onStationPlaybackChanged(
            activeStation.streamUrl,
            activeStation.name,
            true
          );
        }
      } catch (e) {}

      timeAlignerRef.current?.flushAll();
    };

    const handleOnline = () => {
      console.log('[Subtitle Sync] Online event detected.');
      triggerComprehensiveSubtitleRecovery();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NETWORK_RESTORED') {
        console.log('[Subtitle Sync] Android NETWORK_RESTORED message received.');
        triggerComprehensiveSubtitleRecovery();
      }
    };

    const handleRadioNetworkRestored = () => {
      console.log('[Subtitle Sync] Radio network restored event received.');
      triggerComprehensiveSubtitleRecovery();
    };

    const handleOffline = () => {
      setSttConnected(false);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (es) {
        try {
          es.close();
        } catch (e) {}
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('message', handleMessage);
    window.addEventListener('radio-network-restored', handleRadioNetworkRestored);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('radio-network-restored', handleRadioNetworkRestored);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (livenessWatchdogInterval) clearInterval(livenessWatchdogInterval);
      if (es) es.close();
    };
  }, [activeStation.streamUrl, activeStation.name, ingestSubtitle, setSttConnected]);

  // 4. Client-side Speech Recognition Engine Autonomous Failover
  useEffect(() => {
    if (playbackStatus === 'PLAYING') {
      clientSubtitleEngine.start(
        activeStation,
        (item) => {
          recordSttStreamLatency('Client Web STT', 250, {
            english: item.english,
            id: item.id,
            createdAt: item.createdAt,
          });
          ingestSubtitle(item);
        },
        (connected) => {
          setSttConnected(connected);
        }
      );
    } else {
      clientSubtitleEngine.stop();
    }

    return () => {
      clientSubtitleEngine.stop();
    };
  }, [playbackStatus, activeStation, ingestSubtitle, setSttConnected]);

  return {
    ingestSubtitle,
    clearQueue,
  };
}
