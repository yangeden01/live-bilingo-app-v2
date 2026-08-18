package com.bilingo.radio.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.bilingo.radio.MainActivity
import com.bilingo.radio.R

class RadioForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var currentStationName: String = "Live Bilingo 雙語電台"
    private var currentIsPlaying: Boolean = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        when (action) {
            ACTION_STOP -> {
                if (mediaControlListener != null) {
                    mediaControlListener?.invoke(ACTION_STOP)
                } else {
                    broadcastAction(ACTION_STOP)
                }
                releaseWakeLock()
                stopForegroundService()
                return START_NOT_STICKY
            }
            ACTION_TOGGLE_PLAY -> {
                if (mediaControlListener != null) {
                    mediaControlListener?.invoke(ACTION_TOGGLE_PLAY)
                } else {
                    broadcastAction(ACTION_TOGGLE_PLAY)
                }
            }
            ACTION_PLAY -> {
                if (mediaControlListener != null) {
                    mediaControlListener?.invoke(ACTION_PLAY)
                } else {
                    broadcastAction(ACTION_PLAY)
                }
            }
            ACTION_PAUSE -> {
                if (mediaControlListener != null) {
                    mediaControlListener?.invoke(ACTION_PAUSE)
                } else {
                    broadcastAction(ACTION_PAUSE)
                }
            }
            ACTION_UPDATE_STATE, ACTION_START -> {
                val station = intent.getStringExtra(EXTRA_STATION_NAME) ?: currentStationName
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, currentIsPlaying)
                updateNotificationState(station, isPlaying)
            }
        }

        return START_NOT_STICKY
    }

    private fun broadcastAction(action: String) {
        try {
            val broadcastIntent = Intent(BROADCAST_MEDIA_ACTION).apply {
                putExtra("action", action)
                setPackage(packageName)
            }
            sendBroadcast(broadcastIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun updateNotificationState(stationName: String, isPlaying: Boolean) {
        currentStationName = stationName
        currentIsPlaying = isPlaying

        if (isPlaying) {
            acquireWakeLock()
        } else {
            releaseWakeLock()
        }

        val notification = buildNotification(stationName, isPlaying)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            android.util.Log.e("RadioForegroundService", "startForeground error", e)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.notify(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(stationName: String, isPlaying: Boolean): Notification {
        createNotificationChannel()

        // Content Intent: Click notification body to bring app to front
        val contentIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Toggle Play/Pause Action Intent
        val toggleIntent = Intent(this, RadioForegroundService::class.java).apply {
            action = ACTION_TOGGLE_PLAY
        }
        val togglePendingIntent = PendingIntent.getService(
            this,
            1,
            toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop Action Intent
        val stopIntent = Intent(this, RadioForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            2,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIcon = if (isPlaying) {
            android.R.drawable.ic_media_pause
        } else {
            android.R.drawable.ic_media_play
        }
        val playPauseTitle = if (isPlaying) "暫停" else "播放"

        val statusText = if (isPlaying) {
            "正在播放雙語即時電台 • 點擊可返回"
        } else {
            "廣播已暫停 • 點擊繼續播放"
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(stationName)
            .setContentText(statusText)
            .setContentIntent(contentPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .addAction(playPauseIcon, playPauseTitle, togglePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "關閉", stopPendingIntent)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setShowActionsInCompactView(0, 1)
            )

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Bilingo 電台控制列",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "提供下拉式選單與鎖定畫面之即時電台播放控制"
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun stopForegroundService() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        try {
            if (mediaControlListener != null) {
                mediaControlListener?.invoke(ACTION_STOP)
            } else {
                broadcastAction(ACTION_STOP)
            }
        } catch (_: Exception) {}
        releaseWakeLock()
        stopForegroundService()
    }

    override fun onDestroy() {
        releaseWakeLock()
        stopForegroundService()
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
                acquire(10 * 60 * 60 * 1000L)
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

    companion object {
        const val CHANNEL_ID = "live_bilingo_playback_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.bilingo.radio.ACTION_START"
        const val ACTION_STOP = "com.bilingo.radio.ACTION_STOP"
        const val ACTION_TOGGLE_PLAY = "com.bilingo.radio.ACTION_TOGGLE_PLAY"
        const val ACTION_PLAY = "com.bilingo.radio.ACTION_PLAY"
        const val ACTION_PAUSE = "com.bilingo.radio.ACTION_PAUSE"
        const val ACTION_UPDATE_STATE = "com.bilingo.radio.ACTION_UPDATE_STATE"

        const val EXTRA_STATION_NAME = "extra_station_name"
        const val EXTRA_IS_PLAYING = "extra_is_playing"

        const val BROADCAST_MEDIA_ACTION = "com.bilingo.radio.BROADCAST_MEDIA_CONTROL"

        @Volatile
        var mediaControlListener: ((String) -> Unit)? = null

        // Cache last state to prevent unnecessary IPC overhead
        private var lastStation: String = ""
        private var lastPlaying: Boolean? = null
        private var lastUpdateTime: Long = 0L

        fun updateNotificationInfo(context: Context, stationName: String, isPlaying: Boolean) {
            val now = System.currentTimeMillis()
            // Throttle duplicate updates if state hasn't changed
            if (stationName == lastStation && isPlaying == lastPlaying && (now - lastUpdateTime < 1000)) {
                return
            }
            lastStation = stationName
            lastPlaying = isPlaying
            lastUpdateTime = now

            try {
                val intent = Intent(context, RadioForegroundService::class.java).apply {
                    action = ACTION_UPDATE_STATE
                    putExtra(EXTRA_STATION_NAME, stationName)
                    putExtra(EXTRA_IS_PLAYING, isPlaying)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                android.util.Log.e("RadioForegroundService", "updateNotificationInfo failed", e)
            }
        }

        fun stopService(context: Context) {
            lastStation = ""
            lastPlaying = null
            try {
                val intent = Intent(context, RadioForegroundService::class.java).apply {
                    action = ACTION_STOP
                }
                context.startService(intent)
            } catch (e: Throwable) {
                android.util.Log.e("RadioForegroundService", "Failed to stop service", e)
            }
        }
    }
}
