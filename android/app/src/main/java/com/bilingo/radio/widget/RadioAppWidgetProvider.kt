package com.bilingo.radio.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import com.bilingo.radio.MainActivity
import com.bilingo.radio.R
import com.bilingo.radio.service.RadioForegroundService

/**
 * Android Home Screen App Widget Provider for Live Bilingo Radio Mode.
 * Controls Play/Pause, Station Switching (Prev / Next), and Sleep Timer cycling.
 * Supports background execution without auto-launching MainActivity.
 */
class RadioAppWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val stationName = prefs.getString(KEY_STATION_NAME, "美西公共時事談話") ?: "美西公共時事談話"
        val isPlaying = prefs.getBoolean(KEY_IS_PLAYING, false)
        val sleepMinutes = prefs.getInt(KEY_SLEEP_MINUTES, 0)
        val playbackState = prefs.getString(KEY_PLAYBACK_STATE, if (isPlaying) STATE_PLAYING else STATE_PAUSED) ?: (if (isPlaying) STATE_PLAYING else STATE_PAUSED)

        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, stationName, isPlaying, sleepMinutes, playbackState)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        val action = intent.action ?: return
        when (action) {
            ACTION_WIDGET_TOGGLE_PLAY -> {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val currentPlaying = prefs.getBoolean(KEY_IS_PLAYING, false) ||
                    (RadioForegroundService.currentIsPlaying && RadioForegroundService.currentStationName.isNotBlank())
                val stationName = prefs.getString(KEY_STATION_NAME, "美東北公共英語新聞") ?: "美東北公共英語新聞"
                val sleepMinutes = prefs.getInt(KEY_SLEEP_MINUTES, 0)

                if (!currentPlaying) {
                    // Immediate visual feedback: show searching/buffering on the widget
                    updateWidget(context, stationName, true, sleepMinutes, playbackState = STATE_BUFFERING)
                } else {
                    updateWidget(context, stationName, false, sleepMinutes, playbackState = STATE_PAUSED)
                }
                sendMediaAction(context, RadioForegroundService.ACTION_TOGGLE_PLAY)
            }
            ACTION_WIDGET_PREV_STATION -> {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val stationName = prefs.getString(KEY_STATION_NAME, "美東北公共英語新聞") ?: "美東北公共英語新聞"
                val sleepMinutes = prefs.getInt(KEY_SLEEP_MINUTES, 0)
                updateWidget(context, stationName, true, sleepMinutes, playbackState = STATE_BUFFERING)
                sendMediaAction(context, RadioForegroundService.ACTION_PREV_STATION)
            }
            ACTION_WIDGET_NEXT_STATION -> {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val stationName = prefs.getString(KEY_STATION_NAME, "美東北公共英語新聞") ?: "美東北公共英語新聞"
                val sleepMinutes = prefs.getInt(KEY_SLEEP_MINUTES, 0)
                updateWidget(context, stationName, true, sleepMinutes, playbackState = STATE_BUFFERING)
                sendMediaAction(context, RadioForegroundService.ACTION_NEXT_STATION)
            }
            ACTION_WIDGET_SLEEP_TIMER -> {
                // Minimum unit is 1 hour, maximum 5 hours: 0 -> 1h (60m) -> 2h (120m) -> 3h (180m) -> 4h (240m) -> 5h (300m) -> 0
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val currentMins = prefs.getInt(KEY_SLEEP_MINUTES, 0)
                val steps = intArrayOf(0, 60, 120, 180, 240, 300)
                val currentIdx = steps.indexOf(currentMins)
                val nextMins = if (currentIdx >= 0) steps[(currentIdx + 1) % steps.size] else 60
                val stationName = prefs.getString(KEY_STATION_NAME, "美東北公共英語新聞") ?: "美東北公共英語新聞"
                val isPlaying = prefs.getBoolean(KEY_IS_PLAYING, false)
                val playbackState = prefs.getString(KEY_PLAYBACK_STATE, if (isPlaying) STATE_PLAYING else STATE_PAUSED)
                updateWidget(context, stationName, isPlaying, nextMins, playbackState = playbackState)
                sendMediaAction(context, RadioForegroundService.ACTION_SLEEP_TIMER)
            }
        }
    }

    private fun sendMediaAction(context: Context, serviceAction: String) {
        try {
            val mainActivity = MainActivity.currentInstance
            val isAppAlive = mainActivity?.activeWebView != null

            if (isAppAlive && mainActivity != null) {
                // 1. App is alive in foreground or background: directly dispatch to MainActivity's WebView!
                mainActivity.dispatchMediaControl(serviceAction)
                // Ensure native ExoPlayer is never running when WebView is managing audio
                RadioForegroundService.stopNativePlayer()
            } else {
                // 2. Cold started (app killed or not started): run directly via RadioForegroundService native ExoPlayer
                // DO NOT launch MainActivity (keeps app in background, 0 ASR usage, no popups)
                val serviceIntent = Intent(context, RadioForegroundService::class.java).apply {
                    action = serviceAction
                    putExtra(RadioForegroundService.EXTRA_FROM_WIDGET, true)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to send widget media action: $serviceAction", e)
        }
    }

    companion object {
        private const val TAG = "RadioAppWidget"
        const val PREFS_NAME = "bilingo_widget_prefs"
        const val KEY_STATION_NAME = "widget_station_name"
        const val KEY_STREAM_URL = "widget_stream_url"
        const val KEY_IS_PLAYING = "widget_is_playing"
        const val KEY_SLEEP_MINUTES = "widget_sleep_minutes"
        const val KEY_PLAYBACK_STATE = "widget_playback_state"

        const val STATE_BUFFERING = "BUFFERING"
        const val STATE_PLAYING = "PLAYING"
        const val STATE_PAUSED = "PAUSED"
        const val STATE_ERROR = "ERROR"

        const val ACTION_WIDGET_TOGGLE_PLAY = "com.bilingo.radio.widget.ACTION_TOGGLE_PLAY"
        const val ACTION_WIDGET_PREV_STATION = "com.bilingo.radio.widget.ACTION_PREV_STATION"
        const val ACTION_WIDGET_NEXT_STATION = "com.bilingo.radio.widget.ACTION_NEXT_STATION"
        const val ACTION_WIDGET_SLEEP_TIMER = "com.bilingo.radio.widget.ACTION_SLEEP_TIMER"

        fun updateWidget(
            context: Context,
            stationName: String,
            isPlaying: Boolean,
            sleepMinutes: Int = 0,
            playbackState: String? = null
        ) {
            try {
                val stateToSave = playbackState ?: if (isPlaying) STATE_PLAYING else STATE_PAUSED

                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                    .putString(KEY_STATION_NAME, stationName)
                    .putBoolean(KEY_IS_PLAYING, isPlaying)
                    .putInt(KEY_SLEEP_MINUTES, sleepMinutes)
                    .putString(KEY_PLAYBACK_STATE, stateToSave)
                    .apply()

                val appWidgetManager = AppWidgetManager.getInstance(context)
                val componentName = ComponentName(context, RadioAppWidgetProvider::class.java)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

                for (id in appWidgetIds) {
                    updateAppWidget(context, appWidgetManager, id, stationName, isPlaying, sleepMinutes, stateToSave)
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error updating radio widget", e)
            }
        }

        private fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            stationName: String,
            isPlaying: Boolean,
            sleepMinutes: Int,
            playbackState: String? = null
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_radio_control)

            // 1. Station Name
            val displayStation = if (stationName.isNotBlank()) stationName else "美西公共時事談話"
            views.setTextViewText(R.id.widget_station_name, displayStation)

            // 2. Playback Status Text, Color, and Play/Pause Button Icon
            val effectiveState = playbackState ?: if (isPlaying) STATE_PLAYING else STATE_PAUSED
            val (statusText, textColor, playPauseIcon) = when (effectiveState) {
                STATE_BUFFERING, "SEARCHING" -> Triple(
                    "🔄 正在搜尋電台...",
                    Color.parseColor("#38BDF8"),
                    R.drawable.ic_widget_pause
                )
                STATE_PLAYING -> Triple(
                    "🟢 即時廣播播放中",
                    Color.parseColor("#34D399"),
                    R.drawable.ic_widget_pause
                )
                STATE_ERROR, "CANNOT_PLAY" -> Triple(
                    "⚠️ 無法播放電台，請檢查網路",
                    Color.parseColor("#F87171"),
                    R.drawable.ic_widget_play
                )
                STATE_PAUSED -> Triple(
                    "⏸ 廣播已暫停",
                    Color.parseColor("#94A3B8"),
                    R.drawable.ic_widget_play
                )
                else -> if (isPlaying) {
                    Triple(
                        "🟢 即時廣播播放中",
                        Color.parseColor("#34D399"),
                        R.drawable.ic_widget_pause
                    )
                } else {
                    Triple(
                        "⏸ 廣播已暫停",
                        Color.parseColor("#94A3B8"),
                        R.drawable.ic_widget_play
                    )
                }
            }

            views.setTextViewText(R.id.widget_status_text, statusText)
            views.setTextColor(R.id.widget_status_text, textColor)
            views.setImageViewResource(R.id.widget_btn_play_pause, playPauseIcon)

            // 3. Sleep Timer Badge
            val timerText = if (sleepMinutes > 0) {
                val hours = sleepMinutes / 60
                val mins = sleepMinutes % 60
                if (hours > 0 && mins == 0) {
                    "🌙 定時 ${hours}小時"
                } else if (hours > 0) {
                    "🌙 定時 ${hours}時${mins}分"
                } else {
                    "🌙 定時 ${sleepMinutes}分"
                }
            } else {
                "定時：未設定"
            }
            views.setTextViewText(R.id.widget_timer_badge, timerText)

            // 4. Intent to open App on Header or Station click
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val launchPendingIntent = PendingIntent.getActivity(context, 0, launchIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_header_container, launchPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_station_container, launchPendingIntent)

            // 5. Play / Pause Action
            val togglePlayIntent = Intent(context, RadioAppWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_TOGGLE_PLAY
            }
            val togglePlayPendingIntent = PendingIntent.getBroadcast(context, 1, togglePlayIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_btn_play_pause, togglePlayPendingIntent)

            // 6. Previous Station Action
            val prevIntent = Intent(context, RadioAppWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_PREV_STATION
            }
            val prevPendingIntent = PendingIntent.getBroadcast(context, 2, prevIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPendingIntent)

            // 7. Next Station Action
            val nextIntent = Intent(context, RadioAppWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_NEXT_STATION
            }
            val nextPendingIntent = PendingIntent.getBroadcast(context, 3, nextIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_btn_next, nextPendingIntent)

            // 8. Sleep Timer Action
            val timerIntent = Intent(context, RadioAppWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_SLEEP_TIMER
            }
            val timerPendingIntent = PendingIntent.getBroadcast(context, 4, timerIntent, flags)
            views.setOnClickPendingIntent(R.id.widget_btn_timer, timerPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

