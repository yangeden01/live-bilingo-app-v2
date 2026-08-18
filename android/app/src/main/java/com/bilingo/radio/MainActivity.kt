package com.bilingo.radio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.bilingo.radio.service.RadioForegroundService
import com.bilingo.radio.ui.screens.MainScreen
import com.bilingo.radio.ui.theme.LiveBilingoRadioTheme
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: RadioSubtitleViewModel by viewModels()

    private var appUpdateManager: AppUpdateManager? = null
    private var installStateUpdatedListener: InstallStateUpdatedListener? = null
    var activeWebView: WebView? = null

    private var connectivityManager: android.net.ConnectivityManager? = null
    private var networkCallback: android.net.ConnectivityManager.NetworkCallback? = null

    val requestNotificationPermissionLauncher: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            android.util.Log.d("MainActivity", "Notification permission granted: $isGranted")
            notifyWebViewOfPermission(isGranted)
        }

    private val updateActivityResultLauncher: ActivityResultLauncher<IntentSenderRequest> =
        registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
            if (result.resultCode != RESULT_OK) {
                android.util.Log.w("MainActivity", "In-App Update cancelled or failed: ${result.resultCode}")
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } catch (e: Exception) {
            e.printStackTrace()
        }

        try {
            enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        setupGoogleInAppUpdate()
        setupNetworkMonitoring()

        setContent {
            LiveBilingoRadioTheme {
                MainScreen(viewModel = viewModel)
            }
        }
    }

    fun isNotificationPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(this).areNotificationsEnabled()
        }
    }

    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            openNotificationSettings()
        }
    }

    fun openNotificationSettings() {
        try {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
            } catch (err: Exception) {
                err.printStackTrace()
            }
        }
    }

    fun notifyWebViewOfPermission(isGranted: Boolean) {
        runOnUiThread {
            try {
                activeWebView?.evaluateJavascript(
                    "window.postMessage({ type: 'NOTIFICATION_PERMISSION_RESULT', granted: $isGranted }, '*');",
                    null
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Checks Google Play Store for available app updates.
     * Triggers Google Play native In-App Update flow automatically.
     */
    fun checkForAppUpdate(isManualCheck: Boolean = false) {
        try {
            val manager = appUpdateManager ?: AppUpdateManagerFactory.create(this).also { appUpdateManager = it }
            val appUpdateInfoTask = manager.appUpdateInfo

            appUpdateInfoTask.addOnSuccessListener { appUpdateInfo: AppUpdateInfo ->
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
                    val isFlexibleAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                    val isImmediateAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)

                    if (isFlexibleAllowed) {
                        try {
                            manager.startUpdateFlowForResult(
                                appUpdateInfo,
                                updateActivityResultLauncher,
                                AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()
                            )
                        } catch (e: Exception) {
                            android.util.Log.e("MainActivity", "Failed to start flexible update flow", e)
                        }
                    } else if (isImmediateAllowed) {
                        try {
                            manager.startUpdateFlowForResult(
                                appUpdateInfo,
                                updateActivityResultLauncher,
                                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
                            )
                        } catch (e: Exception) {
                            android.util.Log.e("MainActivity", "Failed to start immediate update flow", e)
                        }
                    }
                } else if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    try {
                        manager.startUpdateFlowForResult(
                            appUpdateInfo,
                            updateActivityResultLauncher,
                            AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("MainActivity", "Failed to resume update flow", e)
                    }
                } else {
                    if (isManualCheck) {
                        Toast.makeText(this, "目前已是最新版本 (v2.2.4)", Toast.LENGTH_SHORT).show()
                    }
                }
            }.addOnFailureListener { e ->
                android.util.Log.i("MainActivity", "Play Store in-app update check note: ${e.message}")
                if (isManualCheck) {
                    Toast.makeText(this, "已是最新版本或未在 Google Play 環境", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error during checkForAppUpdate", e)
        }
    }

    private fun setupGoogleInAppUpdate() {
        try {
            val manager = AppUpdateManagerFactory.create(this)
            appUpdateManager = manager

            installStateUpdatedListener = InstallStateUpdatedListener { state ->
                if (state.installStatus() == InstallStatus.DOWNLOADED) {
                    Toast.makeText(this, "新版本已下載完成，即將自動套用更新！", Toast.LENGTH_LONG).show()
                    manager.completeUpdate()
                }
            }
            installStateUpdatedListener?.let { manager.registerListener(it) }

            checkForAppUpdate(isManualCheck = false)
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to setup Google In-App Update", e)
        }
    }

    private fun setupNetworkMonitoring() {
        try {
            connectivityManager = getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            val request = android.net.NetworkRequest.Builder()
                .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    runOnUiThread {
                        try {
                            activeWebView?.evaluateJavascript(
                                "window.dispatchEvent(new Event('online')); window.postMessage({ type: 'NETWORK_RESTORED' }, '*');",
                                null
                            )
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }

                override fun onLost(network: android.net.Network) {
                    runOnUiThread {
                        try {
                            activeWebView?.evaluateJavascript(
                                "window.dispatchEvent(new Event('offline')); window.postMessage({ type: 'NETWORK_LOST' }, '*');",
                                null
                            )
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
            }
            networkCallback?.let { connectivityManager?.registerNetworkCallback(request, it) }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to setup network monitoring", e)
        }
    }

    override fun onResume() {
        super.onResume()
        appUpdateManager?.appUpdateInfo?.addOnSuccessListener { appUpdateInfo ->
            if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                appUpdateManager?.completeUpdate()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        installStateUpdatedListener?.let { appUpdateManager?.unregisterListener(it) }
        try {
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        try {
            activeWebView?.apply {
                loadUrl("about:blank")
                stopLoading()
                pauseTimers()
                destroy()
            }
            activeWebView = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
        try {
            RadioForegroundService.stopService(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
