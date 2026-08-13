package com.bilingo.radio.stt

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Deepgram WebSocket Client for real-time speech-to-text.
 * Connects to wss://api.deepgram.com/v1/listen with Token Authorization.
 */
class DeepgramWebSocketClient(
    private val apiKey: String = "26c44e288a84756af4f80d41436af0bf7cc10715"
) {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    
    private val _transcriptFlow = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val transcriptFlow: SharedFlow<String> = _transcriptFlow.asSharedFlow()

    private val _connectionState = MutableSharedFlow<Boolean>(extraBufferCapacity = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState.asSharedFlow()

    fun connect() {
        try {
            val wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true"
            
            val request = Request.Builder()
                .url(wsUrl)
                .addHeader("Authorization", "Token $apiKey")
                .build()

            webSocket = client.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    _connectionState.tryEmit(true)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    try {
                        val json = JSONObject(text)
                        val isFinal = json.optBoolean("is_final", false)
                        if (isFinal) {
                            val channel = json.optJSONObject("channel")
                            val alternatives = channel?.optJSONArray("alternatives")
                            if (alternatives != null && alternatives.length() > 0) {
                                val transcript = alternatives.getJSONObject(0).optString("transcript", "").trim()
                                if (transcript.isNotEmpty()) {
                                    _transcriptFlow.tryEmit(transcript)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    _connectionState.tryEmit(false)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    _connectionState.tryEmit(false)
                }
            })
        } catch (e: Exception) {
            _connectionState.tryEmit(false)
        }
    }

    fun sendAudioBytes(bytes: ByteArray) {
        webSocket?.send(ByteString.of(*bytes))
    }

    fun disconnect() {
        webSocket?.close(1000, "User stopped stream")
        webSocket = null
        _connectionState.tryEmit(false)
    }
}
