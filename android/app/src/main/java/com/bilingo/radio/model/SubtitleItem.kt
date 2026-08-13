package com.bilingo.radio.model

import java.util.UUID

/**
 * Data class representing a bilingual broadcast subtitle item.
 */
data class SubtitleItem(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: String,
    val englishText: String,
    val chineseText: String,
    val isFinal: Boolean = true
)
