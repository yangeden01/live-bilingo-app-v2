import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, RefreshCw, X, ChevronDown, ChevronUp, Clock, Radio, Server, CheckCircle2, AlertTriangle, Gauge, BarChart3, Database } from 'lucide-react';
import { SttLatencyStats, getSttStreamStats, resetSttStreamLatency } from '../main';
import { safeApiFetch } from '../utils/safeFetch';

interface SttLatencyDebugPanelProps {
  sttConnected: boolean;
  activeStationName: string;
}

export function SttLatencyDebugPanel({ sttConnected, activeStationName }: SttLatencyDebugPanelProps) {
  const [stats, setStats] = useState<SttLatencyStats | null>(() => getSttStreamStats());
  const [isOpen, setIsOpen] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<number | null>(null);
  const [sttStatus, setSttStatus] = useState<any>(null);
  const [nativeUsage, setNativeUsage] = useState<any>(null);

  // Subscribe to live latency updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      setStats(e.detail || null);
    };

    window.addEventListener('stt-latency-update', handleUpdate);
    return () => {
      window.removeEventListener('stt-latency-update', handleUpdate);
    };
  }, []);

  // Poll STT Engine & API Request Usage Status when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      try {
        const res = await safeApiFetch('/api/stt-status', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setSttStatus(data);
        }
      } catch (_) {}

      // Check native Android STT usage if running inside APK
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getNativeSttUsage) {
        try {
          const raw = (window as any).AndroidBridge.getNativeSttUsage();
          if (raw) {
            setNativeUsage(JSON.parse(raw));
          }
        } catch (_) {}
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Update "seconds ago" ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (stats?.lastReceivedAt) {
        setSecondsAgo(Math.max(0, Math.floor((Date.now() - stats.lastReceivedAt) / 1000)));
      } else {
        setSecondsAgo(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [stats?.lastReceivedAt]);

  const handlePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await safeApiFetch('/api/version', { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      setPingResult(elapsed);
    } catch (_) {
      setPingResult(-1);
    } finally {
      setIsPinging(false);
    }
  };

  const handleForceResync = () => {
    try {
      window.dispatchEvent(new CustomEvent('radio-network-restored'));
      if ((window as any).AndroidBridge?.onNetworkRestored) {
        (window as any).AndroidBridge.onNetworkRestored();
      }
    } catch (_) {}
  };

  const latency = stats?.currentLatencyMs ?? null;
  const latencyBadgeColor =
    latency === null
      ? 'bg-slate-800/80 text-slate-400 border-slate-700'
      : latency < 1500
      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
      : latency < 4000
      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
      : 'bg-rose-950/80 text-rose-300 border-rose-500/40';

  const latencyIndicatorDot =
    latency === null
      ? 'bg-slate-500'
      : latency < 1500
      ? 'bg-emerald-400 animate-pulse'
      : latency < 4000
      ? 'bg-amber-400 animate-pulse'
      : 'bg-rose-500 animate-ping';

  // Derived Groq & Deepgram metrics
  const groqUsage = sttStatus?.sttUsage?.groq;
  const deepgramUsage = sttStatus?.sttUsage?.deepgram;
  const utcResetInfo = sttStatus?.sttUsage?.utcResetInfo;

  const groqRpm = groqUsage?.rpm ?? 0;
  const groqRpmLimit = groqUsage?.rpmLimit ?? 30;
  const groqTodayRequests = groqUsage?.requestsTodayUtc ?? 0;
  const groqRateLimited = groqUsage?.rateLimited ?? false;
  const groqCooldownSeconds = groqUsage?.cooldownSeconds ?? 0;
  const groqHeaders = groqUsage?.lastHeaders;

  const deepgramRpm = nativeUsage?.rpm ?? deepgramUsage?.rpm ?? 0;
  const deepgramTodayRequests = nativeUsage?.requestsTodayUtc ?? deepgramUsage?.requestsTodayUtc ?? 0;
  const deepgramActive = nativeUsage?.active ?? deepgramUsage?.active ?? false;

  return (
    <div id="stt-latency-debug-wrapper" className="relative z-30 w-full px-3 py-1">
      {/* Mini Toggle Bar at Top of App */}
      <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
        <button
          id="btn-toggle-latency-panel"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border backdrop-blur-md transition-all shadow-sm ${latencyBadgeColor} hover:brightness-110 active:scale-95`}
          title="點擊開啟/收合 字幕串流接收延遲 (STT Stream Latency) 偵錯面板"
        >
          <span className={`w-2 h-2 rounded-full ${latencyIndicatorDot}`} />
          <Activity className="w-3.5 h-3.5" />
          <span className="font-semibold">
            {latency !== null ? `${latency}ms` : 'STT 偵錯'}
          </span>
          {stats?.lastSource && (
            <span className="text-[10px] opacity-75 hidden sm:inline">
              ({stats.lastSource.replace('Android Native STT', 'Native').replace('Server SSE Stream', 'SSE')})
            </span>
          )}
          {isOpen ? <ChevronUp className="w-3 h-3 ml-0.5 opacity-70" /> : <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />}
        </button>

        {stats && secondsAgo !== null && (
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{secondsAgo === 0 ? '剛剛更新' : `${secondsAgo}s 前`}</span>
          </div>
        )}
      </div>

      {/* Expanded Latency Diagnostic Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="stt-latency-expanded-panel"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mt-2 p-3.5 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-lg max-w-xl mx-auto text-slate-200 text-xs font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    字幕接收延遲 (STT Stream Latency)
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-mono">
                      v2.3.2
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    測量從原生/後端語音轉錄產出至前端 Web 畫面呈現的即時延遲
                  </p>
                </div>
              </div>
              <button
                id="btn-close-latency-panel"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 font-mono">
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400">即時接收延遲</div>
                <div className="text-base font-bold text-emerald-400">
                  {stats?.currentLatencyMs !== undefined ? `${stats.currentLatencyMs}ms` : '--'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400">平均延遲 (Avg)</div>
                <div className="text-base font-bold text-cyan-300">
                  {stats?.avgLatencyMs !== undefined ? `${stats.avgLatencyMs}ms` : '--'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400">最小 / 最大</div>
                <div className="text-xs font-bold text-amber-300 truncate">
                  {stats ? `${stats.minLatencyMs} / ${stats.maxLatencyMs}ms` : '--'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400">總接收句段數</div>
                <div className="text-base font-bold text-indigo-300">
                  {stats?.totalCount ?? 0}
                </div>
              </div>
            </div>

            {/* Status & Channel Details */}
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 mb-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 text-blue-400" /> 當前播放電台:
                </span>
                <span className="text-slate-200 font-medium truncate max-w-[220px]">
                  {activeStationName || '未播放'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" /> 接收通道來源:
                </span>
                <span className="text-emerald-300 font-mono font-semibold">
                  {stats?.lastSource || (sttConnected ? '連線中...' : '等待字幕串流...')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> 轉錄架構策略:
                </span>
                <span className="text-amber-300 font-mono font-semibold">
                  即時語音辨識 (Decoupled Time Aligner 2.5s~3.5s 穩定緩衝)
                </span>
              </div>

              {pingResult !== null && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">伺服器往返耗時 (RTT):</span>
                  <span className={`font-mono font-bold ${pingResult > 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {pingResult > 0 ? `${pingResult}ms` : '逾時 / 錯誤'}
                  </span>
                </div>
              )}
            </div>

            {/* STT API Request & Quota Telemetry (Groq & Deepgram) */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 mb-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold text-slate-200">
                    STT 請求監控 (Groq / Deepgram)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 font-mono flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-blue-400" />
                    Groq 官方 UTC 週期對齊
                  </span>
                  {utcResetInfo && (
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                      ({utcResetInfo.utcDate} 重置剩餘 {utcResetInfo.hoursRemaining}h{utcResetInfo.minutesRemaining}m)
                    </span>
                  )}
                </div>
              </div>

              {/* Request Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                {/* Card 1: Groq RPM */}
                <div className="p-2 rounded-md bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Groq 每分鐘 (RPM)</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      groqRateLimited ? 'bg-rose-500 animate-ping' : groqRpm > 20 ? 'bg-amber-400' : groqRpm > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                    }`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-base font-bold ${groqRateLimited ? 'text-rose-400' : groqRpm > 20 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {groqRpm}
                    </span>
                    <span className="text-[10px] text-slate-400">/ {groqRpmLimit} RPM</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {groqRateLimited ? `⏳ 降溫中 (${groqCooldownSeconds}s)` : '滑動 60 秒視窗'}
                  </div>
                </div>

                {/* Card 2: Groq 當日 (RPD) - UTC 對齊 */}
                <div className="p-2 rounded-md bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Groq 當日 (RPD)</span>
                    <span className="text-[9px] text-cyan-400 font-semibold">00:00 UTC</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-cyan-300">
                      {groqTodayRequests}
                    </span>
                    <span className="text-[10px] text-slate-400">/ 1.44萬 次</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {utcResetInfo ? `距重置剩 ${utcResetInfo.hoursRemaining}h ${utcResetInfo.minutesRemaining}m` : '00:00:00 UTC 重置'}
                  </div>
                </div>

                {/* Card 3: Groq 官方標頭剩餘 (API Headers) */}
                <div className="p-2 rounded-md bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] text-slate-400 mb-0.5">Groq 標頭剩餘額度</div>
                  <div className="text-base font-bold text-indigo-300 truncate">
                    {groqHeaders?.remainingRequests !== undefined && groqHeaders?.remainingRequests !== null
                      ? `${groqHeaders.remainingRequests} 次`
                      : (groqUsage?.configured ? '連線待命中' : '未啟用')}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {groqHeaders?.resetRequests ? `標頭重置: ${groqHeaders.resetRequests}` : 'API 實時回應同步'}
                  </div>
                </div>

                {/* Card 4: Deepgram 備援/原生次數 */}
                <div className="p-2 rounded-md bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>Deepgram 請求</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${deepgramActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-amber-300">
                      {deepgramRpm} RPM
                    </span>
                    <span className="text-[10px] text-slate-400">/ 今日 {deepgramTodayRequests}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                    {nativeUsage ? 'Android 原生 STT 直連' : deepgramActive ? '🟢 WebSocket 連線中' : '備援待命 (Groq 優先)'}
                  </div>
                </div>
              </div>

              {/* Explanatory Note on Groq UTC Reset */}
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/80 flex items-start gap-1.5 leading-relaxed font-sans">
                <AlertTriangle className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-slate-200">Groq 當日定義對齊：</strong>Groq 官方 API 之每日請求上限 (RPD) 依據國際標準時間 <strong>00:00:00 UTC</strong> 統一重置（換算台灣時間為上午 08:00）。本面板之「每分鐘」採滾動 60 秒視窗，「當日」與 Groq 官方 UTC 控制台每日結算完全同步。
                </span>
              </div>
            </div>

            {/* History Table (Recent Chunks) */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <span>最近字幕段落時間戳記錄</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {stats?.history?.length || 0} 筆
                </span>
              </div>

              <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 divide-y divide-slate-850 text-[11px] font-mono">
                {stats?.history && stats.history.length > 0 ? (
                  stats.history.slice(0, 8).map((item, idx) => (
                    <div key={item.id || idx} className="p-1.5 flex items-center justify-between gap-2 hover:bg-slate-800/40">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="text-slate-500 text-[10px]">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-slate-300 truncate font-sans">
                          {item.textSnippet || '(無摘要)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.source
                            .replace('Centralized WebSocket Push', 'Central WS')
                            .replace('Centralized SSE Push', 'Central SSE')
                            .replace('Android Native STT', 'Native')
                            .replace('Server SSE Stream', 'SSE')
                            .replace('REST Polling Fallback', 'Poll')}
                        </span>
                        <span className={`font-bold ${item.latencyMs < 1500 ? 'text-emerald-400' : item.latencyMs < 4000 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {item.latencyMs}ms
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs">
                    尚無字幕段落接收記錄（播放電台後將自動記錄）
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                id="btn-ping-test"
                onClick={handlePing}
                disabled={isPinging}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
                <span>測試 RTT</span>
              </button>

              <button
                id="btn-force-resync"
                onClick={handleForceResync}
                className="px-2.5 py-1 rounded-lg bg-blue-900/60 text-blue-200 hover:bg-blue-800 transition text-xs flex items-center gap-1"
              >
                <Zap className="w-3 h-3 text-blue-400" />
                <span>強制重新同步</span>
              </button>

              <button
                id="btn-reset-latency-stats"
                onClick={() => {
                  resetSttStreamLatency();
                  setStats(null);
                  setPingResult(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition text-xs"
              >
                重置統計
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
