package com.bilingo.radio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.bilingo.radio.service.RadioForegroundService
import com.bilingo.radio.ui.screens.MainScreen
import com.bilingo.radio.ui.theme.LiveBilingoRadioTheme
import com.bilingo.radio.viewmodel.RadioSubtitleViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: RadioSubtitleViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            enableEdgeToEdge(
                statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
                navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        setContent {
            LiveBilingoRadioTheme {
                MainScreen(viewModel = viewModel)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isFinishing) {
            try {
                RadioForegroundService.stopService(this)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}

