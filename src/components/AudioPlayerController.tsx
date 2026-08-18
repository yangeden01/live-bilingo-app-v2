import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { playBeanWallImpactSound } from '../utils/sound';
import { PlaybackStatus, RadioStation, SubtitleItem, ReadingMode } from '../types';
import { Play, Pause, Radio, Signal, Sparkles, Activity, Zap, Info, ListMusic, Plus, Timer, Clock, RefreshCw, X, Check, ChevronDown, Sun, Moon, BookOpen } from 'lucide-react';
import { MarqueeText } from './MarqueeText';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';
import { clientSubtitleEngine } from '../utils/clientSubtitleEngine';

import { DecoupledTimeAligner } from '../utils/DecoupledTimeAligner';

interface Props {
  playbackStatus: PlaybackStatus;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  onNewSubtitle: (item: SubtitleItem) => void;
  onInterimSubtitle?: (item: SubtitleItem | null) => void;
  sttConnected: boolean;
  setSttConnected: (connected: boolean) => void;
  activeStation: RadioStation;
  onOpenStationManager: () => void;
  readingMode?: ReadingMode;
  onReadingModeChange?: (mode: ReadingMode) => void;
  effectiveTheme?: 'dark' | 'light' | 'paper';
}

export const AudioPlayerController: React.FC<Props> = ({
  playbackStatus,
  setPlaybackStatus,
  onNewSubtitle,
  onInterimSubtitle,
  sttConnected,
  setSttConnected,
  activeStation,
  onOpenStationManager,
  readingMode = 'system',
  onReadingModeChange,
  effectiveTheme,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeAlignerRef = useRef<DecoupledTimeAligner | null>(null);

  // Initialize decoupled time alignment engine
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

  // Safe wrapper to dispatch subtitles through decoupled time aligner
  const dispatchSubtitleWithTimeAlignment = useCallback((item: SubtitleItem) => {
    if (timeAlignerRef.current) {
      const currentTime = audioRef.current?.currentTime;
      timeAlignerRef.current.enqueue(item, currentTime);
    } else {
      onNewSubtitle(item);
    }
  }, [onNewSubtitle]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const volumeTouchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerEndTimeRef = useRef<number | null>(null);
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
  const timerDropdownRef = useRef<HTMLDivElement>(null);

  // Close timer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timerDropdownRef.current && !timerDropdownRef.current.contains(event.target as Node)) {
        setIsTimerDropdownOpen(false);
      }
    };
    if (isTimerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTimerDropdownOpen]);

  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-reconnect & Stall Detection Refs
  const retryCountRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const lastCurrentTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: Date.now() });

  const [hasNewUpdate, setHasNewUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const CLIENT_VERSION = '1.6.0';

  // Check version API and ServiceWorker updates on mount and periodically (NO auto-reloads)
  useEffect(() => {
    const checkVersion = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const res = await safeApiFetch<{ version: string; buildTime?: string | number }>(
        '/api/version?t=' + Date.now()
      );

      if (res.ok && res.data && res.data.version) {
        const data = res.data;
        const storedBuildTime = localStorage.getItem('installed_build_time');
        const storedVersion = localStorage.getItem('installed_version');

        if (!storedBuildTime || !storedVersion) {
          localStorage.setItem('installed_build_time', String(data.buildTime || '1770500000000'));
          localStorage.setItem('installed_version', data.version);
          setHasNewUpdate(false);
        } else {
          if (data.version !== storedVersion || (data.buildTime && String(data.buildTime) !== storedBuildTime)) {
            setHasNewUpdate(true);
          } else {
            setHasNewUpdate(false);
          }
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            if (reg.waiting || reg.installing) {
              const storedVersion = localStorage.getItem('installed_version');
              if (storedVersion !== CLIENT_VERSION) {
                setHasNewUpdate(true);
              }
            }
          }
        } catch (e) {}
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateProgress(10);
    setRefreshNotice('正在準備更新...');

    try {
      await new Promise((r) => setTimeout(r, 200));
      setUpdateProgress(35);
      setRefreshNotice('正在清理舊版快取與服務 Worker...');

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active) {
            reg.active.postMessage({ type: 'PURGE_CACHE' });
          }
          await reg.unregister();
        }
      }

      setUpdateProgress(60);
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }

      setUpdateProgress(85);
      setRefreshNotice('正在下載最新版本...');
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(getApiUrl('/api/version?t=' + Date.now())).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          localStorage.setItem('installed_build_time', String(data.buildTime || '1770500000000'));
          localStorage.setItem('installed_version', data.version || CLIENT_VERSION);
        }
      } else {
        localStorage.setItem('installed_version', CLIENT_VERSION);
      }

      setUpdateProgress(100);
      setRefreshNotice('更新完成！正在重新載入...');
      await new Promise((r) => setTimeout(r, 300));

      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    } catch (e) {
      console.error('Apply update error:', e);
      window.location.reload();
    }
  };

  // Click Blue Radio Icon: Forces immediate cache purge & refresh to ensure latest frontend bundle
  const handleHiddenRefresh = async () => {
    setIsSpinning(true);
    retryCountRef.current = 0; // Reset retry counter

    if (audioRef.current) {
      lastCurrentTimeRef.current = { time: audioRef.current.currentTime, timestamp: Date.now() };
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    setRefreshNotice('正在重新載入最新版...');

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.active) {
            reg.active.postMessage({ type: 'PURGE_CACHE' });
          }
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.error('Refresh cache clear error:', e);
    }

    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 400);
  };

  // Keep a ref to latest playbackStatus so async listeners can check live pause state
  const playbackStatusRef = useRef(playbackStatus);
  useEffect(() => {
    playbackStatusRef.current = playbackStatus;
  }, [playbackStatus]);

  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Keep a ref to activeStation for reconnecting
  const activeStationRef = useRef(activeStation);
  useEffect(() => {
    activeStationRef.current = activeStation;
  }, [activeStation]);

  // Helper to ensure direct radio stream URL is extracted and played seamlessly across Web & Android
  const getProxiedStreamUrl = (rawUrl: string): string => {
    if (!rawUrl) return 'https://npr-ice.streamguys1.com/live.mp3';

    // If rawUrl is encoded like /api/radio-stream-proxy?url=https...
    if (rawUrl.includes('/api/radio-stream-proxy') && rawUrl.includes('url=')) {
      try {
        const parts = rawUrl.split('url=');
        if (parts.length > 1) {
          const decoded = decodeURIComponent(parts[1]);
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            return decoded;
          }
        }
      } catch (e) {}
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }

    if (rawUrl.startsWith('/api/radio-stream-proxy')) {
      return getApiUrl(rawUrl);
    }

    return rawUrl;
  };

  // Helper to append query parameter cleanly (? vs &)
  const addQueryParam = (baseUrl: string, key: string, value: string): string => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${key}=${encodeURIComponent(value)}`;
  };

  // Exponential Backoff Auto-Reconnect Procedure (Max 3 retries)
  const handleAutoReconnect = () => {
    if (!audioRef.current || isReconnectingRef.current) return;
    if (playbackStatusRef.current !== 'PLAYING' && playbackStatusRef.current !== 'BUFFERING') return;

    if (retryCountRef.current >= 3) {
      console.warn('[Auto-Reconnect] Exceeded maximum retry attempts (3). Updating UI to ERROR.');
      setPlaybackStatus('ERROR');
      isReconnectingRef.current = false;
      return;
    }

    isReconnectingRef.current = true;
    retryCountRef.current += 1;
    const attempt = retryCountRef.current;
    // Exponential backoff delay: 1000ms, 2000ms, 4000ms
    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);

    console.log(`[Auto-Reconnect] Attempt ${attempt}/3 initiating in ${delayMs}ms...`);
    setPlaybackStatus('BUFFERING');

    setTimeout(() => {
      if (!audioRef.current || playbackStatusRef.current === 'PAUSED') {
        isReconnectingRef.current = false;
        return;
      }

      const audio = audioRef.current;
      const baseUrl = getProxiedStreamUrl(activeStationRef.current.streamUrl);
      const freshUrl = addQueryParam(baseUrl, '_retry', String(Date.now()));
      audio.src = freshUrl;
      audio.load();

      audio
        .play()
        .then(() => {
          console.log(`[Auto-Reconnect] Attempt ${attempt}/3 succeeded! Broadcast resumed.`);
          setPlaybackStatus('PLAYING');
          isReconnectingRef.current = false;
        })
        .catch((err) => {
          console.warn(`[Auto-Reconnect] Attempt ${attempt}/3 failed:`, err);
          isReconnectingRef.current = false;
          if (retryCountRef.current < 3) {
            handleAutoReconnect();
          } else {
            setPlaybackStatus('ERROR');
          }
        });
    }, delayMs);
  };

  // Periodic Heartbeat Monitor: Detect stalled stream (currentTime freezing > 15s or unexpected pause)
  useEffect(() => {
    if (playbackStatus !== 'PLAYING') return;

    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const now = Date.now();
      const currentAudioTime = audio.currentTime;

      // For live radio streams in Android WebViews, currentTime may advance irregularly or stay constant for intervals.
      // Only treat as stalled if audio is actually paused, ended, has no data (readyState < 2),
      // AND currentTime hasn't moved for over 20 seconds.
      const isTrulyStalled =
        !audio.paused &&
        audio.readyState < 2 &&
        currentAudioTime === lastCurrentTimeRef.current.time &&
        now - lastCurrentTimeRef.current.timestamp > 20000;

      // If playback status is PLAYING but audio time hasn't advanced for >20s with no data arriving
      if (isTrulyStalled) {
        console.warn('[Stall Monitor] Broadcast audio genuinely stalled while in PLAYING state. Starting auto-reconnect...');
        lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        handleAutoReconnect();
      } else {
        // Stream is playing normally or buffer is healthy: update time record
        if (currentAudioTime !== lastCurrentTimeRef.current.time) {
          lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        }
        retryCountRef.current = 0;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playbackStatus, activeStation.streamUrl]);

  const isInitialMountRef = useRef(true);

  // When activeStation changes, update audio source. NEVER auto-play on initial load or preview reload.
  useEffect(() => {
    if (!audioRef.current) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      // Initial mount: ensure playback is paused/idle and load source without playing
      audioRef.current.load();
      return;
    }

    // On active station change by user:
    // Only auto-play if user is ALREADY actively listening
    if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
      setPlaybackStatus('BUFFERING');
      audioRef.current.load();
      audioRef.current
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          setupAudioVisualizer();
        })
        .catch((e) => {
          console.warn('Auto-play on station switch error:', e);
          setPlaybackStatus('ERROR');
        });
    } else {
      audioRef.current.load();
    }

    // Always notify backend to synchronize STT transcription for the active station
    safeApiFetch('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
    });

    // If currently playing, insert an instant station-alignment subtitle card
    if (playbackStatusRef.current === 'PLAYING') {
      const now = Date.now();
      const localFormattedTime = new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      onNewSubtitle({
        id: `station-align-${now}`,
        timestamp: localFormattedTime,
        createdAt: now,
        english: `[Live Broadcast] Tuned in to ${activeStation.name}. Real-time bilingual subtitle alignment active.`,
        traditionalChinese: `【即時廣播連線】已切換至「${activeStation.name}」，AI 雙語字幕自動對齊中。`,
        isFinal: true,
      });
    }
  }, [activeStation.id, activeStation.streamUrl, activeStation.name, onNewSubtitle]);

  const lastSseMessageTimeRef = useRef<number>(0);

  // Native Android Subtitle & Bridge Synchronization Listener
  useEffect(() => {
    // 1. Direct JS function binding for Android evaluateJavascript
    (window as any).handleNativeSubtitle = (sub: any) => {
      if (sub && sub.id && sub.english && sub.traditionalChinese) {
        setSttConnected(true);
        dispatchSubtitleWithTimeAlignment(sub);
      }
    };

    // 2. CustomEvent listener
    const handleNativeEvent = (e: any) => {
      if (e.detail && e.detail.id && e.detail.english && e.detail.traditionalChinese) {
        setSttConnected(true);
        dispatchSubtitleWithTimeAlignment(e.detail);
      }
    };

    // 3. Window message listener for connection state and subtitles
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'STT_CONNECTION_STATE') {
        setSttConnected(!!e.data.connected);
      } else if (e.data?.type === 'NEW_SUBTITLE' && e.data?.data) {
        setSttConnected(true);
        dispatchSubtitleWithTimeAlignment(e.data.data);
      }
    };

    window.addEventListener('native-subtitle', handleNativeEvent);
    window.addEventListener('message', handleMessage);

    return () => {
      delete (window as any).handleNativeSubtitle;
      window.removeEventListener('native-subtitle', handleNativeEvent);
      window.removeEventListener('message', handleMessage);
    };
  }, [dispatchSubtitleWithTimeAlignment, setSttConnected]);

  // Sync Android Native STT Pipeline & Backend STT Engine on Station / Playback Change
  useEffect(() => {
    const isPlaying = playbackStatus === 'PLAYING' || playbackStatus === 'BUFFERING';

    // 1. Notify Android Bridge if available
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

    // 2. Notify Backend server to start/pause Deepgram streaming accordingly
    safeApiFetch('/api/radio-playback-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPlaying, streamUrl: activeStation.streamUrl }),
    }).catch(() => {});
  }, [activeStation.streamUrl, activeStation.name, playbackStatus]);

  // Connect SSE with seamless REST polling fallback for background server events and real-time subtitles
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let es: EventSource | null = null;
    let lastPollTimestamp = 0;

    const pollSubtitles = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      // Only poll when user is actively playing or buffering radio
      if (playbackStatusRef.current !== 'PLAYING' && playbackStatusRef.current !== 'BUFFERING') return;

      try {
        const url = getApiUrl(`/api/live-subtitles?since=${lastPollTimestamp}`);
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.subtitles) && json.subtitles.length > 0) {
            setSttConnected(true);
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
                clientSubtitleEngine.recordExternalSubtitle();
                if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
                  dispatchSubtitleWithTimeAlignment(newItem);
                }
              }
            });
          }
        }
      } catch (err) {
        // quiet fallback error
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
          lastSseMessageTimeRef.current = Date.now();

          try {
            const data = JSON.parse(event.data);
            if (data.id && data.english && data.traditionalChinese) {
              // Filter out internal system connection notifications
              if (data.id.startsWith('station-play-') || data.english.includes('Connected to live radio stream')) {
                return;
              }

              const createdAt = data.createdAt || Date.now();
              lastPollTimestamp = Math.max(lastPollTimestamp, createdAt);
              
              // Only push new live subtitles if playback is currently active
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

                clientSubtitleEngine.recordExternalSubtitle();
                dispatchSubtitleWithTimeAlignment(newItem);
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
          if (!reconnectTimer && navigator.onLine) {
            reconnectTimer = setTimeout(() => {
              connectSSE();
            }, 4000);
          }
        };
      } catch (e) {
        setSttConnected(false);
      }
    };

    connectSSE();

    // Initial poll right away to populate any recent subtitles from server
    pollSubtitles();

    // Secondary fallback polling check every 3.5s to ensure zero subtitle missed
    pollInterval = setInterval(pollSubtitles, 3500);

    const handleOnline = () => {
      connectSSE();
      pollSubtitles();
    };
    const handleOffline = () => {
      setSttConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) es.close();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (es) es.close();
    };
  }, [onNewSubtitle, setSttConnected]);

  // Client-side Direct Live Radio Recognition Engine (Optimized SSE-first architecture with autonomous failover)
  useEffect(() => {
    if (playbackStatus === 'PLAYING') {
      clientSubtitleEngine.start(
        activeStation,
        (item) => {
          dispatchSubtitleWithTimeAlignment(item);
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
  }, [playbackStatus, activeStation, dispatchSubtitleWithTimeAlignment, setSttConnected]);

  // Client local buffer ref for live sync alignment
  const pendingEnglishBufferRef = useRef<string>('');
  const lastFlushTimeRef = useRef<number>(Date.now());

  // Method B-3: Synchronize audio player to live broadcast stream smoothly with cache flush and fast alignment
  const handleSyncLiveEdge = () => {
    if (!audioRef.current) return;
    try {
      // Clear client local transcript buffer
      pendingEnglishBufferRef.current = '';
      lastFlushTimeRef.current = Date.now();

      // Clear backend speech recognition buffer & re-sync station
      fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
      safeApiFetch('/api/notify-station-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
      }).catch(() => {});

      const audio = audioRef.current;
      audio.playbackRate = 1.0;

      setPlaybackStatus('BUFFERING');

      // Fast alignment to live edge
      if (audio.buffered && audio.buffered.length > 0) {
        const liveBufferEnd = audio.buffered.end(audio.buffered.length - 1);
        if (liveBufferEnd > 0) {
          audio.currentTime = Math.max(0, liveBufferEnd - 0.1);
        }
      }

      audio
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          setupAudioVisualizer();
        })
        .catch((err) => {
          console.error('Audio sync play error:', err);
          audio.load();
          audio
            .play()
            .then(() => {
              setPlaybackStatus('PLAYING');
              setupAudioVisualizer();
            })
            .catch(() => setPlaybackStatus('ERROR'));
        });
    } catch (err) {
      console.warn('Live sync notice:', err);
    }
  };

  // Sleep Timer Countdown Logic (自動關閉廣播) - Wait for PLAYING status before counting down
  useEffect(() => {
    if (sleepMinutes === 0 || remainingSeconds === null) {
      return;
    }

    // Do NOT count down if audio is not currently playing
    if (playbackStatus !== 'PLAYING') {
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setSleepMinutes(0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepMinutes, playbackStatus, remainingSeconds]);

  const handleSelectSleepTimer = (minutes: number) => {
    setSleepMinutes(minutes);
    setIsTimerDropdownOpen(false);
    if (minutes === 0) {
      setRemainingSeconds(null);
    } else {
      setRemainingSeconds(minutes * 60);
    }
  };

  // Configure HTML5 Media Session API for standard media keys
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activeStation.name,
          artist: 'Live Bilingo 雙語即時電台',
          album: '即時英語廣播 & AI雙語字幕',
          artwork: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ]
        });

        navigator.mediaSession.playbackState =
          playbackStatus === 'PLAYING' ? 'playing' : playbackStatus === 'PAUSED' ? 'paused' : 'none';

        navigator.mediaSession.setActionHandler('play', () => {
          if (playbackStatusRef.current !== 'PLAYING') {
            togglePlayPause();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          playbackStatusRef.current = 'STOPPED';
          setPlaybackStatus('STOPPED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if ((window as any).AndroidBridge?.stopNotificationService) {
            (window as any).AndroidBridge.stopNotificationService();
          }
        });
      } catch (e) {
        console.warn('MediaSession configuration note:', e);
      }
    }
  }, [activeStation.name, playbackStatus]);

  // Sync Android Foreground Service notification state (Only triggers on station change or playbackStatus change, never spamming)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.updatePlayerNotification) {
        if (playbackStatus === 'PLAYING' || playbackStatus === 'BUFFERING') {
          (window as any).AndroidBridge.updatePlayerNotification(activeStation.name, true);
        } else if (playbackStatus === 'PAUSED') {
          (window as any).AndroidBridge.updatePlayerNotification(activeStation.name, false);
        } else if (playbackStatus === 'STOPPED') {
          (window as any).AndroidBridge.stopNotificationService?.();
        }
      }
    } catch (e) {
      console.warn('Android notification sync notice:', e);
    }
  }, [activeStation.name, playbackStatus]);

  // Listen for media control actions triggered from the Android pull-down notification menu
  useEffect(() => {
    let lastHandledTime = 0;

    const handleAndroidMediaMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ANDROID_MEDIA_CONTROL') {
        const now = Date.now();
        // Debounce rapid duplicate events (within 300ms)
        if (now - lastHandledTime < 300) {
          return;
        }
        lastHandledTime = now;

        const action = event.data.action;
        console.log('[MediaControl] Received action from Android system notification:', action);

        if (action === 'com.bilingo.radio.ACTION_TOGGLE_PLAY') {
          const isCurrentlyPlaying = playbackStatusRef.current === 'PLAYING' || (audioRef.current && !audioRef.current.paused);
          if (isCurrentlyPlaying) {
            playbackStatusRef.current = 'PAUSED';
            setPlaybackStatus('PAUSED');
            if (audioRef.current) {
              audioRef.current.pause();
            }
          } else {
            togglePlayPause();
          }
        } else if (action === 'com.bilingo.radio.ACTION_STOP') {
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if ((window as any).AndroidBridge?.stopNotificationService) {
            (window as any).AndroidBridge.stopNotificationService();
          }
        } else if (action === 'com.bilingo.radio.ACTION_PAUSE') {
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
        } else if (action === 'com.bilingo.radio.ACTION_PLAY') {
          const isCurrentlyPlaying = playbackStatusRef.current === 'PLAYING' || (audioRef.current && !audioRef.current.paused);
          if (!isCurrentlyPlaying) {
            togglePlayPause();
          }
        }
      }
    };

    window.addEventListener('message', handleAndroidMediaMessage);
    return () => window.removeEventListener('message', handleAndroidMediaMessage);
  }, []);

  // Handle Play/Pause: Automatically reconnect to live stream and align subtitle engine immediately
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (playbackStatus === 'PLAYING') {
      playbackStatusRef.current = 'PAUSED';
      setPlaybackStatus('PAUSED');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timeAlignerRef.current) {
        timeAlignerRef.current.clear();
      }
    } else {
      // 1. Clear client local speech recognition buffer and time aligner queue
      pendingEnglishBufferRef.current = '';
      lastFlushTimeRef.current = Date.now();
      if (timeAlignerRef.current) {
        timeAlignerRef.current.clear();
      }

      // 2. Clear backend STT stream buffer asynchronously and sync active station
      fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
      safeApiFetch('/api/notify-station-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
      }).catch(() => {});

      setPlaybackStatus('BUFFERING');
      const audio = audioRef.current;
      audio.playbackRate = 1.0;

      // 3. For live radio streams: re-assign fresh live stream URL with cache buster to skip stale internal audio socket buffer
      const baseUrl = getProxiedStreamUrl(activeStation.streamUrl);
      const liveFreshUrl = addQueryParam(baseUrl, '_t', String(Date.now()));
      audio.src = liveFreshUrl;
      audio.load();

      // 4. Play fresh live audio stream cleanly
      audio
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          setupAudioVisualizer();
        })
        .catch((err) => {
          console.error('Audio play error:', err);
          audio.load();
          audio
            .play()
            .then(() => {
              setPlaybackStatus('PLAYING');
              setupAudioVisualizer();
            })
            .catch((e) => {
              console.error('Audio play retry error:', e);
              setPlaybackStatus('ERROR');
            });
        });
    }
  };

  const triggerVolumeFeedback = () => {
    setIsAdjustingVolume(true);
    if (volumeTouchTimeoutRef.current) clearTimeout(volumeTouchTimeoutRef.current);
    volumeTouchTimeoutRef.current = setTimeout(() => {
      setIsAdjustingVolume(false);
    }, 1500); // Keep popup visible for 1.5s after touch so user sees final value clearly
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    triggerVolumeFeedback();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
    triggerVolumeFeedback();
  };

  // Canvas visualizer waveform setup (non-invasive, smooth animation without hijacking HTML5 audio output)
  const setupAudioVisualizer = () => {
    drawWaveform();
  };

  const drawWaveform = () => {
    if (!canvasRef.current) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barCount = 32;
    let step = 0;

    const render = () => {
      if (document.hidden) return; // Do not render animation frames in background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / barCount) * 0.8;
      let x = 0;
      step += 0.15;

      for (let i = 0; i < barCount; i++) {
        const heightMultiplier = Math.abs(Math.sin(step + i * 0.35) * Math.cos(step * 0.8 + i * 0.2));
        const barHeight = Math.max(3, heightMultiplier * canvas.height * 0.85);

        ctx.fillStyle = playbackStatusRef.current === 'PLAYING' ? '#3B82F6' : '#94A3B8';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth + 2;
      }

      if (playbackStatusRef.current === 'PLAYING') {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();
  };

  // App Visibility & Background/Foreground Lifecycle Manager (prevents app switching crash)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded: Stop visualizer rendering to save GPU/CPU memory
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      } else {
        // App returned to foreground
        if (playbackStatusRef.current === 'PLAYING') {
          // Resume AudioContext if suspended
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
          // Restart canvas visualizer loop
          setupAudioVisualizer();

          // Check if audio element was paused during background transition
          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch((err) => {
              console.warn('[Foreground] Auto-resume blocked by browser:', err);
              setPlaybackStatus('PAUSED');
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const currentTheme = effectiveTheme || (readingMode === 'paper' ? 'paper' : readingMode === 'light' ? 'light' : 'dark');

  const cardBgClass =
    currentTheme === 'paper'
      ? 'bg-[#FAF4E8] text-[#3B2E1E] border-[#E2D2B0] shadow-xl shadow-amber-900/5'
      : currentTheme === 'light'
      ? 'bg-white/95 text-slate-900 border-slate-200 shadow-xl shadow-slate-200/60'
      : 'bg-slate-900/90 text-white border-slate-800/80 shadow-xl';

  const ambientGlowClass =
    currentTheme === 'paper'
      ? 'from-amber-100/40 via-orange-100/30 to-amber-200/30'
      : currentTheme === 'light'
      ? 'from-blue-50/60 via-indigo-50/40 to-slate-100/60'
      : 'from-blue-900/10 via-indigo-900/10 to-purple-900/10';

  const stationTitleClass =
    currentTheme === 'paper'
      ? 'text-[#3B2E1E]'
      : currentTheme === 'light'
      ? 'text-slate-900'
      : 'text-white';

  const subtextClass =
    currentTheme === 'paper'
      ? 'text-[#6E5B42]'
      : currentTheme === 'light'
      ? 'text-slate-600'
      : 'text-slate-300';

  const subtextMutedClass =
    currentTheme === 'paper'
      ? 'text-[#8C765C]'
      : currentTheme === 'light'
      ? 'text-slate-500'
      : 'text-slate-400';

  const liveTagClass =
    playbackStatus === 'PLAYING'
      ? currentTheme === 'paper'
        ? 'bg-emerald-600/15 text-emerald-800 border border-emerald-600/30'
        : currentTheme === 'light'
        ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      : currentTheme === 'paper'
      ? 'bg-[#E5D7BD] text-[#6E5B42]'
      : currentTheme === 'light'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-slate-800 text-slate-400';

  const radioBtnClass =
    hasNewUpdate
      ? 'bg-gradient-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
      : currentTheme === 'paper'
      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-900 border border-amber-600/30 shadow-sm'
      : currentTheme === 'light'
      ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 shadow-sm'
      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-sm';

  const stationSwitchBtnClass =
    currentTheme === 'paper'
      ? 'bg-[#EFE6D0] hover:bg-[#E2D2B0] text-[#3B2E1E] border-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
      : 'bg-slate-800/80 hover:bg-slate-700/80 text-blue-300 border-slate-700/70';

  const sleepTimerBtnClass =
    remainingSeconds !== null && playbackStatus === 'PLAYING'
      ? currentTheme === 'paper'
        ? 'bg-amber-200/90 border-amber-600/70 text-amber-950 shadow-sm ring-1 ring-amber-600/40 font-bold'
        : currentTheme === 'light'
        ? 'bg-amber-100 border-amber-500/80 text-amber-950 shadow-sm ring-1 ring-amber-500/50 font-bold'
        : 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-400/40 font-bold'
      : remainingSeconds !== null
      ? currentTheme === 'paper'
        ? 'bg-[#EFE6D0] border-[#D8C49E] text-amber-950 font-bold'
        : currentTheme === 'light'
        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
        : 'bg-slate-800/80 border-slate-700/80 text-amber-300/90 font-bold'
      : currentTheme === 'paper'
      ? 'bg-[#EFE6D0] border-[#D8C49E] text-[#3B2E1E] hover:bg-[#E2D2B0]'
      : currentTheme === 'light'
      ? 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-700/80';

  const popoverClass =
    currentTheme === 'paper'
      ? 'bg-[#FFFDF7] border-[#D8C49E] text-[#3B2E1E] shadow-2xl ring-1 ring-[#E2D2B0]'
      : currentTheme === 'light'
      ? 'bg-white border-slate-200 text-slate-800 shadow-2xl ring-1 ring-slate-200'
      : 'bg-slate-900 border-slate-700/80 text-slate-300 shadow-2xl ring-1 ring-slate-700/60';

  const readingModeContainerClass =
    currentTheme === 'paper'
      ? 'bg-[#EFE6D0] border-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-100 border-slate-200'
      : 'bg-slate-900/90 border-slate-700/80';

  const readingModeDividerClass =
    currentTheme === 'paper'
      ? 'bg-[#D8C49E]'
      : currentTheme === 'light'
      ? 'bg-slate-300'
      : 'bg-slate-700/80';

  return (
    <div className={`backdrop-blur-md rounded-2xl p-4 sm:p-5 border relative z-30 flex flex-col gap-3 transition-colors duration-200 ${cardBgClass}`}>
      {/* Background Subtle Ambient Lighting */}
      <div className={`absolute inset-0 bg-gradient-to-r pointer-events-none rounded-2xl overflow-hidden transition-colors duration-200 ${ambientGlowClass}`} />

      <audio
        ref={audioRef}
        src={getProxiedStreamUrl(activeStation.streamUrl)}
        preload="auto"
        onWaiting={() => setPlaybackStatus('BUFFERING')}
        onPlaying={() => {
          setPlaybackStatus('PLAYING');
          retryCountRef.current = 0;
          if (audioRef.current) {
            lastCurrentTimeRef.current = { time: audioRef.current.currentTime, timestamp: Date.now() };
          }
        }}
        onEnded={() => {
          console.warn('[Audio Tag] Live stream ended unexpectedly.');
          if (playbackStatusRef.current === 'PLAYING') {
            handleAutoReconnect();
          }
        }}
        onPause={() => {
          // Normal pause handler - no auto resume
        }}
        onStalled={() => {
          console.log('[Audio Tag] Network packet delay (stalled). Waiting for audio buffer...');
        }}
        onError={(e) => {
          const errCode = (e.currentTarget as HTMLAudioElement)?.error?.code;
          console.warn('[Audio Tag] Error code:', errCode || 'unknown');
          if (!isReconnectingRef.current) {
            handleAutoReconnect();
          }
        }}
      />

      {playbackStatus === 'ERROR' && (
        <div className="relative z-10 flex items-center justify-between p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl text-xs text-rose-200 animate-fadeIn">
          <span>串流連線失敗，請重試或切換電台。</span>
          <button
            onClick={() => {
              if (audioRef.current) {
                retryCountRef.current = 0;
                setPlaybackStatus('BUFFERING');
                const baseUrl = getProxiedStreamUrl(activeStation.streamUrl);
                const freshUrl = addQueryParam(baseUrl, '_retry', String(Date.now()));
                audioRef.current.src = freshUrl;
                audioRef.current.load();
                audioRef.current
                  .play()
                  .then(() => setPlaybackStatus('PLAYING'))
                  .catch(() => setPlaybackStatus('ERROR'));
              }
            }}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shrink-0 transition-colors"
          >
            重試連線
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3">
        {refreshNotice && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-900/50 border border-emerald-400/30 whitespace-nowrap pointer-events-none animate-fadeIn">
            <RefreshCw className="w-3 h-3 animate-spin text-white shrink-0" />
            <span>{refreshNotice}</span>
          </div>
        )}

        {/* Top Row: Radio Station Identity + Top-Right Radio Station Switcher */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={hasNewUpdate ? handleApplyUpdate : handleHiddenRefresh}
              title={hasNewUpdate ? '發現新版本！點擊此處內容更新' : '檢查更新：廣播與字幕持續播放中'}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer group ${radioBtnClass}`}
            >
              {hasNewUpdate ? (
                <Sparkles className="w-4 h-4 text-amber-100 transition-transform group-hover:scale-110" />
              ) : (
                <Radio className={`w-4.5 h-4.5 text-blue-400 transition-transform duration-700 ${isSpinning ? 'rotate-[360deg] text-emerald-400' : 'group-hover:scale-110'}`} />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                  hasNewUpdate ? 'bg-amber-300 ring-2 ring-amber-200 animate-ping' : 'bg-emerald-400'
                }`}
              />
            </button>

            <div className="min-w-0 flex-1 overflow-hidden">
              <MarqueeText text={activeStation.name} className={`text-base sm:text-lg font-bold tracking-tight ${stationTitleClass}`} />
              <div className={`flex items-center gap-2 mt-0.5 text-xs flex-wrap ${subtextMutedClass}`}>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${liveTagClass}`}>
                  <Signal className={`w-2.5 h-2.5 ${playbackStatus === 'PLAYING' ? 'animate-pulse text-emerald-400' : ''}`} />
                  {playbackStatus === 'PLAYING' ? 'LIVE' : '離線'}
                </span>
                {activeStation.freq && (
                  <span className={`text-[11px] font-medium ${subtextClass}`}>
                    {activeStation.freq}
                  </span>
                )}
                <span className="opacity-50">•</span>
                <span className={`text-xs truncate ${subtextMutedClass}`}>
                  {activeStation.location}
                </span>
              </div>
            </div>
          </div>

          {/* Top Right Action: Radio Station Selection & Sleep Timer */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={onOpenStationManager}
                title="切換廣播電台"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer border ${stationSwitchBtnClass}`}
              >
                <ListMusic className="w-3.5 h-3.5 text-blue-400" />
                <span>切換電台</span>
              </button>

              {(hasNewUpdate || isUpdating) && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleApplyUpdate}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm transition-all whitespace-nowrap ${
                    isUpdating
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 cursor-wait'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer active:scale-95 animate-pulse'
                  }`}
                  title={isUpdating ? `正在更新 ${updateProgress}%` : '點擊更新至最新版本'}
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                      <span>正在更新 {updateProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span>點此更新</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Sleep Timer Custom Dropdown */}
            <div className="relative shrink-0" ref={timerDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTimerDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${sleepTimerBtnClass}`}
                title={
                  remainingSeconds !== null && playbackStatus === 'PLAYING'
                    ? '睡眠定時器正在倒數中，點擊修改'
                    : remainingSeconds !== null
                    ? '已設定睡眠定時器（播放時將開始倒數），點擊修改'
                    : '點擊開啟睡眠自動關閉定時下拉選單'
                }
              >
                <Timer
                  className={`w-3.5 h-3.5 shrink-0 ${
                    remainingSeconds !== null && playbackStatus === 'PLAYING'
                      ? currentTheme === 'dark'
                        ? 'text-amber-300 animate-spin'
                        : 'text-amber-950 animate-spin'
                      : remainingSeconds !== null
                      ? currentTheme === 'dark'
                        ? 'text-amber-300/90'
                        : 'text-amber-950'
                      : currentTheme === 'paper'
                      ? 'text-[#5C4830]'
                      : currentTheme === 'light'
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                />
                {remainingSeconds !== null ? (
                  <span
                    className={`font-mono font-extrabold text-xs tracking-tight ${
                      playbackStatus === 'PLAYING'
                        ? currentTheme === 'dark'
                          ? 'text-amber-300'
                          : 'text-amber-950'
                        : currentTheme === 'dark'
                        ? 'text-amber-300/90'
                        : 'text-amber-900'
                    }`}
                  >
                    {Math.floor(remainingSeconds / 3600) > 0 ? `${Math.floor(remainingSeconds / 3600)}:` : ''}
                    {String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0')}:
                    {String(remainingSeconds % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <span>
                    {sleepMinutes > 0 ? `${sleepMinutes}分鐘` : '關閉定時'}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${isTimerDropdownOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`} />
              </button>

              {/* Floating Dropdown Popover */}
              {isTimerDropdownOpen && (
                <div className={`absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl p-1.5 z-50 animate-fadeIn space-y-0.5 max-h-[400px] overflow-y-auto border ${popoverClass}`}>
                  <div className={`px-2.5 py-1.5 text-[10px] font-bold opacity-70 border-b flex items-center justify-between ${
                    currentTheme === 'paper' ? 'border-[#D8C49E]' : currentTheme === 'light' ? 'border-slate-200' : 'border-slate-700/40'
                  }`}>
                    <span>睡眠定時器</span>
                    <span className="opacity-70 font-normal">最長 3 小時</span>
                  </div>
                  {[
                    { minutes: 0, label: '關閉定時' },
                    { minutes: 15, label: '15 分鐘' },
                    { minutes: 30, label: '30 分鐘' },
                    { minutes: 45, label: '45 分鐘' },
                    { minutes: 60, label: '60 分鐘 (1 小時)' },
                    { minutes: 90, label: '90 分鐘 (1.5 小時)' },
                    { minutes: 120, label: '120 分鐘 (2 小時)' },
                    { minutes: 150, label: '150 分鐘 (2.5 小時)' },
                    { minutes: 180, label: '180 分鐘 (3 小時)' },
                  ].map((opt) => {
                    const isSelected = sleepMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => handleSelectSleepTimer(opt.minutes)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : currentTheme === 'paper'
                            ? 'text-[#3B2E1E] hover:bg-[#EFE6D0]'
                            : currentTheme === 'light'
                            ? 'text-slate-800 hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Utility Bar: Reading Mode Selector Bar */}
        <div className="flex items-center justify-start w-full text-xs pt-1">
          {/* Mechanical Sliding Reading Mode Selector */}
          <div className={`flex items-center gap-1 p-1 rounded-xl shadow-inner w-full sm:w-auto border transition-colors duration-200 ${readingModeContainerClass}`}>
            <div className="flex items-center justify-center text-amber-500 font-bold px-1.5" title="閱讀模式選擇 (護眼與深淺色)">
              <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>
            <div className={`w-[1px] h-3.5 mx-0.5 ${readingModeDividerClass}`} />
            
            <div className="relative inline-flex items-center flex-1 sm:flex-initial select-none p-0.5">
              {(() => {
                const modesList = ['system', 'paper', 'light', 'dark'] as const;
                const selectedIndex = modesList.indexOf(readingMode as typeof modesList[number]);
                const idx = selectedIndex >= 0 ? selectedIndex : 0;
                
                return (
                  <motion.div
                    className="absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 border border-amber-600/50 shadow-[0_2px_8px_rgba(180,83,9,0.5)] pointer-events-none flex items-center justify-center z-0"
                    initial={false}
                    animate={{
                      left: `calc(${idx * 25}% + 1px)`,
                      width: 'calc(25% - 2px)',
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                  >
                    <div className="w-1 h-2.5 bg-amber-200/40 rounded-full shadow-[0_0_2px_rgba(251,191,36,0.6)]" />
                  </motion.div>
                );
              })()}

              <div className="relative z-10 flex items-center w-full sm:w-auto">
                {(
                  [
                    { mode: 'system', label: '自動', icon: Sparkles, color: 'text-blue-400', title: '跟隨環境光線感應與系統設定自動切換 (避亮防眩)' },
                    { mode: 'paper', label: '紙張', icon: BookOpen, color: 'text-amber-500', title: '護眼紙張模式：溫潤羊皮紙色系，長時間閱讀不疲勞' },
                    { mode: 'light', label: '明亮', icon: Sun, color: 'text-amber-400', title: '固定日間高對比明亮模式' },
                    { mode: 'dark', label: '暗黑', icon: Moon, color: 'text-indigo-300', title: '固定夜間低光護眼暗黑模式' },
                  ] as const
                ).map(({ mode, label, icon: Icon, color, title }) => {
                  const isSelected = readingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (readingMode !== mode) {
                          onReadingModeChange?.(mode);
                          setTimeout(playBeanWallImpactSound, 135);
                        }
                      }}
                      title={title}
                      className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 rounded-md font-bold text-xs transition-colors duration-150 cursor-pointer select-none ${
                        isSelected
                          ? 'text-amber-100 font-black'
                          : currentTheme === 'paper'
                          ? 'text-[#7A6853] hover:text-[#3B2E1E]'
                          : currentTheme === 'light'
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-200' : color}`} />
                      <span className="inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
