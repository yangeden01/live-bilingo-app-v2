import { AndroidFile } from '../types';

export const androidProjectFiles: AndroidFile[] = [
  {
    path: 'android/app/build.gradle.kts',
    name: 'build.gradle.kts',
    category: 'gradle',
    language: 'kotlin',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.bilingo.radio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bilingo.radio"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        compose = true
        buildConfig = false
        resValues = false
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
        }
    }
}

dependencies {
    // AndroidX & Jetpack Compose Material 3
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")

    // AndroidX Media3 (ExoPlayer for Live Bilingo Radio)
    implementation("androidx.media3:media3-exoplayer:1.3.1")

    // OkHttp WebSocket (Deepgram Speech-to-Text)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Google Mobile Ads (AdMob Non-Intrusive Banner Ads)
    implementation("com.google.android.gms:play-services-ads:23.1.0")
}`
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'manifest',
    language: 'xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Live Bilingo 雙語電台"
        android:theme="@style/Theme.BilingoRadio">

        <!-- Google AdMob Application ID -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-7732369001198376~9508349578"/>
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="Live Bilingo 雙語電台">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/MainActivity.kt',
    name: 'MainActivity.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.bilingo.radio.ui.screens.MainScreen
import com.bilingo.radio.ui.theme.BilingoRadioTheme
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: RadioSubtitleViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BilingoRadioTheme {
                MainScreen(viewModel = viewModel)
            }
        }
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/player/RadioPlayerManager.kt',
    name: 'RadioPlayerManager.kt',
    category: 'player',
    language: 'kotlin',
    content: `package com.bilingo.radio.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class PlaybackState { IDLE, BUFFERING, PLAYING, PAUSED, ERROR }

class RadioPlayerManager(private val context: Context) {
    private var exoPlayer: ExoPlayer? = null
    val defaultStreamUrl = "https://npr-ice.streamguys1.com/live.mp3"
    private val _playbackState = MutableStateFlow(PlaybackState.IDLE)
    val playbackState: StateFlow<PlaybackState> = _playbackState

    fun initializePlayer() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build().apply {
                val mediaItem = MediaItem.fromUri(Uri.parse(defaultStreamUrl))
                setMediaItem(mediaItem)
                prepare()
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _playbackState.value = if (isPlaying) PlaybackState.PLAYING else PlaybackState.PAUSED
                    }
                })
            }
        }
    }

    fun play() {
        initializePlayer()
        exoPlayer?.playWhenReady = true
        exoPlayer?.play()
    }

    fun pause() {
        exoPlayer?.pause()
    }

    fun release() {
        exoPlayer?.release()
        exoPlayer = null
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/stt/DeepgramWebSocketClient.kt',
    name: 'DeepgramWebSocketClient.kt',
    category: 'stt',
    language: 'kotlin',
    content: `package com.bilingo.radio.stt

import okhttp3.*
import org.json.JSONObject
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

class DeepgramWebSocketClient(
    private val apiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {
    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    private val _transcriptFlow = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val transcriptFlow: SharedFlow<String> = _transcriptFlow

    fun connect() {
        val url = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Token $apiKey")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    if (json.optBoolean("is_final")) {
                        val transcript = json.optJSONObject("channel")
                            ?.optJSONArray("alternatives")
                            ?.optJSONObject(0)
                            ?.optString("transcript", "")
                        if (!transcript.isNullOrBlank()) {
                            _transcriptFlow.tryEmit(transcript)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Disconnected")
        webSocket = null
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/translation/GeminiTranslationRepository.kt',
    name: 'GeminiTranslationRepository.kt',
    category: 'stt',
    language: 'kotlin',
    content: `package com.bilingo.radio.translation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class GeminiTranslationRepository(
    private val apiKey: String = "YOUR_GEMINI_API_KEY"
) {
    private val client = OkHttpClient()

    suspend fun translateToTraditionalChinese(englishText: String): String = withContext(Dispatchers.IO) {
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"
        val prompt = "Translate this public radio transcript to Traditional Chinese (繁體中文). Return ONLY translated text: $englishText"
        
        val json = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
        }

        val request = Request.Builder()
            .url(url)
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: ""
        
        return@withContext parseGeminiResponse(body)
    }

    private fun parseGeminiResponse(body: String): String {
        return try {
            JSONObject(body)
            .getJSONArray("candidates")
            .getJSONObject(0)
            .getJSONObject("content")
            .getJSONArray("parts")
            .getJSONObject(0)
            .getString("text").trim()
        } catch (e: Exception) {
            "（翻譯中...）"
        }
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/ui/screens/MainScreen.kt',
    name: 'MainScreen.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio.ui.screens

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import com.bilingo.radio.service.RadioForegroundService
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

class WebAppInterface(
    private val context: Context,
    private val onRetry: () -> Unit,
    private val onAppLoaded: () -> Unit
) {
    @JavascriptInterface
    fun logMessage(msg: String) {
        android.util.Log.d("BilingoJS", msg)
    }

    @JavascriptInterface
    fun retryConnection() {
        Handler(Looper.getMainLooper()).post {
            try {
                onRetry()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun onPageReady() {
        Handler(Looper.getMainLooper()).post {
            try {
                onAppLoaded()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun updatePlayerNotification(stationName: String, subtitleText: String, isPlaying: Boolean) {
        Handler(Looper.getMainLooper()).post {
            try {
                RadioForegroundService.updateNotificationInfo(
                    context,
                    stationName,
                    subtitleText,
                    isPlaying
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MainScreen(
    viewModel: RadioSubtitleViewModel
) {
    val context = LocalContext.current
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    val localAppUrl = "https://appassets.android.com/index.html"

    val assetLoader = remember(context) {
        try {
            androidx.webkit.WebViewAssetLoader.Builder()
                .setDomain("appassets.android.com")
                .addPathHandler("/", object : androidx.webkit.WebViewAssetLoader.PathHandler {
                    override fun handle(path: String): WebResourceResponse? {
                        var cleanPath = path.trimStart('/')
                        if (cleanPath.isEmpty() || cleanPath == "index.html") {
                            cleanPath = "index.html"
                        }
                        val candidatePaths = listOf(cleanPath, "www/$cleanPath", "assets/$cleanPath", "www/assets/$cleanPath")
                        for (assetPath in candidatePaths) {
                            try {
                                val inputStream = context.assets.open(assetPath)
                                val mimeType = when {
                                    assetPath.endsWith(".html") -> "text/html"
                                    assetPath.endsWith(".js") || assetPath.endsWith(".mjs") -> "text/javascript"
                                    assetPath.endsWith(".css") -> "text/css"
                                    assetPath.endsWith(".png") -> "image/png"
                                    assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg") -> "image/jpeg"
                                    assetPath.endsWith(".svg") -> "image/svg+xml"
                                    assetPath.endsWith(".json") -> "application/json"
                                    assetPath.endsWith(".woff2") -> "font/woff2"
                                    assetPath.endsWith(".woff") -> "font/woff"
                                    assetPath.endsWith(".ttf") -> "font/ttf"
                                    else -> "application/octet-stream"
                                }
                                val encoding = if (mimeType.startsWith("text/") || mimeType == "application/json" || mimeType == "text/javascript") "UTF-8" else null
                                return WebResourceResponse(
                                    mimeType,
                                    encoding,
                                    200,
                                    "OK",
                                    mapOf(
                                        "Access-Control-Allow-Origin" to "*",
                                        "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
                                        "Access-Control-Allow-Headers" to "*"
                                    ),
                                    inputStream
                                )
                            } catch (_: Exception) {
                                // Try next candidate path
                            }
                        }
                        return null
                    }
                })
                .build()
        } catch (e: Exception) {
            android.util.Log.e("MainScreen", "Error building WebViewAssetLoader", e)
            androidx.webkit.WebViewAssetLoader.Builder()
                .setDomain("appassets.android.com")
                .addPathHandler("/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(context))
                .build()
        }
    }

    DisposableEffect(context, webViewInstance) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val action = intent?.getStringExtra("action") ?: return
                webViewInstance?.post {
                    try {
                        webViewInstance?.evaluateJavascript(
                            "window.postMessage({ type: 'ANDROID_MEDIA_CONTROL', action: '$action' }, '*');",
                            null
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
        try {
            val filter = IntentFilter(RadioForegroundService.BROADCAST_MEDIA_ACTION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                context.registerReceiver(receiver, filter)
            }
        } catch (e: Exception) {
            android.util.Log.e("MainScreen", "Error registering media broadcast receiver", e)
        }

        onDispose {
            try {
                context.unregisterReceiver(receiver)
            } catch (_: Exception) {}
            try {
                webViewInstance?.loadUrl("about:blank")
                webViewInstance?.destroy()
                webViewInstance = null
            } catch (_: Exception) {}
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F19))) {
        AndroidView(
            factory = { ctx ->
                try {
                    WebView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        
                        setBackgroundColor(android.graphics.Color.parseColor("#0B0F19"))
                        setLayerType(android.view.View.LAYER_TYPE_NONE, null)
                        
                        webChromeClient = object : WebChromeClient() {
                            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                                android.util.Log.d("WebViewConsole", "\${consoleMessage?.message()} -- line \${consoleMessage?.lineNumber()} of \${consoleMessage?.sourceId()}")
                                return true
                            }
                        }

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            allowFileAccess = true
                            allowContentAccess = true
                            allowFileAccessFromFileURLs = true
                            allowUniversalAccessFromFileURLs = true
                            mediaPlaybackRequiresUserGesture = false
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            useWideViewPort = true
                            loadWithOverviewMode = true
                            setSupportZoom(false)
                            textZoom = 100
                            val defaultUa = try { userAgentString } catch (_: Exception) { "" } ?: ""
                            if (!defaultUa.contains("AndroidApp")) {
                                userAgentString = "$defaultUa AndroidApp/2.1.3"
                            }
                            cacheMode = WebSettings.LOAD_NO_CACHE
                        }

                        addJavascriptInterface(WebAppInterface(ctx, {
                            try {
                                loadUrl(localAppUrl)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }) {}, "AndroidBridge")

                        webViewClient = object : WebViewClient() {
                            override fun shouldInterceptRequest(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): WebResourceResponse? {
                                val url = request?.url ?: return super.shouldInterceptRequest(view, request)
                                return try {
                                    assetLoader.shouldInterceptRequest(url) ?: super.shouldInterceptRequest(view, request)
                                } catch (e: Exception) {
                                    super.shouldInterceptRequest(view, request)
                                }
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                super.onReceivedError(view, request, error)
                                android.util.Log.e("WebViewError", "Error loading \${request?.url}: \${error?.description}")
                                if (request?.isForMainFrame == true) {
                                    android.util.Log.w("WebViewError", "Main frame failed to load appassets! Fallback to file:///android_asset/index.html")
                                    view?.post {
                                        try {
                                            view.loadUrl("file:///android_asset/index.html")
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                }
                            }

                            override fun onReceivedHttpError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                errorResponse: WebResourceResponse?
                            ) {
                                super.onReceivedHttpError(view, request, errorResponse)
                                android.util.Log.e("WebViewHttpError", "HTTP \${errorResponse?.statusCode} loading \${request?.url}")
                                if (request?.isForMainFrame == true && errorResponse?.statusCode != 200) {
                                    android.util.Log.w("WebViewHttpError", "Main frame HTTP error! Fallback to file:///android_asset/index.html")
                                    view?.post {
                                        try {
                                            view.loadUrl("file:///android_asset/index.html")
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                }
                            }
                        }

                        webViewInstance = this
                        loadUrl(localAppUrl)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("MainScreen", "Critical error creating WebView", e)
                    WebView(ctx)
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}`
  },
  {
    path: 'android/app/src/main/java/com/bilingo/radio/ui/components/BilingualCard.kt',
    name: 'BilingualCard.kt',
    category: 'ui',
    language: 'kotlin',
    content: `package com.bilingo.radio.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.bilingo.radio.model.SubtitleItem

@Composable
fun BilingualCard(subtitle: SubtitleItem) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = subtitle.timestamp,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle.englishText,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = subtitle.chineseText,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}`
  }
];
