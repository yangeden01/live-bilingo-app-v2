import React, { useEffect, useRef, useCallback } from 'react';
import { PlaybackStatus, RadioStation } from '../types';
import { getApiUrl } from '../utils/apiUrl';
import { safeApiFetch } from '../utils/safeFetch';

interface UseRadioAudioOptions {
  activeStation: RadioStation;
  playbackStatus: PlaybackStatus;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  onClearSubtitleQueue?: () => void;
  onStartVisualizer?: () => void;
}

export function useRadioAudio({
  activeStation,
  playbackStatus,
  setPlaybackStatus,
  onClearSubtitleQueue,
  onStartVisualizer,
}: UseRadioAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackStatusRef = useRef(playbackStatus);
  const activeStationRef = useRef(activeStation);
  const prevStationIdRef = useRef(activeStation.id);
  const retryCountRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const userPlaybackIntentRef = useRef<boolean>(false);
  const lastCurrentTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: Date.now() });

  const onStartVisualizerRef = useRef(onStartVisualizer);
  const onClearSubtitleQueueRef = useRef(onClearSubtitleQueue);
  useEffect(() => {
    onStartVisualizerRef.current = onStartVisualizer;
    onClearSubtitleQueueRef.current = onClearSubtitleQueue;
  });

  useEffect(() => {
    playbackStatusRef.current = playbackStatus;
    if (playbackStatus === 'PLAYING' || playbackStatus === 'BUFFERING') {
      userPlaybackIntentRef.current = true;
    } else if (playbackStatus === 'PAUSED' || playbackStatus === 'IDLE') {
      userPlaybackIntentRef.current = false;
    }
  }, [playbackStatus]);

  useEffect(() => {
    activeStationRef.current = activeStation;
  }, [activeStation]);

  // Extract or proxy stream URL cleanly
  const getProxiedStreamUrl = useCallback((rawUrl: string): string => {
    if (!rawUrl) return 'https://npr-ice.streamguys1.com/live.mp3';

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
  }, []);

  const addQueryParam = (baseUrl: string, key: string, value: string): string => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${key}=${encodeURIComponent(value)}`;
  };

  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Safe playback trigger handling browser play() promise interruptions
  const safePlay = useCallback(async (audio: HTMLAudioElement) => {
    try {
      const playPromise = audio.play();
      playPromiseRef.current = playPromise;
      await playPromise;

      if (userPlaybackIntentRef.current) {
        playbackStatusRef.current = 'PLAYING';
        setPlaybackStatus('PLAYING');
        isReconnectingRef.current = false;
        retryCountRef.current = 0;
        onStartVisualizerRef.current?.();

        try {
          if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
            (window as any).AndroidBridge.onStationPlaybackChanged(
              activeStationRef.current.streamUrl,
              activeStationRef.current.name,
              true
            );
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('scroll-to-subtitles'));
      }
    } catch (err: any) {
      // If play request was interrupted by a new load request or station change, ignore AbortError
      if (err?.name === 'AbortError' || err?.message?.includes('interrupted by a new load request')) {
        console.log('[Radio Audio] Play request smoothly superseded by new stream load.');
        return;
      }
      if (err?.name === 'NotAllowedError') {
        console.warn('[Radio Audio] Autoplay blocked by browser policy. Pausing.');
        playbackStatusRef.current = 'PAUSED';
        setPlaybackStatus('PAUSED');
        return;
      }

      console.warn('[Radio Audio] Playback attempt error:', err?.message || err);
      if (userPlaybackIntentRef.current && playbackStatusRef.current !== 'PAUSED') {
        playbackStatusRef.current = 'BUFFERING';
        setPlaybackStatus('BUFFERING');
      }
    } finally {
      playPromiseRef.current = null;
    }
  }, [setPlaybackStatus]);

  // Exponential backoff auto-reconnect
  const handleAutoReconnect = useCallback(() => {
    if (!audioRef.current || isReconnectingRef.current) return;
    if (!userPlaybackIntentRef.current && playbackStatusRef.current !== 'PLAYING' && playbackStatusRef.current !== 'BUFFERING') {
      return;
    }

    // If offline (e.g. inside elevator), set buffering and wait for online event instead of exhausting retries
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      playbackStatusRef.current = 'BUFFERING';
      setPlaybackStatus('BUFFERING');
      return;
    }

    isReconnectingRef.current = true;
    retryCountRef.current += 1;
    const attempt = retryCountRef.current;
    const delayMs = Math.min(1000 * Math.pow(1.5, attempt - 1), 6000);

    playbackStatusRef.current = 'BUFFERING';
    setPlaybackStatus('BUFFERING');

    setTimeout(() => {
      if (!audioRef.current || !userPlaybackIntentRef.current) {
        isReconnectingRef.current = false;
        return;
      }

      const audio = audioRef.current;
      const baseUrl = getProxiedStreamUrl(activeStationRef.current.streamUrl);
      const freshUrl = addQueryParam(baseUrl, '_retry', String(Date.now()));
      
      try {
        audio.src = freshUrl;
        safePlay(audio).then(() => {
          isReconnectingRef.current = false;
          safeApiFetch('/api/notify-station-playing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: activeStationRef.current.streamUrl, name: activeStationRef.current.name }),
          }).catch(() => {});
        });
      } catch (e) {
        isReconnectingRef.current = false;
        if (attempt < 5) {
          handleAutoReconnect();
        }
      }
    }, delayMs);
  }, [getProxiedStreamUrl, safePlay, setPlaybackStatus]);

  // Force re-acquisition of stream when exiting elevator / regaining network
  const triggerFreshStreamReconnect = useCallback(() => {
    if (!audioRef.current || !userPlaybackIntentRef.current) return;
    const audio = audioRef.current;
    isReconnectingRef.current = false;
    retryCountRef.current = 0;

    playbackStatusRef.current = 'BUFFERING';
    setPlaybackStatus('BUFFERING');

    fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
    safeApiFetch('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: activeStationRef.current.streamUrl, name: activeStationRef.current.name, forceRestart: true }),
    }).catch(() => {});

    try {
      if ((window as any).AndroidBridge?.onNetworkRestored) {
        (window as any).AndroidBridge.onNetworkRestored();
      }
      if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
        (window as any).AndroidBridge.onStationPlaybackChanged(
          activeStationRef.current.streamUrl,
          activeStationRef.current.name,
          true
        );
      }
    } catch (e) {
      console.warn('[Network Restored] AndroidBridge notice:', e);
    }

    window.dispatchEvent(new CustomEvent('radio-network-restored'));

    const baseUrl = getProxiedStreamUrl(activeStationRef.current.streamUrl);
    const liveFreshUrl = addQueryParam(baseUrl, '_net_restore', String(Date.now()));
    audio.src = liveFreshUrl;
    safePlay(audio);
  }, [getProxiedStreamUrl, safePlay, setPlaybackStatus]);

  // Robust Network Recovery Listeners (Online / Offline / Android Network Broadcast / Focus)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network Monitor] Network connection restored (online). Resuming radio & subtitles...');
      if (userPlaybackIntentRef.current) {
        triggerFreshStreamReconnect();
      }
    };

    const handleOffline = () => {
      console.log('[Network Monitor] Network lost (offline/elevator). Pausing stream buffer...');
      if (playbackStatusRef.current === 'PLAYING') {
        playbackStatusRef.current = 'BUFFERING';
        setPlaybackStatus('BUFFERING');
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NETWORK_RESTORED' && userPlaybackIntentRef.current) {
        console.log('[Android Bridge] Network restored signal received. Reconnecting radio stream...');
        triggerFreshStreamReconnect();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userPlaybackIntentRef.current) {
        const audio = audioRef.current;
        if (audio && (audio.paused || audio.readyState < 2)) {
          console.log('[App Visibility] Resumed from background/sleep. Ensuring live stream active...');
          triggerFreshStreamReconnect();
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [setPlaybackStatus, triggerFreshStreamReconnect]);

  // Stall & Health watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !userPlaybackIntentRef.current) return;

      // If device is offline, stay in buffering until online event fires
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (playbackStatusRef.current !== 'BUFFERING') {
          playbackStatusRef.current = 'BUFFERING';
          setPlaybackStatus('BUFFERING');
        }
        return;
      }

      const now = Date.now();
      const currentAudioTime = audio.currentTime;

      const isAudioFrozen =
        !audio.paused &&
        audio.readyState < 2 &&
        currentAudioTime === lastCurrentTimeRef.current.time &&
        now - lastCurrentTimeRef.current.timestamp > 8000;

      const isStuckInBuffering =
        playbackStatusRef.current === 'BUFFERING' &&
        now - lastCurrentTimeRef.current.timestamp > 10000;

      if (isAudioFrozen || isStuckInBuffering) {
        console.warn('[Stall Watchdog] Audio stalled or buffering timed out. Auto-healing stream...');
        lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        triggerFreshStreamReconnect();
      } else {
        if (currentAudioTime !== lastCurrentTimeRef.current.time) {
          lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [setPlaybackStatus, triggerFreshStreamReconnect]);

  // Handle active station changes ONLY when activeStation.id actually changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (prevStationIdRef.current === activeStation.id) {
      return;
    }
    prevStationIdRef.current = activeStation.id;

    if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
      playbackStatusRef.current = 'BUFFERING';
      setPlaybackStatus('BUFFERING');
      const baseUrl = getProxiedStreamUrl(activeStation.streamUrl);
      const liveFreshUrl = addQueryParam(baseUrl, '_t', String(Date.now()));
      audioRef.current.src = liveFreshUrl;
      safePlay(audioRef.current);
    } else {
      audioRef.current.load();
    }

    safeApiFetch('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
    });
  }, [activeStation.id, activeStation.streamUrl, activeStation.name, getProxiedStreamUrl, safePlay, setPlaybackStatus]);

  // Main toggle play / pause logic
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (playbackStatusRef.current === 'PLAYING') {
      playbackStatusRef.current = 'PAUSED';
      setPlaybackStatus('PAUSED');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      onClearSubtitleQueueRef.current?.();

      try {
        if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
          (window as any).AndroidBridge.onStationPlaybackChanged(
            activeStationRef.current.streamUrl,
            activeStationRef.current.name,
            false
          );
        }
      } catch (e) {}
    } else {
      onClearSubtitleQueueRef.current?.();

      fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
      safeApiFetch('/api/notify-station-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeStationRef.current.streamUrl, name: activeStationRef.current.name }),
      }).catch(() => {});

      try {
        if ((window as any).AndroidBridge?.onStationPlaybackChanged) {
          (window as any).AndroidBridge.onStationPlaybackChanged(
            activeStationRef.current.streamUrl,
            activeStationRef.current.name,
            true
          );
        }
      } catch (e) {}

      playbackStatusRef.current = 'BUFFERING';
      setPlaybackStatus('BUFFERING');
      const audio = audioRef.current;
      audio.playbackRate = 1.0;

      const baseUrl = getProxiedStreamUrl(activeStationRef.current.streamUrl);
      const liveFreshUrl = addQueryParam(baseUrl, '_t', String(Date.now()));
      audio.src = liveFreshUrl;
      safePlay(audio);
    }
  }, [getProxiedStreamUrl, safePlay, setPlaybackStatus]);

  // Listen for global window custom events
  useEffect(() => {
    const handleGlobalToggle = () => {
      togglePlayPause();
    };
    window.addEventListener('radio-toggle-play', handleGlobalToggle);
    return () => {
      window.removeEventListener('radio-toggle-play', handleGlobalToggle);
    };
  }, [togglePlayPause]);

  // Fast live-edge alignment
  const handleSyncLiveEdge = useCallback(() => {
    if (!audioRef.current) return;
    try {
      fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
      safeApiFetch('/api/notify-station-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
      }).catch(() => {});

      const audio = audioRef.current;
      audio.playbackRate = 1.0;
      setPlaybackStatus('BUFFERING');

      if (audio.buffered && audio.buffered.length > 0) {
        const liveBufferEnd = audio.buffered.end(audio.buffered.length - 1);
        if (liveBufferEnd > 0) {
          audio.currentTime = Math.max(0, liveBufferEnd - 0.1);
        }
      }

      safePlay(audio);
    } catch (err) {
      console.warn('Live sync error:', err);
    }
  }, [activeStation.name, activeStation.streamUrl, safePlay, setPlaybackStatus]);

  // HTML5 Media Session API integration
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
          ],
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
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if ((window as any).AndroidBridge?.stopNotificationService) {
            (window as any).AndroidBridge.stopNotificationService();
          }
        });
      } catch (e) {
        console.warn('MediaSession configuration error:', e);
      }
    }
  }, [activeStation.name, playbackStatus, setPlaybackStatus, togglePlayPause]);

  // Android notification service & pull-down actions
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.updatePlayerNotification) {
        if (playbackStatus === 'PLAYING' || playbackStatus === 'BUFFERING') {
          (window as any).AndroidBridge.updatePlayerNotification(activeStation.name, true);
        } else if (playbackStatus === 'PAUSED') {
          (window as any).AndroidBridge.updatePlayerNotification(activeStation.name, false);
        } else if (playbackStatus === 'IDLE' || playbackStatus === 'ERROR') {
          (window as any).AndroidBridge.stopNotificationService?.();
        }
      }
    } catch (e) {
      console.warn('Android notification sync notice:', e);
    }
  }, [activeStation.name, playbackStatus]);

  useEffect(() => {
    let lastHandledTime = 0;

    const handleAndroidMediaMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ANDROID_MEDIA_CONTROL') {
        const now = Date.now();
        if (now - lastHandledTime < 300) return;
        lastHandledTime = now;

        const action = event.data.action;
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
        } else if (action === 'com.bilingo.radio.ACTION_STOP' || action === 'com.bilingo.radio.ACTION_PAUSE') {
          playbackStatusRef.current = 'PAUSED';
          setPlaybackStatus('PAUSED');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          if (action === 'com.bilingo.radio.ACTION_STOP' && (window as any).AndroidBridge?.stopNotificationService) {
            (window as any).AndroidBridge.stopNotificationService();
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
  }, [setPlaybackStatus, togglePlayPause]);

  return {
    audioRef,
    togglePlayPause,
    handleSyncLiveEdge,
    handleAutoReconnect,
    getProxiedStreamUrl,
  };
}
