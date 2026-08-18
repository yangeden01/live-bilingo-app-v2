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
  const retryCountRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const lastCurrentTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: Date.now() });
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    playbackStatusRef.current = playbackStatus;
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

  // Exponential backoff auto-reconnect
  const handleAutoReconnect = useCallback(() => {
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
    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);

    console.log(`[Auto-Reconnect] Attempt ${attempt}/3 in ${delayMs}ms...`);
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
          console.log(`[Auto-Reconnect] Attempt ${attempt}/3 succeeded!`);
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
  }, [getProxiedStreamUrl, setPlaybackStatus]);

  // Stall detector
  useEffect(() => {
    if (playbackStatus !== 'PLAYING') return;

    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const now = Date.now();
      const currentAudioTime = audio.currentTime;

      const isTrulyStalled =
        !audio.paused &&
        audio.readyState < 2 &&
        currentAudioTime === lastCurrentTimeRef.current.time &&
        now - lastCurrentTimeRef.current.timestamp > 20000;

      if (isTrulyStalled) {
        console.warn('[Stall Monitor] Audio stalled. Starting auto-reconnect...');
        lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        handleAutoReconnect();
      } else {
        if (currentAudioTime !== lastCurrentTimeRef.current.time) {
          lastCurrentTimeRef.current = { time: currentAudioTime, timestamp: now };
        }
        retryCountRef.current = 0;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playbackStatus, handleAutoReconnect]);

  // Handle active station changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      audioRef.current.load();
      return;
    }

    if (playbackStatusRef.current === 'PLAYING' || playbackStatusRef.current === 'BUFFERING') {
      setPlaybackStatus('BUFFERING');
      audioRef.current.load();
      audioRef.current
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          onStartVisualizer?.();
        })
        .catch((e) => {
          console.warn('Auto-play on station switch error:', e);
          setPlaybackStatus('ERROR');
        });
    } else {
      audioRef.current.load();
    }

    safeApiFetch('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
    });
  }, [activeStation.id, activeStation.streamUrl, activeStation.name, onStartVisualizer, setPlaybackStatus]);

  // Main toggle play / pause logic
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (playbackStatus === 'PLAYING') {
      playbackStatusRef.current = 'PAUSED';
      setPlaybackStatus('PAUSED');
      if (audioRef.current) {
        audioRef.current.pause();
      }
      onClearSubtitleQueue?.();
    } else {
      onClearSubtitleQueue?.();

      fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
      safeApiFetch('/api/notify-station-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeStation.streamUrl, name: activeStation.name }),
      }).catch(() => {});

      setPlaybackStatus('BUFFERING');
      const audio = audioRef.current;
      audio.playbackRate = 1.0;

      const baseUrl = getProxiedStreamUrl(activeStation.streamUrl);
      const liveFreshUrl = addQueryParam(baseUrl, '_t', String(Date.now()));
      audio.src = liveFreshUrl;
      audio.load();

      audio
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          onStartVisualizer?.();
        })
        .catch((err) => {
          console.error('Audio play error:', err);
          audio.load();
          audio
            .play()
            .then(() => {
              setPlaybackStatus('PLAYING');
              onStartVisualizer?.();
            })
            .catch((e) => {
              console.error('Audio play retry error:', e);
              setPlaybackStatus('ERROR');
            });
        });
    }
  }, [activeStation.name, activeStation.streamUrl, getProxiedStreamUrl, onClearSubtitleQueue, onStartVisualizer, playbackStatus, setPlaybackStatus]);

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

      audio
        .play()
        .then(() => {
          setPlaybackStatus('PLAYING');
          onStartVisualizer?.();
        })
        .catch(() => {
          audio.load();
          audio
            .play()
            .then(() => {
              setPlaybackStatus('PLAYING');
              onStartVisualizer?.();
            })
            .catch(() => setPlaybackStatus('ERROR'));
        });
    } catch (err) {
      console.warn('Live sync error:', err);
    }
  }, [activeStation.name, activeStation.streamUrl, onStartVisualizer, setPlaybackStatus]);

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
    getProxiedStreamUrl,
  };
}
