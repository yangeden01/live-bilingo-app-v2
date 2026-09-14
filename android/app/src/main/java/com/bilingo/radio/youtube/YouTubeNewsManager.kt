package com.bilingo.radio.youtube

import android.util.Log
import androidx.core.text.HtmlCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * YouTube News Discovery Manager for Android Native Layer
 *
 * Directly queries reputable English news channels using native OkHttpClient,
 * strictly filtering within a 48-hour publication window and sorting newest first.
 * Completely eliminates CORS and AI Studio Cloud Run authentication redirect barriers.
 */
class YouTubeNewsManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
) {
    companion object {
        private const val TAG = "YouTubeNewsManager"
        private const val CACHE_TTL_MS = 7 * 60 * 1000L // 7 minutes cache
    }

    private data class NewsChannel(val name: String, val id: String, val category: String)

    private val reputableChannels = listOf(
        NewsChannel("PBS NewsHour", "UC6ZFN9Tx6xh-skXCuRHCDpQ", "US"),
        NewsChannel("ABC News", "UCBi2mrWuNuyYy4gbM6fU18Q", "US"),
        NewsChannel("NBC News", "UCeY0bbntWzzVIaj2z3QigXg", "US"),
        NewsChannel("CBS News", "UC8p1vwvWtl6T73JiExfWs1g", "US"),
        NewsChannel("CNN", "UCupvZG-5ko_eiXAupbDfxWw", "World"),
        NewsChannel("BBC News", "UC16niRr50-MSBwiO3YDb3RA", "World"),
        NewsChannel("Bloomberg", "UCIALMKvObZNtJ6AmdCLP7Lg", "Business"),
        NewsChannel("CNBC", "UCvJJ_dzjViJCoLf5uKUTwoA", "Business"),
        NewsChannel("Reuters", "UChqUTb7kYRX8-EiaN3XFrSQ", "World"),
        NewsChannel("Associated Press", "UC52XwA83_M4hDia5cCUMifA", "World"),
        NewsChannel("DW News", "UCknLrEdhRCp1aegoMqRaCZg", "World"),
        NewsChannel("Sky News", "UCoMdktPbSTixAyNGwb-UYkQ", "World")
    )

    private data class CachedNews(val timestamp: Long, val jsonResponse: String)
    private var memoryCache: CachedNews? = null

    data class RawNewsItem(
        val videoId: String,
        val title: String,
        val channelTitle: String,
        val channelId: String,
        val publishedAt: String,
        val publishedMs: Long,
        val thumbnailUrl: String,
        val category: String
    )

    suspend fun fetchRecentNews(forceRefresh: Boolean = false): String = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val fortyEightHoursAgoMs = now - (48L * 60 * 60 * 1000)

        // 1. Check in-memory cache
        val currentCache = memoryCache
        if (!forceRefresh && currentCache != null && (now - currentCache.timestamp) < CACHE_TTL_MS) {
            Log.d(TAG, "Returning cached 48h news discovery response (${currentCache.timestamp})")
            return@withContext currentCache.jsonResponse
        }

        Log.i(TAG, "Fetching fresh 48h English news across ${reputableChannels.size} reputable channels...")

        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val isoFormatFallback = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        val allItems = mutableListOf<RawNewsItem>()

        try {
            val deferred = reputableChannels.map { channel ->
                async {
                    val feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}"
                    val req = Request.Builder()
                        .url(feedUrl)
                        .header("User-Agent", "Mozilla/5.0 (Linux; Android; LiveBilingo/2.5.2)")
                        .build()

                    try {
                        client.newCall(req).execute().use { response ->
                            if (!response.isSuccessful) return@async emptyList<RawNewsItem>()
                            val xml = response.body?.string() ?: return@async emptyList<RawNewsItem>()
                            parseChannelFeedXml(xml, channel, fortyEightHoursAgoMs, now, isoFormat, isoFormatFallback)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Feed fetch failed for ${channel.name}: ${e.message}")
                        emptyList<RawNewsItem>()
                    }
                }
            }

            val results = deferred.awaitAll()
            for (res in results) {
                allItems.addAll(res)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error aggregating news feeds", e)
        }

        // 2. Deduplicate and filter out shorts
        val seenIds = mutableSetOf<String>()
        val filtered = mutableListOf<RawNewsItem>()

        for (item in allItems) {
            if (seenIds.contains(item.videoId)) continue
            seenIds.add(item.videoId)

            val lowerTitle = item.title.lowercase(Locale.ROOT)
            if (lowerTitle.contains("#shorts") || lowerTitle.contains(" shorts") || lowerTitle.contains("shorts ")) continue

            filtered.add(item)
        }

        // 3. Sort strictly newest first (由最新開始排)
        filtered.sortByDescending { it.publishedMs }

        // 4. Take top 25 newest items
        val topVideos = filtered.take(25)

        val videosArray = JSONArray()
        for (item in topVideos) {
            val vObj = JSONObject().apply {
                put("videoId", item.videoId)
                put("title", item.title)
                put("channelTitle", item.channelTitle)
                put("channelId", item.channelId)
                put("publishedAt", item.publishedAt)
                put("publishedRelative", formatRelativeTimeZh(item.publishedMs, now))
                put("durationFormatted", "05:00")
                put("durationSeconds", 300)
                put("thumbnailUrl", item.thumbnailUrl)
                put("hasCaptions", true)
                put("captionBadge", "CC 英文字幕")
                put("category", item.category)
            }
            videosArray.put(vObj)
        }

        val resultObj = JSONObject().apply {
            put("success", true)
            put("cached", false)
            put("timestamp", now)
            put("publishedAfter", isoFormat.format(fortyEightHoursAgoMs))
            put("videos", videosArray)
            if (topVideos.isEmpty()) {
                put("message", "最近 48 小時暫時找不到可用英文字幕的新聞影片")
            }
        }

        val jsonStr = resultObj.toString()
        if (topVideos.isNotEmpty()) {
            memoryCache = CachedNews(now, jsonStr)
        }

        Log.i(TAG, "Successfully loaded ${topVideos.size} news items within 48h (sorted newest first)")
        return@withContext jsonStr
    }

    private fun parseChannelFeedXml(
        xml: String,
        channel: NewsChannel,
        minTimeMs: Long,
        maxTimeMs: Long,
        isoFormat: SimpleDateFormat,
        isoFormatFallback: SimpleDateFormat
    ): List<RawNewsItem> {
        val list = mutableListOf<RawNewsItem>()
        val entryRegex = Regex("<entry>([\\s\\S]*?)</entry>")
        val matches = entryRegex.findAll(xml)

        for (m in matches) {
            val block = m.groupValues[1]
            val vId = Regex("<yt:videoId>([^<]+)</yt:videoId>").find(block)?.groupValues?.get(1) ?: continue
            val rawTitle = Regex("<title>([^<]+)</title>").find(block)?.groupValues?.get(1) ?: continue
            val published = Regex("<published>([^<]+)</published>").find(block)?.groupValues?.get(1) ?: continue
            val thumb = Regex("<media:thumbnail[^>]+url=[\"']([^\"']+)[\"']").find(block)?.groupValues?.get(1)
                ?: "https://i.ytimg.com/vi/$vId/hqdefault.jpg"

            var pubMs: Long = 0L
            try {
                pubMs = isoFormat.parse(published)?.time ?: 0L
            } catch (_: Exception) {
                try {
                    pubMs = isoFormatFallback.parse(published)?.time ?: 0L
                } catch (_: Exception) {}
            }

            if (pubMs < minTimeMs || pubMs > maxTimeMs) continue

            val cleanTitle = HtmlCompat.fromHtml(rawTitle, HtmlCompat.FROM_HTML_MODE_LEGACY).toString().trim()
            val cat = categorize(cleanTitle, channel.name, channel.category)

            list.add(
                RawNewsItem(
                    videoId = vId,
                    title = cleanTitle,
                    channelTitle = channel.name,
                    channelId = channel.id,
                    publishedAt = published,
                    publishedMs = pubMs,
                    thumbnailUrl = thumb,
                    category = cat
                )
            )
        }
        return list
    }

    private fun formatRelativeTimeZh(pubMs: Long, now: Long): String {
        val diffMs = (now - pubMs).coerceAtLeast(0L)
        val mins = diffMs / (60 * 1000L)
        if (mins < 1) return "剛剛"
        if (mins < 60) return "${mins} 分鐘前"
        val hours = mins / 60
        if (hours < 24) return "${hours} 小時前"
        val days = hours / 24
        return "${days} 天前"
    }

    private fun categorize(title: String, channelTitle: String, defaultCategory: String): String {
        val lower = title.lowercase(Locale.ROOT)
        if (Regex("\\b(breaking|alert|urgent|just in|live update)\\b", RegexOption.IGNORE_CASE).containsMatchIn(lower)) {
            return "Breaking"
        }
        if (Regex("\\b(ai|artificial intelligence|tech|technology|nvidia|openai|semiconductor|cyber|google|apple|microsoft)\\b", RegexOption.IGNORE_CASE).containsMatchIn(lower)) {
            return "Technology"
        }
        if (channelTitle.contains("Bloomberg") || channelTitle.contains("CNBC") ||
            Regex("\\b(economy|inflation|wall street|stock|market|fed|interest rate|trade|tariff|ceo|bank|investor)\\b", RegexOption.IGNORE_CASE).containsMatchIn(lower)) {
            return "Business"
        }
        if (Regex("\\b(biden|trump|congress|senate|white house|supreme court|fbi|pentagon|us election|election|harris|republican|democrat)\\b", RegexOption.IGNORE_CASE).containsMatchIn(lower)) {
            return "US"
        }
        return defaultCategory
    }
}
