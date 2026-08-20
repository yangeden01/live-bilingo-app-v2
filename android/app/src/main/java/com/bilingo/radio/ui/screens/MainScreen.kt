package com.bilingo.radio.ui.screens

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Vibrator
import android.os.VibratorManager
import android.os.VibrationEffect
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
import com.bilingo.radio.MainActivity
import com.bilingo.radio.service.RadioForegroundService
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

fun Context.findMainActivity(): MainActivity? {
    var ctx: Context? = this
    while (ctx != null) {
        if (ctx is MainActivity) return ctx
        if (ctx is android.content.ContextWrapper) {
            ctx = ctx.baseContext
        } else {
            break
        }
    }
    return null
}

class WebAppInterface(
    private val context: Context,
    private val getWebView: () -> WebView?,
    private val onRetry: () -> Unit,
    private val onAppLoaded: () -> Unit
) {
    private var tts: android.speech.tts.TextToSpeech? = null
    private var isTtsReady = false
    private var isTtsInitializing = false
    val sttManager = com.bilingo.radio.stt.RadioStreamSttManager()

    init {
        sttManager.onSubtitleListener = { subtitle ->
            Handler(Looper.getMainLooper()).post {
                try {
                    val webView = getWebView() ?: context.findMainActivity()?.activeWebView ?: return@post
                    val escapedEn = org.json.JSONObject.quote(subtitle.english)
                    val escapedZh = org.json.JSONObject.quote(subtitle.traditionalChinese)
                    val jsCode = """
                        (function() {
                            const sub = {
                                id: '${subtitle.id}',
                                timestamp: '${subtitle.timestamp}',
                                createdAt: ${subtitle.createdAt},
                                english: $escapedEn,
                                traditionalChinese: $escapedZh,
                                isFinal: true,
                                isNative: true
                            };
                            if (window.handleNativeSubtitle) {
                                window.handleNativeSubtitle(sub);
                            }
                            window.dispatchEvent(new CustomEvent('native-subtitle', { detail: sub }));
                            window.postMessage({ type: 'NEW_SUBTITLE', data: sub }, '*');
                        })();
                    """.trimIndent()
                    webView.evaluateJavascript(jsCode, null)
                } catch (e: Exception) {
                    android.util.Log.e("WebAppInterface", "Error sending subtitle to WebView: ${e.message}")
                }
            }
        }

        sttManager.onConnectionStateListener = { connected ->
            Handler(Looper.getMainLooper()).post {
                try {
                    val webView = getWebView() ?: context.findMainActivity()?.activeWebView ?: return@post
                    webView.evaluateJavascript(
                        "window.postMessage({ type: 'STT_CONNECTION_STATE', connected: $connected }, '*');",
                        null
                    )
                } catch (_: Exception) {}
            }
        }
    }

    private fun ensureTtsInitialized(onReady: (() -> Unit)? = null) {
        if (isTtsReady && tts != null) {
            onReady?.invoke()
            return
        }
        if (isTtsInitializing) return
        isTtsInitializing = true
        try {
            tts = android.speech.tts.TextToSpeech(context.applicationContext) { status ->
                isTtsInitializing = false
                if (status == android.speech.tts.TextToSpeech.SUCCESS) {
                    val result = tts?.setLanguage(java.util.Locale.US)
                    if (result != android.speech.tts.TextToSpeech.LANG_MISSING_DATA &&
                        result != android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED
                    ) {
                        isTtsReady = true
                        tts?.setSpeechRate(0.95f)
                        onReady?.invoke()
                    }
                }
            }
        } catch (e: Exception) {
            isTtsInitializing = false
            android.util.Log.w("WebAppInterface", "TTS init exception: ${e.message}")
        }
    }

    fun onNetworkRestoredInternal() {
        Handler(Looper.getMainLooper()).post {
            try {
                sttManager.onNetworkRestored()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun onNetworkRestored() {
        onNetworkRestoredInternal()
    }

    @JavascriptInterface
    fun onStationPlaybackChanged(streamUrl: String, stationName: String, isPlaying: Boolean) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (isPlaying && streamUrl.isNotBlank()) {
                    sttManager.start(streamUrl)
                } else {
                    sttManager.stop()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun speak(text: String) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (text.isBlank()) return@post
                ensureTtsInitialized {
                    try {
                        tts?.stop()
                        tts?.speak(text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "bilingo_tts_${System.currentTimeMillis()}")
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun stopSpeak() {
        Handler(Looper.getMainLooper()).post {
            try {
                tts?.stop()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

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
    fun updatePlayerNotification(stationName: String, isPlaying: Boolean) {
        Handler(Looper.getMainLooper()).post {
            try {
                RadioForegroundService.updateNotificationInfo(context, stationName, isPlaying)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun isNotificationPermissionGranted(): Boolean {
        return context.findMainActivity()?.isNotificationPermissionGranted() ?: true
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        Handler(Looper.getMainLooper()).post {
            try {
                context.findMainActivity()?.requestNotificationPermission()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun openNotificationSettings() {
        Handler(Looper.getMainLooper()).post {
            try {
                context.findMainActivity()?.openNotificationSettings()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun stopNotificationService() {
        Handler(Looper.getMainLooper()).post {
            try {
                RadioForegroundService.stopService(context)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        Handler(Looper.getMainLooper()).post {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vibratorManager?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                }
                if (vibrator?.hasVibrator() == true) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(durationMs.coerceIn(20, 1000), VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(durationMs.coerceIn(20, 1000))
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun checkForAppUpdate() {
        Handler(Looper.getMainLooper()).post {
            try {
                context.findMainActivity()?.checkForAppUpdate(isManualCheck = true)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun savePersistentData(key: String, value: String) {
        try {
            val prefs = context.getSharedPreferences("bilingo_persistent_data", Context.MODE_PRIVATE)
            prefs.edit().putString(key, value).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun getPersistentData(key: String): String {
        return try {
            val prefs = context.getSharedPreferences("bilingo_persistent_data", Context.MODE_PRIVATE)
            prefs.getString(key, "") ?: ""
        } catch (e: Exception) {
            ""
        }
    }

    @JavascriptInterface
    fun exitApp(clearCache: Boolean) {
        Handler(Looper.getMainLooper()).post {
            try {
                sttManager.stop()
                tts?.stop()
                RadioForegroundService.stopService(context)

                if (clearCache) {
                    try {
                        // Only clear temporary web cache if explicitly asked, but NEVER delete WebStorage / LocalStorage / SharedPreferences
                        getWebView()?.clearCache(true)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                (context.findMainActivity() ?: context as? android.app.Activity)?.finishAffinity()
            } catch (e: Exception) {
                e.printStackTrace()
                (context.findMainActivity() ?: context as? android.app.Activity)?.finish()
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MainScreen(
    viewModel: RadioSubtitleViewModel? = null
) {
    val context = LocalContext.current
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    val localAppUrl = "https://appassets.android.com/assets/index.html"

    val assetLoader = remember(context) {
        androidx.webkit.WebViewAssetLoader.Builder()
            .setDomain("appassets.android.com")
            .addPathHandler("/assets/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(context))
            .addPathHandler("/res/", androidx.webkit.WebViewAssetLoader.ResourcesPathHandler(context))
            .build()
    }

    DisposableEffect(context) {
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
                        
                        val isEmulator = Build.FINGERPRINT.startsWith("generic") ||
                                Build.FINGERPRINT.startsWith("unknown") ||
                                Build.MODEL.contains("google_sdk") ||
                                Build.MODEL.contains("Emulator") ||
                                Build.MODEL.contains("Android SDK built for x86") ||
                                Build.HARDWARE.contains("goldfish") ||
                                Build.HARDWARE.contains("ranchu") ||
                                Build.PRODUCT.contains("sdk") ||
                                Build.PRODUCT.contains("emulator")

                        if (isEmulator) {
                            android.util.Log.i("MainScreen", "Emulator detected: setting WebView LAYER_TYPE_SOFTWARE")
                            setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
                        } else {
                            setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                        }
                        
                        webChromeClient = object : WebChromeClient() {
                            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                                android.util.Log.d("WebViewConsole", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                                return true
                            }
                        }

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            databaseEnabled = true
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
                                userAgentString = "$defaultUa AndroidApp/2.2.5"
                            }
                            cacheMode = WebSettings.LOAD_DEFAULT
                        }

                        val webInterface = WebAppInterface(
                            context = ctx,
                            getWebView = { this },
                            onRetry = {
                                try {
                                    loadUrl(localAppUrl)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            },
                            onAppLoaded = {}
                        )
                        ctx.findMainActivity()?.activeWebAppInterface = webInterface
                        ctx.findMainActivity()?.activeWebView = this
                        addJavascriptInterface(webInterface, "AndroidBridge")

                        webViewClient = object : WebViewClient() {
                            override fun shouldInterceptRequest(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): WebResourceResponse? {
                                val url = request?.url ?: return super.shouldInterceptRequest(view, request)
                                try {
                                    val standardResponse = assetLoader.shouldInterceptRequest(url)
                                    if (standardResponse != null) return standardResponse
                                } catch (e: Exception) {
                                    android.util.Log.w("WebViewAsset", "assetLoader error for $url: ${e.message}")
                                }

                                if (url.host == "appassets.android.com" || url.scheme == "file") {
                                    val path = url.path?.trimStart('/') ?: ""
                                    val cleanPath = path.substringBefore('?').substringBefore('#')
                                    val candidates = listOf(
                                        cleanPath,
                                        cleanPath.removePrefix("assets/"),
                                        "assets/$cleanPath",
                                        "www/$cleanPath",
                                        "www/${cleanPath.removePrefix("assets/")}"
                                    ).filter { it.isNotEmpty() }.distinct()

                                    for (assetPath in candidates) {
                                        try {
                                            val inputStream = ctx.assets.open(assetPath)
                                            val mimeType = when {
                                                assetPath.endsWith(".html", ignoreCase = true) -> "text/html"
                                                assetPath.endsWith(".js", ignoreCase = true) || assetPath.endsWith(".mjs", ignoreCase = true) -> "text/javascript"
                                                assetPath.endsWith(".css", ignoreCase = true) -> "text/css"
                                                assetPath.endsWith(".png", ignoreCase = true) -> "image/png"
                                                assetPath.endsWith(".jpg", ignoreCase = true) || assetPath.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
                                                assetPath.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
                                                assetPath.endsWith(".json", ignoreCase = true) -> "application/json"
                                                assetPath.endsWith(".woff2", ignoreCase = true) -> "font/woff2"
                                                assetPath.endsWith(".woff", ignoreCase = true) -> "font/woff"
                                                assetPath.endsWith(".ttf", ignoreCase = true) -> "font/ttf"
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
                                        } catch (_: Exception) {}
                                    }
                                }

                                return super.shouldInterceptRequest(view, request)
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                super.onReceivedError(view, request, error)
                                android.util.Log.e("WebViewError", "Error loading ${request?.url}: ${error?.description}")
                                if (request?.isForMainFrame == true) {
                                    android.util.Log.w("WebViewError", "Main frame fallback to file:///android_asset/index.html")
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
                                android.util.Log.e("WebViewHttpError", "HTTP ${errorResponse?.statusCode} loading ${request?.url}")
                                if (request?.isForMainFrame == true && errorResponse?.statusCode != 200) {
                                    android.util.Log.w("WebViewHttpError", "Main frame HTTP error fallback to file:///android_asset/index.html")
                                    view?.post {
                                        try {
                                            view.loadUrl("file:///android_asset/index.html")
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                }
                            }

                            override fun onRenderProcessGone(
                                view: WebView?,
                                detail: android.webkit.RenderProcessGoneDetail?
                            ): Boolean {
                                android.util.Log.w("WebViewClient", "onRenderProcessGone detected. Recovering gracefully...")
                                try {
                                    view?.post {
                                        view.loadUrl(localAppUrl)
                                    }
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                                return true
                            }
                            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                try {
                                    view?.resumeTimers()
                                } catch (_: Exception) {}
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                super.onPageFinished(view, url)
                                try {
                                    view?.resumeTimers()
                                } catch (_: Exception) {}
                            }
                        }

                        webViewInstance = this
                        (ctx as? MainActivity)?.activeWebView = this
                        try {
                            resumeTimers()
                            onResume()
                        } catch (_: Exception) {}
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
}
