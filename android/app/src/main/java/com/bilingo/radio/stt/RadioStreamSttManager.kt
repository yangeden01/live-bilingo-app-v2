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
    val isFinal: Boolean = true,
    val isNative: Boolean = true
)

/**
 * Autonomous Native Radio STT & Bilingual Subtitle Streamer for Android APK.
 * Connects to Deepgram Speech-to-Text directly on Android with paced live audio rate control
 * and strict sentence-boundary buffering to guarantee smooth, non-repetitive, desync-free subtitles.
 */
class RadioStreamSttManager(
    private val deepgramApiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private val mainHandler = Handler(Looper.getMainLooper())
    private val translationRepo = GeminiTranslationRepository()
    private val timeFormat = SimpleDateFormat("hh:mm:ss a", Locale.ENGLISH)

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

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

    fun start(streamUrl: String, forceRestart: Boolean = false) {
        if (streamUrl.isBlank()) return
        if (!forceRestart && isRunning && currentRadioStreamUrl == streamUrl && webSocket != null && (System.currentTimeMillis() - lastAudioDataTime < 15000)) {
            return
        }

        stop()
        isRunning = true
        currentRadioStreamUrl = streamUrl
        lastAudioDataTime = System.currentTimeMillis()
        lastTranscriptTime = System.currentTimeMillis()

        startWatchdog()

        currentStreamJob = scope.launch {
            startStreamingPipeline(streamUrl)
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
                val audioStalled = (now - lastAudioDataTime > 12000)
                val wsDisconnected = (webSocket == null)
                val transcriptStalled = (now - lastTranscriptTime > 22000)

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
        android.util.Log.i("RadioStreamSttManager", "Starting native radio STT stream: $streamUrl")
        
        // Deepgram parameters tuned for live broadcast radio:
        // - interim_results=false: prevent interim fragments from polluting the final sentence accumulator
        // - smart_format=true & punctuate=true: capitalize and place proper sentence boundaries (. ? !)
        // - endpointing=300 & utterance_end_ms=1200: optimal natural pause detection
        // - filler_words=false: eliminate filler noise loops
        val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=false&endpointing=300&utterance_end_ms=1200&filler_words=false"
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
        webSocket = httpClient.newWebSocket(wsRequest, wsListener)

        // Launch Keep-Alive Ping Loop
        scope.launch {
            while (isRunning && isActive && webSocket != null) {
                delay(5000)
                try {
                    val pingJson = JSONObject().apply { put("type", "KeepAlive") }
                    webSocket?.send(pingJson.toString())
                } catch (_: Exception) {}
            }
        }

        // Connect to Audio Stream and stream bytes with rate-pacing to prevent clock desync
        try {
            val audioRequest = Request.Builder()
                .url(streamUrl)
                .addHeader("User-Agent", "LiveBilingoRadio/2.2.3")
                .addHeader("Icy-MetaData", "0")
                .build()

            val audioResponse = httpClient.newCall(audioRequest).execute()
            if (!audioResponse.isSuccessful) {
                android.util.Log.e("RadioStreamSttManager", "Failed to connect to audio stream: HTTP ${audioResponse.code}")
                if (isRunning) {
                    delay(3000)
                    if (isRunning) {
                        startStreamingPipeline(streamUrl)
                    }
                }
                return
            }

            val inputStream: InputStream = audioResponse.body?.byteStream() ?: return
            val buffer = ByteArray(4096)
            var bytesRead: Int
            var lastPacingTime = System.currentTimeMillis()
            var bytesSentInWindow = 0L

            while (isRunning && scope.isActive) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead <= 0) break

                lastAudioDataTime = System.currentTimeMillis()
                if (isWsConnected && webSocket != null) {
                    webSocket?.send(buffer.toByteString(0, bytesRead))
                    bytesSentInWindow += bytesRead

                    // Rate pacing: Max ~24 KB/s during initial connection buffer bursts to keep STT in real-time sync with radio audio
                    val elapsed = System.currentTimeMillis() - lastPacingTime
                    if (elapsed < 1000 && bytesSentInWindow > 28000) {
                        val sleepTime = 1000 - elapsed
                        if (sleepTime > 10) {
                            delay(sleepTime)
                        }
                        lastPacingTime = System.currentTimeMillis()
                        bytesSentInWindow = 0L
                    } else if (elapsed >= 1000) {
                        lastPacingTime = System.currentTimeMillis()
                        bytesSentInWindow = 0L
                    }
                }
            }
            try { inputStream.close() } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.w("RadioStreamSttManager", "Audio stream read loop error: ${e.message}")
        }

        // Auto-reconnect if stream died while still active
        if (isRunning && scope.isActive) {
            delay(2000)
            if (isRunning && scope.isActive) {
                startStreamingPipeline(currentRadioStreamUrl)
            }
        }
    }

    private fun handleDeepgramMessage(text: String) {
        try {
            val json = JSONObject(text)
            val channel = json.optJSONObject("channel")
            val alternatives = channel?.optJSONArray("alternatives") ?: return
            if (alternatives.length() == 0) return

            val rawTranscript = alternatives.getJSONObject(0).optString("transcript", "").trim()
            if (rawTranscript.isEmpty()) return

            lastTranscriptTime = System.currentTimeMillis()

            val cleanChunk = sanitizeText(rawTranscript)
            if (cleanChunk.length < 2) return

            synchronized(pendingBuffer) {
                val currentText = pendingBuffer.toString().trim()
                
                // Smart word deduplication & overlap merging
                val merged = mergeChunks(currentText, cleanChunk)
                pendingBuffer.clear()
                pendingBuffer.append(merged)

                if (bufferStartTime == 0L) {
                    bufferStartTime = System.currentTimeMillis()
                }

                val fullText = pendingBuffer.toString().trim()
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                val hasSentenceEnd = "[.?!;]\\s*$".toRegex().containsMatchIn(fullText)
                val isSpeechFinal = json.optBoolean("speech_final", false)
                val elapsedMs = System.currentTimeMillis() - bufferStartTime

                // RULE 3: Strict sentence boundary preservation for learning
                // Flush immediately if full sentence punctuation (. ? !) is reached with >= 4 words
                if (hasSentenceEnd && wordCount >= 4) {
                    flushPendingBuffer(false)
                } else if (isSpeechFinal && wordCount >= 6) {
                    // Natural speech boundary reached
                    flushPendingBuffer(false)
                } else if (elapsedMs >= 5000 || wordCount >= 18) {
                    // Maximum duration / word threshold reached -> flush complete clause
                    flushPendingBuffer(true)
                } else {
                    // Dynamic debounce timer: wait 2200ms for sentence completion
                    flushTimerJob?.cancel()
                    flushTimerJob = scope.launch {
                        delay(2200)
                        flushPendingBuffer(false)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("RadioStreamSttManager", "Error parsing Deepgram message: ${e.message}")
        }
    }

    private fun mergeChunks(existing: String, incoming: String): String {
        if (existing.isEmpty()) return incoming
        if (incoming.isEmpty()) return existing

        val normExisting = existing.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        val normIncoming = incoming.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")

        // Exactly identical or incoming already at the end
        if (normExisting == normIncoming || normExisting.endsWith(normIncoming)) {
            return existing
        }

        // If existing is a prefix of incoming (Deepgram refined transcription)
        if (normIncoming.startsWith(normExisting) && incoming.length > existing.length) {
            return incoming
        }

        // Word overlap checking
        val existingWords = existing.split("\\s+".toRegex()).filter { it.isNotEmpty() }
        val incomingWords = incoming.split("\\s+".toRegex()).filter { it.isNotEmpty() }

        val maxOverlapCheck = minOf(6, minOf(existingWords.size, incomingWords.size))
        var bestOverlap = 0

        for (overlap in maxOverlapCheck downTo 1) {
            val suffix = existingWords.takeLast(overlap).joinToString(" ").lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
            val prefix = incomingWords.take(overlap).joinToString(" ").lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
            if (suffix == prefix) {
                bestOverlap = overlap
                break
            }
        }

        return if (bestOverlap > 0) {
            val remainingIncoming = incomingWords.drop(bestOverlap).joinToString(" ")
            if (remainingIncoming.isNotEmpty()) "$existing $remainingIncoming" else existing
        } else {
            "$existing $incoming"
        }
    }

    private fun sanitizeText(input: String): String {
        if (input.isBlank()) return ""
        var s = input.trim()

        // 1. Remove immediate word stutters (e.g. "the the" -> "the", "two two" -> "two")
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

            // Find clean sentence boundary (e.g. '.', '!', '?')
            val sentenceEndRegex = Regex("[.?!;](\\s+|$)")
            val matches = sentenceEndRegex.findAll(fullText).toList()

            if (matches.isNotEmpty()) {
                val lastMatch = matches.last()
                val cutIndex = lastMatch.range.last + 1
                rawText = fullText.substring(0, cutIndex).trim()
                textToKeep = fullText.substring(cutIndex).trim()
            } else if (forceAll) {
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                if (wordCount >= 10) {
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
                } else if (wordCount >= 4) {
                    rawText = fullText
                    textToKeep = ""
                } else {
                    return
                }
            } else {
                val wordCount = fullText.split("\\s+".toRegex()).filter { it.isNotEmpty() }.size
                if (wordCount >= 7) {
                    rawText = fullText
                    textToKeep = ""
                } else {
                    return
                }
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

        // Hallucination Loop Detection (Entropy / Unique words ratio)
        val words = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9\\s]"), "").split("\\s+".toRegex()).filter { it.isNotEmpty() }
        if (words.size >= 6) {
            val uniqueCount = words.toSet().size
            val ratio = uniqueCount.toDouble() / words.size.toDouble()
            if (ratio < 0.45) {
                android.util.Log.d("RadioStreamSttManager", "Dropped low-diversity hallucination text: $cleanedText")
                return
            }
        }

        // Avoid emitting near-duplicate sentences
        val normCleaned = cleanedText.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
        synchronized(recentEmittedSentences) {
            val isDuplicate = recentEmittedSentences.any { prev ->
                val normPrev = prev.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
                normPrev == normCleaned ||
                (normCleaned.contains(normPrev) && normPrev.length >= 14) ||
                (normPrev.contains(normCleaned) && normCleaned.length >= 14)
            }
            if (isDuplicate) {
                android.util.Log.d("RadioStreamSttManager", "Dropped duplicate sentence: $cleanedText")
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

        mainHandler.post {
            onSubtitleListener?.invoke(subtitle)
        }
    }
}
