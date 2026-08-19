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
import okhttp3.Call
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
        android.util.Log.i("RadioStreamSttManager", "Network restored detected: triggering immediate STT stream restart...")
        if (currentRadioStreamUrl.isNotBlank()) {
            start(currentRadioStreamUrl, forceRestart = true)
        }
    }

    fun stop() {
        isRunning = false
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
                if (!isRunning) break
                val now = System.currentTimeMillis()
                val audioStalled = (now - lastAudioDataTime > 15000)
                val wsDisconnected = (webSocket == null)
                val transcriptStalled = isRunning && (now - lastTranscriptTime > 25000)

                if (audioStalled || wsDisconnected || transcriptStalled) {
                    android.util.Log.w("RadioStreamSttManager", "Watchdog triggered: audioStalled=$audioStalled, wsDisconnected=$wsDisconnected, transcriptStalled=$transcriptStalled. Reconnecting STT stream...")
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
        android.util.Log.i("RadioStreamSttManager", "[Session #$sessionId] Connecting native radio STT stream: $targetUrl")

        val now = System.currentTimeMillis()
        lastAudioDataTime = now
        lastTranscriptTime = now

        try {
            currentAudioCall?.cancel()
        } catch (_: Exception) {}
        currentAudioCall = null

        try {
            webSocket?.cancel()
        } catch (_: Exception) {}
        webSocket = null

        val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=600&utterance_end_ms=1000"
        val wsRequest = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Token $deepgramApiKey")
            .build()

        var isWsConnected = false

        val wsListener = object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                if (sessionId != currentSessionId) {
                    try { ws.close(1000, "Old session") } catch (_: Exception) {}
                    return
                }
                isWsConnected = true
                lastAudioDataTime = System.currentTimeMillis()
                lastTranscriptTime = System.currentTimeMillis()
                android.util.Log.i("RadioStreamSttManager", "[Session #$sessionId] Deepgram WebSocket connected successfully")
                mainHandler.post {
                    onConnectionStateListener?.invoke(true)
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                if (sessionId != currentSessionId) return
                handleDeepgramMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                if (sessionId != currentSessionId) return
                isWsConnected = false
                webSocket = null
                android.util.Log.w("RadioStreamSttManager", "[Session #$sessionId] Deepgram WebSocket error: ${t.message}")
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                if (sessionId != currentSessionId) return
                isWsConnected = false
                webSocket = null
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }
        }

        val currentWs = streamingHttpClient.newWebSocket(wsRequest, wsListener)
        webSocket = currentWs

        // Wait up to 6 seconds for Deepgram WebSocket connection handshake to succeed
        var waitCount = 0
        while (!isWsConnected && isRunning && scope.isActive && sessionId == currentSessionId && waitCount < 60) {
            delay(100)
            waitCount++
        }

        if (!isWsConnected || !isRunning || !scope.isActive || sessionId != currentSessionId) {
            android.util.Log.w("RadioStreamSttManager", "[Session #$sessionId] Deepgram WS not connected after wait ($waitCount), retrying in 2s...")
            if (isRunning && scope.isActive && sessionId == currentSessionId) {
                delay(2000)
                if (isRunning && scope.isActive && sessionId == currentSessionId) {
                    startStreamingPipeline(targetUrl, sessionId)
                }
            }
            return
        }

        // Keep-Alive Ping Loop (every 5 seconds)
        scope.launch {
            while (isRunning && isActive && sessionId == currentSessionId && webSocket != null) {
                delay(5000)
                try {
                    val pingJson = JSONObject().apply { put("type", "KeepAlive") }
                    webSocket?.send(pingJson.toString())
                } catch (_: Exception) {}
            }
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

            while (isRunning && scope.isActive && sessionId == currentSessionId && isWsConnected && webSocket != null) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead <= 0) break

                lastAudioDataTime = System.currentTimeMillis()
                webSocket?.send(buffer.toByteString(0, bytesRead))
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
                // 1. If sentence boundary (. ? !) found and has >= 8 words (or speech_final) -> flush immediately
                if ((hasSentenceEnd && wordCount >= 8) || isSpeechFinal) {
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

        val cleanedText = sanitizeText(rawText)
        if (cleanedText.length < 3 || cleanedText == lastFlushedText) return

        // Hallucination Loop Detection
        if (isHallucinationLoop(cleanedText)) {
            android.util.Log.d("RadioStreamSttManager", "Dropped low-diversity hallucination text: $cleanedText")
            return
        }

        // Avoid duplicate sentences
        val normCleaned = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        synchronized(recentEmittedSentences) {
            val isDuplicate = recentEmittedSentences.take(4).any { prev ->
                val normPrev = prev.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                normPrev == normCleaned && normCleaned.isNotEmpty()
            }
            if (isDuplicate) {
                return
            }
            recentEmittedSentences.add(0, cleanedText)
            if (recentEmittedSentences.size > 10) {
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
