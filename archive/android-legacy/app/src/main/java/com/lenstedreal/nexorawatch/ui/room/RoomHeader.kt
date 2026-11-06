package com.lenstedreal.nexorawatch.ui.room

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.data.Room
import com.lenstedreal.nexorawatch.realtime.ConnectionStatus
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraError
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSuccess
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraWarning

@Composable
fun RoomHeader(
    room: Room,
    connectionStatus: ConnectionStatus,
    onBackClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onNotice: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    val statusColor = when (connectionStatus) {
        ConnectionStatus.CONNECTED -> NexoraSuccess
        ConnectionStatus.RECONNECTING -> NexoraWarning
        ConnectionStatus.DISCONNECTED, ConnectionStatus.FAILED, ConnectionStatus.ROOM_GONE -> NexoraError
    }

    val statusText = when (connectionStatus) {
        ConnectionStatus.CONNECTED -> stringResource(R.string.realtime_status_connected) // "Bağlı"
        ConnectionStatus.RECONNECTING -> stringResource(R.string.realtime_status_connecting) // "Yeniden bağlanıyor"
        ConnectionStatus.DISCONNECTED, ConnectionStatus.FAILED, ConnectionStatus.ROOM_GONE -> stringResource(R.string.realtime_status_disconnected) // "Bağlantı yok"
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 64.dp)
            .background(NexoraSurfaceSecondary)
            .border(width = 1.dp, color = NexoraBorder)
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .testTag("room_header"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onBackClick,
            modifier = Modifier.testTag("room_back_button")
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Ana sayfa",
                tint = NexoraMuted,
                modifier = Modifier.size(20.dp)
            )
        }

        Spacer(modifier = Modifier.width(4.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = room.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = NexoraOnSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Nexora Room Code", room.code))
                        onNotice("Oda kodu kopyalandı.")
                    }
                    .padding(vertical = 2.dp)
                    .testTag("copy_room_code_button")
            ) {
                Text(
                    text = room.code,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NexoraBrandSecondary
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.ContentCopy,
                    contentDescription = "Kodu Kopyala",
                    tint = NexoraBrandSecondary,
                    modifier = Modifier.size(11.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Phase 6H: Visible room connection indicator ("Bağlı" / "Yeniden bağlanıyor" / "Bağlantı yok")
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .padding(end = 8.dp)
                .testTag("connection_status_indicator")
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(
                        color = statusColor,
                        shape = CircleShape
                    )
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = statusText,
                fontSize = 11.sp,
                color = NexoraMuted
            )
        }

        // Leave button
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                .clickable(onClick = onLeaveClick)
                .padding(horizontal = 10.dp, vertical = 7.dp)
                .testTag("leave_room_button")
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Logout,
                contentDescription = null,
                tint = NexoraMuted,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = stringResource(R.string.leave_room),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = NexoraMuted
            )
        }
    }
}
