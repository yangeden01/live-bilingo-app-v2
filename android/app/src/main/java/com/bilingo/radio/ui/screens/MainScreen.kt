package com.bilingo.radio.ui.screens

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
                                android.util.Log.d("WebViewConsole", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
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
                                android.util.Log.e("WebViewError", "Error loading ${request?.url}: ${error?.description}")
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
                                android.util.Log.e("WebViewHttpError", "HTTP ${errorResponse?.statusCode} loading ${request?.url}")
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
}
