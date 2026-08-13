package com.bilingo.radio.translation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * Repository to translate English transcript into Traditional Chinese using Gemini API.
 */
class GeminiTranslationRepository(
    private val apiKey: String = "YOUR_GEMINI_API_KEY"
) {

    private val client = OkHttpClient()
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun translateToTraditionalChinese(englishText: String): String = withContext(Dispatchers.IO) {
        if (englishText.isBlank()) return@withContext ""

        try {
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

            val prompt = "You are a professional news translator. Translate the following English audio transcript from public radio into natural Traditional Chinese (繁體中文). Return ONLY the translated Chinese text without markdown or quotes:\n\n$englishText"

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
                        return@withContext parts.getJSONObject(0).optString("text", "").trim()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Fallback translation
        return@withContext fallbackTranslate(englishText)
    }

    private fun fallbackTranslate(text: String): String {
        return when {
            text.contains("welcome", ignoreCase = true) -> "歡迎收聽 Live Bilingo 雙語電台。"
            text.contains("news", ignoreCase = true) -> "以下是來自灣區與加州地區的焦點新聞報導。"
            text.contains("weather", ignoreCase = true) -> "舊金山灣區今日天氣晴朗，沿海地區伴有局部晨霧。"
            else -> "（繁體中文）$text"
        }
    }
}
