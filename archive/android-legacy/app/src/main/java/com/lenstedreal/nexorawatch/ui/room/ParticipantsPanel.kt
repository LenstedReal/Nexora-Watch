package com.lenstedreal.nexorawatch.ui.room

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.PersonAddAlt1
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.data.Participant
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSuccess
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ParticipantsPanel(
    participants: List<Participant>,
    myParticipantId: String? = null,
    onAddFriendFromParticipant: ((Participant) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, NexoraGlassBorder, RoundedCornerShape(14.dp))
            .background(NexoraSurfaceSecondary)
            .padding(16.dp)
            .testTag("participants_panel")
    ) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Group,
                    contentDescription = null,
                    tint = NexoraBrandSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.participants_title),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraOnSurface
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${participants.size}",
                    fontSize = 12.sp,
                    color = NexoraMuted
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                participants.forEach { participant ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(NexoraSurfaceTertiary)
                            .border(1.dp, NexoraBorder, RoundedCornerShape(999.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .background(
                                    color = if (participant.online) NexoraSuccess else NexoraMuted,
                                    shape = CircleShape
                                )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = participant.nickname,
                            fontSize = 12.sp,
                            color = NexoraOnSurface
                        )
                        if (participant.isHost) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = stringResource(R.string.host_badge),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = NexoraBrandSecondary
                            )
                        } else {
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "İZLEYİCİ",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexoraMuted
                            )
                        }
                        if (onAddFriendFromParticipant != null && participant.id != myParticipantId) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.PersonAddAlt1,
                                contentDescription = "Arkadaş Ekle",
                                tint = NexoraBrandSecondary,
                                modifier = Modifier
                                    .size(13.dp)
                                    .clickable { onAddFriendFromParticipant(participant) }
                            )
                        }
                    }
                }
            }
        }
    }
}
