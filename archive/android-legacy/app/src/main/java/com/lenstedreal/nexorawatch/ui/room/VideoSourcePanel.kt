package com.lenstedreal.nexorawatch.ui.room

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraError
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraWarning

@Composable
fun VideoSourcePanel(
    isHost: Boolean,
    currentVideoUrl: String,
    onSetVideoUrl: (String) -> Unit,
    onSelectLocalVideoUri: (Uri) -> Unit,
    onCancelUpload: () -> Unit = {},
    localVideoName: String?,
    onRemoveLocalVideo: () -> Unit,
    isUploading: Boolean,
    uploadProgress: Int,
    modifier: Modifier = Modifier
) {
    if (!isHost) {
        // Guest Read-Only Mode Visual Indicator Card
        Box(
            modifier = modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .border(1.dp, NexoraBorder, RoundedCornerShape(14.dp))
                .background(NexoraSurfaceSecondary)
                .padding(horizontal = 16.dp, vertical = 14.dp)
                .testTag("guest_readonly_indicator")
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = stringResource(R.string.guest_read_only_badge),
                    tint = NexoraWarning,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.host_only_notice),
                    fontSize = 12.sp,
                    color = NexoraMuted,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.guest_read_only_badge),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraWarning
                )
            }
        }
        return
    }

    var inputUrl by remember(currentVideoUrl) { mutableStateOf(currentVideoUrl) }

    val videoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            onSelectLocalVideoUri(uri)
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, NexoraGlassBorder, RoundedCornerShape(14.dp))
            .background(NexoraSurfaceSecondary)
            .padding(16.dp)
            .testTag("video_source_panel")
    ) {
        Column {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = null,
                    tint = NexoraBrand,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.video_source),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraOnSurface
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = stringResource(R.string.host_badge),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraBrandSecondary
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // URL Input Row + Ayarla button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(46.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(NexoraSurfaceTertiary)
                        .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    if (inputUrl.isEmpty()) {
                        Text(
                            text = "YouTube · Drive · MP4 · M3U8",
                            fontSize = 13.sp,
                            color = NexoraMuted
                        )
                    }

                    BasicTextField(
                        value = inputUrl,
                        onValueChange = { inputUrl = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("video_url_input"),
                        textStyle = TextStyle(
                            color = NexoraOnSurface,
                            fontSize = 13.sp
                        ),
                        cursorBrush = SolidColor(NexoraBrand),
                        singleLine = true
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = {
                        if (inputUrl.isNotBlank()) {
                            onSetVideoUrl(inputUrl.trim())
                        }
                    },
                    modifier = Modifier
                        .height(46.dp)
                        .testTag("set_video_button"),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NexoraBrand,
                        contentColor = NexoraOnBrand
                    ),
                    enabled = inputUrl.isNotBlank() && !isUploading
                ) {
                    Text(
                        text = stringResource(R.string.set_source),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Local Video File Picker Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(NexoraSurfaceTertiary.copy(alpha = 0.6f))
                    .border(1.dp, NexoraBrand.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .clickable(enabled = !isUploading) { videoPickerLauncher.launch("video/*") }
                    .padding(12.dp)
                    .testTag("local_video_picker")
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(NexoraBrand.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Upload,
                            contentDescription = null,
                            tint = NexoraBrand,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.select_local_video),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = NexoraOnSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = stringResource(R.string.local_video_hint),
                            fontSize = 11.sp,
                            color = NexoraMuted
                        )

                        if (isUploading) {
                            Spacer(modifier = Modifier.height(6.dp))
                            LinearProgressIndicator(
                                progress = { uploadProgress / 100f },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                                color = NexoraBrand,
                                trackColor = NexoraSurfaceTertiary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = stringResource(R.string.uploading_progress, uploadProgress),
                                fontSize = 11.sp,
                                color = NexoraBrandSecondary
                            )
                        } else if (localVideoName != null) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "${stringResource(R.string.selected_prefix)}$localVideoName",
                                fontSize = 11.sp,
                                color = NexoraBrandSecondary,
                                maxLines = 1
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    if (isUploading) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .border(1.dp, NexoraError.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                                .clickable { onCancelUpload() }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                .testTag("cancel_upload_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = stringResource(R.string.cancel_upload),
                                tint = NexoraError,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = stringResource(R.string.cancel_upload),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexoraError
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .border(1.dp, NexoraBorder, RoundedCornerShape(6.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "Seç",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexoraMuted
                            )
                        }
                    }
                }
            }

            // Local video active indicator with Remove action
            if (localVideoName != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(NexoraSurfaceTertiary)
                        .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = localVideoName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = NexoraOnSurface,
                            maxLines = 1
                        )
                        Text(
                            text = stringResource(R.string.playing_on_device),
                            fontSize = 10.sp,
                            color = NexoraMuted
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .border(1.dp, NexoraBorder, RoundedCornerShape(6.dp))
                            .clickable(onClick = onRemoveLocalVideo)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.remove_action),
                            fontSize = 11.sp,
                            color = NexoraMuted
                        )
                    }
                }
            }
        }
    }
}
