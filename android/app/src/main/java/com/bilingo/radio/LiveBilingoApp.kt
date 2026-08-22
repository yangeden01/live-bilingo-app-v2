package com.bilingo.radio

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log

class LiveBilingoApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // 1. Install Global Uncaught Exception Handler to prevent hard OS crash popups
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val message = throwable.message ?: ""
            val isIgnorable = throwable is IllegalStateException && (
                message.contains("ForegroundService", ignoreCase = true) ||
                message.contains("WebView", ignoreCase = true) ||
                message.contains("Not allowed to start service", ignoreCase = true)
            ) || throwable is android.os.DeadSystemException ||
            throwable is java.io.IOException ||
            message.contains("RenderProcessGone", ignoreCase = true)

            Log.e("LiveBilingoApp", "Uncaught exception on thread ${thread.name} (ignorable=$isIgnorable): ${throwable.message}", throwable)

            if (isIgnorable || thread.name != "main") {
                // Recover safely from non-fatal background/service/WebView crashes without killing the process with OS crash dialog
                Log.w("LiveBilingoApp", "Suppressed non-fatal uncaught exception to preserve user session.")
                return@setDefaultUncaughtExceptionHandler
            }

            try {
                // If a fatal main-thread error occurs, cleanly finish or pass to default handler
                defaultHandler?.uncaughtException(thread, throwable)
            } catch (e: Exception) {
                Log.e("LiveBilingoApp", "Error in defaultHandler: ${e.message}")
            }
        }

        // 2. Pre-create Notification Channel
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channelId = "bilingo_radio_channel_v2"
                val channelName = "雙語廣播與即時字幕播放服務"
                val channelDesc = "維持背景即時電台收聽與雙語字幕同步"
                val importance = NotificationManager.IMPORTANCE_LOW
                val channel = NotificationChannel(channelId, channelName, importance).apply {
                    description = channelDesc
                    setShowBadge(false)
                    setSound(null, null)
                    enableVibration(false)
                    enableLights(false)
                }

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                notificationManager?.createNotificationChannel(channel)
            }
        } catch (e: Exception) {
            Log.e("LiveBilingoApp", "Failed to create notification channel: ${e.message}")
        }
    }
}
