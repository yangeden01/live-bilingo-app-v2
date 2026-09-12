package com.bilingo.radio.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.bilingo.radio.model.SubtitleItem
import com.bilingo.radio.player.PlaybackState
import com.bilingo.radio.player.RadioPlayerManager
import com.bilingo.radio.stt.DeepgramWebSocketClient
import com.bilingo.radio.translation.GeminiTranslationRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RadioSubtitleViewModel(application: Application) : AndroidViewModel(application) {

    private val playerManager = RadioPlayerManager(application)
    private val deepgramClient = DeepgramWebSocketClient()
    private val translationRepo = GeminiTranslationRepository()

    val playbackState: StateFlow<PlaybackState> = playerManager.playbackState

    private val _subtitleList = MutableStateFlow<List<SubtitleItem>>(emptyList())
    val subtitleList: StateFlow<List<SubtitleItem>> = _subtitleList.asStateFlow()

    private val _isSttConnected = MutableStateFlow(false)
    val isSttConnected: StateFlow<Boolean> = _isSttConnected.asStateFlow()

    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    init {
        viewModelScope.launch {
            deepgramClient.connectionState.collect { connected ->
                _isSttConnected.value = connected
            }
        }

        viewModelScope.launch {
            deepgramClient.transcriptFlow.collect { englishText ->
                processIncomingTranscript(englishText)
            }
        }
    }

    fun togglePlayPause() {
        if (playbackState.value == PlaybackState.PLAYING) {
            playerManager.pause()
            deepgramClient.disconnect()
        } else {
            playerManager.play()
            deepgramClient.connect()
        }
    }

    private fun processIncomingTranscript(englishText: String) {
        viewModelScope.launch {
            val chineseTranslation = translationRepo.translateToTraditionalChinese(englishText)
            val newItem = SubtitleItem(
                timestamp = timeFormat.format(Date()),
                englishText = englishText,
                chineseText = chineseTranslation,
                isFinal = true
            )
            _subtitleList.value = listOf(newItem) + _subtitleList.value
        }
    }

    override fun onCleared() {
        super.onCleared()
        playerManager.release()
        deepgramClient.disconnect()
    }
}
