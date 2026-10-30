package com.bilingo.radio.youtube

import android.util.Log
import androidx.core.text.HtmlCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * YouTube Transcript Manager for Android Native Layer
 * 
 * Provides direct, asynchronous extraction of YouTube English captions
 * using OkHttp, bypassing any external Cloud Run / AI Studio authentication barriers.
 * 
 * Isolated completely from Radio playback and STT pipelines.
 */
class YouTubeTranscriptManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()
) {
    companion object {
        private const val TAG = "YouTubeTranscript"
        private const val DEFAULT_INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        private const val INNERTUBE_PLAYER_URL = "https://www.youtube.com/youtubei/v1/player"
    }

    /**
     * Fetch and parse YouTube captions for the given videoId.
     * Returns a JSON string conforming to TranscriptProviderResponse.
     */
    suspend fun fetchTranscript(videoId: String): String = withContext(Dispatchers.IO) {
        val cleanId = videoId.trim()
        if (!cleanId.matches(Regex("^[a-zA-Z0-9_-]{11}$"))) {
            Log.w(TAG, "Invalid videoId format: $cleanId")
            return@withContext JSONObject().apply {
                put("success", false)
                put("code", "INVALID_YOUTUBE_URL")
                put("message", "無效的 YouTube 影片識別碼 (Invalid YouTube Video ID)")
            }.toString()
        }

        Log.i(TAG, "Bridge request started for videoId: $cleanId")

        try {
            // 1. Query Innertube player endpoint with ANDROID client context
            var playerJson: JSONObject? = queryInnertubePlayer(cleanId)
            var captionTracks = extractCaptionTracks(playerJson)

            // Fallback: If player endpoint has no caption tracks, attempt scraping watch page metadata
            if (captionTracks == null || captionTracks.length() == 0) {
                Log.d(TAG, "Innertube player returned no caption tracks, trying watch page fallback...")
                val watchJson = scrapeWatchPageMetadata(cleanId)
                if (watchJson != null) {
                    playerJson = watchJson
                    captionTracks = extractCaptionTracks(watchJson)
                }
            }

            if (captionTracks == null || captionTracks.length() == 0) {
                val playabilityStatus = playerJson?.optJSONObject("playabilityStatus")?.optString("status", "") ?: ""
                Log.w(TAG, "No caption tracks found. Playability status: $playabilityStatus")
                val code = if (playabilityStatus == "UNPLAYABLE" || playabilityStatus == "LOGIN_REQUIRED") {
                    "VIDEO_UNAVAILABLE"
                } else {
                    "CAPTIONS_NOT_AVAILABLE"
                }
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", code)
                    put("message", "此影片目前沒有可用的字幕內容 (No captions found for this video)")
                }.toString()
            }

            Log.i(TAG, "Caption track count: ${captionTracks.length()}")

            // 2. Select best English caption track
            val selectedTrack = selectBestEnglishTrack(captionTracks)
            if (selectedTrack == null) {
                Log.w(TAG, "No usable English caption track found among ${captionTracks.length()} tracks")
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", "CAPTIONS_NOT_AVAILABLE")
                    put("message", "此影片未提供英文字幕 (English captions are not available for this video)")
                }.toString()
            }

            val langCode = selectedTrack.optString("languageCode", "en")
            val isAsr = selectedTrack.optString("kind", "") == "asr"
            val rawBaseUrl = selectedTrack.optString("baseUrl", "")

            Log.i(TAG, "Selected track languageCode: $langCode (manual: ${!isAsr})")

            if (rawBaseUrl.isBlank()) {
                Log.w(TAG, "Selected track baseUrl is empty")
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", "TRANSCRIPT_FETCH_FAILED")
                    put("message", "無法取得字幕下載連結 (Empty caption baseUrl)")
                }.toString()
            }

            // 3. Fetch caption XML (stripping fmt param if present to get standard timedtext)
            val cleanUrl = rawBaseUrl.replace(Regex("&fmt=[^&]+"), "")
            val captionRequest = Request.Builder()
                .url(cleanUrl)
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile)")
                .get()
                .build()

            val captionResponse = client.newCall(captionRequest).execute()
            val httpStatus = captionResponse.code
            Log.i(TAG, "Caption fetch HTTP status: $httpStatus")

            if (!captionResponse.isSuccessful) {
                captionResponse.close()
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", "TRANSCRIPT_FETCH_FAILED")
                    put("message", "下載字幕軌道失敗 (HTTP $httpStatus)")
                }.toString()
            }

            val xmlBody = captionResponse.body?.string() ?: ""
            captionResponse.close()

            if (xmlBody.isBlank()) {
                Log.w(TAG, "Caption XML body is empty")
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", "TRANSCRIPT_FETCH_FAILED")
                    put("message", "字幕內容為空 (Empty caption content)")
                }.toString()
            }

            // 4. Parse timed segments from XML (supports both Format 3 <p t="" d=""> and Format 1 <text start="" dur="">)
            val segmentsArray = parseCaptionXml(xmlBody)
            Log.i(TAG, "Parsed segment count: ${segmentsArray.length()}")

            if (segmentsArray.length() == 0) {
                return@withContext JSONObject().apply {
                    put("success", false)
                    put("code", "CAPTIONS_NOT_AVAILABLE")
                    put("message", "未能解析出有效的字幕標籤 (Could not parse caption segments)")
                }.toString()
            }

            // Extract video title and duration from player metadata
            val videoTitle = playerJson?.optJSONObject("videoDetails")?.optString("title", "YouTube Video")
                ?: "YouTube Video"
            val durationSecs = playerJson?.optJSONObject("videoDetails")?.optString("lengthSeconds", "0")?.toIntOrNull()
                ?: 0

            // 5. Build structured success response matching TranscriptProvider format
            val resultJson = JSONObject().apply {
                put("videoId", cleanId)
                put("title", videoTitle)
                put("durationSeconds", durationSecs)
                put("language", langCode)
                put("languageCode", langCode)
                put("segments", segmentsArray)
            }

            val responseObj = JSONObject().apply {
                put("success", true)
                put("result", resultJson)
            }

            return@withContext responseObj.toString()
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error fetching transcript for $cleanId", e)
            return@withContext JSONObject().apply {
                put("success", false)
                put("code", "TRANSCRIPT_FETCH_FAILED")
                put("message", "取得字幕時發生異常: ${e.message}")
            }.toString()
        }
    }

    private fun queryInnertubePlayer(videoId: String): JSONObject? {
        return try {
            val url = "$INNERTUBE_PLAYER_URL?key=$DEFAULT_INNERTUBE_KEY"
            val requestBodyJson = JSONObject().apply {
                val context = JSONObject().apply {
                    val clientObj = JSONObject().apply {
                        put("clientName", "ANDROID")
                        put("clientVersion", "20.10.38")
                    }
                    put("client", clientObj)
                }
                put("context", context)
                put("videoId", videoId)
            }

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val request = Request.Builder()
                .url(url)
                .header("Content-Type", "application/json")
                .header("User-Agent", "com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US)")
                .post(requestBodyJson.toString().toRequestBody(mediaType))
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val body = response.body?.string() ?: ""
                response.close()
                if (body.isNotBlank()) JSONObject(body) else null
            } else {
                response.close()
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Innertube player query failed: ${e.message}")
            null
        }
    }

    private fun scrapeWatchPageMetadata(videoId: String): JSONObject? {
        return try {
            val request = Request.Builder()
                .url("https://www.youtube.com/watch?v=$videoId")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                response.close()
                return null
            }

            val html = response.body?.string() ?: ""
            response.close()

            val pattern = Regex("ytInitialPlayerResponse\\s*=\\s*(\\{.+?\\});(?:var|<\\/script)")
            val match = pattern.find(html)
            if (match != null) {
                val jsonStr = match.groupValues[1]
                JSONObject(jsonStr)
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Watch page scrape fallback failed: ${e.message}")
            null
        }
    }

    private fun extractCaptionTracks(playerJson: JSONObject?): JSONArray? {
        if (playerJson == null) return null
        val captions = playerJson.optJSONObject("captions") ?: return null
        val renderer = captions.optJSONObject("playerCaptionsTracklistRenderer") ?: return null
        return renderer.optJSONArray("captionTracks")
    }

    private fun selectBestEnglishTrack(tracks: JSONArray): JSONObject? {
        var manualExactEn: JSONObject? = null
        var manualPrefixEn: JSONObject? = null
        var asrExactEn: JSONObject? = null
        var asrPrefixEn: JSONObject? = null

        for (i in 0 until tracks.length()) {
            val track = tracks.optJSONObject(i) ?: continue
            val lang = track.optString("languageCode", "").lowercase()
            val kind = track.optString("kind", "").lowercase()
            val isAsr = (kind == "asr")

            if (lang == "en") {
                if (!isAsr && manualExactEn == null) {
                    manualExactEn = track
                } else if (isAsr && asrExactEn == null) {
                    asrExactEn = track
                }
            } else if (lang.startsWith("en-") || lang.startsWith("en_")) {
                if (!isAsr && manualPrefixEn == null) {
                    manualPrefixEn = track
                } else if (isAsr && asrPrefixEn == null) {
                    asrPrefixEn = track
                }
            }
        }

        // Priority order: manual "en" > manual "en-*" > asr "en" > asr "en-*"
        return manualExactEn ?: manualPrefixEn ?: asrExactEn ?: asrPrefixEn
    }

    /**
     * Parses YouTube TimedText XML.
     * Supports:
     * - Format 3: <p t="1360" d="1680">[♪♪♪]</p> (milliseconds)
     * - Format 1: <text start="1.36" dur="1.68">[♪♪♪]</text> (seconds)
     */
    private fun parseCaptionXml(xml: String): JSONArray {
        val result = JSONArray()

        // 1. Try Format 3 (<p t="" d="">)
        val pRegex = Regex("<p\\s+[^>]*t=\"(\\d+)\"[^>]*d=\"(\\d+)\"[^>]*>([\\s\\S]*?)</p>")
        val pMatches = pRegex.findAll(xml).toList()

        if (pMatches.isNotEmpty()) {
            for (match in pMatches) {
                val tMs = match.groupValues[1].toLongOrNull() ?: continue
                val dMs = match.groupValues[2].toLongOrNull() ?: 0L
                val rawText = match.groupValues[3]
                val cleanText = sanitizeCaptionText(rawText)

                if (cleanText.isNotBlank()) {
                    val item = JSONObject().apply {
                        put("startMs", tMs)
                        put("endMs", tMs + dMs)
                        put("text", cleanText)
                    }
                    result.put(item)
                }
            }
            if (result.length() > 0) {
                return result
            }
        }

        // 2. Try Format 1 (<text start="" dur="">)
        val textRegex = Regex("<text\\s+[^>]*start=\"([0-9.]+)\"[^>]*dur=\"([0-9.]+)\"[^>]*>([\\s\\S]*?)</text>")
        val textMatches = textRegex.findAll(xml).toList()

        for (match in textMatches) {
            val startSec = match.groupValues[1].toDoubleOrNull() ?: continue
            val durSec = match.groupValues[2].toDoubleOrNull() ?: 0.0
            val rawText = match.groupValues[3]
            val cleanText = sanitizeCaptionText(rawText)

            if (cleanText.isNotBlank()) {
                val startMs = Math.round(startSec * 1000.0)
                val endMs = Math.round((startSec + durSec) * 1000.0)
                val item = JSONObject().apply {
                    put("startMs", startMs)
                    put("endMs", endMs)
                    put("text", cleanText)
                }
                result.put(item)
            }
        }

        return result
    }

    private fun sanitizeCaptionText(raw: String): String {
        // Remove nested XML tags (e.g. <s>, <span>, <br>)
        val stripped = raw.replace(Regex("<[^>]+>"), " ")
        // Decode HTML entities (e.g. &#39; -> ', &amp; -> &, &quot; -> ")
        return HtmlCompat.fromHtml(stripped, HtmlCompat.FROM_HTML_MODE_LEGACY)
            .toString()
            .replace("\n", " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
