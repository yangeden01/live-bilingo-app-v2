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
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class NativeSubtitle(
    val id: String,
    val timestamp: String,
    val createdAt: Long,
    val english: String,
    val traditionalChinese: String,
    val isFinal: Boolean = true
)

/**
 * Autonomous Native Radio STT & Bilingual Subtitle Streamer for Android APK.
 * Runs Deepgram Speech-to-Text directly on the Android device without relying on private preview proxy.
 */
class RadioStreamSttManager(
    private val deepgramApiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val mainHandler = Handler(Looper.getMainLooper())
    private val translationRepo = GeminiTranslationRepository()
    private val timeFormat = SimpleDateFormat("hh:mm:ss a", Locale.ENGLISH)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var currentStreamJob: Job? = null
    private var webSocket: WebSocket? = null
    private var currentRadioStreamUrl: String = ""
    private var isRunning = false
    private var lastAudioDataTime = 0L
    private var lastTranscriptTime = 0L

    private var pendingBuffer = StringBuilder()
    private var bufferStartTime = 0L
    private var flushTimerJob: Job? = null
    private var lastFlushedText = ""
    private val recentEmittedSentences = mutableListOf<String>()

    var onSubtitleListener: ((NativeSubtitle) -> Unit)? = null
    var onConnectionStateListener: ((Boolean) -> Unit)? = null

    fun start(streamUrl: String) {
        if (streamUrl.isBlank()) return
        if (isRunning && currentRadioStreamUrl == streamUrl && webSocket != null) {
            return
        }

        stop()
        isRunning = true
        currentRadioStreamUrl = streamUrl
        lastAudioDataTime = System.currentTimeMillis()
        lastTranscriptTime = System.currentTimeMillis()

        currentStreamJob = scope.launch {
            startStreamingPipeline(streamUrl)
        }
    }

    fun stop() {
        isRunning = false
        currentStreamJob?.cancel()
        currentStreamJob = null
        flushTimerJob?.cancel()
        flushTimerJob = null
        try {
            webSocket?.close(1000, "Normal closure")
        } catch (_: Exception) {}
        webSocket = null
        pendingBuffer.clear()
        bufferStartTime = 0L
        mainHandler.post {
            onConnectionStateListener?.invoke(false)
        }
    }

    private suspend fun startStreamingPipeline(streamUrl: String) {
        android.util.Log.i("RadioStreamSttManager", "Starting native radio STT stream: $streamUrl")
        
        val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=300"
        val wsRequest = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Token $deepgramApiKey")
            .build()

        var isWsConnected = false

        val wsListener = object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isWsConnected = true
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
                android.util.Log.w("RadioStreamSttManager", "Deepgram WebSocket error: ${t.message}")
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isWsConnected = false
                mainHandler.post {
                    onConnectionStateListener?.invoke(false)
                }
            }
        }

        webSocket = httpClient.newWebSocket(wsRequest, wsListener)

        // Launch Keep-Alive Ping Loop
        scope.launch {
            while (isRunning && isActive) {
                delay(5000)
                try {
                    val pingJson = JSONObject().apply { put("type", "KeepAlive") }
                    webSocket?.send(pingJson.toString())
                } catch (_: Exception) {}
            }
        }

        // Connect to Audio Stream and pipe bytes
        try {
            val audioRequest = Request.Builder()
                .url(streamUrl)
                .addHeader("User-Agent", "LiveBilingoRadio/2.2.3")
                .addHeader("Icy-MetaData", "0")
                .build()

            val audioResponse = httpClient.newCall(audioRequest).execute()
            if (!audioResponse.isSuccessful) {
                android.util.Log.e("RadioStreamSttManager", "Failed to connect to audio stream: HTTP ${audioResponse.code}")
                return
            }

            val inputStream: InputStream = audioResponse.body?.byteStream() ?: return
            val buffer = ByteArray(4096)
            var bytesRead: Int

            while (isRunning && scope.isActive) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead <= 0) break

                lastAudioDataTime = System.currentTimeMillis()
                if (isWsConnected && webSocket != null) {
                    webSocket?.send(buffer.toByteString(0, bytesRead))
                }
            }
            try { inputStream.close() } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.w("RadioStreamSttManager", "Audio stream read loop error: ${e.message}")
        }

        // Auto-reconnect if stream died while still active
        if (isRunning) {
            delay(2000)
            if (isRunning) {
                start(currentRadioStreamUrl)
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

            val transcript = alternatives.getJSONObject(0).optString("transcript", "").trim()
            if (transcript.isEmpty()) return

            lastTranscriptTime = System.currentTimeMillis()

            if (isFinal) {
                synchronized(pendingBuffer) {
                    val cleanChunk = transcript.trim()
                    if (cleanChunk.isNotEmpty()) {
                        // Prevent back-to-back duplicate words or identical chunk appends
                        val currentPending = pendingBuffer.toString().trim()
                        val normPending = currentPending.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                        val normChunk = cleanChunk.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")

                        if (normPending.isNotEmpty() && (normPending.endsWith(normChunk) || normPending == normChunk)) {
                            // Already appended or duplicate final chunk, skip
                        } else {
                            if (pendingBuffer.isEmpty()) {
                                bufferStartTime = System.currentTimeMillis()
                            } else {
                                pendingBuffer.append(" ")
                            }
                            pendingBuffer.append(cleanChunk)
                        }
                    }

                    val fullText = pendingBuffer.toString().trim()
                    val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                    val hasSentenceEnd = "[.?!;]\\s*$".toRegex().containsMatchIn(fullText)
                    val isSpeechFinal = json.optBoolean("speech_final", false)
                    val elapsedMs = System.currentTimeMillis() - bufferStartTime

                    // PRIORITY: Preserve complete sentences for learning.
                    // If sentence end (. ? !) is found and has at least 5 words, flush immediately.
                    // If not ended with punctuation, dynamically extend duration up to 6000ms before soft flush at clause/comma.
                    if ((hasSentenceEnd && wordCount >= 5) || isSpeechFinal) {
                        flushPendingBuffer(false)
                    } else if (elapsedMs >= 6500 || wordCount >= 22) {
                        // Hard timeout fallback: flush at sentence/clause boundary
                        flushPendingBuffer(true)
                    } else {
                        // Dynamically extend timer waiting for next sentence boundary
                        flushTimerJob?.cancel()
                        flushTimerJob = scope.launch {
                            delay(3500)
                            flushPendingBuffer(false)
                        }
                    }
                }
            } else {
                // Interim result: only trigger if clear full sentence boundary and long enough
                val hasSentenceEnd = "[.?!;]\\s*$".toRegex().containsMatchIn(transcript)
                val wordCount = transcript.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                if (hasSentenceEnd && wordCount >= 7) {
                    synchronized(pendingBuffer) {
                        if (pendingBuffer.isEmpty()) bufferStartTime = System.currentTimeMillis()
                        else pendingBuffer.append(" ")
                        pendingBuffer.append(transcript)
                        flushPendingBuffer(false)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("RadioStreamSttManager", "Error parsing Deepgram message: ${e.message}")
        }
    }

    private fun flushPendingBuffer(forceAll: Boolean) {
        var rawText: String
        var textToKeep = ""

        synchronized(pendingBuffer) {
            val fullText = pendingBuffer.toString().trim()
            if (fullText.length < 3) {
                pendingBuffer.clear()
                bufferStartTime = 0L
                return
            }

            // Find clean sentence boundary (e.g. '.', '!', '?')
            val sentenceEndRegex = Regex("[.?!;](\\s+|$)")
            val matches = sentenceEndRegex.findAll(fullText).toList()

            if (matches.isNotEmpty()) {
                val lastMatch = matches.last()
                val cutIndex = lastMatch.range.last + 1
                rawText = fullText.substring(0, cutIndex).trim()
                textToKeep = fullText.substring(cutIndex).trim()
            } else if (forceAll) {
                // Check if there is a comma or dash clause to split cleanly
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
                // Still waiting for next sentence completion
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

        val cleanedText = rawText.replace(Regex("\\b(\\w+)(?:\\s+\\1\\b)+", RegexOption.IGNORE_CASE), "$1")
            .replace(Regex("\\s+"), " ")
            .trim()

        if (cleanedText.length < 4 || cleanedText == lastFlushedText) return

        val normCleaned = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        // Prevent duplicate cards from sentence expansion / prefix overlap
        synchronized(recentEmittedSentences) {
            val isDuplicate = recentEmittedSentences.any { prev ->
                val normPrev = prev.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                normPrev == normCleaned ||
                (normCleaned.contains(normPrev) && normPrev.length >= 12) ||
                (normPrev.contains(normCleaned) && normCleaned.length >= 12)
            }
            if (isDuplicate) {
                android.util.Log.d("RadioStreamSttManager", "Dropped near-duplicate sentence: $cleanedText")
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
            traditionalChinese = traditionalChinese,
            isFinal = true
        )

        mainHandler.post {
            onSubtitleListener?.invoke(subtitle)
        }
    }
}
