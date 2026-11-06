package com.lenstedreal.nexorawatch.ui.room

import android.view.HapticFeedbackConstants
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.data.OverlayReaction
import com.lenstedreal.nexorawatch.data.Room
import com.lenstedreal.nexorawatch.player.NexoraPlayer
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraError
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlass
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraWarning
import kotlin.math.roundToInt

private val OVERLAY_REACTIONS = listOf("🔥", "❤️", "😂", "👏")

@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(
    room: Room,
    player: NexoraPlayer?,
    isHost: Boolean,
    localVideoName: String?,
    expectedPositionSeconds: Double = 0.0,
    overlayReactions: List<OverlayReaction> = emptyList(),
    hapticEnabled: Boolean = true,
    onToggleHaptic: () -> Unit = {},
    onSendReaction: (String) -> Unit = {},
    onHostPlaybackChanged: (Boolean, Double) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    val roomVideo = room.video
    val hasVideo = roomVideo != null || localVideoName != null
    val view = LocalView.current
    var youtubeError by remember(roomVideo?.url) { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, NexoraGlassBorder, RoundedCornerShape(14.dp))
            .background(Color.Black)
            .testTag("video_player_container")
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .background(Color.Black)
        ) {
            val maxWidthPx = constraints.maxWidth.toFloat().coerceAtLeast(1f)
            val maxHeightPx = constraints.maxHeight.toFloat().coerceAtLeast(1f)

            if (!hasVideo) {
                // Waiting for video placeholder
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.VideoLibrary,
                            contentDescription = null,
                            tint = NexoraMuted,
                            modifier = Modifier.size(42.dp)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = stringResource(R.string.waiting_for_video),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = NexoraOnSurface
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = stringResource(R.string.waiting_for_video_desc),
                            fontSize = 12.sp,
                            color = NexoraMuted,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else if (
                localVideoName == null &&
                roomVideo?.kind == "youtube" &&
                !roomVideo.videoId.isNullOrBlank()
            ) {
                // WebView ONLY for YouTube embedded player
                YouTubePlayer(
                    videoId = roomVideo.videoId,
                    isHost = isHost,
                    expectedPlaying = room.playback.playing,
                    expectedPositionSeconds = expectedPositionSeconds,
                    onHostPlaybackChanged = onHostPlaybackChanged,
                    onPlayerError = { err -> youtubeError = err },
                    modifier = Modifier.fillMaxSize()
                )

                if (!isHost) {
                    // Guest touch interceptor so guests cannot manipulate YouTube playback directly
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Transparent)
                            .clickable(enabled = false) {}
                    )
                }

                if (youtubeError != null) {
                    PersistentVideoErrorOverlay(
                        errorMessage = youtubeError ?: stringResource(R.string.video_error_title),
                        onRetry = { youtubeError = null }
                    )
                }
            } else if (player != null) {
                val playerState by player.state.collectAsState()

                AndroidView(
                    factory = { context ->
                        PlayerView(context).apply {
                            this.player = player.exoPlayer
                            useController = isHost // Only host can scrub/play/pause directly
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    update = { playerView ->
                        playerView.player = player.exoPlayer
                        playerView.useController = isHost
                    },
                    modifier = Modifier.fillMaxSize()
                )

                if (playerState.isBuffering && !playerState.hasError) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.35f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = NexoraBrand,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                // Guest overlay to intercept accidental touches on ExoPlayer
                if (!isHost) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Transparent)
                    )
                }

                // Persistent visible error overlay for broken/invalid video URLs
                if (playerState.hasError) {
                    PersistentVideoErrorOverlay(
                        errorMessage = playerState.errorMessage ?: stringResource(R.string.video_error_title),
                        onRetry = { player.retry() }
                    )
                }
            }

            // Guest Read-Only Visual Badge Overlay (Top-Left of Player)
            if (!isHost) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp)
                        .clip(CircleShape)
                        .background(NexoraGlass)
                        .border(1.dp, NexoraWarning.copy(alpha = 0.5f), CircleShape)
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                        .testTag("player_readonly_badge")
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = stringResource(R.string.guest_read_only_badge),
                        tint = NexoraWarning,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = stringResource(R.string.guest_read_only_badge),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = NexoraWarning,
                        letterSpacing = 0.8.sp
                    )
                }
            }

            // Lightweight Floating Video Overlay Reactions (🔥 ❤️ 😂 👏)
            overlayReactions.forEach { reaction ->
                key(reaction.id) {
                    FloatingReactionItem(
                        reaction = reaction,
                        containerWidthPx = maxWidthPx,
                        containerHeightPx = maxHeightPx
                    )
                }
            }
        }

        // Guest Read-Only Playback Controls Strip
        if (!isHost) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NexoraSurfaceTertiary.copy(alpha = 0.9f))
                    .padding(horizontal = 12.dp, vertical = 7.dp)
                    .testTag("guest_readonly_controls_bar")
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = NexoraBrandSecondary,
                    modifier = Modifier.size(13.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.guest_read_only_controls_notice),
                    fontSize = 11.sp,
                    color = NexoraMuted
                )
            }
        }

        // Video Overlay Reaction Bar (🔥 ❤️ 😂 👏) + Optional Haptic Toggle
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .background(NexoraSurfaceSecondary)
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .testTag("video_reaction_bar")
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OVERLAY_REACTIONS.forEach { emoji ->
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(NexoraSurfaceTertiary)
                            .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                            .clickable {
                                if (hapticEnabled) {
                                    try {
                                        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                                    } catch (_: Exception) {}
                                }
                                onSendReaction(emoji)
                            }
                            .testTag("reaction_btn_$emoji"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = emoji, fontSize = 16.sp)
                    }
                }
            }

            // Optional Haptic Feedback Toggle
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (hapticEnabled) NexoraBrand.copy(alpha = 0.14f) else NexoraSurfaceTertiary
                    )
                    .border(
                        1.dp,
                        if (hapticEnabled) NexoraBrand.copy(alpha = 0.5f) else NexoraBorder,
                        RoundedCornerShape(8.dp)
                    )
                    .clickable { onToggleHaptic() }
                    .padding(horizontal = 10.dp, vertical = 7.dp)
                    .testTag("haptic_toggle_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Vibration,
                    contentDescription = stringResource(R.string.haptic_label),
                    tint = if (hapticEnabled) NexoraBrand else NexoraMuted,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(5.dp))
                Text(
                    text = stringResource(R.string.haptic_label),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (hapticEnabled) NexoraOnSurface else NexoraMuted
                )
            }
        }

        if (localVideoName != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NexoraSurfaceSecondary)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    text = "${stringResource(R.string.playing_on_device)}: $localVideoName",
                    fontSize = 11.sp,
                    color = NexoraMuted
                )
            }
        }
    }
}

@Composable
private fun PersistentVideoErrorOverlay(
    errorMessage: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.86f))
            .padding(20.dp)
            .testTag("video_error_overlay"),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.ErrorOutline,
                contentDescription = null,
                tint = NexoraError,
                modifier = Modifier.size(38.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.video_error_title),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = NexoraOnSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = errorMessage,
                fontSize = 12.sp,
                color = NexoraMuted,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = NexoraBrand,
                    contentColor = NexoraOnBrand
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.testTag("video_retry_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.video_error_retry),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun FloatingReactionItem(
    reaction: OverlayReaction,
    containerWidthPx: Float,
    containerHeightPx: Float
) {
    val progress = remember { Animatable(0f) }

    LaunchedEffect(reaction.id) {
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 1600, easing = LinearOutSlowInEasing)
        )
    }

    val xOffset = (containerWidthPx * reaction.horizontalFraction.coerceIn(0.12f, 0.85f)).roundToInt()
    val yOffset = (containerHeightPx * (0.82f - 0.65f * progress.value)).roundToInt()
    val alpha = (1f - progress.value).coerceIn(0f, 1f)

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .offset { IntOffset(xOffset, yOffset) }
            .alpha(alpha)
    ) {
        Text(
            text = reaction.emoji,
            fontSize = 26.sp
        )
        if (reaction.senderNickname.isNotBlank()) {
            Text(
                text = reaction.senderNickname,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = NexoraOnSurface,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(horizontal = 4.dp, vertical = 1.dp)
            )
        }
    }
}
