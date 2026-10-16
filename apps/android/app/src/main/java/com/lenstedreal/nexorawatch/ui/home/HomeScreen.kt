package com.lenstedreal.nexorawatch.ui.home

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Film
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SmartDisplay
import androidx.compose.material.icons.filled.Sparkles
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.ui.components.NexoraButton
import com.lenstedreal.nexorawatch.ui.components.NexoraTextField
import com.lenstedreal.nexorawatch.ui.components.SourceChip
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraError
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlass
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurfaceTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraOverlay
import com.lenstedreal.nexorawatch.ui.theme.NexoraSuccess
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary
import kotlinx.coroutines.delay

private const val HERO_IMAGE_URL =
    "https://images.unsplash.com/photo-1678247539441-05ad26a18343?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onNavigateToRoom: (roomCode: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()
    val context = LocalContext.current

    LaunchedEffect(uiState.toastMessage) {
        if (uiState.toastMessage != null) {
            delay(2800)
            viewModel.clearToast()
        }
    }

    if (uiState.showWebHintDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.setShowWebHintDialog(false) },
            title = {
                Text(
                    text = "Web Özelliği (BETA)",
                    color = NexoraOnSurface,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = stringResource(R.string.web_beta_hint),
                    color = NexoraOnSurfaceTertiary,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setShowWebHintDialog(false) }) {
                    Text(text = "Anladım", color = NexoraBrand)
                }
            },
            containerColor = NexoraSurfaceSecondary,
            shape = RoundedCornerShape(14.dp)
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(NexoraSurface)
            .testTag("home_screen")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
        ) {
            // Hero section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(390.dp)
            ) {
                AsyncImage(
                    model = HERO_IMAGE_URL,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    NexoraOverlay,
                                    NexoraSurface
                                )
                            )
                        )
                )

                // Top right portfolio badge
                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 16.dp, end = 16.dp)
                        .clip(CircleShape)
                        .background(NexoraSurfaceSecondary.copy(alpha = 0.85f))
                        .border(1.dp, NexoraGlassBorder, CircleShape)
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://link.me/lenstedreal"))
                            context.startActivity(intent)
                        }
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(NexoraBrand, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "LenstedReal",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexoraOnSurface
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "↗",
                        fontSize = 11.sp,
                        color = NexoraMuted
                    )
                }

                // Hero content
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(horizontal = 24.dp, vertical = 12.dp)
                ) {
                    // SENKRON İZLEME Pill
                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(NexoraGlass)
                            .border(1.dp, NexoraGlassBorder, CircleShape)
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = NexoraBrand,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = stringResource(R.string.tagline_sync),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = NexoraBrand,
                            letterSpacing = 1.5.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Nexora Watch 3D Crystal Logo
                    Image(
                        painter = painterResource(id = R.drawable.nexora_logo),
                        contentDescription = "Nexora Watch Logo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .height(60.dp)
                            .clip(RoundedCornerShape(8.dp))
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = stringResource(R.string.hero_title),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = NexoraOnSurface,
                        letterSpacing = (-0.5).sp
                    )

                    Text(
                        text = stringResource(R.string.by_lenstedreal).uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexoraBrandSecondary,
                        letterSpacing = 1.6.sp
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = stringResource(R.string.hero_subtitle),
                        fontSize = 14.sp,
                        color = NexoraOnSurfaceTertiary,
                        lineHeight = 20.sp
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Source Chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        SourceChip(icon = Icons.Default.SmartDisplay, label = "YouTube")
                        SourceChip(icon = Icons.Default.Language, label = "Drive")
                        SourceChip(icon = Icons.Default.Movie, label = "MP4 / M3U8")
                        SourceChip(
                            icon = Icons.Default.Language,
                            label = "Web",
                            isBeta = true,
                            onInfoClick = { viewModel.setShowWebHintDialog(true) }
                        )
                    }
                }
            }

            // Interactive Form Card
            Box(
                modifier = Modifier
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(NexoraSurfaceSecondary)
                    .border(1.dp, NexoraGlassBorder, RoundedCornerShape(16.dp))
                    .padding(20.dp)
            ) {
                Column {
                    // Mode Toggle (Oda Kur / Odaya Katıl)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(NexoraSurfaceTertiary, RoundedCornerShape(10.dp))
                            .padding(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (uiState.mode == HomeMode.CREATE) NexoraBrandTertiary else Color.Transparent
                                )
                                .then(
                                    if (uiState.mode == HomeMode.CREATE) {
                                        Modifier.border(1.dp, NexoraBrandSecondary, RoundedCornerShape(8.dp))
                                    } else Modifier
                                )
                                .clickable { viewModel.setMode(HomeMode.CREATE) }
                                .testTag("mode_create_tab"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = stringResource(R.string.mode_create),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (uiState.mode == HomeMode.CREATE) NexoraOnSurface else NexoraMuted
                            )
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (uiState.mode == HomeMode.JOIN) NexoraBrandTertiary else Color.Transparent
                                )
                                .then(
                                    if (uiState.mode == HomeMode.JOIN) {
                                        Modifier.border(1.dp, NexoraBrandSecondary, RoundedCornerShape(8.dp))
                                    } else Modifier
                                )
                                .clickable { viewModel.setMode(HomeMode.JOIN) }
                                .testTag("mode_join_tab"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = stringResource(R.string.mode_join),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (uiState.mode == HomeMode.JOIN) NexoraOnSurface else NexoraMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Nickname Input
                    NexoraTextField(
                        value = uiState.nickname,
                        onValueChange = { viewModel.setNickname(it) },
                        label = stringResource(R.string.label_nickname),
                        placeholder = stringResource(R.string.placeholder_nickname),
                        maxLength = 24,
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Person,
                                contentDescription = null,
                                tint = NexoraMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        testTag = "nickname_input"
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Create: Room name input | Join: Room code input
                    if (uiState.mode == HomeMode.CREATE) {
                        NexoraTextField(
                            value = uiState.roomName,
                            onValueChange = { viewModel.setRoomName(it) },
                            label = stringResource(R.string.label_room_name),
                            placeholder = stringResource(R.string.placeholder_room_name),
                            maxLength = 48,
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Film,
                                    contentDescription = null,
                                    tint = NexoraMuted,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            testTag = "room_name_input"
                        )
                    } else {
                        NexoraTextField(
                            value = uiState.roomCode,
                            onValueChange = { viewModel.setRoomCode(it) },
                            label = stringResource(R.string.label_room_code),
                            placeholder = stringResource(R.string.placeholder_room_code),
                            maxLength = 6,
                            textStyle = TextStyle(
                                color = NexoraOnSurface,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 6.sp
                            ),
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.VpnKey,
                                    contentDescription = null,
                                    tint = NexoraMuted,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            testTag = "room_code_input"
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Submit Button
                    val canSubmit = uiState.nickname.trim().isNotEmpty() &&
                            (uiState.mode == HomeMode.CREATE || uiState.roomCode.trim().length == 6)

                    NexoraButton(
                        text = if (uiState.mode == HomeMode.CREATE) {
                            stringResource(R.string.button_create_room)
                        } else {
                            stringResource(R.string.button_join_room)
                        },
                        onClick = {
                            viewModel.submit(onSuccess = onNavigateToRoom)
                        },
                        enabled = canSubmit && !uiState.isLoading,
                        loading = uiState.isLoading,
                        testTag = "home_submit_button",
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Sparkles,
                                contentDescription = null,
                                tint = Color.Black,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = stringResource(R.string.room_expiration_notice),
                        fontSize = 12.sp,
                        color = NexoraMuted,
                        lineHeight = 17.sp,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Floating Toast Notification
        if (uiState.toastMessage != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 24.dp, start = 20.dp, end = 20.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(NexoraSurfaceTertiary)
                    .border(
                        1.dp,
                        if (uiState.isToastError) NexoraError else NexoraSuccess,
                        RoundedCornerShape(8.dp)
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = uiState.toastMessage ?: "",
                    color = NexoraOnSurface,
                    fontSize = 14.sp
                )
            }
        }
    }
}
