package com.bilingo.radio.player

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class PlaybackState {
    IDLE, BUFFERING, PLAYING, PAUSED, ERROR
}

/**
 * Radio state coordinator.
 * Audio streaming is managed centrally by HTML5 <audio> inside WebView to ensure
 * single-source radio playback and exact subtitle synchronization.
 */
class RadioPlayerManager(private val context: Context) {
    
    private val _playbackState = MutableStateFlow(PlaybackState.IDLE)
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    var currentStreamUrl = ""

    fun setStreamUrl(url: String) {
        currentStreamUrl = url
    }

    fun play() {
        _playbackState.value = PlaybackState.PLAYING
    }

    fun pause() {
        _playbackState.value = PlaybackState.PAUSED
    }

    fun togglePlayPause() {
        if (_playbackState.value == PlaybackState.PLAYING) {
            pause()
        } else {
            play()
        }
    }

    fun release() {
        _playbackState.value = PlaybackState.IDLE
    }
}
