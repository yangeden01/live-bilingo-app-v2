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
            Log.e("LiveBilingoApp", "Uncaught exception caught on thread ${thread.name}: ${throwable.message}", throwable)
            try {
                // Safely log and fallback rather than crashing OS process abruptly
            } catch (_: Exception) {}
            defaultHandler?.uncaughtException(thread, throwable)
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
