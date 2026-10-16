package com.lenstedreal.nexorawatch.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class NexoraPlayerState(
    val isPlaying: Boolean = false,
    val positionSeconds: Double = 0.0,
    val durationSeconds: Double = 0.0,
    val isBuffering: Boolean = false,
    val hasError: Boolean = false,
    val errorMessage: String? = null
)

@OptIn(UnstableApi::class)
class NexoraPlayer(
    private val context: Context,
    private val baseUrl: String = "https://nexorawatch-beta.vercel.app"
) {
    val exoPlayer: ExoPlayer = ExoPlayer.Builder(context).build()
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var progressJob: Job? = null

    private val _state = MutableStateFlow(NexoraPlayerState())
    val state: StateFlow<NexoraPlayerState> = _state.asStateFlow()

    private var currentLoadedUrl: String? = null

    var onUserSeek: ((Boolean, Double) -> Unit)? = null
    var onUserPlayPause: ((Boolean, Double) -> Unit)? = null

    init {
        exoPlayer.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateState()
                onUserPlayPause?.invoke(isPlaying, currentPositionSeconds)
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    _state.value = _state.value.copy(
                        hasError = false,
                        errorMessage = null
                    )
                }
                updateState()
            }

            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                updateState()
                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    onUserSeek?.invoke(exoPlayer.isPlaying, newPosition.positionMs.coerceAtLeast(0L) / 1000.0)
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val detail = error.localizedMessage ?: "Video kaynağı yüklenemedi veya desteklenmiyor."
                _state.value = _state.value.copy(
                    isBuffering = false,
                    isPlaying = false,
                    hasError = true,
                    errorMessage = "Oynatma hatası: $detail"
                )
            }
        })

        startProgressLoop()
    }

    private fun startProgressLoop() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                updateState()
                delay(250)
            }
        }
    }

    private fun updateState() {
        val current = _state.value
        val pos = (exoPlayer.currentPosition.coerceAtLeast(0L) / 1000.0)
        val dur = (exoPlayer.duration.coerceAtLeast(0L) / 1000.0)
        // Preserve persistent error state until resolved or retried
        _state.value = current.copy(
            isPlaying = exoPlayer.isPlaying,
            positionSeconds = pos,
            durationSeconds = dur,
            isBuffering = !current.hasError && exoPlayer.playbackState == Player.STATE_BUFFERING
        )
    }

    fun resolveAbsoluteUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (
            trimmed.startsWith("http://") ||
            trimmed.startsWith("https://") ||
            trimmed.startsWith("content://") ||
            trimmed.startsWith("file://")
        ) {
            return trimmed
        }
        val cleanBase = baseUrl.trimEnd('/')
        val cleanPath = if (trimmed.startsWith('/')) trimmed else "/$trimmed"
        return "$cleanBase$cleanPath"
    }

    fun setSource(rawUrl: String, forceReload: Boolean = false) {
        val absoluteUrl = resolveAbsoluteUrl(rawUrl)
        if (!forceReload && currentLoadedUrl == absoluteUrl && !_state.value.hasError) return
        currentLoadedUrl = absoluteUrl

        _state.value = _state.value.copy(
            hasError = false,
            errorMessage = null,
            isBuffering = true
        )

        if (! (absoluteUrl.startsWith("http://") ||
                    absoluteUrl.startsWith("https://") ||
                    absoluteUrl.startsWith("content://") ||
                    absoluteUrl.startsWith("file://"))
        ) {
            _state.value = _state.value.copy(
                isBuffering = false,
                hasError = true,
                errorMessage = "Geçersiz video bağlantısı."
            )
            return
        }

        val isHls = absoluteUrl.contains(".m3u8", ignoreCase = true)

        val mediaItemBuilder = MediaItem.Builder().setUri(absoluteUrl)
        if (isHls) {
            mediaItemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8)
        }

        val mediaItem = mediaItemBuilder.build()
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
    }

    fun retry() {
        val url = currentLoadedUrl ?: return
        setSource(url, forceReload = true)
    }

    fun clearSource() {
        currentLoadedUrl = null
        exoPlayer.stop()
        exoPlayer.clearMediaItems()
        _state.value = NexoraPlayerState()
    }

    fun play() {
        exoPlayer.play()
        updateState()
    }

    fun pause() {
        exoPlayer.pause()
        updateState()
    }

    fun seekTo(seconds: Double) {
        val ms = (seconds.coerceAtLeast(0.0) * 1000).toLong()
        exoPlayer.seekTo(ms)
        updateState()
    }

    val currentPositionSeconds: Double
        get() = exoPlayer.currentPosition.coerceAtLeast(0L) / 1000.0

    val isPlaying: Boolean
        get() = exoPlayer.isPlaying

    fun release() {
        progressJob?.cancel()
        exoPlayer.release()
    }
}
