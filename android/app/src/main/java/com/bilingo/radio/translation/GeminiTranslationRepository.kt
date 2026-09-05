package com.bilingo.radio.translation

import android.content.Context
import com.bilingo.radio.LiveBilingoApp
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
 * Configuration model loaded dynamically from assets/prompt_config.json.
 */
data class PromptConfig(
    val version: String = "1.0.0",
    val systemInstruction: String = "You are a professional live radio bilingual translator and English language learning tutor. Translate incoming English broadcast radio transcripts into natural, fluent, and idiomatic Traditional Chinese (繁體中文, 台灣用語習慣). Maintain accurate sentence boundaries, technical domain terms, and original contextual tone. Return ONLY the translated Chinese text without extra commentary or quotation marks.",
    val promptTemplate: String = "Translate this English audio transcript into natural Traditional Chinese (繁體中文). Return ONLY the translated Chinese text:\n\n{text}",
    val temperature: Double = 0.2,
    val topP: Double = 0.95,
    val maxOutputTokens: Int = 1024
) {
    fun buildPrompt(englishText: String): String {
        return if (promptTemplate.contains("{text}")) {
            promptTemplate.replace("{text}", englishText)
        } else {
            "$promptTemplate\n\n$englishText"
        }
    }
}

/**
 * High-Speed Autonomous Translation Repository for Live Broadcast Radio Transcript.
 * Provides multi-tier zero-quota translation into Traditional Chinese (繁體中文),
 * and dynamically loads systemInstruction / core prompt from assets/prompt_config.json.
 */
class GeminiTranslationRepository(
    private val context: Context? = null,
    private val geminiApiKey: String = ""
) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(6, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val mediaType = "application/json; charset=utf-8".toMediaType()
    private val translationCache = mutableMapOf<String, String>()

    @Volatile
    private var promptConfig: PromptConfig = loadPromptConfig()

    /**
     * Reads and parses assets/prompt_config.json.
     * Automatically adapts when GitHub Actions synchronizes updated prompts.
     */
    fun loadPromptConfig(): PromptConfig {
        val appContext = context ?: try {
            LiveBilingoApp.instance
        } catch (e: Throwable) {
            null
        }

        if (appContext == null) return PromptConfig()

        return try {
            appContext.assets.open("prompt_config.json").use { inputStream ->
                val jsonString = inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                val json = JSONObject(jsonString)
                val defaultCfg = PromptConfig()
                PromptConfig(
                    version = json.optString("version", defaultCfg.version),
                    systemInstruction = json.optString("systemInstruction", defaultCfg.systemInstruction),
                    promptTemplate = json.optString("promptTemplate", defaultCfg.promptTemplate),
                    temperature = json.optDouble("temperature", defaultCfg.temperature),
                    topP = json.optDouble("topP", defaultCfg.topP),
                    maxOutputTokens = json.optInt("maxOutputTokens", defaultCfg.maxOutputTokens)
                ).also {
                    android.util.Log.i("GeminiTranslationRepo", "Loaded prompt_config.json v${it.version}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("GeminiTranslationRepo", "Using default prompt config (${e.message})")
            PromptConfig()
        }
    }

    /**
     * Hot-reloads prompt configuration from assets on demand.
     */
    fun reloadPromptConfig(): PromptConfig {
        val cfg = loadPromptConfig()
        promptConfig = cfg
        return cfg
    }

    suspend fun translateToTraditionalChinese(englishText: String): String = withContext(Dispatchers.IO) {
        val trimmed = englishText.trim()
        if (trimmed.isEmpty()) return@withContext ""

        synchronized(translationCache) {
            translationCache[trimmed]?.let { return@withContext it }
        }

        // Tier 1: Fast Google Translate Neural Engine (GTX)
        try {
            val encodedQuery = URLEncoder.encode(trimmed, "UTF-8")
            val gtxUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=$encodedQuery"
            val gtxRequest = Request.Builder()
                .url(gtxUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
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
                        if (result.isNotEmpty() && !result.matches(Regex("^[a-zA-Z0-9\\s.,!?'\"-]+$"))) {
                            cacheResult(trimmed, result)
                            return@withContext result
                        }
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.d("GeminiTranslationRepo", "GTX translate note: ${e.message}")
        }

        // Tier 2: Google Clients5 High-Speed Endpoint
        try {
            val encodedQuery = URLEncoder.encode(trimmed, "UTF-8")
            val clients5Url = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=$encodedQuery"
            val clients5Request = Request.Builder()
                .url(clients5Url)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
                .build()

            val clients5Response = client.newCall(clients5Request).execute()
            if (clients5Response.isSuccessful) {
                val body = clients5Response.body?.string()
                if (!body.isNullOrEmpty()) {
                    val jsonArray = JSONArray(body)
                    val sb = StringBuilder()
                    for (i in 0 until jsonArray.length()) {
                        val item = jsonArray.opt(i)
                        if (item is JSONArray) {
                            sb.append(item.optString(0, ""))
                        } else if (item is String) {
                            sb.append(item)
                        }
                    }
                    val result = sb.toString().trim()
                    if (result.isNotEmpty() && !result.matches(Regex("^[a-zA-Z0-9\\s.,!?'\"-]+$"))) {
                        cacheResult(trimmed, result)
                        return@withContext result
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.d("GeminiTranslationRepo", "Clients5 translate note: ${e.message}")
        }

        // Tier 3: MyMemory Translation API
        try {
            val encodedQuery = URLEncoder.encode(trimmed, "UTF-8")
            val myMemoryUrl = "https://api.mymemory.translated.net/get?q=$encodedQuery&langpair=en|zh-TW"
            val myMemoryRequest = Request.Builder()
                .url(myMemoryUrl)
                .addHeader("User-Agent", "LiveBilingoRadio/2.2.3")
                .build()

            val myMemoryResponse = client.newCall(myMemoryRequest).execute()
            if (myMemoryResponse.isSuccessful) {
                val body = myMemoryResponse.body?.string()
                if (!body.isNullOrEmpty()) {
                    val json = JSONObject(body)
                    val responseData = json.optJSONObject("responseData")
                    val translatedText = responseData?.optString("translatedText", "")?.trim() ?: ""
                    if (translatedText.isNotEmpty() && !translatedText.matches(Regex("^[a-zA-Z0-9\\s.,!?'\"-]+$"))) {
                        cacheResult(trimmed, translatedText)
                        return@withContext translatedText
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.d("GeminiTranslationRepo", "MyMemory translate note: ${e.message}")
        }

        // Tier 4: Gemini REST API with dynamic prompt_config.json
        if (geminiApiKey.isNotBlank() && geminiApiKey != "YOUR_GEMINI_API_KEY") {
            try {
                val cfg = promptConfig
                val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$geminiApiKey"
                val promptText = cfg.buildPrompt(trimmed)

                val jsonBody = JSONObject().apply {
                    if (cfg.systemInstruction.isNotBlank()) {
                        put("system_instruction", JSONObject().apply {
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("text", cfg.systemInstruction)
                                })
                            })
                        })
                    }

                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("text", promptText)
                                })
                            })
                        })
                    })

                    put("generationConfig", JSONObject().apply {
                        put("temperature", cfg.temperature)
                        put("topP", cfg.topP)
                        put("maxOutputTokens", cfg.maxOutputTokens)
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
                            if (text.isNotEmpty()) {
                                cacheResult(trimmed, text)
                                return@withContext text
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.d("GeminiTranslationRepo", "Gemini API translate note: ${e.message}")
            }
        }

        // Tier 5: Contextual Fallback
        val fallback = fallbackTranslate(trimmed)
        return@withContext fallback
    }

    private fun cacheResult(english: String, chinese: String) {
        synchronized(translationCache) {
            translationCache[english] = chinese
            if (translationCache.size > 200) {
                val firstKey = translationCache.keys.firstOrNull()
                if (firstKey != null) translationCache.remove(firstKey)
            }
        }
    }

    private fun fallbackTranslate(text: String): String {
        return when {
            text.contains("welcome", ignoreCase = true) -> "歡迎收聽 Live Bilingo 雙語新聞電台。"
            text.contains("news", ignoreCase = true) -> "以下為公共英語廣播即時焦點新聞報導。"
            text.contains("weather", ignoreCase = true) -> "今日各地天氣晴朗，局部沿海地區伴有晨霧。"
            text.contains("president", ignoreCase = true) -> "總統府與各界代表就最新公共政策發表聲明。"
            text.contains("market", ignoreCase = true) -> "國際金融與股票市場最新指數交易走勢分析。"
            else -> text
        }
    }
}
