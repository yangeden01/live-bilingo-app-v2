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
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.bilingo.radio.MainActivity
import com.bilingo.radio.R
import com.bilingo.radio.widget.RadioAppWidgetProvider

data class StationItem(
    val name: String,
    val streamUrl: String
)

class RadioForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var exoPlayer: ExoPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
        createNotificationChannel()
        loadPersistedState()
    }

    private fun loadPersistedState() {
        val prefs = getSharedPreferences(RadioAppWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        currentStationName = prefs.getString(RadioAppWidgetProvider.KEY_STATION_NAME, DEFAULT_STATIONS[0].name) ?: DEFAULT_STATIONS[0].name
        currentStreamUrl = prefs.getString(RadioAppWidgetProvider.KEY_STREAM_URL, DEFAULT_STATIONS[0].streamUrl) ?: DEFAULT_STATIONS[0].streamUrl
    }

    private fun initExoPlayerIfNeeded() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(applicationContext).build().apply {
                playWhenReady = true
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_BUFFERING -> {
                                currentIsPlaying = true
                                currentPlaybackState = RadioAppWidgetProvider.STATE_BUFFERING
                                RadioAppWidgetProvider.updateWidget(
                                    applicationContext,
                                    currentStationName,
                                    true,
                                    lastSleepMinutes,
                                    playbackState = RadioAppWidgetProvider.STATE_BUFFERING
                                )
                                updateNotificationState(currentStationName, "🔄 正在連線電台...", true)
                            }
                            Player.STATE_READY -> {
                                if (playWhenReady) {
                                    currentIsPlaying = true
                                    currentPlaybackState = RadioAppWidgetProvider.STATE_PLAYING
                                    acquireWakeLock()
                                    RadioAppWidgetProvider.updateWidget(
                                        applicationContext,
                                        currentStationName,
                                        true,
                                        lastSleepMinutes,
                                        playbackState = RadioAppWidgetProvider.STATE_PLAYING
                                    )
                                    updateNotificationState(currentStationName, "🟢 正在播放雙語即時電台 • 點擊可返回", true)
                                } else {
                                    currentIsPlaying = false
                                    currentPlaybackState = RadioAppWidgetProvider.STATE_PAUSED
                                    releaseWakeLock()
                                    RadioAppWidgetProvider.updateWidget(
                                        applicationContext,
                                        currentStationName,
                                        false,
                                        lastSleepMinutes,
                                        playbackState = RadioAppWidgetProvider.STATE_PAUSED
                                    )
                                    updateNotificationState(currentStationName, "⏸ 廣播已暫停 • 點擊繼續播放", false)
                                }
                            }
                            Player.STATE_ENDED -> {
                                currentIsPlaying = false
                                currentPlaybackState = RadioAppWidgetProvider.STATE_PAUSED
                                releaseWakeLock()
                                RadioAppWidgetProvider.updateWidget(
                                    applicationContext,
                                    currentStationName,
                                    false,
                                    lastSleepMinutes,
                                    playbackState = RadioAppWidgetProvider.STATE_PAUSED
                                )
                                updateNotificationState(currentStationName, "⏸ 廣播已暫停", false)
                            }
                            Player.STATE_IDLE -> {}
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        android.util.Log.e("RadioForegroundService", "Native ExoPlayer playback error: ${error.message}", error)
                        currentIsPlaying = false
                        currentPlaybackState = RadioAppWidgetProvider.STATE_ERROR
                        releaseWakeLock()
                        RadioAppWidgetProvider.updateWidget(
                            applicationContext,
                            currentStationName,
                            false,
                            lastSleepMinutes,
                            playbackState = RadioAppWidgetProvider.STATE_ERROR
                        )
                        updateNotificationState(currentStationName, "⚠️ 無法播放電台，請檢查網路", false)
                    }
                })
            }
        }
    }

    private fun playStationNatively(stationName: String, url: String) {
        currentStationName = stationName
        currentStreamUrl = if (url.isNotBlank()) url else getUrlForStation(stationName)
        currentIsPlaying = true
        currentPlaybackState = RadioAppWidgetProvider.STATE_BUFFERING
        acquireWakeLock()

        RadioAppWidgetProvider.updateWidget(
            applicationContext,
            currentStationName,
            true,
            lastSleepMinutes,
            playbackState = RadioAppWidgetProvider.STATE_BUFFERING
        )
        updateNotificationState(currentStationName, "🔄 正在連線電台...", true)

        initExoPlayerIfNeeded()
        try {
            exoPlayer?.apply {
                stop()
                clearMediaItems()
                setMediaItem(MediaItem.fromUri(currentStreamUrl))
                prepare()
                playWhenReady = true
            }
        } catch (e: Exception) {
            android.util.Log.e("RadioForegroundService", "Failed to start ExoPlayer stream", e)
            currentIsPlaying = false
            currentPlaybackState = RadioAppWidgetProvider.STATE_ERROR
            releaseWakeLock()
            RadioAppWidgetProvider.updateWidget(
                applicationContext,
                currentStationName,
                false,
                lastSleepMinutes,
                playbackState = RadioAppWidgetProvider.STATE_ERROR
            )
            updateNotificationState(currentStationName, "⚠️ 無法播放電台，請檢查網路", false)
        }
    }

    private fun pauseNativePlayer() {
        currentIsPlaying = false
        currentPlaybackState = RadioAppWidgetProvider.STATE_PAUSED
        releaseWakeLock()
        try {
            exoPlayer?.pause()
        } catch (_: Exception) {}
        RadioAppWidgetProvider.updateWidget(
            applicationContext,
            currentStationName,
            false,
            lastSleepMinutes,
            playbackState = RadioAppWidgetProvider.STATE_PAUSED
        )
        updateNotificationState(currentStationName, "⏸ 廣播已暫停 • 點擊繼續播放", false)
    }

    fun stopNativePlayer() {
        currentIsPlaying = false
        currentPlaybackState = RadioAppWidgetProvider.STATE_PAUSED
        releaseWakeLock()
        try {
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
        } catch (_: Exception) {}
    }

    private fun getUrlForStation(name: String): String {
        return DEFAULT_STATIONS.find { it.name.equals(name, ignoreCase = true) }?.streamUrl
            ?: DEFAULT_STATIONS[0].streamUrl
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val isAppAlive = MainActivity.currentInstance?.activeWebView != null

        when (action) {
            ACTION_STOP -> {
                if (isAppAlive) {
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_STOP)
                    } else {
                        broadcastAction(ACTION_STOP)
                    }
                }
                stopNativePlayer()
                releaseWakeLock()
                stopForegroundService()
                return START_NOT_STICKY
            }
            ACTION_TOGGLE_PLAY -> {
                if (isAppAlive) {
                    // App is alive in foreground or background: WebView controls HTML5 audio & subtitles
                    stopNativePlayer()
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_TOGGLE_PLAY)
                    } else {
                        broadcastAction(ACTION_TOGGLE_PLAY)
                    }
                } else {
                    // Cold start: App is NOT alive, run directly via native ExoPlayer (0 ASR cost, no app launch)
                    if (currentIsPlaying || exoPlayer?.isPlaying == true) {
                        pauseNativePlayer()
                    } else {
                        loadPersistedState()
                        playStationNatively(currentStationName, currentStreamUrl)
                    }
                }
            }
            ACTION_PLAY -> {
                if (isAppAlive) {
                    stopNativePlayer()
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_PLAY)
                    } else {
                        broadcastAction(ACTION_PLAY)
                    }
                } else {
                    loadPersistedState()
                    playStationNatively(currentStationName, currentStreamUrl)
                }
            }
            ACTION_PAUSE -> {
                if (isAppAlive) {
                    stopNativePlayer()
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_PAUSE)
                    } else {
                        broadcastAction(ACTION_PAUSE)
                    }
                } else {
                    pauseNativePlayer()
                }
            }
            ACTION_PREV_STATION -> {
                if (isAppAlive) {
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_PREV_STATION)
                    } else {
                        broadcastAction(ACTION_PREV_STATION)
                    }
                } else {
                    loadPersistedState()
                    val idx = DEFAULT_STATIONS.indexOfFirst { it.name.equals(currentStationName, ignoreCase = true) }
                    val newIdx = if (idx > 0) idx - 1 else DEFAULT_STATIONS.size - 1
                    val newStation = DEFAULT_STATIONS[newIdx]
                    playStationNatively(newStation.name, newStation.streamUrl)
                }
            }
            ACTION_NEXT_STATION -> {
                if (isAppAlive) {
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_NEXT_STATION)
                    } else {
                        broadcastAction(ACTION_NEXT_STATION)
                    }
                } else {
                    loadPersistedState()
                    val idx = DEFAULT_STATIONS.indexOfFirst { it.name.equals(currentStationName, ignoreCase = true) }
                    val newIdx = if (idx >= 0) (idx + 1) % DEFAULT_STATIONS.size else 0
                    val newStation = DEFAULT_STATIONS[newIdx]
                    playStationNatively(newStation.name, newStation.streamUrl)
                }
            }
            ACTION_SLEEP_TIMER -> {
                val steps = intArrayOf(0, 60, 120, 180, 240, 300)
                val currentIdx = steps.indexOf(lastSleepMinutes)
                val nextMins = if (currentIdx >= 0) steps[(currentIdx + 1) % steps.size] else 60
                setSleepTimerMinutes(this, nextMins)
                RadioAppWidgetProvider.updateWidget(
                    this,
                    currentStationName,
                    currentIsPlaying,
                    nextMins,
                    playbackState = currentPlaybackState
                )
                if (isAppAlive) {
                    if (mediaControlListener != null) {
                        mediaControlListener?.invoke(ACTION_SLEEP_TIMER)
                    } else {
                        broadcastAction(ACTION_SLEEP_TIMER)
                    }
                }
            }
            ACTION_UPDATE_STATE, ACTION_START -> {
                val station = intent.getStringExtra(EXTRA_STATION_NAME) ?: currentStationName
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, currentIsPlaying)
                if (isPlaying && isAppAlive) {
                    // WebView is actively playing, ensure native player is stopped
                    stopNativePlayer()
                }
                updateNotificationState(station, if (isPlaying) "🟢 正在播放雙語即時電台 • 點擊可返回" else "⏸ 廣播已暫停 • 點擊繼續播放", isPlaying)
                try {
                    RadioAppWidgetProvider.updateWidget(
                        this,
                        station,
                        isPlaying,
                        lastSleepMinutes,
                        playbackState = if (isPlaying) RadioAppWidgetProvider.STATE_PLAYING else RadioAppWidgetProvider.STATE_PAUSED
                    )
                } catch (e: Exception) {
                    android.util.Log.w("RadioForegroundService", "Failed to update widget on update state: ${e.message}")
                }
            }
        }

        return START_NOT_STICKY
    }

    private fun broadcastAction(action: String) {
        val mainActivity = MainActivity.currentInstance
        if (mainActivity?.activeWebView != null) {
            try {
                mainActivity.dispatchMediaControl(action)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        } else {
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
    }

    private fun updateNotificationState(stationName: String, statusText: String, isPlaying: Boolean) {
        currentStationName = stationName
        currentIsPlaying = isPlaying

        if (isPlaying) {
            acquireWakeLock()
        } else {
            releaseWakeLock()
        }

        val notification = buildNotification(stationName, statusText, isPlaying)

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

    private fun buildNotification(stationName: String, statusText: String, isPlaying: Boolean): Notification {
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
        // If playing audio, continue in background. Only stop if idle or paused
        if (!currentIsPlaying && exoPlayer?.isPlaying != true) {
            releaseWakeLock()
            stopForegroundService()
        }
    }

    override fun onDestroy() {
        if (activeInstance == this) {
            activeInstance = null
        }
        releaseWakeLock()
        try {
            exoPlayer?.release()
            exoPlayer = null
        } catch (_: Exception) {}
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
        const val ACTION_PREV_STATION = "com.bilingo.radio.ACTION_PREV_STATION"
        const val ACTION_NEXT_STATION = "com.bilingo.radio.ACTION_NEXT_STATION"
        const val ACTION_SLEEP_TIMER = "com.bilingo.radio.ACTION_SLEEP_TIMER"
        const val ACTION_UPDATE_STATE = "com.bilingo.radio.ACTION_UPDATE_STATE"

        const val EXTRA_STATION_NAME = "extra_station_name"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
        const val EXTRA_SLEEP_MINUTES = "extra_sleep_minutes"
        const val EXTRA_FROM_WIDGET = "extra_from_widget"

        const val BROADCAST_MEDIA_ACTION = "com.bilingo.radio.BROADCAST_MEDIA_CONTROL"

        val DEFAULT_STATIONS = listOf(
            StationItem("美西公共時事談話", "https://streams.kqed.org/kqedradio.mp3"),
            StationItem("中西部深度時事廣播", "https://wbez.streamguys1.com/wbez128.mp3"),
            StationItem("美東北公共英語新聞", "https://nhpr.streamguys1.com/nhpr.mp3"),
            StationItem("全美綜合時事聯播", "https://npr-ice.streamguys1.com/live.mp3"),
            StationItem("英國國際英語新聞", "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service"),
            StationItem("全美財經新聞訪談", "https://stream.revma.ihrhls.com/zc4732")
        )

        @Volatile
        var mediaControlListener: ((String) -> Unit)? = null

        @Volatile
        var lastSleepMinutes: Int = 0

        @Volatile
        var currentStationName: String = DEFAULT_STATIONS[0].name

        @Volatile
        var currentStreamUrl: String = DEFAULT_STATIONS[0].streamUrl

        @Volatile
        var currentIsPlaying: Boolean = false

        @Volatile
        var currentPlaybackState: String = RadioAppWidgetProvider.STATE_PAUSED

        private var lastUpdateTime: Long = 0L
        private val sleepTimerHandler = Handler(Looper.getMainLooper())
        private var sleepTimerRunnable: Runnable? = null

        @Volatile
        var activeInstance: RadioForegroundService? = null

        fun stopNativePlayer() {
            try {
                activeInstance?.stopNativePlayer()
            } catch (_: Exception) {}
        }

        fun isNativePlaying(): Boolean = currentIsPlaying

        fun setSleepTimerMinutes(context: Context, minutes: Int) {
            lastSleepMinutes = minutes
            sleepTimerRunnable?.let { sleepTimerHandler.removeCallbacks(it) }
            if (minutes > 0) {
                val runnable = Runnable {
                    android.util.Log.i("RadioForegroundService", "Sleep timer fired. Stopping playback.")
                    val serviceIntent = Intent(context, RadioForegroundService::class.java).apply {
                        action = ACTION_STOP
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                }
                sleepTimerRunnable = runnable
                sleepTimerHandler.postDelayed(runnable, minutes * 60 * 1000L)
            } else {
                sleepTimerRunnable = null
            }
        }

        fun updateSleepTimer(context: Context, sleepMinutes: Int) {
            setSleepTimerMinutes(context, sleepMinutes)
            try {
                RadioAppWidgetProvider.updateWidget(
                    context,
                    currentStationName,
                    currentIsPlaying,
                    sleepMinutes,
                    playbackState = currentPlaybackState
                )
            } catch (e: Exception) {
                android.util.Log.w("RadioForegroundService", "updateSleepTimer note: ${e.message}")
            }
        }

        fun onWebViewStartedPlayback(context: Context, stationName: String) {
            currentStationName = stationName
            currentIsPlaying = true
            currentPlaybackState = RadioAppWidgetProvider.STATE_PLAYING
            // Critical: Ensure native ExoPlayer is stopped immediately so it never plays simultaneously with WebView
            stopNativePlayer()
            // WebView has taken over audio playback, notify service
            try {
                val intent = Intent(context, RadioForegroundService::class.java).apply {
                    action = ACTION_UPDATE_STATE
                    putExtra(EXTRA_STATION_NAME, stationName)
                    putExtra(EXTRA_IS_PLAYING, true)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun updateNotificationInfo(context: Context, stationName: String, isPlaying: Boolean, sleepMinutes: Int = lastSleepMinutes) {
            val now = System.currentTimeMillis()
            lastSleepMinutes = sleepMinutes
            if (stationName == currentStationName && isPlaying == currentIsPlaying && (now - lastUpdateTime < 1000)) {
                return
            }
            currentStationName = stationName
            currentIsPlaying = isPlaying
            currentPlaybackState = if (isPlaying) RadioAppWidgetProvider.STATE_PLAYING else RadioAppWidgetProvider.STATE_PAUSED
            lastUpdateTime = now

            try {
                RadioAppWidgetProvider.updateWidget(
                    context,
                    stationName,
                    isPlaying,
                    sleepMinutes,
                    playbackState = currentPlaybackState
                )
            } catch (e: Exception) {
                android.util.Log.w("RadioForegroundService", "Widget sync on notification info note: ${e.message}")
            }

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
            currentIsPlaying = false
            currentPlaybackState = RadioAppWidgetProvider.STATE_PAUSED
            try {
                context.stopService(Intent(context, RadioForegroundService::class.java))
            } catch (e: Throwable) {
                android.util.Log.w("RadioForegroundService", "Failed to stop service directly: ${e.message}")
            }
        }
    }
}

