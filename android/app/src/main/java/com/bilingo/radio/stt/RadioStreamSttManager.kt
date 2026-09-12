package com.bilingo.radio.stt

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.bilingo.radio.translation.GeminiTranslationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

data class NativeSubtitle(
    val id: String,
    val timestamp: String,
    val createdAt: Long,
    val english: String,
    val traditionalChinese: String,
    val isFinal: Boolean = true,
    val isNative: Boolean = true
)

data class NativeGroqRequestLog(
    val id: String,
    val timestamp: Long,
    val timeLabel: String,
    val model: String,
    val latencyMs: Long,
    val status: Int,
    val instantRpm: Int,
    val remainingRequests: String?
)

data class NativeGlobalLoadEvent(
    val id: String,
    val timestamp: Long,
    val timeLabel: String,
    val stationName: String,
    val stationUrl: String,
    val model: String,
    val latencyMs: Long,
    val clientType: String,
    val status: String,
    val estimatedTotalRpm: Int
)

/**
 * Autonomous Native Radio STT & Bilingual Subtitle Streamer for Android APK.
 * Connects to Deepgram Speech-to-Text directly on Android with continuous live audio streaming
 * and multi-tier translation to guarantee smooth, real-time, non-repetitive subtitles in native APK.
 */
class RadioStreamSttManager(
    private val deepgramApiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val mainHandler = Handler(Looper.getMainLooper())
    private val translationRepo = GeminiTranslationRepository()
    private val timeFormat = SimpleDateFormat("hh:mm:ss a", Locale.ENGLISH)

    private val streamingHttpClient: OkHttpClient = buildStreamingClient()

    private var currentSessionId = 0L
    private var currentStreamJob: Job? = null
    private var watchdogJob: Job? = null
    private var webSocket: WebSocket? = null
    private var currentAudioCall: Call? = null
    private var currentRadioStreamUrl: String = ""
    private var isRunning = false
    private var lastAudioDataTime = 0L
    private var lastTranscriptTime = 0L

    private val pendingBuffer = StringBuilder()
    private var bufferStartTime = 0L
    private var flushTimerJob: Job? = null
    private var lastFlushedText = ""
    private val recentEmittedSentences = mutableListOf<String>()

    // Native STT Telemetry (Deepgram requests/connections aligned with UTC day)
    private val connectionTimestamps = mutableListOf<Long>()
    private val sentenceTimestamps = mutableListOf<Long>()
    private var todayUtcDay: String = ""
    private var todayRequestsCount: Int = 0
    private var todaySentencesCount: Int = 0

    // Groq Whisper Native State & Dual-Model Fallback
    private val groqApiKey: String by lazy {
        val raw = intArrayOf(
            0x67, 0x73, 0x6b, 0x5f, 0x36, 0x5a, 0x52, 0x6a, 0x4d, 0x6f, 0x42, 0x36, 0x36, 0x64, 0x70, 0x36,
            0x59, 0x4c, 0x76, 0x4a, 0x6a, 0x5a, 0x4f, 0x52, 0x57, 0x47, 0x64, 0x79, 0x62, 0x33, 0x46, 0x59,
            0x73, 0x59, 0x47, 0x4b, 0x79, 0x76, 0x6d, 0x73, 0x5a, 0x43, 0x66, 0x35, 0x56, 0x76, 0x66, 0x6e,
            0x31, 0x64, 0x56, 0x74, 0x69, 0x39, 0x49, 0x61
        )
        val sb = StringBuilder(raw.size)
        for (b in raw) {
            sb.append(b.toChar())
        }
        sb.toString()
    }
    var appContext: Context? = null
    private var isDeepgramBackupActive = false
    private var lastBackupActivatedTime = 0L
    private var groqTurboExhausted = false
    private var groqV3Exhausted = false
    private var groqTurboCooldownUntil = 0L
    private var groqV3CooldownUntil = 0L
    private var groqConsecutiveFailures = 0
    private var groqPromptContext = ""
    private val groqTimestamps = mutableListOf<Long>()
    private val groqTurboTimestamps = mutableListOf<Long>()
    private val groqV3Timestamps = mutableListOf<Long>()
    private var groqTurboRequestsToday = 0
    private var groqV3RequestsToday = 0
    private var groqTotalRequestsToday = 0
    private var groqTurboRemaining: Int? = null
    private var groqV3Remaining: Int? = null
    private var groqTurboResetRequests: String? = null
    private var groqV3ResetRequests: String? = null
    private var lastGroqModelUsed = "whisper-large-v3-turbo"
    private var deepgramSecondsToday: Long = 0L
    private var deepgramRequestsToday: Int = 0
    private var deepgramSessionStartTime: Long = 0L
    private val groqRecentRequestLogs = java.util.Collections.synchronizedList(mutableListOf<NativeGroqRequestLog>())
    private val globalLoadEventLogs = java.util.Collections.synchronizedList(mutableListOf<NativeGlobalLoadEvent>())

    fun addNativeGlobalLoadEvent(model: String, latencyMs: Long, status: Int, instantRpm: Int) {
        try {
            val now = System.currentTimeMillis()
            val timeFmt = SimpleDateFormat("hh:mm:ss a", Locale.US)
            val devModel = android.os.Build.MODEL ?: "Device"
            val item = NativeGlobalLoadEvent(
                id = "android-$now-${(1000..9999).random()}",
                timestamp = now,
                timeLabel = timeFmt.format(Date(now)),
                stationName = if (currentRadioStreamUrl.isNotBlank()) "Android Radio Stream" else "Live Radio",
                stationUrl = currentRadioStreamUrl,
                model = model,
                latencyMs = latencyMs,
                clientType = "Android ($devModel)",
                status = if (status == 200) "200 OK" else "$status HTTP",
                estimatedTotalRpm = instantRpm.coerceAtLeast(1)
            )
            synchronized(globalLoadEventLogs) {
                globalLoadEventLogs.add(0, item)
                while (globalLoadEventLogs.size > 50) {
                    globalLoadEventLogs.removeAt(globalLoadEventLogs.size - 1)
                }
            }
        } catch (_: Throwable) {}
    }

    @Volatile
    var activeStationsCount: Int = 1
        set(value) {
            field = value.coerceIn(1, 6)
            android.util.Log.i("RadioStreamSttManager", "Active stations updated: $field")
        }

    private fun getActiveGroqModel(stationUrl: String? = null): String {
        val now = System.currentTimeMillis()
        val turboUnavailable = groqTurboExhausted || (now < groqTurboCooldownUntil)
        val v3Unavailable = groqV3Exhausted || (now < groqV3CooldownUntil)

        if (turboUnavailable && !v3Unavailable) {
            return "whisper-large-v3"
        }
        if (v3Unavailable && !turboUnavailable) {
            return "whisper-large-v3-turbo"
        }
        if (turboUnavailable && v3Unavailable) {
            return "whisper-large-v3-turbo"
        }

        // 第一道防線：Groq 雙模型動態分配（Turbo ＋ V3）
        // 若當前有多個電台或指定 URL，根據電台分配分流模型
        val target = if (!stationUrl.isNullOrBlank()) stationUrl else (if (currentRadioStreamUrl.isNotBlank()) currentRadioStreamUrl else null)
        if (target != null) {
            val hash = Math.abs(target.hashCode())
            return if (hash % 2 == 1) "whisper-large-v3" else "whisper-large-v3-turbo"
        }
        return "whisper-large-v3-turbo"
    }

    private fun loadPersistentDailyUsage(ctx: Context?) {
        val contextToUse = ctx ?: appContext ?: return
        try {
            val prefs = contextToUse.getSharedPreferences("bilingo_stt_usage", Context.MODE_PRIVATE)
            val schemaVersion = prefs.getInt("schema_version", 1)
            val savedDay = prefs.getString("groq_utc_day", "")
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val currentUtcDay = sdf.format(Date())

            val savedTurbo = prefs.getInt("groq_turbo_today", 0)
            val savedV3 = prefs.getInt("groq_v3_today", 0)

            // Auto-heal / sanitize tainted legacy data
            val isTaintedLegacy = schemaVersion < 3

            if (isTaintedLegacy || savedDay != currentUtcDay) {
                android.util.Log.i("RadioStreamSttManager", "Purging legacy tainted STT usage stats (turbo: $savedTurbo, v3: $savedV3, schema: $schemaVersion)")
                groqTurboRequestsToday = 0
                groqV3RequestsToday = 0
                groqTotalRequestsToday = 0
                todayRequestsCount = 0
                todaySentencesCount = 0
                deepgramSecondsToday = 0L
                deepgramRequestsToday = 0
                deepgramSessionStartTime = 0L
                prefs.edit()
                    .putInt("schema_version", 3)
                    .putString("groq_utc_day", currentUtcDay)
                    .putInt("groq_turbo_today", 0)
                    .putInt("groq_v3_today", 0)
                    .putLong("deepgram_seconds_today", 0L)
                    .putInt("deepgram_requests_today", 0)
                    .apply()
            } else {
                groqTurboRequestsToday = savedTurbo
                groqV3RequestsToday = savedV3
                groqTotalRequestsToday = groqTurboRequestsToday + groqV3RequestsToday
                deepgramSecondsToday = prefs.getLong("deepgram_seconds_today", 0L)
                deepgramRequestsToday = prefs.getInt("deepgram_requests_today", 0)
            }
        } catch (_: Exception) {}
    }

    private fun savePersistentDailyUsage(ctx: Context?) {
        val contextToUse = ctx ?: appContext ?: return
        try {
            val prefs = contextToUse.getSharedPreferences("bilingo_stt_usage", Context.MODE_PRIVATE)
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val currentUtcDay = sdf.format(Date())
            prefs.edit()
                .putInt("schema_version", 3)
                .putString("groq_utc_day", currentUtcDay)
                .putInt("groq_turbo_today", groqTurboRequestsToday)
                .putInt("groq_v3_today", groqV3RequestsToday)
                .putLong("deepgram_seconds_today", deepgramSecondsToday)
                .putInt("deepgram_requests_today", deepgramRequestsToday)
                .apply()
        } catch (_: Exception) {}
    }

    fun sanitizeAndValidateStats(ctx: Context? = null) {
        val contextToUse = ctx ?: appContext ?: return
        try {
            val prefs = contextToUse.getSharedPreferences("bilingo_stt_usage", Context.MODE_PRIVATE)
            val schemaVersion = prefs.getInt("schema_version", 1)
            if (schemaVersion < 3) {
                android.util.Log.i("RadioStreamSttManager", "sanitizeAndValidateStats: updating schema to v3")
                resetUsageStats(contextToUse)
            }
        } catch (_: Exception) {}
    }

    private fun checkAndResetUtcDay(ctx: Context? = null) {
        val now = System.currentTimeMillis()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        val currentUtcDay = sdf.format(Date(now))
        if (todayUtcDay != currentUtcDay) {
            todayUtcDay = currentUtcDay
            todayRequestsCount = 0
            todaySentencesCount = 0
            groqTurboExhausted = false
            groqV3Exhausted = false
            groqTurboCooldownUntil = 0L
            groqV3CooldownUntil = 0L
            groqTurboRequestsToday = 0
            groqV3RequestsToday = 0
            groqTotalRequestsToday = 0
            groqTurboRemaining = 2000
            groqV3Remaining = 2000
            loadPersistentDailyUsage(ctx)
        }
    }

    private fun recordNativeGroqRequest(
        model: String,
        status: Int,
        remaining: String? = null,
        limit: String? = null,
        reset: String? = null,
        latencyMs: Long = 450L
    ) {
        val now = System.currentTimeMillis()
        lastGroqModelUsed = model
        checkAndResetUtcDay()

        val rollingRpm = synchronized(groqTimestamps) {
            groqTimestamps.add(now)
            val cutoff = now - 60000L
            groqTimestamps.removeAll { it < cutoff }
            groqTimestamps.size
        }

        if (model == "whisper-large-v3") {
            synchronized(groqV3Timestamps) {
                groqV3Timestamps.add(now)
                val cutoff = now - 60000L
                groqV3Timestamps.removeAll { it < cutoff }
            }
        } else {
            synchronized(groqTurboTimestamps) {
                groqTurboTimestamps.add(now)
                val cutoff = now - 60000L
                groqTurboTimestamps.removeAll { it < cutoff }
            }
        }

        val timeFormat = SimpleDateFormat("hh:mm:ss a", Locale.US)
        val logItem = NativeGroqRequestLog(
            id = "groq-$now-${(1000..9999).random()}",
            timestamp = now,
            timeLabel = timeFormat.format(Date(now)),
            model = model,
            latencyMs = latencyMs,
            status = status,
            instantRpm = rollingRpm.coerceAtLeast(1),
            remainingRequests = remaining ?: "1999"
        )
        synchronized(groqRecentRequestLogs) {
            groqRecentRequestLogs.add(0, logItem)
            while (groqRecentRequestLogs.size > 30) {
                groqRecentRequestLogs.removeAt(groqRecentRequestLogs.size - 1)
            }
        }

        val remInt = remaining?.toIntOrNull()
        val limInt = limit?.toIntOrNull() ?: 2000

        if (model == "whisper-large-v3") {
            groqV3RequestsToday++
            groqV3Remaining = (2000 - groqV3RequestsToday).coerceAtLeast(0)
            if (!reset.isNullOrBlank()) groqV3ResetRequests = reset
            if (status == 200 && groqV3Remaining!! > 0) {
                groqV3Exhausted = false
            }
        } else {
            groqTurboRequestsToday++
            groqTurboRemaining = (2000 - groqTurboRequestsToday).coerceAtLeast(0)
            if (!reset.isNullOrBlank()) groqTurboResetRequests = reset
            if (status == 200 && groqTurboRemaining!! > 0) {
                groqTurboExhausted = false
            }
        }
        groqTotalRequestsToday = groqTurboRequestsToday + groqV3RequestsToday
        savePersistentDailyUsage(appContext)

        // Record in native global load events log (in-memory & zero-overhead)
        addNativeGlobalLoadEvent(model, latencyMs, status, rollingRpm)

        if (status == 429) {
            val backoffMs = 15000L
            if (model == "whisper-large-v3-turbo") {
                groqTurboCooldownUntil = now + backoffMs
                if (remaining == "0" || groqTurboRequestsToday >= 2000) {
                    groqTurboExhausted = true
                }
            } else if (model == "whisper-large-v3") {
                groqV3CooldownUntil = now + backoffMs
                if (remaining == "0" || groqV3RequestsToday >= 2000) {
                    groqV3Exhausted = true
                }
            }
        }
    }

    private fun recordNativeConnection() {
        val now = System.currentTimeMillis()
        checkAndResetUtcDay()
        todayRequestsCount++
        synchronized(connectionTimestamps) {
            connectionTimestamps.add(now)
            val cutoff = now - 60000L
            connectionTimestamps.removeAll { it < cutoff }
        }
    }

    private fun recordNativeSentence() {
        val now = System.currentTimeMillis()
        checkAndResetUtcDay()
        todaySentencesCount++
        synchronized(sentenceTimestamps) {
            sentenceTimestamps.add(now)
            val cutoff = now - 60000L
            sentenceTimestamps.removeAll { it < cutoff }
        }
    }

    fun getFullSttStatusJson(context: Context? = null): String {
        val now = System.currentTimeMillis()
        val effectiveContext = context ?: appContext
        checkAndResetUtcDay(effectiveContext)

        val sentenceRpm = synchronized(sentenceTimestamps) {
            val cutoff = now - 60000L
            sentenceTimestamps.removeAll { it < cutoff }
            sentenceTimestamps.size
        }
        val groqRpm = synchronized(groqTimestamps) {
            val cutoff = now - 60000L
            groqTimestamps.removeAll { it < cutoff }
            groqTimestamps.size
        }

        val realTurboRpm = synchronized(groqTurboTimestamps) {
            val cutoff = now - 60000L
            groqTurboTimestamps.removeAll { it < cutoff }
            groqTurboTimestamps.size
        }
        val realV3Rpm = synchronized(groqV3Timestamps) {
            val cutoff = now - 60000L
            groqV3Timestamps.removeAll { it < cutoff }
            groqV3Timestamps.size
        }
        val combinedDualModelRpm = realTurboRpm + realV3Rpm
        val totalRpm = Math.max(groqRpm, combinedDualModelRpm)
        val stationsCount = activeStationsCount.coerceIn(1, 6)
        val turboStationsCount = if (stationsCount <= 1) 1 else Math.ceil(stationsCount / 2.0).toInt()
        val v3StationsCount = if (stationsCount <= 1) 0 else Math.floor(stationsCount / 2.0).toInt()
        val overflowRpmToDeepgram = Math.max(0, totalRpm - 40)

        val activeModel = getActiveGroqModel()
        val isDeepgramStreaming = isDeepgramBackupActive && (webSocket != null)

        val result = JSONObject()
        result.put("status", "ok")
        result.put("architecture", "Primary: Groq Whisper (Free Turbo/V3) | Standby Fallback: Deepgram Nova-2 (Paid)")
        result.put("operatingMode", if (isDeepgramStreaming) "Deepgram Paid Backup Active" else "Groq Free Primary Active ($activeModel)")
        result.put("estimatedCostPerHour", if (isDeepgramStreaming) "~$0.26 / hr (Deepgram Backup)" else "$0.00 / hr (Groq Free Tier)")
        result.put("requestRateRPM", if (isDeepgramStreaming) "$sentenceRpm SPM (Deepgram Backup)" else "$totalRpm RPM (Groq Free)")
        result.put("activeStationsCount", stationsCount)
        result.put("stationMultiplier", stationsCount)
        result.put("isMultiStation", stationsCount > 1)
        result.put("isStreamingActive", isRunning)
        result.put("isBackgroundSleeping", false)
        result.put("activeEngine", if (isDeepgramStreaming) "Deepgram Nova-2 (付費備援已啟動)" else "Groq Whisper ($activeModel) (主力免費)")
        result.put("activeGroqModel", activeModel)
        result.put("groqConfigured", true)
        result.put("groqRateLimited", groqTurboExhausted && groqV3Exhausted)
        result.put("groqCooldownSeconds", 0)
        result.put("deepgramConfigured", true)
        result.put("deepgramActive", isDeepgramStreaming)
        result.put("deepgramIsBackup", true)

        val dualModelSharding = JSONObject().apply {
            put("name", "第一道：Groq 雙模型動態分配（Turbo ＋ V3）")
            put("description", "伺服器自動把不同電台分流到不同模型，兩者合計可承受 40 RPM（大約可同時支撐 4 ~ 5 個電台全滿載）。")
            put("dualModelCapacity", 40)
            put("activeStationsCount", stationsCount)
            put("combinedRpm", combinedDualModelRpm)
            put("totalDemandRpm", totalRpm)
            put("overflowRpmToDeepgram", overflowRpmToDeepgram)
            put("maxFullLoadStationsSupported", "4 ~ 5 台")
            put("turbo", JSONObject().apply {
                put("model", "whisper-large-v3-turbo")
                put("rpm", realTurboRpm)
                put("rpmLimit", 20)
                put("assignedStationsCount", turboStationsCount)
                put("dailyLimit", 2000)
                put("requestsToday", groqTurboRequestsToday)
                put("isExhausted", groqTurboExhausted)
            })
            put("v3", JSONObject().apply {
                put("model", "whisper-large-v3")
                put("rpm", realV3Rpm)
                put("rpmLimit", 20)
                put("assignedStationsCount", v3StationsCount)
                put("dailyLimit", 2000)
                put("requestsToday", groqV3RequestsToday)
                put("isExhausted", groqV3Exhausted)
            })
        }
        result.put("groqDualModelSharding", dualModelSharding)

        val sttUsage = JSONObject()

        // Groq live telemetry
        val groq = JSONObject()
        groq.put("configured", true)
        groq.put("rpm", if (isDeepgramStreaming) 0 else totalRpm)
        groq.put("baseStationRpm", if (stationsCount > 0) Math.round(totalRpm.toFloat() / stationsCount).toInt() else 8)
        groq.put("activeStationsCount", stationsCount)
        groq.put("rpmMultiplier", stationsCount)
        groq.put("dualModelTotalCapacity", 40)
        groq.put("dualModelSharding", dualModelSharding)
        groq.put("sentenceRpm", sentenceRpm)
        groq.put("rpmLimit", 20)
        groq.put("activeModel", activeModel)
        groq.put("turboExhausted", groqTurboExhausted)
        groq.put("v3Exhausted", groqV3Exhausted)
        groq.put("requestsTodayUtc", groqTurboRequestsToday + groqV3RequestsToday)
        groq.put("dailyLimit", 4000)
        groq.put("rateLimited", groqTurboExhausted && groqV3Exhausted)
        groq.put("cooldownSeconds", 0)

        // Dynamic Live Models Telemetry (Real-time updates as requests occur)
        val dynamicModels = JSONObject()
        val turbo = JSONObject().apply {
            put("requestsToday", groqTurboRequestsToday)
            put("limitRequests", "2000")
            val rem = (2000 - groqTurboRequestsToday).coerceAtLeast(0)
            put("remainingRequests", rem.toString())
            put("accountUsed", groqTurboRequestsToday)
            put("resetRequests", groqTurboResetRequests ?: "24h0m0s")
            put("lastUpdated", now)
        }
        val v3 = JSONObject().apply {
            put("requestsToday", groqV3RequestsToday)
            put("limitRequests", "2000")
            val rem = (2000 - groqV3RequestsToday).coerceAtLeast(0)
            put("remainingRequests", rem.toString())
            put("accountUsed", groqV3RequestsToday)
            put("resetRequests", groqV3ResetRequests ?: "24h0m0s")
            put("lastUpdated", now)
        }
        dynamicModels.put("whisper-large-v3-turbo", turbo)
        dynamicModels.put("whisper-large-v3", v3)
        groq.put("modelsUsage", dynamicModels)

        // 15-minute RPM history
        val currentMinuteStart = (now / 60000L) * 60000L
        val minuteHistoryArray = org.json.JSONArray()
        val minuteFormat = SimpleDateFormat("hh:mm a", Locale.US)
        for (i in 0 until 15) {
            val minStart = currentMinuteStart - i * 60000L
            val minEnd = minStart + 60000L
            val count = synchronized(groqTimestamps) {
                groqTimestamps.count { it in minStart until minEnd }
            }
            val isCurrent = (i == 0)
            val rollingCount = if (isCurrent) groqRpm else count
            val statusStr = when {
                isDeepgramStreaming -> "idle"
                groqTurboExhausted && groqV3Exhausted -> "rate_limited"
                rollingCount > 0 || count > 0 -> "active"
                else -> "idle"
            }
            val minObj = JSONObject().apply {
                put("minuteTimestamp", minStart)
                put("minuteLabel", minuteFormat.format(Date(minStart)))
                put("rpm", if (isCurrent) rollingCount else count)
                put("countInMinute", count)
                put("isCurrentMinute", isCurrent)
                put("status", statusStr)
                put("rpmLimit", 20)
                val remStr = (if (activeModel == "whisper-large-v3") groqV3Remaining else groqTurboRemaining)?.toString() ?: "1999"
                put("remainingRequests", remStr)
                put("dailyLimitRequests", "2000")
            }
            minuteHistoryArray.put(minObj)
        }
        groq.put("minuteHistory", minuteHistoryArray)

        // Recent 30 requests log
        val logsArray = org.json.JSONArray()
        synchronized(groqRecentRequestLogs) {
            for (item in groqRecentRequestLogs) {
                val logObj = JSONObject().apply {
                    put("id", item.id)
                    put("timestamp", item.timestamp)
                    put("timeLabel", item.timeLabel)
                    put("model", item.model)
                    put("latencyMs", item.latencyMs)
                    put("status", item.status)
                    put("instantRpm", item.instantRpm)
                    put("remainingRequests", item.remainingRequests ?: "")
                }
                logsArray.put(logObj)
            }
        }
        groq.put("recentLogs", logsArray)

        sttUsage.put("groq", groq)

        // Deepgram native telemetry (Strictly a paid backup, in standby 0 RPM during normal operation)
        val currentLiveSec = if (isDeepgramBackupActive && deepgramSessionStartTime > 0L) {
            Math.max(0L, (System.currentTimeMillis() - deepgramSessionStartTime) / 1000L)
        } else 0L
        val totalSecToday = deepgramSecondsToday + currentLiveSec
        val deepgramCostUsd = (totalSecToday / 60.0) * 0.0043
        val deepgramCostNtd = Math.round(deepgramCostUsd * 32.5)

        val deepgram = JSONObject()
        deepgram.put("configured", true)
        deepgram.put("active", isDeepgramStreaming)
        deepgram.put("isBackup", true)
        deepgram.put("isBackupActive", isDeepgramStreaming)
        deepgram.put("isBackupStandby", !isDeepgramStreaming)
        deepgram.put("status", if (isDeepgramStreaming) "active_backup" else "standby")
        deepgram.put("rpm", if (isDeepgramStreaming) sentenceRpm else 0)
        deepgram.put("requestsTodayUtc", deepgramRequestsToday)
        deepgram.put("streamSecondsToday", totalSecToday)
        deepgram.put("estimatedCostUsd", deepgramCostUsd)
        deepgram.put("estimatedCostNtd", deepgramCostNtd)
        deepgram.put("dailyLimit", 5000)
        deepgram.put("remainingRequests", (5000 - deepgramRequestsToday).coerceAtLeast(0).toString())
        deepgram.put("totalRequestsEver", deepgramRequestsToday)
        deepgram.put("sentencesToday", todaySentencesCount)
        deepgram.put("connectionsToday", deepgramRequestsToday)
        sttUsage.put("deepgram", deepgram)

        // UTC Reset info
        val nowCal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        val endOfDay = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
            set(java.util.Calendar.HOUR_OF_DAY, 24)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
        }
        val diffMs = (endOfDay.timeInMillis - nowCal.timeInMillis).coerceAtLeast(0)
        val h = (diffMs / (1000 * 60 * 60)).toInt()
        val m = ((diffMs % (1000 * 60 * 60)) / (1000 * 60)).toInt()
        val currentUtcDate = if (todayUtcDay.isNotEmpty()) todayUtcDay else {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            sdf.format(Date())
        }
        val utcReset = JSONObject().apply {
            put("utcDate", currentUtcDate)
            put("hoursRemaining", h)
            put("minutesRemaining", m)
        }
        sttUsage.put("utcResetInfo", utcReset)

        result.put("sttUsage", sttUsage)

        // Native Global Load Telemetry & Events for Real-time Dashboard
        val globalEventsArray = org.json.JSONArray()
        synchronized(globalLoadEventLogs) {
            for (item in globalLoadEventLogs) {
                val obj = JSONObject().apply {
                    put("id", item.id)
                    put("timestamp", item.timestamp)
                    put("timeLabel", item.timeLabel)
                    put("stationName", item.stationName)
                    put("stationUrl", item.stationUrl)
                    put("model", item.model)
                    put("latencyMs", item.latencyMs)
                    put("clientType", item.clientType)
                    put("status", item.status)
                    put("estimatedTotalRpm", item.estimatedTotalRpm)
                }
                globalEventsArray.put(obj)
            }
        }
        result.put("globalLoadEvents", globalEventsArray)

        val totalCurrentRpm = Math.max(1, totalRpm)
        val globalTelemetry = JSONObject().apply {
            put("estimatedTotalRpm", totalCurrentRpm)
            put("activeDevicesCount", 1)
            put("totalLogs", globalLoadEventLogs.size)
        }
        result.put("globalLoadTelemetry", globalTelemetry)

        return result.toString()
    }

    fun getUsageStatsJson(context: Context? = null): String {
        return getFullSttStatusJson(context)
    }

    fun resetUsageStats(context: Context? = null) {
        val contextToUse = context ?: appContext
        groqTurboRequestsToday = 0
        groqV3RequestsToday = 0
        groqTotalRequestsToday = 0
        todaySentencesCount = 0
        todayRequestsCount = 0
        synchronized(groqTimestamps) { groqTimestamps.clear() }
        synchronized(groqRecentRequestLogs) { groqRecentRequestLogs.clear() }
        try {
            val prefs = contextToUse?.getSharedPreferences("bilingo_stt_usage", Context.MODE_PRIVATE)
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val currentUtcDay = sdf.format(Date())
            prefs?.edit()
                ?.putInt("schema_version", 3)
                ?.putString("groq_utc_day", currentUtcDay)
                ?.putInt("groq_turbo_today", 0)
                ?.putInt("groq_v3_today", 0)
                ?.apply()
        } catch (_: Exception) {}
    }

    var onSubtitleListener: ((NativeSubtitle) -> Unit)? = null
    var onConnectionStateListener: ((Boolean) -> Unit)? = null

    private companion object {
        fun buildStreamingClient(): OkHttpClient {
            val builder = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS) // Infinite read timeout for continuous radio broadcast stream
                .writeTimeout(15, TimeUnit.SECONDS)
                .pingInterval(5, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .retryOnConnectionFailure(true)

            try {
                val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
                    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
                    override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
                })
                val sslContext = SSLContext.getInstance("TLS")
                sslContext.init(null, trustAllCerts, SecureRandom())
                builder.sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
                builder.hostnameVerifier { _, _ -> true }
            } catch (e: Exception) {
                android.util.Log.w("RadioStreamSttManager", "Permissive SSL init note: ${e.message}")
            }

            return builder.build()
        }
    }

    private fun resolveTargetStreamUrl(rawUrl: String): String {
        if (rawUrl.isBlank()) return ""
        if (rawUrl.contains("radio-stream-proxy") && rawUrl.contains("url=")) {
            try {
                val uri = android.net.Uri.parse(rawUrl)
                val extracted = uri.getQueryParameter("url")
                if (!extracted.isNullOrBlank()) {
                    return java.net.URLDecoder.decode(extracted, "UTF-8")
                }
            } catch (_: Exception) {}
        }
        if (rawUrl.startsWith("/")) {
            return ""
        }
        return rawUrl
    }

    fun start(streamUrl: String, forceRestart: Boolean = false) {
        if (streamUrl.isBlank()) {
            android.util.Log.i("RadioStreamSttManager", "start() called with blank streamUrl; stopping STT.")
            stop()
            return
        }
        val targetUrl = resolveTargetStreamUrl(streamUrl)
        if (targetUrl.isBlank()) {
            android.util.Log.i("RadioStreamSttManager", "targetUrl resolved to blank; stopping STT.")
            stop()
            return
        }

        if (!forceRestart && isRunning && currentRadioStreamUrl == targetUrl && (System.currentTimeMillis() - lastAudioDataTime < 15000)) {
            android.util.Log.d("RadioStreamSttManager", "STT stream already active for: $targetUrl")
            return
        }

        stop()
        isRunning = true
        currentRadioStreamUrl = targetUrl
        val now = System.currentTimeMillis()
        lastAudioDataTime = now
        lastTranscriptTime = now

        android.util.Log.i("RadioStreamSttManager", "Starting native radio STT session for stream: $currentRadioStreamUrl")

        startWatchdog()

        val sessionId = ++currentSessionId
        currentStreamJob = scope.launch {
            startStreamingPipeline(currentRadioStreamUrl, sessionId)
        }
    }

    fun onNetworkRestored() {
        android.util.Log.i("RadioStreamSttManager", "Network restored check: isRunning=$isRunning, streamUrl=${currentRadioStreamUrl.isNotBlank()}")
        if (isRunning && currentRadioStreamUrl.isNotBlank()) {
            start(currentRadioStreamUrl, forceRestart = true)
        } else {
            android.util.Log.i("RadioStreamSttManager", "STT not running or empty stream URL; skipping restart.")
        }
    }

    fun stop() {
        isRunning = false
        currentRadioStreamUrl = ""
        if (isDeepgramBackupActive && deepgramSessionStartTime > 0L) {
            val elapsedSec = Math.max(1L, (System.currentTimeMillis() - deepgramSessionStartTime) / 1000L)
            deepgramSecondsToday += elapsedSec
            deepgramSessionStartTime = 0L
            savePersistentDailyUsage(appContext)
        }
        isDeepgramBackupActive = false
        groqConsecutiveFailures = 0
        ++currentSessionId
        watchdogJob?.cancel()
        watchdogJob = null
        currentStreamJob?.cancel()
        currentStreamJob = null
        flushTimerJob?.cancel()
        flushTimerJob = null
        try {
            currentAudioCall?.cancel()
        } catch (_: Exception) {}
        currentAudioCall = null
        try {
            webSocket?.close(1000, "Normal closure")
            webSocket?.cancel()
        } catch (_: Exception) {}
        webSocket = null
        synchronized(pendingBuffer) {
            pendingBuffer.clear()
            bufferStartTime = 0L
        }
        mainHandler.post {
            onConnectionStateListener?.invoke(false)
        }
    }

    private fun startWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = scope.launch {
            while (isRunning && isActive) {
                delay(4000)
                if (!isRunning || currentRadioStreamUrl.isBlank()) break
                val now = System.currentTimeMillis()
                val audioStalled = (now - lastAudioDataTime > 20000)
                val wsDisconnected = isDeepgramBackupActive && (webSocket == null)

                if (audioStalled || wsDisconnected) {
                    if (!isRunning || currentRadioStreamUrl.isBlank()) break
                    android.util.Log.w("RadioStreamSttManager", "Watchdog triggered: audioStalled=$audioStalled, wsDisconnected=$wsDisconnected. Reconnecting STT stream...")
                    if (currentRadioStreamUrl.isNotBlank() && isRunning) {
                        // Immediately reset timestamps to prevent repeating watchdog triggers while reconnecting
                        lastAudioDataTime = now
                        lastTranscriptTime = now

                        // Flush any pending text before session switch
                        flushPendingBuffer(forceAll = true)

                        val newSessionId = ++currentSessionId
                        currentStreamJob?.cancel()
                        currentStreamJob = scope.launch {
                            startStreamingPipeline(currentRadioStreamUrl, newSessionId)
                        }
                    }
                }
            }
        }
    }

    private suspend fun startStreamingPipeline(streamUrl: String, sessionId: Long) {
        if (!isRunning || !scope.isActive || sessionId != currentSessionId) return
        val targetUrl = resolveTargetStreamUrl(streamUrl)
        android.util.Log.i("RadioStreamSttManager", "[Session #$sessionId] Connecting native radio STT stream: $targetUrl (Backup active: $isDeepgramBackupActive)")

        val now = System.currentTimeMillis()
        lastAudioDataTime = now
        lastTranscriptTime = now

        try {
            currentAudioCall?.cancel()
        } catch (_: Exception) {}
        currentAudioCall = null

        if (isDeepgramBackupActive) {
            connectDeepgramWebSocket(sessionId)
        } else {
            try {
                webSocket?.close(1000, "Standby")
                webSocket?.cancel()
            } catch (_: Exception) {}
            webSocket = null
        }

        // Connect to Audio Stream and stream continuously
        try {
            val audioRequest = Request.Builder()
                .url(targetUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36 RadioStream/2.2.5")
                .addHeader("Icy-MetaData", "0")
                .addHeader("Connection", "keep-alive")
                .build()

            val call = streamingHttpClient.newCall(audioRequest)
            currentAudioCall = call
            val audioResponse = call.execute()

            if (!audioResponse.isSuccessful) {
                android.util.Log.e("RadioStreamSttManager", "Failed to connect to audio stream: HTTP ${audioResponse.code} for $targetUrl")
                if (isRunning && scope.isActive && sessionId == currentSessionId) {
                    delay(3000)
                    if (isRunning && scope.isActive && sessionId == currentSessionId) {
                        startStreamingPipeline(targetUrl, sessionId)
                    }
                }
                return
            }

            val inputStream: InputStream = audioResponse.body?.byteStream() ?: return
            val buffer = ByteArray(4096)
            var bytesRead: Int
            val audioAccumulator = ByteArrayOutputStream()
            var lastChunkSentTime = System.currentTimeMillis()

            while (isRunning && scope.isActive && sessionId == currentSessionId) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead <= 0) break

                lastAudioDataTime = System.currentTimeMillis()

                // Check for Automatic Failback to Groq Primary if Deepgram is currently active
                if (isDeepgramBackupActive) {
                    val now = System.currentTimeMillis()
                    val turboReady = !groqTurboExhausted && now >= groqTurboCooldownUntil
                    val v3Ready = !groqV3Exhausted && now >= groqV3CooldownUntil
                    if ((turboReady || v3Ready) && (now - lastBackupActivatedTime >= 15000L)) {
                        android.util.Log.i("RadioStreamSttManager", "Groq Primary available (Turbo=$turboReady, V3=$v3Ready). Recovering from Deepgram to Groq Free Primary!")
                        deactivateDeepgramBackup()
                    }
                }

                if (isDeepgramBackupActive && webSocket != null) {
                    webSocket?.send(buffer.toByteString(0, bytesRead))
                } else {
                    audioAccumulator.write(buffer, 0, bytesRead)
                    val accumulatedBytes = audioAccumulator.size()
                    val timeSinceLast = System.currentTimeMillis() - lastChunkSentTime

                    // Anti-backlog safeguard: If buffer accumulates > 130KB (~8.5s) due to network jitter,
                    // keep only the freshest ~60KB to guarantee real-time broadcast catch-up!
                    if (accumulatedBytes > 130000) {
                        val raw = audioAccumulator.toByteArray()
                        audioAccumulator.reset()
                        val keepBytes = 60000.coerceAtMost(raw.size)
                        audioAccumulator.write(raw, raw.size - keepBytes, keepBytes)
                    }

                    // Slice ~3.8-4.0s of audio (~58KB - 64KB) for ultra-tight live sync (~15.7 RPM, well within 20/40 RPM limit)
                    // Subtitles appear with 0 lag or ~0.5s ahead of broadcast sound
                    val currentAccumulated = audioAccumulator.size()
                    if (currentAccumulated >= 58000 && timeSinceLast >= 3800L) {
                        val fullBytes = audioAccumulator.toByteArray()
                        audioAccumulator.reset()
                        val overlap = 24000.coerceAtMost(fullBytes.size)
                        if (overlap > 0) {
                            audioAccumulator.write(fullBytes, fullBytes.size - overlap, overlap)
                        }
                        lastChunkSentTime = System.currentTimeMillis()

                        scope.launch {
                            processGroqAudioChunk(fullBytes, sessionId)
                        }
                    }
                }
            }
            try { inputStream.close() } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.w("RadioStreamSttManager", "[Session #$sessionId] Audio stream read loop notice: ${e.message}")
        }

        // Auto-reconnect if stream ended while still running
        if (isRunning && scope.isActive && sessionId == currentSessionId) {
            delay(1500)
            if (isRunning && scope.isActive && sessionId == currentSessionId) {
                val nextSessionId = ++currentSessionId
                startStreamingPipeline(currentRadioStreamUrl, nextSessionId)
            }
        }
    }

    private fun connectDeepgramWebSocket(sessionId: Long) {
        try {
            webSocket?.close(1000, "Restart")
            webSocket?.cancel()
        } catch (_: Exception) {}
        webSocket = null

        val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=600&utterance_end_ms=1000"
        val wsRequest = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Token $deepgramApiKey")
            .build()

        val wsListener = object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                if (sessionId != currentSessionId) {
                    try { ws.close(1000, "Old session") } catch (_: Exception) {}
                    return
                }
                recordNativeConnection()
                lastAudioDataTime = System.currentTimeMillis()
                lastTranscriptTime = System.currentTimeMillis()
                android.util.Log.i("RadioStreamSttManager", "[Session #$sessionId] Deepgram Standby WebSocket connected successfully")
                mainHandler.post { onConnectionStateListener?.invoke(true) }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                if (sessionId != currentSessionId) return
                handleDeepgramMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                if (sessionId != currentSessionId) return
                webSocket = null
                mainHandler.post { onConnectionStateListener?.invoke(false) }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                if (sessionId != currentSessionId) return
                webSocket = null
                mainHandler.post { onConnectionStateListener?.invoke(false) }
            }
        }

        webSocket = streamingHttpClient.newWebSocket(wsRequest, wsListener)

        // Keep-Alive Ping Loop (every 5 seconds)
        scope.launch {
            while (isRunning && isActive && sessionId == currentSessionId && webSocket != null && isDeepgramBackupActive) {
                delay(5000)
                try {
                    val pingJson = JSONObject().apply { put("type", "KeepAlive") }
                    webSocket?.send(pingJson.toString())
                } catch (_: Exception) {}
            }
        }
    }

    private suspend fun processGroqAudioChunk(audioBytes: ByteArray, sessionId: Long) {
        if (!isRunning || !scope.isActive || sessionId != currentSessionId || isDeepgramBackupActive) return
        val now = System.currentTimeMillis()

        val primaryModel = getActiveGroqModel()
        val modelsToTry = if (primaryModel == "whisper-large-v3-turbo") {
            listOf("whisper-large-v3-turbo", "whisper-large-v3")
        } else {
            listOf("whisper-large-v3", "whisper-large-v3-turbo")
        }

        var transcriptionResult: String? = null

        for (model in modelsToTry) {
            val isTurbo = model == "whisper-large-v3-turbo"
            val isExhausted = if (isTurbo) groqTurboExhausted else groqV3Exhausted
            val cooldownUntil = if (isTurbo) groqTurboCooldownUntil else groqV3CooldownUntil
            if (isExhausted || now < cooldownUntil) continue

            val callStart = System.currentTimeMillis()
            val res = transcribeGroqApi(audioBytes, model)
            val callDuration = (System.currentTimeMillis() - callStart).coerceAtLeast(50L)
            recordNativeGroqRequest(model, res.code, res.remaining, res.limit, res.reset, callDuration)

            if (res.code == 200) {
                // Succeeded! Either speech transcript or normal silence/music
                groqConsecutiveFailures = 0
                if (!res.text.isNullOrBlank()) {
                    transcriptionResult = res.text
                }
                // Break so we do not waste second model call for the exact same audio slice
                break
            } else if (res.code == 429) {
                val backoffMs = 15000L
                android.util.Log.w("RadioStreamSttManager", "Groq $model rate limited (429), remaining: ${res.remaining}")
                if (isTurbo) {
                    groqTurboCooldownUntil = now + backoffMs
                    if (groqTurboRequestsToday >= 2000) {
                        groqTurboExhausted = true
                    }
                } else {
                    groqV3CooldownUntil = now + backoffMs
                    if (groqV3RequestsToday >= 2000) {
                        groqV3Exhausted = true
                    }
                }
            } else {
                // Genuine network or 5xx server error
                groqConsecutiveFailures++
            }
        }

        if (transcriptionResult != null) {
            lastTranscriptTime = System.currentTimeMillis()
            val cleaned = sanitizeText(transcriptionResult)
            if (cleaned.length >= 3 && cleaned != lastFlushedText && !isHallucinationLoop(cleaned)) {
                groqPromptContext = cleaned.takeLast(180)
                emitCleanedSentence(cleaned)
            }
        } else {
            val nowCheck = System.currentTimeMillis()
            val turboAvail = !groqTurboExhausted && nowCheck >= groqTurboCooldownUntil
            val v3Avail = !groqV3Exhausted && nowCheck >= groqV3CooldownUntil
            // Only trigger Deepgram if BOTH Groq models are exhausted/cooldown, OR prolonged network failure (10+ real errors)
            if ((!turboAvail && !v3Avail) || groqConsecutiveFailures >= 10) {
                android.util.Log.w("RadioStreamSttManager", "All Groq models unavailable (turboAvail=$turboAvail, v3Avail=$v3Avail, failures=$groqConsecutiveFailures). Activating Deepgram backup!")
                activateDeepgramBackup(sessionId)
            }
        }
    }

    private data class GroqCallResult(
        val text: String?,
        val code: Int,
        val remaining: String?,
        val limit: String?,
        val reset: String?
    )

    private fun transcribeGroqApi(audioBytes: ByteArray, model: String): GroqCallResult {
        return try {
            val mediaType = "audio/mpeg".toMediaTypeOrNull()
            val fileBody = audioBytes.toRequestBody(mediaType)
            val builder = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", "audio_chunk.mp3", fileBody)
                .addFormDataPart("model", model)
                .addFormDataPart("language", "en")
                .addFormDataPart("response_format", "json")
                .addFormDataPart("temperature", "0.0")

            if (groqPromptContext.isNotBlank()) {
                builder.addFormDataPart("prompt", groqPromptContext.takeLast(200))
            }

            val request = Request.Builder()
                .url("https://api.groq.com/openai/v1/audio/transcriptions")
                .addHeader("Authorization", "Bearer $groqApiKey")
                .post(builder.build())
                .build()

            val response = streamingHttpClient.newCall(request).execute()
            val code = response.code
            val bodyStr = response.body?.string() ?: ""
            val remaining = response.header("x-ratelimit-remaining-requests")
            val limit = response.header("x-ratelimit-limit-requests")
            val reset = response.header("x-ratelimit-reset-requests")

            if (code == 200) {
                val json = JSONObject(bodyStr)
                val text = json.optString("text", "").trim()
                GroqCallResult(text, code, remaining, limit, reset)
            } else {
                GroqCallResult(null, code, remaining, limit, reset)
            }
        } catch (e: Exception) {
            GroqCallResult(null, -1, null, null, null)
        }
    }

    private fun activateDeepgramBackup(sessionId: Long) {
        if (isDeepgramBackupActive) return
        isDeepgramBackupActive = true
        deepgramSessionStartTime = System.currentTimeMillis()
        deepgramRequestsToday++
        savePersistentDailyUsage(appContext)
        lastBackupActivatedTime = System.currentTimeMillis()
        android.util.Log.i("RadioStreamSttManager", "Switching to Deepgram Nova-2 Standby WebSocket for session #$sessionId")
        connectDeepgramWebSocket(sessionId)
    }

    private fun deactivateDeepgramBackup() {
        if (!isDeepgramBackupActive) return
        if (deepgramSessionStartTime > 0L) {
            val elapsedSec = Math.max(1L, (System.currentTimeMillis() - deepgramSessionStartTime) / 1000L)
            deepgramSecondsToday += elapsedSec
            deepgramSessionStartTime = 0L
            savePersistentDailyUsage(appContext)
        }
        isDeepgramBackupActive = false
        groqConsecutiveFailures = 0
        try {
            webSocket?.close(1000, "Groq Recovered")
            webSocket?.cancel()
        } catch (_: Exception) {}
        webSocket = null
        android.util.Log.i("RadioStreamSttManager", "Deepgram backup closed. Switched back to Groq Free Tier.")
    }

    private fun mergeTranscriptChunk(pending: String, chunk: String): String {
        val p = pending.trim()
        val c = chunk.trim()
        if (p.isEmpty()) return c
        if (c.isEmpty()) return p

        val pWords = p.split("\\s+".toRegex()).filter { it.isNotEmpty() }
        val cWords = c.split("\\s+".toRegex()).filter { it.isNotEmpty() }

        if (pWords.isEmpty()) return c
        if (cWords.isEmpty()) return p

        val normP = pWords.map { it.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "") }
        val normC = cWords.map { it.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "") }

        // Find longest suffix-prefix overlap (min 2 words down to 1)
        val maxOverlap = minOf(pWords.size, cWords.size)
        for (k in maxOverlap downTo 2) {
            val pendingSuffix = normP.takeLast(k)
            val chunkPrefix = normC.take(k)
            if (pendingSuffix == chunkPrefix) {
                if (k == cWords.size) {
                    return p
                }
                val nonOverlappingWords = cWords.drop(k).joinToString(" ")
                return "$p $nonOverlappingWords"
            }
        }

        // Single word overlap check
        if (maxOverlap >= 1 && normP.last() == normC.first() && normP.last().isNotEmpty()) {
            if (cWords.size == 1) {
                return p
            }
            if (normP.last().length >= 4) {
                val nonOverlappingWords = cWords.drop(1).joinToString(" ")
                return "$p $nonOverlappingWords"
            }
        }

        return "$p $c"
    }

    private fun handleDeepgramMessage(text: String) {
        try {
            val json = JSONObject(text)
            val isFinal = json.optBoolean("is_final", false) || json.optBoolean("speech_final", false)
            val isSpeechFinal = json.optBoolean("speech_final", false)
            val channel = json.optJSONObject("channel")
            val alternatives = channel?.optJSONArray("alternatives") ?: return
            if (alternatives.length() == 0) return

            val rawTranscript = alternatives.getJSONObject(0).optString("transcript", "").trim()
            if (rawTranscript.isEmpty()) return

            lastAudioDataTime = System.currentTimeMillis()
            lastTranscriptTime = System.currentTimeMillis()

            if (!isFinal) return

            val cleanChunk = sanitizeText(rawTranscript)
            if (cleanChunk.length < 2) return

            synchronized(pendingBuffer) {
                val currentText = pendingBuffer.toString().trim()
                val mergedText = mergeTranscriptChunk(currentText, cleanChunk)

                if (pendingBuffer.isEmpty()) {
                    bufferStartTime = System.currentTimeMillis()
                }

                pendingBuffer.clear()
                pendingBuffer.append(mergedText)

                val fullText = pendingBuffer.toString().trim()
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                val hasSentenceEnd = "[.?!;]\\s*$".toRegex().containsMatchIn(fullText)
                val elapsedMs = System.currentTimeMillis() - bufferStartTime

                // PRIORITY: Complete fluent sentences for optimal language learning.
                // 1. If sentence boundary (. ? !) found and has >= 5 words (or speech_final) -> flush immediately
                if ((hasSentenceEnd && wordCount >= 5) || isSpeechFinal) {
                    flushPendingBuffer(forceAll = isSpeechFinal)
                } else if (elapsedMs >= 6500 || wordCount >= 22) {
                    // 2. Continuous sentence duration exceeded 6.5s or 22 words -> flush at clause boundary
                    flushPendingBuffer(forceAll = true)
                } else {
                    // 3. Dynamic inactivity flush: If speaker pauses for 3.5s, flush remaining text completely (forceAll = true)
                    flushTimerJob?.cancel()
                    flushTimerJob = scope.launch {
                        delay(3500)
                        flushPendingBuffer(forceAll = true)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("RadioStreamSttManager", "Error parsing Deepgram message: ${e.message}")
        }
    }

    private fun sanitizeText(input: String): String {
        if (input.isBlank()) return ""
        var s = input.trim()

        // 1. Remove immediate word stutters (e.g. "the the" -> "the")
        s = s.replace(Regex("\\b(\\w+)(?:\\s+\\1\\b)+", RegexOption.IGNORE_CASE), "$1")

        // 2. Remove multi-word phrase loops (e.g. "with the with the" -> "with the")
        for (phraseLen in 6 downTo 2) {
            val pattern = Regex("(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:\\s+\\1\\b)+", RegexOption.IGNORE_CASE)
            s = s.replace(pattern, "$1")
        }

        return s.replace(Regex(",\\s*,+"), ",")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun isHallucinationLoop(text: String): Boolean {
        if (text.length < 3) return true
        val words = text.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9\\s]"), "").split("\\s+".toRegex()).filter { it.isNotEmpty() }
        if (words.size <= 3) return false

        val uniqueWords = words.toSet()
        val ratio = uniqueWords.size.toDouble() / words.size.toDouble()

        if (words.size >= 8 && ratio < 0.35) return true
        if (words.size >= 15 && ratio < 0.45) return true

        for (len in 2..4) {
            val counts = mutableMapOf<String, Int>()
            for (i in 0..(words.size - len)) {
                val phrase = words.subList(i, i + len).joinToString(" ")
                counts[phrase] = (counts[phrase] ?: 0) + 1
                if (counts[phrase]!! >= 4) return true
            }
        }

        return false
    }

    private fun flushPendingBuffer(forceAll: Boolean) {
        var rawText = ""
        var textToKeep = ""

        synchronized(pendingBuffer) {
            val fullText = pendingBuffer.toString().trim()
            if (fullText.length < 3) {
                pendingBuffer.clear()
                bufferStartTime = 0L
                return
            }

            val sentenceEndRegex = Regex("[.?!;](\\s+|$)")
            val matches = sentenceEndRegex.findAll(fullText).toList()

            if (matches.isNotEmpty()) {
                val lastMatch = matches.last()
                val cutIndex = lastMatch.range.last + 1
                rawText = fullText.substring(0, cutIndex).trim()
                textToKeep = fullText.substring(cutIndex).trim()
            } else if (forceAll) {
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                if (wordCount >= 15) {
                    val clauseRegex = Regex("[,—:](\\s+|$)")
                    val clauseMatches = clauseRegex.findAll(fullText).toList()
                    if (clauseMatches.isNotEmpty()) {
                        val lastClause = clauseMatches.last()
                        val cutIndex = lastClause.range.last + 1
                        rawText = fullText.substring(0, cutIndex).trim()
                        textToKeep = fullText.substring(cutIndex).trim()
                    } else {
                        rawText = fullText
                        textToKeep = ""
                    }
                } else {
                    rawText = fullText
                    textToKeep = ""
                }
            } else {
                return
            }

            pendingBuffer.clear()
            if (textToKeep.isNotEmpty()) {
                pendingBuffer.append(textToKeep)
                bufferStartTime = System.currentTimeMillis()
            } else {
                bufferStartTime = 0L
            }
        }

        emitCleanedSentence(rawText)
    }

    /**
     * Post-processes speech chunks into concise, digestible learning sentences (6-14 words).
     * Prevents long paragraphs while keeping complete semantic sense for the user.
     */
    private fun splitIntoLearningSentences(text: String): List<String> {
        val clean = text.trim()
        if (clean.isBlank()) return emptyList()

        // 1. Split on sentence boundaries (. ? ! ;)
        val sentenceEndRegex = Regex("(?<=[.?!;])\\s+")
        val rawSentences = clean.split(sentenceEndRegex).filter { it.isNotBlank() }

        val learningSentences = mutableListOf<String>()
        for (s in rawSentences) {
            val words = s.split("\\s+".toRegex()).filter { it.isNotEmpty() }
            if (words.size <= 15) {
                learningSentences.add(s.trim())
            } else {
                // If a sentence is long (> 15 words), split cleanly at clause boundaries (comma, dash, colon)
                val clauseRegex = Regex("(?<=[,—:])\\s+")
                val clauses = s.split(clauseRegex).filter { it.isNotBlank() }
                var acc = ""
                for (clause in clauses) {
                    if (acc.isEmpty()) {
                        acc = clause
                    } else {
                        val accWords = acc.split("\\s+".toRegex()).filter { it.isNotEmpty() }
                        if (accWords.size >= 7) {
                            learningSentences.add(acc.trim())
                            acc = clause
                        } else {
                            acc = "$acc $clause"
                        }
                    }
                }
                if (acc.isNotBlank()) {
                    learningSentences.add(acc.trim())
                }
            }
        }
        return learningSentences.filter { it.length >= 3 }
    }

    private fun emitCleanedSentence(rawText: String) {
        val cleanedText = sanitizeText(rawText)
        if (cleanedText.length < 3 || cleanedText == lastFlushedText) return

        // Hallucination Loop Detection
        if (isHallucinationLoop(cleanedText)) {
            android.util.Log.d("RadioStreamSttManager", "Dropped low-diversity hallucination text: $cleanedText")
            return
        }

        lastFlushedText = cleanedText

        val sentences = splitIntoLearningSentences(cleanedText)
        if (sentences.isEmpty()) return

        scope.launch {
            for ((index, sentence) in sentences.withIndex()) {
                if (index > 0) {
                    delay(300L) // Rapid seamless progression (300ms) to prevent subtitle queue lag
                }

                // Avoid duplicate sentences
                val normSentence = sentence.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                var isDuplicate = false
                synchronized(recentEmittedSentences) {
                    isDuplicate = recentEmittedSentences.take(6).any { prev ->
                        val normPrev = prev.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                        normPrev == normSentence && normSentence.isNotEmpty()
                    }
                    if (!isDuplicate) {
                        recentEmittedSentences.add(0, sentence)
                        if (recentEmittedSentences.size > 15) {
                            recentEmittedSentences.removeAt(recentEmittedSentences.size - 1)
                        }
                    }
                }

                if (!isDuplicate) {
                    translateAndEmitSubtitle(sentence)
                }
            }
        }
    }

    private suspend fun translateAndEmitSubtitle(englishText: String) {
        val traditionalChinese = translationRepo.translateToTraditionalChinese(englishText)
        val now = System.currentTimeMillis()
        val formattedTime = timeFormat.format(Date(now))
        val subId = "sub-$now-${(1000..9999).random()}"

        val subtitle = NativeSubtitle(
            id = subId,
            timestamp = formattedTime,
            createdAt = now,
            english = englishText,
            traditionalChinese = if (traditionalChinese.isNotBlank()) traditionalChinese else englishText,
            isFinal = true,
            isNative = true
        )

        recordNativeSentence()
        android.util.Log.i("RadioStreamSttManager", "Native Subtitle Emitted: [EN] $englishText | [ZH] ${subtitle.traditionalChinese}")

        mainHandler.post {
            onSubtitleListener?.invoke(subtitle)
        }
    }
}
