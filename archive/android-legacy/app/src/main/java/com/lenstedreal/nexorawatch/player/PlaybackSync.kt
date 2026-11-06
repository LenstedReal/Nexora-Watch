package com.lenstedreal.nexorawatch.player

import com.lenstedreal.nexorawatch.data.Playback
import kotlin.math.abs
import kotlin.math.max

object PlaybackSync {
    const val DRIFT_TOLERANCE_SECONDS = 2.0
    const val NORMAL_POLL_INTERVAL_MS = 1000L
    const val RELAXED_POLL_INTERVAL_MS = 3000L
    const val HEARTBEAT_INTERVAL_MS = 5000L
    const val OFFSET_UPDATE_THRESHOLD_MS = 150L
    const val REMOTE_SYNC_GUARD_WINDOW_MS = 500L
    const val PLAYBACK_DEBOUNCE_MS = 300L

    fun calculateExpectedPosition(
        playback: Playback,
        serverOffset: Long,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): Double {
        if (!playback.playing) return max(0.0, playback.position)
        if (playback.updatedAt <= 0L) return max(0.0, playback.position)
        val elapsedSeconds = max(
            0.0,
            (currentTimeMillis + serverOffset - playback.updatedAt) / 1000.0
        )
        return max(0.0, playback.position + elapsedSeconds)
    }

    fun isDriftExceeded(currentSeconds: Double, expectedSeconds: Double): Boolean {
        return abs(currentSeconds - expectedSeconds) > DRIFT_TOLERANCE_SECONDS
    }

    fun shouldUpdateServerOffset(
        currentOffset: Long,
        nextOffset: Long,
        hasInitialOffset: Boolean
    ): Boolean {
        return !hasInitialOffset || abs(nextOffset - currentOffset) > OFFSET_UPDATE_THRESHOLD_MS
    }
}
