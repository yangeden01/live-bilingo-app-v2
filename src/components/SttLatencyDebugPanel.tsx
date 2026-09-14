import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Zap,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Radio,
  Server,
  Sparkles,
  ShieldCheck,
  Lock,
  Unlock,
  Wifi,
} from 'lucide-react';
import { SttLatencyStats, getSttStreamStats } from '../main';
import { safeApiFetch } from '../utils/safeFetch';
import { APP_VERSION } from '../types';

interface SttLatencyDebugPanelProps {
  sttConnected: boolean;
  activeStationName: string;
}

export function SttLatencyDebugPanel({ sttConnected, activeStationName }: SttLatencyDebugPanelProps) {
  const [stats, setStats] = useState<SttLatencyStats | null>(() => getSttStreamStats());
  const [isOpen, setIsOpen] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [pingResult, setPingResult] = useState<number | null>(null);

  // 開發者權限狀態（3 秒內點擊 icon 5 次解鎖）
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('bilingo_developer_auth') === 'unlocked_by_gesture';
    } catch (_) {
      return false;
    }
  });
  const clickTimestampsRef = useRef<number[]>([]);
  const [showUnlockToast, setShowUnlockToast] = useState(false);

  const [sttStatus, setSttStatus] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('bilingo_global_stt_cache');
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  });
  const [liveSentenceCount, setLiveSentenceCount] = useState(0);
  const [liveSentenceSpm, setLiveSentenceSpm] = useState(0);
  const [liveSliceRpm, setLiveSliceRpm] = useState(0);
  const sentenceTimestampsRef = useRef<number[]>([]);
  const sliceTimestampsRef = useRef<number[]>([]);
  const lastSliceTimeRef = useRef<number>(0);
  const lastFetchTimeRef = useRef<number>(0);

  // 監聽即時字幕事件，區分「音訊切片轉譯速率 (RPM，約 15~16)」與「字幕句子接收速率 (SPM)」
  useEffect(() => {
    const handleSubtitleEvent = () => {
      const now = Date.now();
      const cutoff = now - 60000;

      // 1. 句子流速累計 (SPM)
      sentenceTimestampsRef.current.push(now);
      sentenceTimestampsRef.current = sentenceTimestampsRef.current.filter((t) => t >= cutoff);
      setLiveSentenceCount((prev) => prev + 1);
      setLiveSentenceSpm(sentenceTimestampsRef.current.length);

      // 2. 音訊切片頻率辨識 (RPM):
      //    廣播音訊每 3.8 秒切片一次，同一切片的句子於 2.2 秒內抵達。
      //    因此超過 2.2 秒間隔抵達的新字幕，標誌著一個全新的音訊切片。
      if (now - lastSliceTimeRef.current >= 2200) {
        sliceTimestampsRef.current.push(now);
        lastSliceTimeRef.current = now;
      }
      sliceTimestampsRef.current = sliceTimestampsRef.current.filter((t) => t >= cutoff);
      setLiveSliceRpm(sliceTimestampsRef.current.length);

      // 3. 節流讀取配額（最多每 3.5 秒一次，避免高頻請求）
      if (now - lastFetchTimeRef.current >= 3500) {
        lastFetchTimeRef.current = now;
        setTimeout(fetchStatus, 200);
      }
    };

    window.addEventListener('new-subtitle', handleSubtitleEvent);
    window.addEventListener('native-subtitle', handleSubtitleEvent);
    const ticker = setInterval(() => {
      const now = Date.now();
      const cutoff = now - 60000;
      sentenceTimestampsRef.current = sentenceTimestampsRef.current.filter((t) => t >= cutoff);
      sliceTimestampsRef.current = sliceTimestampsRef.current.filter((t) => t >= cutoff);
      setLiveSentenceSpm(sentenceTimestampsRef.current.length);
      setLiveSliceRpm(sliceTimestampsRef.current.length);
    }, 2000);

    return () => {
      window.removeEventListener('new-subtitle', handleSubtitleEvent);
      window.removeEventListener('native-subtitle', handleSubtitleEvent);
      clearInterval(ticker);
    };
  }, []);

  // 訂閱即時延遲更新
  useEffect(() => {
    const handleUpdate = (e: any) => {
      setStats(e.detail || null);
    };

    window.addEventListener('stt-latency-update', handleUpdate);
    return () => {
      window.removeEventListener('stt-latency-update', handleUpdate);
    };
  }, []);

  // 全局 STT 配額資料抓取（Android Native Bridge 與 Web 雲端雙向融合）
  const fetchStatus = async () => {
    let nativeData: any = null;
    let nativeGroq: any = null;

    try {
      // 1. Android 原生 App 環境讀取
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getNativeSttUsage) {
        try {
          const raw = (window as any).AndroidBridge.getNativeSttUsage();
          if (raw && raw !== '{}') {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed && (parsed.sttUsage || parsed.groq || parsed.status === 'ok')) {
              nativeData = parsed;
              nativeGroq = parsed.sttUsage?.groq || parsed.groq;
              setSttStatus((prev: any) => ({ ...(prev || {}), ...parsed }));
            }
          }
        } catch (e) {
          console.warn('[SttDebug] Native bridge read error:', e);
        }
      }

      // 2. 將本機統計回傳雲端中央伺服器，達成手機與平板 RPD 配額 100% 同步
      try {
        const deviceId =
          localStorage.getItem('bilingo_device_id') ||
          (() => {
            const id = 'dev_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('bilingo_device_id', id);
            return id;
          })();
        const nativeTurboToday = Number(
          nativeData?.groqDualModelSharding?.turbo?.requestsToday ??
            nativeGroq?.modelsUsage?.['whisper-large-v3-turbo']?.requestsToday ??
            0
        );
        const nativeV3Today = Number(
          nativeData?.groqDualModelSharding?.v3?.requestsToday ??
            nativeGroq?.modelsUsage?.['whisper-large-v3']?.requestsToday ??
            0
        );
        const nativeDgSec = Number(
          nativeData?.sttUsage?.deepgram?.streamSecondsToday ?? 0
        );

        if (nativeTurboToday > 0 || nativeV3Today > 0 || nativeDgSec > 0) {
          safeApiFetch('/api/sync-stt-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId,
              turboRequestsToday: nativeTurboToday,
              v3RequestsToday: nativeV3Today,
              deepgramStreamSecondsToday: nativeDgSec,
            }),
          }).catch(() => {});
        }
      } catch (_) {}

      // 3. 雲端 /api/stt-status 雙通道融合
      const res = await safeApiFetch<any>('/api/stt-status', { cache: 'no-store' });
      if (res.ok && res.data) {
        const cloudData = res.data;

        setSttStatus((prev: any) => {
          const merged = { ...(cloudData || {}), ...(nativeData || {}) };

          if (cloudData.sttUsage?.groq || nativeData?.sttUsage?.groq) {
            merged.sttUsage = merged.sttUsage || {};
            const cloudGroq = cloudData.sttUsage?.groq || {};
            const nGroq = nativeData?.sttUsage?.groq || {};
            const cloudModels = cloudGroq.modelsUsage || {};
            const nModels = nGroq.modelsUsage || {};

            const maxTurboToday = Math.max(
              Number(cloudModels['whisper-large-v3-turbo']?.requestsToday || 0),
              Number(nModels['whisper-large-v3-turbo']?.requestsToday || 0),
              Number(nativeData?.groqDualModelSharding?.turbo?.requestsToday || 0)
            );
            const maxV3Today = Math.max(
              Number(cloudModels['whisper-large-v3']?.requestsToday || 0),
              Number(nModels['whisper-large-v3']?.requestsToday || 0),
              Number(nativeData?.groqDualModelSharding?.v3?.requestsToday || 0)
            );

            merged.sttUsage.groq = {
              ...cloudGroq,
              ...nGroq,
              requestsTodayUtc: maxTurboToday + maxV3Today,
              totalRequestsEver: Math.max(
                Number(cloudGroq.totalRequestsEver || 0),
                Number(nGroq.totalRequestsEver || 0)
              ),
              modelsUsage: {
                'whisper-large-v3-turbo': {
                  requestsToday: maxTurboToday,
                  remainingRequests:
                    nModels['whisper-large-v3-turbo']?.remainingRequests ??
                    cloudModels['whisper-large-v3-turbo']?.remainingRequests ??
                    null,
                  limitRequests: '2000',
                  resetRequests:
                    nModels['whisper-large-v3-turbo']?.resetRequests ??
                    cloudModels['whisper-large-v3-turbo']?.resetRequests ??
                    null,
                },
                'whisper-large-v3': {
                  requestsToday: maxV3Today,
                  remainingRequests:
                    nModels['whisper-large-v3']?.remainingRequests ??
                    cloudModels['whisper-large-v3']?.remainingRequests ??
                    null,
                  limitRequests: '2000',
                  resetRequests:
                    nModels['whisper-large-v3']?.resetRequests ??
                    cloudModels['whisper-large-v3']?.resetRequests ??
                    null,
                },
              },
            };
          }

          // 保持 Deepgram 每日時長累積不歸零
          if (cloudData.sttUsage?.deepgram || nativeData?.sttUsage?.deepgram) {
            merged.sttUsage = merged.sttUsage || {};
            const cloudDg = cloudData.sttUsage?.deepgram || {};
            const nDg = nativeData?.sttUsage?.deepgram || {};
            const maxDgSec = Math.max(
              Number(cloudDg.streamSecondsToday || 0),
              Number(nDg.streamSecondsToday || 0)
            );
            const costUsd = Number(((maxDgSec / 60) * 0.0043).toFixed(4));
            const costNtd = Math.round(costUsd * 32.5);

            merged.sttUsage.deepgram = {
              ...cloudDg,
              ...nDg,
              streamSecondsToday: maxDgSec,
              estimatedCostUsd: costUsd,
              estimatedCostNtd: costNtd,
              requestsTodayUtc: Math.max(
                Number(cloudDg.requestsTodayUtc || 0),
                Number(nDg.requestsTodayUtc || 0)
              ),
            };
          }

          try {
            localStorage.setItem('bilingo_global_stt_cache', JSON.stringify(merged));
          } catch (_) {}
          return merged;
        });
      }
    } catch (e) {
      console.warn('[SttDebug] Fetch stt status error:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    handlePing(); // 面板載入時自動測速一次 RTT
    const intervalTime = isOpen ? 3000 : 10000;
    const interval = setInterval(fetchStatus, intervalTime);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isOpen]);

  // 更新「X 秒前」計時器
  useEffect(() => {
    const interval = setInterval(() => {
      if (stats?.lastReceivedAt) {
        setSecondsAgo(Math.max(0, Math.floor((Date.now() - stats.lastReceivedAt) / 1000)));
      } else {
        setSecondsAgo(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [stats]);

  // 點擊頂部圖標觸發（3 秒內點擊 5 次解鎖開發者權限）
  const handleBadgeClick = () => {
    if (isDevUnlocked) {
      // 已處於解鎖狀態：點擊直接開關面板
      setIsOpen((prev) => !prev);
      return;
    }

    // 尚未解鎖：計算過去 3000ms 內的點擊次數
    const now = Date.now();
    const recentClicks = [...clickTimestampsRef.current.filter((t) => now - t <= 3000), now];
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length >= 5) {
      // 3 秒內連續點擊 5 次達成！解鎖開發者專用面板
      try {
        sessionStorage.setItem('bilingo_developer_auth', 'unlocked_by_gesture');
      } catch (_) {}
      setIsDevUnlocked(true);
      clickTimestampsRef.current = [];
      setIsOpen(true);
      setShowUnlockToast(true);
      setTimeout(() => setShowUnlockToast(false), 2500);

      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([40, 60, 80]);
        }
      } catch (_) {}
    } else {
      // 點擊未滿 5 次：保持完全靜默，不顯示任何彈窗，不讓一般使用者感知
    }
  };

  // 鎖定並退出開發者模式
  const handleLockAndExit = () => {
    try {
      sessionStorage.removeItem('bilingo_developer_auth');
    } catch (_) {}
    setIsDevUnlocked(false);
    setIsOpen(false);
    clickTimestampsRef.current = [];
  };

  // RTT 延遲測試
  const handlePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await safeApiFetch('/api/version', { cache: 'no-store' });
      const duration = Math.round(performance.now() - start);
      setPingResult(duration);
    } catch (e) {
      setPingResult(-1);
    } finally {
      setIsPinging(false);
    }
  };

  // 強制重新同步 STT 串流
  const handleForceResync = () => {
    setIsResyncing(true);
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.reconnectStt) {
        (window as any).AndroidBridge.reconnectStt();
      } else {
        window.dispatchEvent(new CustomEvent('bilingo:force-stt-reconnect'));
      }
    } catch (e) {
      console.warn('Force resync failed:', e);
    }
    setTimeout(() => {
      setIsResyncing(false);
      fetchStatus();
    }, 1200);
  };

  // 徽章樣式計算
  const latency = stats?.currentLatencyMs ?? null;
  let latencyBadgeColor = 'bg-slate-900/80 text-slate-300 border-slate-700/60';
  let latencyIndicatorDot = 'bg-slate-500';

  if (!sttConnected) {
    latencyBadgeColor = 'bg-slate-900/90 text-slate-400 border-slate-700/60';
    latencyIndicatorDot = 'bg-slate-600';
  } else if (latency !== null) {
    if (latency < 400) {
      latencyBadgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50 shadow-emerald-900/20';
      latencyIndicatorDot = 'bg-emerald-400 animate-pulse';
    } else if (latency < 900) {
      latencyBadgeColor = 'bg-cyan-950/80 text-cyan-300 border-cyan-600/50 shadow-cyan-900/20';
      latencyIndicatorDot = 'bg-cyan-400';
    } else if (latency < 2500) {
      latencyBadgeColor = 'bg-amber-950/80 text-amber-300 border-amber-600/50 shadow-amber-900/20';
      latencyIndicatorDot = 'bg-amber-400';
    } else {
      latencyBadgeColor = 'bg-rose-950/80 text-rose-300 border-rose-600/50 shadow-rose-900/20';
      latencyIndicatorDot = 'bg-rose-400 animate-ping';
    }
  }

  // 提取 Groq 全局配額與雙模型數據
  const sttUsage = sttStatus?.sttUsage;
  const groqUsage = sttUsage?.groq;
  const deepgramUsage = sttUsage?.deepgram;
  const utcResetInfo = sttUsage?.utcResetInfo;

  // 備用 Deepgram 是否被啟動
  const isDeepgramBackupActive = Boolean(
    deepgramUsage?.active && (sttStatus?.activeEngine?.includes('Deepgram') || deepgramUsage?.isBackupActive)
  );

  // Groq 雙模型每日限制 (RPD): Turbo 2,000 次 + V3 2,000 次 = 4,000 次全局免費額度
  const modelsUsage = groqUsage?.modelsUsage || {};
  const dualSharding = sttStatus?.groqDualModelSharding || groqUsage?.dualModelSharding || {};
  const turboInfo = modelsUsage['whisper-large-v3-turbo'] || dualSharding?.turbo;
  const v3Info = modelsUsage['whisper-large-v3'] || dualSharding?.v3;

  // 1. 本機切片頻率（音訊每 3.8s 切片，正常約 15~16 RPM，安全線 20 RPM）
  const currentSliceRpm = liveSliceRpm > 0 
    ? liveSliceRpm 
    : (groqUsage?.rpm !== undefined && groqUsage.rpm > 0 ? Number(groqUsage.rpm) : 0);

  // 2. Groq 雙模型分流速率 (Turbo 20 RPM + V3 20 RPM 獨立分流池)
  const activeEngineStr = String(sttStatus?.activeEngine || '').toLowerCase();

  // Turbo (第一道免費主力: 2,000 RPD / 20 RPM)
  const turboLimit = 2000;
  const rawTurboRem = turboInfo?.remainingRequests ?? dualSharding?.turbo?.remainingRequests;
  const hasTurboOfficialHeader = rawTurboRem !== undefined && rawTurboRem !== null && rawTurboRem !== '';
  const parsedTurboRem = hasTurboOfficialHeader ? parseInt(String(rawTurboRem), 10) : NaN;
  const isTurboOfficiallyKnown = !isNaN(parsedTurboRem);

  const turboExhausted = Boolean(
    turboInfo?.isExhausted ||
    dualSharding?.turbo?.isExhausted ||
    groqUsage?.turboExhausted ||
    (isTurboOfficiallyKnown && parsedTurboRem === 0)
  );

  const turboRemaining = turboExhausted
    ? 0
    : isTurboOfficiallyKnown && parsedTurboRem >= 0
    ? parsedTurboRem
    : Math.max(0, turboLimit - Number(turboInfo?.requestsToday ?? (groqUsage?.requestsTodayUtc ? Math.min(2000, groqUsage.requestsTodayUtc) : 0)));

  const turboRequests = turboExhausted
    ? turboLimit
    : isTurboOfficiallyKnown && parsedTurboRem >= 0
    ? Math.min(turboLimit, Math.max(Number(turboInfo?.requestsToday ?? 0), turboLimit - parsedTurboRem))
    : Math.min(turboLimit, Number(turboInfo?.requestsToday ?? 0));

  // V3 (第二道免費接棒: 2,000 RPD / 20 RPM)
  const v3Limit = 2000;
  const rawV3Rem = v3Info?.remainingRequests ?? dualSharding?.v3?.remainingRequests;
  const hasV3OfficialHeader = rawV3Rem !== undefined && rawV3Rem !== null && rawV3Rem !== '';
  const parsedV3Rem = hasV3OfficialHeader ? parseInt(String(rawV3Rem), 10) : NaN;
  const isV3OfficiallyKnown = !isNaN(parsedV3Rem);

  const v3Exhausted = Boolean(
    v3Info?.isExhausted ||
    dualSharding?.v3?.isExhausted ||
    groqUsage?.v3Exhausted ||
    (isV3OfficiallyKnown && parsedV3Rem === 0)
  );

  const v3Remaining = v3Exhausted
    ? 0
    : isV3OfficiallyKnown && parsedV3Rem >= 0
    ? parsedV3Rem
    : Math.max(0, v3Limit - Number(v3Info?.requestsToday ?? (groqUsage?.requestsTodayUtc && groqUsage.requestsTodayUtc > 2000 ? groqUsage.requestsTodayUtc - 2000 : 0)));

  const v3Requests = v3Exhausted
    ? v3Limit
    : isV3OfficiallyKnown && parsedV3Rem >= 0
    ? Math.min(v3Limit, Math.max(Number(v3Info?.requestsToday ?? 0), v3Limit - parsedV3Rem))
    : Math.min(v3Limit, Number(v3Info?.requestsToday ?? 0));

  const bothGroqExhausted = turboExhausted && v3Exhausted;

  const isTurboActive = activeEngineStr.includes('turbo') || (!bothGroqExhausted && !turboExhausted);
  const isV3Active = activeEngineStr.includes('whisper-large-v3') && !activeEngineStr.includes('turbo');

  const turboRpm = Math.min(
    20,
    Number(
      dualSharding?.turbo?.rpm ??
        dualSharding?.turboRpm ??
        (isTurboActive ? currentSliceRpm : 0)
    )
  );
  const v3Rpm = Math.min(
    20,
    Number(
      dualSharding?.v3?.rpm ??
        dualSharding?.v3Rpm ??
        (isV3Active ? currentSliceRpm : 0)
    )
  );

  // 全局總次數 (合計 4,000 次)
  const totalGroqToday = Math.min(4000, turboRequests + v3Requests);
  const totalGroqLimit = 4000;
  const totalGroqRemaining = Math.max(0, totalGroqLimit - totalGroqToday);

  // Deepgram 備援時長與費用累積 (本機持久化防止暫停歸零)
  const todayUtcKey = new Date().toISOString().slice(0, 10);
  const cachedDgSeconds = (() => {
    try {
      return Number(localStorage.getItem(`bilingo_dg_sec_${todayUtcKey}`) || '0');
    } catch (_) {
      return 0;
    }
  })();

  const rawDgSeconds = Number(
    deepgramUsage?.streamSecondsToday ??
      (Number(deepgramUsage?.requestsTodayUtc ?? 0) * 3.5)
  );
  const deepgramSeconds = Math.max(cachedDgSeconds, rawDgSeconds);

  if (deepgramSeconds > cachedDgSeconds) {
    try {
      localStorage.setItem(`bilingo_dg_sec_${todayUtcKey}`, String(deepgramSeconds));
    } catch (_) {}
  }

  const deepgramMinutesPart = Math.floor(deepgramSeconds / 60);
  const deepgramSecondsPart = deepgramSeconds % 60;
  const deepgramDurationText = `${deepgramMinutesPart} 分 ${String(deepgramSecondsPart).padStart(2, '0')} 秒`;

  const deepgramCostUsd = Number(((deepgramSeconds / 60) * 0.0043).toFixed(4));
  const deepgramCostNtd = Math.round(deepgramCostUsd * 32.5);
  const deepgramCostText = `$${deepgramCostUsd.toFixed(2)} USD (NT$ ${deepgramCostNtd})`;

  const isDeepgramActive = Boolean(
    deepgramUsage?.active ||
      isDeepgramBackupActive ||
      activeEngineStr.includes('deepgram')
  );

  // UTC 重置倒數計算
  const resetCountdownText = (() => {
    if (utcResetInfo?.hoursRemaining !== undefined && utcResetInfo?.minutesRemaining !== undefined) {
      return `${utcResetInfo.hoursRemaining}h ${utcResetInfo.minutesRemaining}m`;
    }
    const now = new Date();
    const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const diff = Math.max(0, nextReset.getTime() - now.getTime());
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  })();

  return (
    <div id="stt-latency-debug-wrapper" className="relative z-30 w-full px-3 py-1">
      {/* 頂部迷你切換按鈕（使用者附圖紅框中的 icon） */}
      <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
        <button
          id="btn-toggle-latency-panel"
          onClick={handleBadgeClick}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border backdrop-blur-md transition-all shadow-sm ${latencyBadgeColor} hover:brightness-110 active:scale-95 cursor-pointer`}
          title={isDevUnlocked ? '點擊收合 STT 監控面板' : '即時語音延遲'}
        >
          <span className={`w-2 h-2 rounded-full ${latencyIndicatorDot}`} />
          <Activity className="w-3.5 h-3.5" />
          <span className="font-semibold">
            {latency !== null ? `${latency}ms` : '0ms'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3 h-3 ml-0.5 opacity-70" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
          )}
          {isDevUnlocked && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-0.5" title="開發者模式中" />
          )}
        </button>

        {stats && secondsAgo !== null && (
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{secondsAgo === 0 ? '剛剛更新' : `${secondsAgo}s 前`}</span>
          </div>
        )}
      </div>

      {/* 解鎖開發者模式 Toast 提示 */}
      <AnimatePresence>
        {showUnlockToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 border border-cyan-500/60 shadow-2xl text-cyan-300 text-xs font-medium flex items-center gap-2 backdrop-blur-md"
          >
            <Unlock className="w-3.5 h-3.5 text-cyan-400" />
            <span>已連續點擊 5 次，開發者模式已解鎖！</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 展開後的開發者專用監控面板 */}
      <AnimatePresence>
        {isOpen && isDevUnlocked && (
          <motion.div
            id="stt-latency-expanded-panel"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mt-2 p-3.5 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-lg max-w-xl mx-auto text-slate-200 text-xs font-sans"
          >
            {/* 標頭 */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    STT 服務狀態與全局配額監控
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-mono">
                      {APP_VERSION}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono flex items-center gap-0.5">
                      <Unlock className="w-2.5 h-2.5" /> 已授權
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    即時監控語音辨識延遲、全域總負載日誌與 Groq 每日配額 (RPD)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-lock-and-exit"
                  onClick={handleLockAndExit}
                  title="鎖定並退出開發者模式"
                  className="px-2 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 text-[10px] font-mono border border-slate-700"
                >
                  <Lock className="w-3 h-3 text-amber-300" />
                  <span>鎖定退出</span>
                </button>
                <button
                  id="btn-close-latency-panel"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 電台與串流來源狀態條 */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 mb-2.5 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 truncate max-w-[55%]">
                <Radio className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-slate-400 shrink-0">電台:</span>
                <span className="text-slate-200 font-medium truncate">
                  {activeStationName || '未播放'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate max-w-[42%] justify-end">
                <Server className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-emerald-300 font-mono font-semibold truncate text-[10px]">
                  {stats?.lastSource
                    ? stats.lastSource
                    : sttConnected
                    ? '🟢 串流連線中'
                    : '⚪ 待命狀態'}
                </span>
              </div>
            </div>

            {/* 4 大獨立防線架構卡片 */}
            <div className="space-y-2 mb-2.5">
              {/* 【卡片 1】即時轉譯速率（本機 RPM 監控） */}
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-900/60 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded bg-emerald-950 border border-emerald-800/80 text-emerald-400">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200">
                        【卡片 1】即時轉譯速率（本機 RPM 監控）
                      </span>
                      <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 font-mono">
                        本機滑動窗口 0 網路開銷
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      currentSliceRpm <= 20
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse'
                    }`}
                  >
                    {currentSliceRpm <= 20 ? '🟢 綠燈安全' : '⚠️ 接近 20 RPM 上限'}
                  </span>
                </div>

                {/* 音訊切片轉譯速率（安全線 20 RPM） */}
                <div className="space-y-1 mb-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">
                      音訊切片速率:{' '}
                      <strong className={currentSliceRpm <= 20 ? 'text-emerald-400' : 'text-amber-400'}>
                        {currentSliceRpm}
                      </strong>{' '}
                      / 20 RPM
                    </span>
                    <span className="text-slate-500 text-[9px]">
                      安全上限: 20 RPM (約 15~16 RPM)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        currentSliceRpm <= 20 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, (currentSliceRpm / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Groq 雙模型分流狀況條 (各 20 RPM 獨立池) */}
                <div className="p-1.5 mb-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400 font-sans">Groq 分流池:</span>
                  <div className="flex items-center gap-3">
                    <span className={turboRpm > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      Turbo: {turboRpm}/20 RPM
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className={v3Rpm > 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                      V3: {v3Rpm}/20 RPM
                    </span>
                    <span className="text-[9px] text-slate-500 font-sans">
                      (雙池共 40 RPM)
                    </span>
                  </div>
                </div>

                {/* 整合指標：語音延遲 + 字幕流速 + 整合 RTT 測速 */}
                <div className="grid grid-cols-3 gap-1.5 font-mono text-center">
                  <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-[9px] text-slate-400 font-sans">語音延遲</div>
                    <div className="text-xs font-bold text-emerald-400">
                      {stats?.currentLatencyMs !== undefined && stats?.currentLatencyMs !== null
                        ? `${stats.currentLatencyMs}ms`
                        : '--'}
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans">
                      均值 {stats?.avgLatencyMs ?? '--'}ms
                    </div>
                  </div>

                  <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-[9px] text-slate-400 font-sans">字幕流速</div>
                    <div className="text-xs font-bold text-indigo-300">
                      {liveSentenceSpm} 句/分
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans">
                      總累計 {stats?.totalCount ?? liveSentenceCount} 句
                    </div>
                  </div>

                  {/* 整合【測試 RTT】：輕量指標 + 微型點擊按鈕 */}
                  <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                    <div className="text-[9px] text-slate-400 font-sans flex items-center justify-between">
                      <span>網路 RTT</span>
                      <button
                        onClick={handlePing}
                        disabled={isPinging}
                        title="測試與伺服器網路往返時延"
                        className="text-[9px] text-cyan-400 hover:text-cyan-200 flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isPinging ? 'animate-spin' : ''}`} />
                        <span>測速</span>
                      </button>
                    </div>
                    <div className="text-xs font-bold text-cyan-300">
                      {pingResult !== null
                        ? pingResult < 0
                          ? '超時'
                          : `${pingResult}ms`
                        : '--'}
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans">
                      {pingResult !== null && pingResult >= 0
                        ? pingResult < 150
                          ? '🟢 極佳'
                          : '🟡 稍慢'
                        : '點擊測速'}
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 font-sans mt-1.5">
                  💡 本機廣播切片頻率約在 15~16 RPM，安全線設在 20 RPM，一眼確認絕不觸碰 Groq 單機速率牆。
                </div>
              </div>

              {/* 【卡片 2】Groq Whisper Large V3 Turbo（免費主力防線） */}
              <div
                className={`p-2.5 rounded-lg border shadow-sm transition-colors ${
                  turboExhausted ? 'bg-rose-950/25 border-rose-900/60' : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      【卡片 2】Groq Whisper Large V3 Turbo
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      免費第一主力
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                      turboExhausted
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : isTurboActive
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {turboExhausted ? '🔴 官方已滿 (剩餘 0 次)' : isTurboActive ? '🟢 運作中 (第一主力)' : '⚪ 待命分流'}
                  </span>
                </div>

                {/* 分流即時速率 (RPM: 限制 20 次/分) */}
                <div className="mb-2 p-1.5 rounded bg-slate-900/70 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">分流即時速率:</span>
                    <span className={turboRpm >= 20 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {turboRpm} / 20 RPM
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        turboRpm >= 20 ? 'bg-rose-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (turboRpm / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 今日配額累積 (RPD: 2,000 次) */}
                <div className="flex items-baseline justify-between mb-1 text-xs">
                  <div className="font-mono">
                    <span className={`text-base font-bold ${turboExhausted ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {Math.min(turboRequests, turboLimit).toLocaleString()}
                    </span>
                    <span className="text-slate-400"> / {turboLimit.toLocaleString()} 次 (RPD)</span>
                  </div>
                  <div className={`text-[10px] font-mono ${turboExhausted ? 'text-rose-400 font-bold' : 'text-cyan-400'}`}>
                    {turboExhausted ? (
                      <span>今日剩餘 <strong className="font-bold">0</strong> 次 (官方已滿)</span>
                    ) : (
                      <span>今日剩餘 <strong className="font-bold">{turboRemaining.toLocaleString()}</strong> 次</span>
                    )}
                  </div>
                </div>

                {/* 視覺進度條 */}
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800 mb-1">
                  <div
                    className={`h-full transition-all duration-300 ${
                      turboExhausted ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, (Math.min(turboRequests, turboLimit) / turboLimit) * 100)}%` }}
                  />
                </div>

                <div className="text-[9px] text-slate-500 font-sans">
                  {turboExhausted ? (
                    <span className="text-rose-400/90 flex items-center gap-1">
                      ⚠️ 官方 Header 鎖定：剩餘 0 次。重置倒數：{utcResetInfo?.formattedRemaining || '台灣 08:00 AM (UTC 00:00)'}。
                    </span>
                  ) : (
                    <span>🔒 Groq 獨立 20 RPM 速率池。由官方 Header 與伺服器同步鎖定，平板與手機配額完全一致。</span>
                  )}
                </div>
              </div>

              {/* 【卡片 3】Groq Whisper Large V3（免費第二防線） */}
              <div
                className={`p-2.5 rounded-lg border shadow-sm transition-colors ${
                  v3Exhausted ? 'bg-rose-950/25 border-rose-900/60' : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      【卡片 3】Groq Whisper Large V3
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                      免費第二主力
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                      v3Exhausted
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : isV3Active || (turboExhausted && !v3Exhausted)
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {v3Exhausted
                      ? '🔴 官方已滿 (剩餘 0 次)'
                      : isV3Active || (turboExhausted && !v3Exhausted)
                      ? '🟢 運作中 (接棒主力)'
                      : '⚪ 待命分流'}
                  </span>
                </div>

                {/* 分流即時速率 (RPM: 限制 20 次/分) */}
                <div className="mb-2 p-1.5 rounded bg-slate-900/70 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">分流即時速率:</span>
                    <span className={v3Rpm >= 20 ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
                      {v3Rpm} / 20 RPM
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        v3Rpm >= 20 ? 'bg-rose-500' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${Math.min(100, (v3Rpm / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 今日配額累積 (RPD: 2,000 次) */}
                <div className="flex items-baseline justify-between mb-1 text-xs">
                  <div className="font-mono">
                    <span className={`text-base font-bold ${v3Exhausted ? 'text-rose-400' : 'text-cyan-300'}`}>
                      {Math.min(v3Requests, v3Limit).toLocaleString()}
                    </span>
                    <span className="text-slate-400"> / {v3Limit.toLocaleString()} 次 (RPD)</span>
                  </div>
                  <div className={`text-[10px] font-mono ${v3Exhausted ? 'text-rose-400 font-bold' : 'text-cyan-400'}`}>
                    {v3Exhausted ? (
                      <span>今日剩餘 <strong className="font-bold">0</strong> 次 (官方已滿)</span>
                    ) : (
                      <span>今日剩餘 <strong className="font-bold">{v3Remaining.toLocaleString()}</strong> 次</span>
                    )}
                  </div>
                </div>

                {/* 視覺進度條 */}
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800 mb-1">
                  <div
                    className={`h-full transition-all duration-300 ${
                      v3Exhausted ? 'bg-rose-500' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, (Math.min(v3Requests, v3Limit) / v3Limit) * 100)}%` }}
                  />
                </div>

                <div className="text-[9px] text-slate-500 font-sans">
                  {v3Exhausted ? (
                    <span className="text-rose-400/90 flex items-center gap-1">
                      ⚠️ 官方 Header 鎖定：剩餘 0 次。重置倒數：{utcResetInfo?.formattedRemaining || '台灣 08:00 AM (UTC 00:00)'}。
                    </span>
                  ) : (
                    <span>🔄 Groq 獨立 20 RPM 速率池。當 Turbo 滿 2,000 次或速率達上限時無縫分流，確保廣播字幕不斷炊。</span>
                  )}
                </div>
              </div>

              {/* 【卡片 4】Deepgram Nova-2 備援（單一收底防線） */}
              <div
                className={`p-2.5 rounded-lg border transition-colors shadow-sm ${
                  isDeepgramActive
                    ? 'bg-amber-950/40 border-amber-800/90'
                    : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      【卡片 4】Deepgram Nova-2
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      付費備援收底
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                      isDeepgramActive
                        ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {isDeepgramActive ? '🟠 備援運行中' : '🟢 0 耗損待命中 ($0)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-1.5 font-mono">
                  <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-[9px] text-slate-400 font-sans">今日串流時長</div>
                    <div className="text-xs font-bold text-slate-200">
                      {deepgramDurationText}
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans">當日累計不因暫停歸零</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                    <div className="text-[9px] text-slate-400 font-sans">今日預估花費</div>
                    <div className={`text-xs font-bold ${isDeepgramActive ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {deepgramCostText}
                    </div>
                    <div className="text-[8px] text-slate-500 font-sans">官方費率 $0.0043/分</div>
                  </div>
                </div>

                <div className="text-[9px] text-slate-400 font-sans">
                  {bothGroqExhausted ? (
                    <span className="text-amber-300/90">
                      ⚠️ 因 Groq 雙主力（Turbo ＋ V3）今日 4,000 次官方免費配額已耗盡，已全自動啟動 Deepgram Nova-2 備援，以確保電台雙語字幕不間斷。重置倒數：{utcResetInfo?.formattedRemaining || '台灣 08:00 AM'}。
                    </span>
                  ) : (
                    <span>🛡️ 當 Groq 雙模型合計 4,000 次滿載時，才無縫啟動接棒。平常 0 耗損不扣款，暫停時時長與金額忠實保留。</span>
                  )}
                </div>
              </div>
            </div>

            {/* 每日重置倒數與主要操作列 */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>00:00 UTC 重置剩餘 {resetCountdownText}</span>
              </div>

              {/* 主要操作按鈕：⚡ 重新校準字幕 (Force Sync) */}
              <button
                id="btn-force-resync"
                onClick={handleForceResync}
                disabled={isResyncing}
                className="px-3 py-1.5 rounded-lg bg-blue-900/70 text-blue-100 hover:bg-blue-800 transition text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm border border-blue-700/60"
              >
                <Zap className={`w-3.5 h-3.5 text-blue-300 ${isResyncing ? 'animate-spin' : ''}`} />
                <span>{isResyncing ? '校準同步中...' : '⚡ 重新校準字幕 (Force Sync)'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
