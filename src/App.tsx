// Live Bilingo Radio App v1.6.5 - MediaSession & Offline Background Audio Fix
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SubtitleItem, PlaybackStatus, RadioStation, ReadingMode } from './types';
import { AudioPlayerController } from './components/AudioPlayerController';
import { Material3AndroidFrame } from './components/Material3AndroidFrame';
import { AndroidCodeExplorer } from './components/AndroidCodeExplorer';
import { StationManagerModal } from './components/StationManagerModal';
import { DictionaryModal } from './components/DictionaryModal';
import { SttLatencyDebugPanel } from './components/SttLatencyDebugPanel';
import { getApiUrl } from './utils/apiUrl';
import { safeApiFetch } from './utils/safeFetch';
import { vibrateGitPushSuccess, vibrateZipExportSuccess } from './utils/haptics';
import { sanitizeTranscriptText, isHallucinationLoop } from './utils/textSanitizer';
import { Radio, Code2, Smartphone, Cpu, CheckCircle2, Sparkles, Volume2, ShieldCheck, Download, ListMusic, BookOpen, RefreshCw, Copy, Play, Pause, Sun, Moon, Bell, Power } from 'lucide-react';

const DEFAULT_STATIONS: RadioStation[] = [
  {
    id: 'us-west-public-news',
    name: '美西公共英語新聞',
    freq: '新聞廣播串流',
    location: 'San Francisco, CA',
    category: '美國新聞與公共談話 (US News & Talk)',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
  },
  {
    id: 'us-east-public-news',
    name: '美國東岸新聞廣播',
    freq: '時事廣播串流',
    location: 'Concord, NH',
    category: '美國新聞與英語談話 (US News & Talk)',
    streamUrl: 'https://nhpr.streamguys1.com/nhpr',
  },
  {
    id: 'us-finance-news-talk',
    name: '美東商業財經新聞',
    freq: 'Finance Stream',
    location: 'New York, NY',
    category: '美國財經與新聞 (US Finance & Talk)',
    streamUrl: 'https://stream.revma.ihrhls.com/zc4732',
  },
  {
    id: 'us-national-public-talk',
    name: '北美綜合時事談話',
    freq: 'National Stream',
    location: 'Washington, D.C.',
    category: '美國時事與深度談話 (US Dialogue & News)',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
  },
  {
    id: 'uk-global-english-news',
    name: '英國國際英語新聞',
    freq: 'World Service',
    location: 'London, UK',
    category: '英國國際新聞 (UK Global News)',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
  },
];

export default function App() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(20);
  const [initStatusText, setInitStatusText] = useState('初始化系統模組...');

  const [activeTab, setActiveTab] = useState<'app' | 'code' | 'api'>('app');
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('IDLE');
  const [sttConnected, setSttConnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    console.log('[App Init] Initializing App state...');

    let isMounted = true;

    // Hard safety timer: forced unlock after 1200ms max so splash overlay NEVER hangs permanently
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn('[App Init] Safety timeout reached. Forcing isInitializing = false');
        setInitProgress(100);
        setIsInitializing(false);
      }
    }, 1200);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[App Init] Device offline on initial load');
      setIsOnline(false);
      setInitProgress(100);
      setInitStatusText('離線/航空模式中...');
      setIsInitializing(false);
      clearTimeout(safetyTimer);
      return;
    }

    const timer1 = setTimeout(() => {
      if (!isMounted) return;
      setInitProgress(60);
      setInitStatusText('連接雙語廣播與字幕串流...');
    }, 150);

    const timer2 = setTimeout(() => {
      if (!isMounted) return;
      setInitProgress(90);
      setInitStatusText('載入電台清單與語音對齊模組...');
    }, 350);

    const timer3 = setTimeout(() => {
      if (!isMounted) return;
      setInitProgress(100);
      setIsInitializing(false);
      clearTimeout(safetyTimer);
      console.log('[App Init] Initialization complete successfully');
    }, 550);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Git Push & Server Build Haptic Vibration Notification
  const [gitUpdateToast, setGitUpdateToast] = useState<{ commit?: string; time: number } | null>(null);

  useEffect(() => {
    let lastBuildTime = 0;
    let lastCommit = '';
    let isInitialCheck = true;

    const checkServerVersion = async () => {
      try {
        const res = await safeApiFetch<{ buildTime?: number; commit?: string; version?: string }>('/api/version', { cache: 'no-store' });
        if (res.ok && res.data) {
          const currentBuildTime = Number(res.data.buildTime || 0);
          const currentCommit = String(res.data.commit || '');

          if (currentBuildTime > 0 || currentCommit) {
            const hasChanged = (lastBuildTime > 0 && currentBuildTime > 0 && currentBuildTime !== lastBuildTime) ||
                              (lastCommit && currentCommit && currentCommit !== 'dev' && currentCommit !== lastCommit);

            if (!isInitialCheck && hasChanged) {
              console.log('[Haptics] 🚀 New Git Push build deployed! Triggering vibration alert... (Commit: ' + currentCommit + ')');
              vibrateGitPushSuccess();
              setGitUpdateToast({ commit: currentCommit, time: Date.now() });
              setTimeout(() => setGitUpdateToast(null), 6000);
            }

            if (currentBuildTime > 0) lastBuildTime = currentBuildTime;
            if (currentCommit) lastCommit = currentCommit;
            isInitialCheck = false;
          }
        }
      } catch (e) {
        // ignore offline / network glitches
      }
    };

    // Initial check
    checkServerVersion();
    // Poll every 3 seconds for fast detection of new Git Push / Server updates
    const interval = setInterval(checkServerVersion, 3000);

    return () => clearInterval(interval);
  }, []);

  // Radio Station Management State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const isAndroidWebView = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /AndroidApp|wv|Android.*Version\/[0-9.]+/i.test(ua) || (window as any).Android !== undefined;
  }, []);

  const isInAppBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isLine = /Line/i.test(ua);
    const isFB = /FBAV|FBAN|FB_IAB/i.test(ua);
    const isIG = /Instagram/i.test(ua);
    const isWeChat = /MicroMessenger/i.test(ua);
    const isIframe = window.self !== window.top;
    return isLine || isFB || isIG || isWeChat || isIframe;
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[PWA] beforeinstallprompt event intercepted successfully');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] App successfully installed as WebAPK');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleResetPwaAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      window.location.href = window.location.origin + '/?pwa_reset=' + Date.now();
    } catch (e) {
      console.error('Failed to reset PWA:', e);
      window.location.reload();
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyStatus('已複製網址！請至 Chrome「無痕分頁」貼上開啟即可一鍵安裝 PWA');
      setTimeout(() => setCopyStatus(''), 4000);
    }).catch(() => {
      setCopyStatus('複製失敗，請手動複製網址：' + window.location.href);
    });
  };

  // Notification Permission State for Android Pull-down Control Bar
  const [notificationGranted, setNotificationGranted] = useState<boolean>(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState<boolean>(false);
  const [notifToastMessage, setNotifToastMessage] = useState<string>('');
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  // Check notification permission on startup (only show prompt if not granted & not previously dismissed)
  useEffect(() => {
    if (isInitializing) return;

    const checkCurrentPermission = () => {
      try {
        if (typeof window !== 'undefined') {
          if ((window as any).AndroidBridge?.isNotificationPermissionGranted) {
            return Boolean((window as any).AndroidBridge.isNotificationPermissionGranted());
          }
          if ('Notification' in window) {
            return Notification.permission === 'granted';
          }
        }
      } catch (e) {
        console.warn('Check notification permission notice:', e);
      }
      return true;
    };

    const isGranted = checkCurrentPermission();
    setNotificationGranted(isGranted);

    // If permission is already granted -> enter smoothly without disturbing the user!
    // If not granted -> show polite prompt once per session
    if (!isGranted) {
      const dismissed = sessionStorage.getItem('live_bilingo_notif_prompt_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isInitializing]);

  // Listen for native Android notification permission results
  useEffect(() => {
    const handleNotifMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_PERMISSION_RESULT') {
        const granted = Boolean(event.data.granted);
        setNotificationGranted(granted);
        if (granted) {
          setShowNotificationPrompt(false);
          setNotifToastMessage('✅ 通知權限已開啟！手機下拉選單控制列已就緒');
          setTimeout(() => setNotifToastMessage(''), 3500);
        }
      }
    };

    window.addEventListener('message', handleNotifMessage);
    return () => window.removeEventListener('message', handleNotifMessage);
  }, []);

  const handleRequestNotification = async () => {
    try {
      if ((window as any).AndroidBridge?.requestNotificationPermission) {
        (window as any).AndroidBridge.requestNotificationPermission();
      } else if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationGranted(true);
          setShowNotificationPrompt(false);
          setNotifToastMessage('✅ 通知權限已開啟！');
          setTimeout(() => setNotifToastMessage(''), 3000);
        }
      }
    } catch (e) {
      console.error('Request notification permission error:', e);
    }
  };

  const handleDismissNotificationPrompt = () => {
    try {
      sessionStorage.setItem('live_bilingo_notif_prompt_dismissed', 'true');
    } catch (e) {}
    setShowNotificationPrompt(false);
  };

  const [stations, setStations] = useState<RadioStation[]>(() => {
    try {
      const saved = localStorage.getItem('live_bilingo_stations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_STATIONS;
  });

  const [activeStation, setActiveStation] = useState<RadioStation>(() => {
    try {
      const savedId = localStorage.getItem('live_bilingo_active_station_id');
      const savedStations = localStorage.getItem('live_bilingo_stations');
      const stationList: RadioStation[] = savedStations ? JSON.parse(savedStations) : DEFAULT_STATIONS;
      if (savedId) {
        const found = stationList.find((s) => s.id === savedId);
        if (found) return found;
      }
    } catch (e) {}
    return DEFAULT_STATIONS[0];
  });

  // Persist stations and activeStation ID to localStorage whenever changed
  useEffect(() => {
    try {
      if (stations && stations.length > 0) {
        localStorage.setItem('live_bilingo_stations', JSON.stringify(stations));
      }
    } catch (e) {}
  }, [stations]);

  useEffect(() => {
    try {
      if (activeStation?.id) {
        localStorage.setItem('live_bilingo_active_station_id', activeStation.id);
      }
    } catch (e) {}
  }, [activeStation]);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [dictWord, setDictWord] = useState('');

  // Global Reading Mode State (Auto System + Ambient Light Sensor | Paper | Light | Dark)
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => {
    try {
      const saved = localStorage.getItem('radio_reading_mode');
      if (saved === 'system' || saved === 'paper' || saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {}
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [ambientLux, setAmbientLux] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('radio_reading_mode', readingMode);
    } catch (e) {}

    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    let sensor: any = null;
    if ('AmbientLightSensor' in window) {
      try {
        // @ts-ignore
        sensor = new AmbientLightSensor();
        sensor.onreading = () => {
          if (typeof sensor.illuminance === 'number') {
            setAmbientLux(sensor.illuminance);
          }
        };
        sensor.onerror = () => {};
        sensor.start();
      } catch (e) {}
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      if (sensor) {
        try {
          sensor.stop();
        } catch (e) {}
      }
    };
  }, [readingMode]);

  const [currentHour, setCurrentHour] = useState<number>(() => {
    return new Date().getHours();
  });

  // Periodically check local time so auto theme switches smoothly at nightfall (e.g. 18:00 or 21:30)
  useEffect(() => {
    const updateHour = () => {
      setCurrentHour(new Date().getHours());
    };
    updateHour();
    const interval = setInterval(updateHour, 30000);
    return () => clearInterval(interval);
  }, []);

  const effectiveTheme = useMemo<'dark' | 'light' | 'paper'>(() => {
    if (readingMode === 'paper') return 'paper';
    if (readingMode === 'light') return 'light';
    if (readingMode === 'dark') return 'dark';

    // readingMode === 'system' (自動閱讀模式)
    // 1. Check ambient light sensor if available
    if (ambientLux !== null) {
      return ambientLux < 40 ? 'dark' : 'light';
    }
    // 2. Check system-level dark mode preference
    if (systemPrefersDark) {
      return 'dark';
    }
    // 3. Time-of-day automatic eye-protection: Evening / Night (18:00 to 07:00) defaults to DARK mode
    const isNightTime = currentHour >= 18 || currentHour < 7;
    if (isNightTime) {
      return 'dark';
    }
    return 'light';
  }, [readingMode, ambientLux, systemPrefersDark, currentHour]);

  const handleOpenDictionary = (word?: string) => {
    setDictWord(word || '');
    setIsDictOpen(true);
  };

  const handleUpdateStations = (repairedList: RadioStation[]) => {
    if (Array.isArray(repairedList) && repairedList.length === 5) {
      setStations(repairedList);
      const updatedActive = repairedList.find((s) => s.id === activeStation.id);
      if (updatedActive) {
        setActiveStation(updatedActive);
      }
    }
  };

  // Silent background stream check & auto-repair on app startup (runs asynchronously in background)
  useEffect(() => {
    const silentCheckAndRepair = async () => {
      // If offline, skip network checks immediately without waiting or blocking
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const res = await safeApiFetch<{ stations: RadioStation[]; repairedCount: number }>(
        '/api/repair-stations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stations }),
        }
      );

      if (res.ok && res.data && Array.isArray(res.data.stations) && res.data.repairedCount > 0) {
        console.log(`[Silent Auto-Repair] Silently repaired ${res.data.repairedCount} radio stream URLs`);
        handleUpdateStations(res.data.stations);
      }
    };

    const timer = setTimeout(silentCheckAndRepair, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Synchronize active station stream with backend Deepgram STT listener
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (activeStation?.streamUrl) {
      safeApiFetch('/api/set-active-station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: activeStation.streamUrl, name: activeStation.name }),
      });
    }
  }, [activeStation]);

  // Real-time live broadcast subtitles with localStorage cache persistence across version updates
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(() => {
    try {
      const saved = localStorage.getItem('radio_subtitles_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clean cached items and drop any prior hallucination loops
          const cleanedList = parsed
            .map((item: SubtitleItem) => ({
              ...item,
              english: sanitizeTranscriptText(item.english),
            }))
            .filter((item: SubtitleItem) => !isHallucinationLoop(item.english) && item.english.length >= 4);

          if (cleanedList.length > 0) {
            return cleanedList;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse cached subtitles:', e);
    }
    return [
      {
        id: 'init-default-1',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        createdAt: Date.now() - 20000,
        english: 'You are listening to Live Public Radio Stream. Real-time AI speech recognition and high-speed bilingual translation engine connected.',
        traditionalChinese: '【雙語廣播即時連線】您正在收聽美國公共廣播串流，AI 語音辨識與雙語對齊翻譯引擎已成功連線。',
        isFinal: true,
      },
      {
        id: 'init-default-2',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        createdAt: Date.now() - 10000,
        english: 'Transit officials are officially rolling out new unified fare integration cards across regional transit lines, promising seamless travel starting next month.',
        traditionalChinese: '交通局官員正式宣佈，將於下個月起整合大眾運輸系統票證，為跨區通勤族 provide 無縫公共運輸體驗。',
        isFinal: true,
      }
    ];
  });

  // Current real-time streaming partial subtitle (interim)
  const [interimSubtitle, setInterimSubtitle] = useState<SubtitleItem | null>(null);

  // Refresh top subtitle timestamp on startup so user sees current local time & signal Android bridge page ready
  useEffect(() => {
    try {
      if ((window as any).AndroidBridge?.onPageReady) {
        (window as any).AndroidBridge.onPageReady();
      }
    } catch (e) {
      console.warn('AndroidBridge call error:', e);
    }

    setSubtitles((prev) => {
      if (!prev || prev.length === 0) return prev;
      const now = Date.now();
      const formatted = new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return prev.map((item, idx) => {
        if (idx === 0) {
          return { ...item, timestamp: formatted, createdAt: now };
        }
        return item;
      });
    });
  }, []);

  // Persist subtitles in localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('radio_subtitles_cache', JSON.stringify(subtitles));
    } catch (e) {
      console.warn('Failed to save subtitles cache:', e);
    }
  }, [subtitles]);

  const handleNewSubtitle = useCallback((item: SubtitleItem) => {
    if (!item || !item.english) return;

    const cleanedEnglish = sanitizeTranscriptText(item.english);
    if (cleanedEnglish.length < 3 || isHallucinationLoop(cleanedEnglish)) {
      return;
    }

    const cleanItem: SubtitleItem = {
      ...item,
      english: cleanedEnglish,
      createdAt: item.createdAt || Date.now(),
    };

    setSubtitles((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === cleanItem.id);
      let updated: SubtitleItem[];

      // Normalize english text for duplicate / sub-sentence detection
      const normEnglish = (cleanItem.english || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (existingIndex >= 0) {
        // Merge item while preserving user bookmark status and custom state
        const existing = prev[existingIndex];
        const merged = {
          ...existing,
          ...cleanItem,
          // Preserve Chinese translation if incoming item is missing it
          traditionalChinese: cleanItem.traditionalChinese || existing.traditionalChinese,
          bookmarked: existing.bookmarked || cleanItem.bookmarked,
        };
        updated = [...prev];
        updated[existingIndex] = merged;
      } else {
        // Check recent items (last 3 items or within last 12 seconds)
        const now = Date.now();
        const topItem = prev[0];

        if (topItem) {
          const normTop = (topItem.english || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isRecentTop = (now - (topItem.createdAt || 0)) < 15000;

          // 1. If incoming subtitle is an expansion / longer refined version of the top item
          if (isRecentTop && normEnglish.length > normTop.length && (normEnglish.includes(normTop) || normEnglish.startsWith(normTop.slice(0, 20)))) {
            // Replace top item with the updated longer sentence
            const updatedTop = {
              ...topItem,
              ...cleanItem,
              bookmarked: topItem.bookmarked || cleanItem.bookmarked,
            };
            updated = [updatedTop, ...prev.slice(1)];
            return updated;
          }

          // 2. If top item already contains this shorter text within 12s, skip adding fragment
          if (isRecentTop && normTop.includes(normEnglish) && normTop.length > normEnglish.length) {
            return prev;
          }

          // 3. Exact match with top item within 15s
          if (isRecentTop && normTop === normEnglish) {
            // Update translation if newer translation is available
            if (cleanItem.traditionalChinese && cleanItem.traditionalChinese !== cleanItem.english && topItem.traditionalChinese !== cleanItem.traditionalChinese) {
              const updatedTop = {
                ...topItem,
                traditionalChinese: cleanItem.traditionalChinese,
              };
              return [updatedTop, ...prev.slice(1)];
            }
            return prev;
          }
        }

        // Check if identical to any of the last 3 items within 10 seconds
        const isDuplicateRecent = prev.slice(0, 3).some((s) => {
          const normPrev = (s.english || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isTimeClose = (now - (s.createdAt || 0)) < 10000;
          return isTimeClose && normPrev === normEnglish;
        });

        if (isDuplicateRecent) {
          return prev;
        }

        // Insert new clean subtitle at the beginning
        updated = [cleanItem, ...prev];
      }

      // Preserve up to 500 history items + keep all bookmarked items indefinitely
      if (updated.length > 500) {
        const bookmarked = updated.filter((s) => s.bookmarked);
        const nonBookmarked = updated.filter((s) => !s.bookmarked).slice(0, 500 - bookmarked.length);
        const combined = [...bookmarked, ...nonBookmarked];
        combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return combined;
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const handleCustomSubtitleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SubtitleItem>;
      if (customEvent.detail) {
        handleNewSubtitle(customEvent.detail);
      }
    };
    window.addEventListener('new-subtitle', handleCustomSubtitleEvent);
    return () => {
      window.removeEventListener('new-subtitle', handleCustomSubtitleEvent);
    };
  }, [handleNewSubtitle]);

  const handleBookmarkToggle = (id: string) => {
    setSubtitles((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, bookmarked: !item.bookmarked } : item
      )
    );
  };

  const handleClearBookmarks = () => {
    setSubtitles((prev) => {
      const updated = prev.map((item) => ({ ...item, bookmarked: false }));
      try {
        localStorage.setItem('radio_subtitles_cache', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearSubtitles = () => {
    setSubtitles((prev) => {
      // Independently preserve all bookmarked subtitles when clearing history
      const bookmarkedOnly = prev.filter((item) => item.bookmarked);
      try {
        localStorage.setItem('radio_subtitles_cache', JSON.stringify(bookmarkedOnly));
      } catch (e) {}
      return bookmarkedOnly;
    });
    safeApiFetch('/api/clear-subtitles-history', { method: 'POST' });
  };

  const handleTogglePlayPause = () => {
    // Dispatches to useRadioAudio's centralized streaming pipeline
    window.dispatchEvent(new CustomEvent('radio-toggle-play'));
  };

  const scrollToSubtitleReadingPosition = useCallback(() => {
    setTimeout(() => {
      const targetEl = document.getElementById('subtitle-search-bar') || document.getElementById('subtitle-frame-top');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }, []);

  useEffect(() => {
    const handleScrollEvent = () => {
      scrollToSubtitleReadingPosition();
    };
    window.addEventListener('scroll-to-subtitles', handleScrollEvent);
    return () => {
      window.removeEventListener('scroll-to-subtitles', handleScrollEvent);
    };
  }, [scrollToSubtitleReadingPosition]);

  const handleTopHeaderPlayToggle = () => {
    const isCurrentlyPlaying = playbackStatus === 'PLAYING';
    handleTogglePlayPause();
    // Scroll/adjust screen position to subtitles when starting playback
    if (!isCurrentlyPlaying) {
      scrollToSubtitleReadingPosition();
    }
  };

  const handleConfirmExit = () => {
    // 1. Stop audio playback immediately
    try {
      const audioEl = document.querySelector('audio');
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
      }
    } catch (_) {}

    // 2. Clear server-side audio buffer & local session storage
    fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
    try {
      sessionStorage.clear();
    } catch (_) {}

    // 3. Trigger native Android app exit & memory cleanup if in Android app
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.exitApp) {
      (window as any).AndroidBridge.exitApp(true);
    } else {
      // Browser / PWA fallback
      setShowExitModal(false);
      setPlaybackStatus('IDLE');
      setNotifToastMessage('已安全清理即時快取並停止廣播播放');
      setTimeout(() => {
        try {
          window.close();
        } catch (_) {}
      }, 500);
    }
  };

  const appBgClass =
    effectiveTheme === 'paper'
      ? 'bg-[#F8F3E6] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-slate-100 text-slate-900'
      : 'bg-slate-950 text-slate-100';

  const headerClass =
    effectiveTheme === 'paper'
      ? 'bg-[#FAF4E8]/95 border-[#E2D2B0] text-[#3B2E1E]'
      : effectiveTheme === 'light'
      ? 'bg-white/95 border-slate-200 text-slate-900'
      : 'bg-slate-900/95 border-slate-800 text-slate-100';

  const versionBadgeClass =
    effectiveTheme === 'paper'
      ? 'bg-emerald-800/15 text-emerald-900 border-emerald-700/30'
      : effectiveTheme === 'light'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-600 selection:text-white pb-12 transition-colors duration-200 ${appBgClass}`}>
      {/* Startup Loading Overlay Animation */}
      <AnimatePresence>
        {isInitializing && (
          <motion.div
            key="app-startup-splash-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => {
              console.log('[Splash Overlay] Tapped to force dismiss');
              setIsInitializing(false);
            }}
            className="fixed inset-0 z-[9999] bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 select-none cursor-pointer"
          >
            <div className="relative w-24 h-24 flex items-center justify-center mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
              <div className="absolute -inset-3 rounded-full border border-amber-400/40 animate-spin" style={{ animationDuration: '8s' }} />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center shadow-xl shadow-blue-500/30 ring-1 ring-white/20">
                <Radio className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-white">Live Bilingo 雙語電台</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30">
                v2.2.5
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6 font-medium">即時 AI 雙語字幕 • 語音對齊串流</p>

            {/* Dynamic Sound Equalizer Waves */}
            <div className="flex items-end gap-1.5 h-8 mb-6">
              <span className="w-1.5 bg-blue-500 rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.8s' }} />
              <span className="w-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ height: '100%', animationDuration: '1.2s' }} />
              <span className="w-1.5 bg-amber-400 rounded-full animate-pulse" style={{ height: '80%', animationDuration: '0.9s' }} />
              <span className="w-1.5 bg-blue-400 rounded-full animate-pulse" style={{ height: '90%', animationDuration: '1.1s' }} />
              <span className="w-1.5 bg-emerald-400 rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.7s' }} />
            </div>

            {/* Progress Bar Track */}
            <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3 relative border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${initProgress}%` }}
              />
            </div>

            <div className="text-xs text-slate-400 font-mono tracking-wide flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
              <span>{initStatusText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Mobile Status Bar Safe Area Spacer (Preserves Phone Native Status Bar Safe Inset & Never Obscured) */}
      <div 
        aria-hidden="true" 
        className="bg-[#0b0f19] border-b border-slate-800/40 w-full shrink-0 z-50 sticky top-0"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />

      {/* Real-Time Git Push & Build Deployed Notification Toast */}
      <AnimatePresence>
        {gitUpdateToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600/95 text-white text-xs font-semibold rounded-full shadow-xl flex items-center gap-2 border border-emerald-400 backdrop-blur-md"
          >
            <span className="animate-bounce">📳</span>
            <span>已同步 GitHub 最新代碼 ({gitUpdateToast.commit || 'main'}) 震動提醒！</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Browser Warning Header Banner (Rendered safely BELOW top safe-area) */}
      {isInAppBrowser && !isInstalled && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-3 sm:px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 z-40 relative shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-sm shrink-0">⚠️</span>
            <span className="truncate text-[11px] sm:text-xs">
              <b>提醒：</b>目前在 LINE/FB 內建瀏覽器或預覽頁，請用獨立 Chrome/Safari 開啟才能成功安裝！
            </span>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow transition-transform active:scale-95"
          >
            安裝 App 說明
          </button>
        </div>
      )}

      {/* Offline / Airplane Mode Banner (Rendered safely BELOW top safe-area spacer, well within screen bounds) */}
      {!isOnline && (
        <div className="bg-red-600/90 text-white border-b border-red-500/50 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-2 z-40 relative shadow-md">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-base shrink-0 animate-pulse">📡</span>
            <span className="truncate text-[11px] sm:text-xs">
              <b>航空/離線模式：</b>網路未連線，已進入本機離線模式，可閱讀學習歷史字幕與單字筆記。
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 bg-white text-red-700 hover:bg-slate-100 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow transition-all active:scale-95"
          >
            重試連線
          </button>
        </div>
      )}

      {/* Navigation Header (Sticky below top status bar) */}
      <header 
        className={`backdrop-blur-md border-b sticky z-50 shadow-md transition-colors duration-200 py-1.5 ${headerClass}`}
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex flex-nowrap items-center justify-between gap-2">
          {/* Left: Exit/Power Button + Logo & Title (Far from Play button, sticky on top) */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {/* Quick Exit Button (Far left, separated from Play button, prompts before exiting) */}
            <button
              onClick={() => setShowExitModal(true)}
              title="退出應用程式並清理快取"
              className={`p-2 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm ${
                effectiveTheme === 'paper'
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-red-900/5'
                  : effectiveTheme === 'light'
                  ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200 shadow-red-500/5'
                  : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30 shadow-red-500/10'
              }`}
              aria-label="退出應用程式"
            >
              <Power className="w-4 h-4" />
            </button>

            {/* Radio Logo Icon */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Radio className="w-4 h-4" />
            </div>

            {/* Title (Version badge removed per user request to keep header clean) */}
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-1.5 truncate">
                <span className="truncate">Live Bilingo 雙語電台</span>
              </h1>
              <p className="text-[11px] opacity-70 truncate hidden sm:block">
                Media3 ExoPlayer • 即時雙語字幕 • 語音對齊串流
              </p>
            </div>
          </div>

          {/* Top Sticky Play/Pause Button + PWA Install */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTopHeaderPlayToggle}
              title={playbackStatus === 'PLAYING' ? '暫停廣播收聽' : '播放廣播（自動置頂字幕搜尋區）'}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
                playbackStatus === 'PLAYING'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 ring-2 ring-amber-400/40'
                  : playbackStatus === 'BUFFERING'
                  ? 'bg-blue-600/80 text-white shadow-blue-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 ring-2 ring-blue-500/40'
              }`}
            >
              {playbackStatus === 'BUFFERING' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>連線中...</span>
                </>
              ) : playbackStatus === 'PLAYING' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
                  </span>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>暫停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  <span>播放</span>
                </>
              )}
            </button>

            {/* Top Notification Status & Prompt Trigger */}
            <button
              onClick={() => {
                if (!notificationGranted) {
                  setShowNotificationPrompt(true);
                } else {
                  setNotifToastMessage('🔔 通知權限已啟用：手機下拉選單與鎖定畫面控制列運作中');
                  setTimeout(() => setNotifToastMessage(''), 3000);
                }
              }}
              title={notificationGranted ? '手機下拉控制列已就緒 (通知已開啟)' : '點擊開啟手機下拉控制列通知'}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-sm ${
                notificationGranted
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 animate-pulse'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">
                {notificationGranted ? '下拉控制列' : '開啟通知'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  notificationGranted ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </button>

            {!isInstalled && !isAndroidWebView && (
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>安裝 App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Real-time Subtitle Reception Latency Diagnostic Panel */}
      <SttLatencyDebugPanel
        sttConnected={sttConnected}
        activeStationName={activeStation?.name || ''}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-12 pb-[max(3rem,env(safe-area-inset-bottom))] space-y-6">
        {/* Global Radio Stream Controller */}
        <AudioPlayerController
          playbackStatus={playbackStatus}
          setPlaybackStatus={setPlaybackStatus}
          onNewSubtitle={handleNewSubtitle}
          onInterimSubtitle={setInterimSubtitle}
          sttConnected={sttConnected}
          setSttConnected={setSttConnected}
          activeStation={activeStation}
          onOpenStationManager={() => setIsStationModalOpen(true)}
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          effectiveTheme={effectiveTheme}
        />

        {/* Tab View Switching */}
        {activeTab === 'app' && (
          <Material3AndroidFrame
            subtitles={subtitles}
            interimSubtitle={interimSubtitle}
            playbackStatus={playbackStatus}
            onTogglePlayPause={handleTogglePlayPause}
            sttConnected={sttConnected}
            onBookmarkToggle={handleBookmarkToggle}
            onClearBookmarks={handleClearBookmarks}
            onClearSubtitles={handleClearSubtitles}
            onOpenDictionary={handleOpenDictionary}
            activeStation={activeStation}
            onOpenStationManager={() => setIsStationModalOpen(true)}
            readingMode={readingMode}
            onReadingModeChange={setReadingMode}
            effectiveTheme={effectiveTheme}
          />
        )}

        {activeTab === 'code' && <AndroidCodeExplorer />}

        {activeTab === 'api' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span>系統與 API 架構規格說明</span>
              </h2>
              <p className="text-xs text-slate-400">
                本系統包含完整 Jetpack Compose Native Android 原生程式碼與 Web 即時直連廣播服務
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Radio Spec */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">1. 音訊串流引擎</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm text-white">美西公共新聞廣播</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Android 採用 <code className="text-blue-300 font-mono">androidx.media3.exoplayer.ExoPlayer</code> 串流直播 URL: <br />
                  <code className="text-slate-300 font-mono text-[11px] block mt-1 break-all bg-slate-900 p-1.5 rounded">
                    https://npr-ice.streamguys1.com/live.mp3
                  </code>
                </p>
              </div>

              {/* Deepgram STT Spec */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">2. Real-Time STT 語音轉文字</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm text-white">Deepgram Nova-2 WebSocket</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  OkHttp WebSocket 直連：<br />
                  <code className="text-slate-300 font-mono text-[10px] block mt-1 break-all bg-slate-900 p-1.5 rounded">
                    wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true
                  </code>
                  授權標頭：<code className="text-emerald-400 font-mono">Token 26c44e28...</code>
                </p>
              </div>

              {/* Local Translation Spec */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">3. 翻譯引擎</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm text-white">本機高效率繁體中文翻譯</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  將英文 Finalized Transcript 即時進行高效率繁體中文翻譯，零 API 配額限制且極速無延遲。
                </p>
              </div>
            </div>

            {/* Architecture Flow Diagram */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>資料串流架構圖 (Data Pipeline Flow)</span>
              </h3>
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-center text-xs font-mono">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 w-full">
                  <div className="text-blue-400 font-bold mb-1">Public Radio Stream</div>
                  <div className="text-slate-400 text-[11px]">live.mp3</div>
                </div>
                <span className="text-slate-500 font-bold">➔</span>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 w-full">
                  <div className="text-blue-400 font-bold mb-1">Deepgram WebSocket</div>
                  <div className="text-slate-400 text-[11px]">Nova-2 STT Model</div>
                </div>
                <span className="text-slate-500 font-bold">➔</span>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 w-full">
                  <div className="text-emerald-400 font-bold mb-1">High-Speed Local Engine</div>
                  <div className="text-slate-400 text-[11px]">English ➔ 繁體中文</div>
                </div>
                <span className="text-slate-500 font-bold">➔</span>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 w-full">
                  <div className="text-emerald-400 font-bold mb-1">Jetpack Compose UI</div>
                  <div className="text-slate-400 text-[11px]">Bilingual Cards LazyColumn</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Station Manager Modal */}
      <StationManagerModal
        isOpen={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        stations={stations}
        activeStation={activeStation}
        onSelectStation={(station) => {
          setActiveStation(station);
          setIsStationModalOpen(false);
          // Automatically start playing immediately and scroll to subtitle reading position when switching station
          scrollToSubtitleReadingPosition();
          fetch(getApiUrl('/api/clear-buffer'), { method: 'POST' }).catch(() => {});
          setPlaybackStatus('BUFFERING');
          setTimeout(() => {
            const audioEl = document.querySelector('audio');
            if (audioEl) {
              audioEl.load();
              audioEl
                .play()
                .then(() => {
                  setPlaybackStatus('PLAYING');
                  scrollToSubtitleReadingPosition();
                })
                .catch((e) => {
                  console.warn('Auto play on station switch error:', e);
                  setPlaybackStatus('ERROR');
                });
            }
          }, 50);
        }}
        onUpdateStations={handleUpdateStations}
      />

      {/* Free Local Dictionary Modal */}
      <DictionaryModal
        isOpen={isDictOpen}
        onClose={() => setIsDictOpen(false)}
        initialWord={dictWord}
      />

      {/* PWA Install Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white">安裝廣播 App 到手機桌面</h3>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Direct PWA Install Prompt Button if event captured */}
            {deferredPrompt && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>系統已偵測到一鍵安裝支援！</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        setIsInstalled(true);
                      }
                      setDeferredPrompt(null);
                      setShowInstallModal(false);
                    } catch (e) {
                      console.error('Direct install prompt error:', e);
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  點此立即跳出 Chrome 原生安裝 App 視窗
                </button>
              </div>
            )}

            {/* In-App Browser Warning Alert */}
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-1.5">
              <div className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                <span>⚠️ 為什麼預設安裝容易失敗或無法下載？</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                若是從 <b>LINE、FB、IG、微信或預覽視窗 (iFrame)</b> 內開啟，內建瀏覽器會<b>全面封鎖</b>手機安裝 PWA App 的權限！
              </p>
            </div>

            {/* iOS vs Android Instruction Tabs */}
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2">
                <div className="font-bold text-blue-400 text-xs flex items-center gap-1.5">
                  <span>📱 安卓 Chrome / 跨平台手動安裝步驟：</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                  <li>點選瀏覽器右上角 <span className="font-mono bg-slate-700 px-1.5 py-0.5 rounded text-white font-bold">⋮</span> 選單</li>
                  <li>尋找並點擊 <span className="font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">「安裝應用程式」</span> 或 <span className="font-bold text-emerald-400">「新增至主螢幕」</span></li>
                  <li>點擊 <span className="font-bold text-white">「新增」</span>，即可在手機桌面建立獨立 App 圖示！</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2">
                <div className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                  <span>🍎 iPhone / iPad (Safari) 安裝步驟：</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                  <li>請務必使用 <span className="font-bold text-white">Safari 瀏覽器</span> 開啟本頁</li>
                  <li>點擊 Safari 底部工具列的 <span className="font-bold text-sky-400">「分享 📤」</span> 按鈕</li>
                  <li>向上滑動選單，點擊 <span className="font-bold text-emerald-400">「加入主螢幕 ➕」</span> 即完成！</li>
                </ol>
              </div>

              {/* URL Copy Tool for External Browser Opening */}
              <div className="space-y-1.5 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <span>🔗 複製獨立 App 網址在外部 Chrome/Safari 開啟</span>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="w-full mt-1 py-2 px-3 bg-blue-600/90 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  複製 App 專屬網址（貼至原生 Chrome 瀏覽器）
                </button>
                {copyStatus && (
                  <div className="text-[11px] text-emerald-300 font-semibold text-center mt-1">
                    {copyStatus}
                  </div>
                )}
              </div>

              {/* Reset Cache Option */}
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1.5">
                <div className="font-bold text-slate-400 text-[11px] flex items-center gap-1.5">
                  <span>🔄 遇到暫存衝突？</span>
                </div>
                <button
                  onClick={handleResetPwaAndReload}
                  className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  重置 PWA 註冊暫存並重新載入
                </button>
              </div>
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowInstallModal(false);
                  setActiveTab('code');
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📦 需要 Android Kotlin 原生專案檔？切換至 Code 頁面</span>
              </button>
              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                關閉說明視窗，返回雙語電台
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notification Toast Message */}
      {notifToastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900/95 border border-emerald-500/50 text-emerald-300 font-medium text-xs rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notifToastMessage}</span>
        </div>
      )}

      {/* Notification Permission Prompt Modal (Shown only when not granted) */}
      {showNotificationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-500/15 text-blue-400 rounded-xl border border-blue-500/30">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">開啟「手機下拉控制列」</h3>
                  <p className="text-[11px] text-slate-400">通知權限設定提示</p>
                </div>
              </div>
              <button
                onClick={handleDismissNotificationPrompt}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p className="text-slate-200 text-xs leading-relaxed">
                開啟通知權限後，您可以在手機<b>「下拉通知中心」</b>及<b>「鎖定畫面」</b>直接控制廣播播放、暫停與電台狀態，無須頻繁解鎖或切換 App 畫面！
              </p>

              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-emerald-400 font-bold shrink-0">⚡</span>
                  <div>
                    <span className="font-bold text-white">極致流暢、零延遲：</span>
                    <span className="text-slate-400"> 採用全新輕量化無鎖控制架構，徹底解決先前下拉選單造成的語音與字幕卡頓問題。</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-blue-400 font-bold shrink-0">🎵</span>
                  <div>
                    <span className="font-bold text-white">背景與鎖定畫面控制：</span>
                    <span className="text-slate-400"> 手機關閉螢幕或切換其他 App 時，仍可隨時掌控即時電台。</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0">🔇</span>
                  <div>
                    <span className="font-bold text-white">安靜無擾保證：</span>
                    <span className="text-slate-400"> 僅在播放廣播時常駐快捷按鈕，絕不發送廣告或震動干擾。</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleRequestNotification}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Bell className="w-4 h-4" />
                <span>立即開啟通知權限</span>
              </button>
              <button
                onClick={handleDismissNotificationPrompt}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                稍後再說（直接進入主畫面）
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-red-500/15 text-red-400 rounded-xl border border-red-500/30">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認退出應用程式？</h3>
                <p className="text-[11px] text-slate-400">Live Bilingo 雙語電台</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p className="text-slate-200 text-xs">
                確定要關閉並退出 <b>Live Bilingo 雙語電台</b> 嗎？
              </p>
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>停止廣播即時串流與背景播放服務</span>
                </div>
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>安全清理臨時記憶體快取，釋放系統資源</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleConfirmExit}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Power className="w-4 h-4" />
                <span>清理快取並退出</span>
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
