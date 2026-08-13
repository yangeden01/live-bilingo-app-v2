package com.bilingo.radio.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.bilingo.radio.MainActivity
import com.bilingo.radio.R

class RadioForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var currentStationName = "Live Bilingo 雙語電台"
    private var currentSubtitleText = "即時廣播與AI雙語字幕"
    private var isPlaying = true

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        when (action) {
            ACTION_STOP -> {
                broadcastMediaControl(ACTION_STOP)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_TOGGLE_PLAY -> {
                isPlaying = !isPlaying
                broadcastMediaControl(ACTION_TOGGLE_PLAY)
                updateNotification()
            }
            ACTION_PAUSE -> {
                isPlaying = false
                broadcastMediaControl(ACTION_PAUSE)
                updateNotification()
            }
            ACTION_PLAY -> {
                isPlaying = true
                broadcastMediaControl(ACTION_PLAY)
                updateNotification()
            }
            ACTION_UPDATE_TITLE -> {
                intent.getStringExtra(EXTRA_STATION_NAME)?.let {
                    if (it.isNotBlank()) currentStationName = it
                }
                intent.getStringExtra(EXTRA_SUBTITLE)?.let {
                    if (it.isNotBlank()) currentSubtitleText = it
                }
                if (intent.hasExtra(EXTRA_IS_PLAYING)) {
                    isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                }
                updateNotification()
            }
        }

        val notification = createNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID, 
                    notification, 
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (_: Exception) {}
            stopSelf()
        }

        return START_STICKY
    }

    private fun broadcastMediaControl(action: String) {
        val broadcastIntent = Intent(BROADCAST_MEDIA_ACTION).apply {
            putExtra("action", action)
        }
        sendBroadcast(broadcastIntent)
    }

    private fun updateNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.notify(NOTIFICATION_ID, createNotification())
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        broadcastMediaControl(ACTION_STOP)
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        broadcastMediaControl(ACTION_STOP)
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "LiveBilingoRadio:MediaWakeLock"
            ).apply {
                setReferenceCounted(false)
                acquire(10 * 60 * 60 * 1000L) // 10 hours max
            }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "廣播背景播放服務",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "提供下拉選單媒體控制 Bar 與背景播放功能"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Toggle Play/Pause Pending Intent
        val toggleIntent = Intent(this, RadioForegroundService::class.java).apply {
            action = ACTION_TOGGLE_PLAY
        }
        val togglePendingIntent = PendingIntent.getService(
            this, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop Pending Intent
        val stopIntent = Intent(this, RadioForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 2, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseTitle = if (isPlaying) "暫停" else "播放"
        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentStationName)
            .setContentText(currentSubtitleText)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(playPauseIcon, playPauseTitle, togglePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stopPendingIntent)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setShowActionsInCompactView(0, 1)
            )

        return builder.build()
    }

    companion object {
        const val CHANNEL_ID = "live_radio_playback_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.bilingo.radio.ACTION_START"
        const val ACTION_STOP = "com.bilingo.radio.ACTION_STOP"
        const val ACTION_TOGGLE_PLAY = "com.bilingo.radio.ACTION_TOGGLE_PLAY"
        const val ACTION_PLAY = "com.bilingo.radio.ACTION_PLAY"
        const val ACTION_PAUSE = "com.bilingo.radio.ACTION_PAUSE"
        const val ACTION_UPDATE_TITLE = "com.bilingo.radio.ACTION_UPDATE_TITLE"

        const val EXTRA_STATION_NAME = "extra_station_name"
        const val EXTRA_SUBTITLE = "extra_subtitle"
        const val EXTRA_IS_PLAYING = "extra_is_playing"

        const val BROADCAST_MEDIA_ACTION = "com.bilingo.radio.BROADCAST_MEDIA_CONTROL"

        fun startService(context: Context) {
            val intent = Intent(context, RadioForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, RadioForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        fun updateNotificationInfo(context: Context, stationName: String, subtitleText: String, isPlaying: Boolean) {
            val intent = Intent(context, RadioForegroundService::class.java).apply {
                action = ACTION_UPDATE_TITLE
                putExtra(EXTRA_STATION_NAME, stationName)
                putExtra(EXTRA_SUBTITLE, subtitleText)
                putExtra(EXTRA_IS_PLAYING, isPlaying)
            }
            try {
                if (isPlaying && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
