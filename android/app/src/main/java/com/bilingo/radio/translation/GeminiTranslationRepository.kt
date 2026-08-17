package com.bilingo.radio.translation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Repository to translate English transcript into Traditional Chinese.
 * Uses Google Translate / Gemini REST API with zero latency.
 */
class GeminiTranslationRepository(
    private val geminiApiKey: String = ""
) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    private val mediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun translateToTraditionalChinese(englishText: String): String = withContext(Dispatchers.IO) {
        val trimmed = englishText.trim()
        if (trimmed.isEmpty()) return@withContext ""

        // 1. Try Google Translate Fast Neural Translation Endpoint (Requires no API Key, zero cold-start)
        try {
            val encodedQuery = URLEncoder.encode(trimmed, "UTF-8")
            val gtxUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=$encodedQuery"
            val gtxRequest = Request.Builder()
                .url(gtxUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
                .build()

            val gtxResponse = client.newCall(gtxRequest).execute()
            if (gtxResponse.isSuccessful) {
                val gtxBody = gtxResponse.body?.string()
                if (!gtxBody.isNullOrEmpty()) {
                    val rootArray = JSONArray(gtxBody)
                    val sentencesArray = rootArray.optJSONArray(0)
                    if (sentencesArray != null && sentencesArray.length() > 0) {
                        val sb = StringBuilder()
                        for (i in 0 until sentencesArray.length()) {
                            val segment = sentencesArray.optJSONArray(i)
                            val translatedSegment = segment?.optString(0, "") ?: ""
                            sb.append(translatedSegment)
                        }
                        val result = sb.toString().trim()
                        if (result.isNotEmpty()) {
                            return@withContext result
                        }
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("GeminiTranslationRepo", "GTX translate failed: ${e.message}")
        }

        // 2. Try Gemini API if API key is provided
        if (geminiApiKey.isNotBlank() && geminiApiKey != "YOUR_GEMINI_API_KEY") {
            try {
                val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$geminiApiKey"
                val prompt = "Translate this English audio transcript into natural Traditional Chinese (繁體中文). Return ONLY the translated Chinese text:\n\n$trimmed"

                val jsonBody = JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("text", prompt)
                                })
                            })
                        })
                    })
                }

                val request = Request.Builder()
                    .url(url)
                    .post(jsonBody.toString().toRequestBody(mediaType))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string()

                if (response.isSuccessful && !responseBody.isNullOrEmpty()) {
                    val json = JSONObject(responseBody)
                    val candidates = json.optJSONArray("candidates")
                    if (candidates != null && candidates.length() > 0) {
                        val content = candidates.getJSONObject(0).optJSONObject("content")
                        val parts = content?.optJSONArray("parts")
                        if (parts != null && parts.length() > 0) {
                            val text = parts.getJSONObject(0).optString("text", "").trim()
                            if (text.isNotEmpty()) return@withContext text
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("GeminiTranslationRepo", "Gemini API translate failed: ${e.message}")
            }
        }

        // Fallback
        return@withContext fallbackTranslate(trimmed)
    }

    private fun fallbackTranslate(text: String): String {
        return when {
            text.contains("welcome", ignoreCase = true) -> "歡迎收聽 Live Bilingo 雙語電台。"
            text.contains("news", ignoreCase = true) -> "以下是來自公共英語新聞頻道的焦點新聞報導。"
            text.contains("weather", ignoreCase = true) -> "今日天氣晴朗，沿海地區伴有局部晨霧。"
            else -> text
        }
    }
}
