package com.bilingo.radio.stt

import android.os.Handler
import android.os.Looper
import com.bilingo.radio.translation.GeminiTranslationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
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

    private var currentStreamJob: Job? = null
    private var watchdogJob: Job? = null
    private var webSocket: WebSocket? = null
    private var currentRadioStreamUrl: String = ""
    private var isRunning = false
    private var lastAudioDataTime = 0L
    private var lastTranscriptTime = 0L

    private val pendingBuffer = StringBuilder()
    private var bufferStartTime = 0L
    private var flushTimerJob: Job? = null
    private var lastFlushedText = ""
    private val recentEmittedSentences = mutableListOf<String>()

    var onSubtitleListener: ((NativeSubtitle) -> Unit)? = null
    var onConnectionStateListener: ((Boolean) -> Unit)? = null

    private companion object {
        fun buildStreamingClient(): OkHttpClient {
            val builder = OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS) // Infinite read timeout for continuous radio broadcast stream
                .writeTimeout(15, TimeUnit.SECONDS)
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
        if (rawUrl.isBlank()) return "https://nhpr.streamguys1.com/nhpr"
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
            return "https://nhpr.streamguys1.com/nhpr"
        }
        return rawUrl
    }

    fun start(streamUrl: String, forceRestart: Boolean = false) {
        val targetUrl = resolveTargetStreamUrl(streamUrl)
        if (targetUrl.isBlank()) return

        if (!forceRestart && isRunning && currentRadioStreamUrl == targetUrl && webSocket != null && (System.currentTimeMillis() - lastAudioDataTime < 15000)) {
            android.util.Log.d("RadioStreamSttManager", "STT stream already active for: $targetUrl")
            return
        }

        stop()
        isRunning = true
        currentRadioStreamUrl = targetUrl
        lastAudioDataTime = System.currentTimeMillis()
        lastTranscriptTime = System.currentTimeMillis()

        android.util.Log.i("RadioStreamSttManager", "Starting native radio STT session for stream: $currentRadioStreamUrl")

        startWatchdog()

        currentStreamJob = scope.launch {
            startStreamingPipeline(currentRadioStreamUrl)
        }
    }

    fun onNetworkRestored() {
        android.util.Log.i("RadioStreamSttManager", "Network restored detected: triggering immediate STT stream restart...")
        if (currentRadioStreamUrl.isNotBlank()) {
            start(currentRadioStreamUrl, forceRestart = true)
        }
    }

    fun stop() {
        isRunning = false
        watchdogJob?.cancel()
        watchdogJob = null
        currentStreamJob?.cancel()
        currentStreamJob = null
        flushTimerJob?.cancel()
        flushTimerJob = null
        try {
            webSocket?.close(1000, "Normal closure")
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
                if (!isRunning) break
                val now = System.currentTimeMillis()
                val audioStalled = (now - lastAudioDataTime > 15000)
                val wsDisconnected = (webSocket == null)
                val transcriptStalled = (now - lastTranscriptTime > 25000)

                if (audioStalled || wsDisconnected || transcriptStalled) {
                    android.util.Log.w("RadioStreamSttManager", "Watchdog triggered: audioStalled=$audioStalled, wsDisconnected=$wsDisconnected, transcriptStalled=$transcriptStalled. Reconnecting...")
                    if (currentRadioStreamUrl.isNotBlank()) {
                        scope.launch {
                            try {
                                webSocket?.cancel()
                            } catch (_: Exception) {}
                            webSocket = null
                            startStreamingPipeline(currentRadioStreamUrl)
                        }
                    }
                }
            }
        }
    }

    private suspend fun startStreamingPipeline(streamUrl: String) {
        if (!isRunning || !scope.isActive) return
        val targetUrl = resolveTargetStreamUrl(streamUrl)
        android.util.Log.i("RadioStreamSttManager", "Connecting native radio STT stream: $targetUrl")

        val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=300&utterance_end_ms=1000"
        val wsRequest = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Token $deepgramApiKey")
            .build()

        var isWsConnected = false

        val wsListener = object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isWsConnected = true
                lastTranscriptTime = System.currentTimeMillis()
                android.util.Log.i("RadioStreamSttManager", "Deepgram WebSocket connected successfully")
                mainHandler.post {
                    onConnectionStateListener?.invoke(true)
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleDeepgramMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isWsConnected = false
                webSocket = null
                android.util.Log.w("RadioStreamSttManager", "Deepgram WebSocket error: ${t.message}")
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isWsConnected = false
                webSocket = null
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }
        }

        try {
            webSocket?.cancel()
        } catch (_: Exception) {}
        webSocket = streamingHttpClient.newWebSocket(wsRequest, wsListener)

        // Keep-Alive Ping Loop
        scope.launch {
            while (isRunning && isActive && webSocket != null) {
                delay(5000)
                try {
                    val pingJson = JSONObject().apply { put("type", "KeepAlive") }
                    webSocket?.send(pingJson.toString())
                } catch (_: Exception) {}
            }
        }

        // Connect to Audio Stream and stream chunks with rate pacing
        try {
            val audioRequest = Request.Builder()
                .url(targetUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36 RadioStream/2.2.5")
                .addHeader("Icy-MetaData", "0")
                .addHeader("Connection", "keep-alive")
                .build()

            val audioResponse = streamingHttpClient.newCall(audioRequest).execute()
            if (!audioResponse.isSuccessful) {
                android.util.Log.e("RadioStreamSttManager", "Failed to connect to audio stream: HTTP ${audioResponse.code} for $targetUrl")
                if (isRunning) {
                    delay(3000)
                    if (isRunning) {
                        startStreamingPipeline(targetUrl)
                    }
                }
                return
            }

            val inputStream: InputStream = audioResponse.body?.byteStream() ?: return
            val buffer = ByteArray(2048)
            var bytesRead: Int
            var lastPacingTime = System.currentTimeMillis()
            var bytesSentInWindow = 0

            while (isRunning && scope.isActive) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead <= 0) break

                lastAudioDataTime = System.currentTimeMillis()
                if (isWsConnected && webSocket != null) {
                    webSocket?.send(buffer.toByteString(0, bytesRead))
                    bytesSentInWindow += bytesRead
                }

                // Smooth rate pacing: keep streaming aligned with real-time audio clock (max 32KB/sec)
                val elapsed = System.currentTimeMillis() - lastPacingTime
                if (elapsed < 1000 && bytesSentInWindow > 32000) {
                    delay(1000 - elapsed)
                    lastPacingTime = System.currentTimeMillis()
                    bytesSentInWindow = 0
                } else if (elapsed >= 1000) {
                    lastPacingTime = System.currentTimeMillis()
                    bytesSentInWindow = 0
                }
            }
            try { inputStream.close() } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.w("RadioStreamSttManager", "Audio stream read loop exception: ${e.message}")
        }

        // Auto-reconnect if stream ended while still running
        if (isRunning && scope.isActive) {
            delay(1500)
            if (isRunning && scope.isActive) {
                startStreamingPipeline(currentRadioStreamUrl)
            }
        }
    }

    private fun handleDeepgramMessage(text: String) {
        try {
            val json = JSONObject(text)
            val isFinal = json.optBoolean("is_final", false) || json.optBoolean("speech_final", false)
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
                val normPending = currentText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                val normChunk = cleanChunk.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")

                if (normPending.isNotEmpty() && (normPending.endsWith(normChunk) || normPending == normChunk)) {
                    // already present
                } else {
                    if (pendingBuffer.isEmpty()) {
                        bufferStartTime = System.currentTimeMillis()
                    }
                    if (pendingBuffer.isNotEmpty()) {
                        pendingBuffer.append(" ").append(cleanChunk)
                    } else {
                        pendingBuffer.append(cleanChunk)
                    }
                }

                val fullText = pendingBuffer.toString().trim()
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                val hasSentenceEnd = "[.?!;]\\s*$".toRegex().containsMatchIn(fullText)
                val isSpeechFinal = json.optBoolean("speech_final", false)
                val elapsedMs = System.currentTimeMillis() - bufferStartTime

                if ((hasSentenceEnd && wordCount >= 3) || isSpeechFinal) {
                    flushPendingBuffer(false)
                } else if (elapsedMs >= 4000 || wordCount >= 14) {
                    flushPendingBuffer(true)
                } else {
                    flushTimerJob?.cancel()
                    flushTimerJob = scope.launch {
                        delay(2000)
                        flushPendingBuffer(true)
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
        for (phraseLen in 4 downTo 2) {
            val pattern = Regex("(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:\\s+\\1\\b)+", RegexOption.IGNORE_CASE)
            s = s.replace(pattern, "$1")
        }

        return s.replace(Regex(",\\s*,+"), ",")
            .replace(Regex("\\s+"), " ")
            .trim()
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
                if (wordCount >= 8) {
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
                } else if (wordCount >= 2) {
                    rawText = fullText
                    textToKeep = ""
                } else {
                    return
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

        var cleanedText = sanitizeText(rawText)
        if (cleanedText.length < 4 || cleanedText == lastFlushedText) return

        // Hallucination Loop Detection
        val words = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9\\s]"), "").split("\\s+".toRegex()).filter { it.isNotEmpty() }
        if (words.size >= 6) {
            val uniqueCount = words.toSet().size
            val ratio = uniqueCount.toDouble() / words.size.toDouble()
            if (ratio < 0.40) {
                android.util.Log.d("RadioStreamSttManager", "Dropped low-diversity hallucination text: $cleanedText")
                return
            }
        }

        // Avoid duplicate sentences
        val normCleaned = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        synchronized(recentEmittedSentences) {
            val isDuplicate = recentEmittedSentences.take(5).any { prev ->
                val normPrev = prev.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                normPrev == normCleaned && normCleaned.isNotEmpty()
            }
            if (isDuplicate) {
                return
            }
            recentEmittedSentences.add(0, cleanedText)
            if (recentEmittedSentences.size > 15) {
                recentEmittedSentences.removeAt(recentEmittedSentences.size - 1)
            }
        }

        lastFlushedText = cleanedText

        scope.launch {
            translateAndEmitSubtitle(cleanedText)
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

        android.util.Log.i("RadioStreamSttManager", "Native Subtitle Emitted: [EN] $englishText | [ZH] ${subtitle.traditionalChinese}")

        mainHandler.post {
            onSubtitleListener?.invoke(subtitle)
        }
    }
}
