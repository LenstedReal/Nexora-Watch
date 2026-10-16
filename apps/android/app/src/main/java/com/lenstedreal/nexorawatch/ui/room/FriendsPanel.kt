package com.lenstedreal.nexorawatch.ui.room

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
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
import com.lenstedreal.nexorawatch.data.FriendItem
import com.lenstedreal.nexorawatch.data.FriendState
import com.lenstedreal.nexorawatch.data.InviteState
import com.lenstedreal.nexorawatch.data.RoomInvite
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSuccess
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraWarning

@Composable
fun FriendsPanel(
    friends: List<FriendItem>,
    invites: List<RoomInvite>,
    currentRoomCode: String,
    onAddFriend: (String) -> Unit,
    onRemoveFriend: (String) -> Unit,
    onSendRoomInvite: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var friendInput by remember { mutableStateOf("") }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, NexoraGlassBorder, RoundedCornerShape(14.dp))
            .background(NexoraSurfaceSecondary)
            .padding(16.dp)
            .testTag("friends_panel")
    ) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = null,
                    tint = NexoraBrandSecondary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.friends_title),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraOnSurface
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${friends.size}",
                    fontSize = 12.sp,
                    color = NexoraMuted
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(R.string.friends_optional_hint),
                fontSize = 11.sp,
                color = NexoraMuted
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Add friend row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(NexoraSurfaceTertiary)
                        .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    if (friendInput.isEmpty()) {
                        Text(
                            text = "Arkadaş rumuzu ekle...",
                            fontSize = 12.sp,
                            color = NexoraMuted
                        )
                    }
                    BasicTextField(
                        value = friendInput,
                        onValueChange = { if (it.length <= 24) friendInput = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("friend_nickname_input"),
                        textStyle = TextStyle(
                            color = NexoraOnSurface,
                            fontSize = 12.sp
                        ),
                        cursorBrush = SolidColor(NexoraBrand),
                        singleLine = true
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Box(
                    modifier = Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (friendInput.trim().isNotEmpty()) NexoraBrand else NexoraBrand.copy(alpha = 0.4f)
                        )
                        .clickable(enabled = friendInput.trim().isNotEmpty()) {
                            onAddFriend(friendInput.trim())
                            friendInput = ""
                        }
                        .padding(horizontal = 12.dp)
                        .testTag("add_friend_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Ekle",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = NexoraOnBrand
                    )
                }
            }

            if (friends.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    friends.forEach { friend ->
                        val roomInvite = invites.firstOrNull {
                            it.toNickname.equals(friend.nickname, ignoreCase = true) &&
                                    it.roomCode.equals(currentRoomCode, ignoreCase = true)
                        }
                        val stateColor = when (friend.state) {
                            FriendState.ONLINE -> NexoraSuccess
                            FriendState.IN_ROOM -> NexoraBrandSecondary
                            FriendState.PENDING -> NexoraWarning
                            FriendState.OFFLINE -> NexoraMuted
                        }
                        val stateLabel = when (friend.state) {
                            FriendState.ONLINE -> "Çevrimiçi"
                            FriendState.IN_ROOM -> "Odada"
                            FriendState.PENDING -> "İstek bekliyor"
                            FriendState.OFFLINE -> "Çevrimdışı"
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(NexoraSurfaceTertiary)
                                .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(stateColor, CircleShape)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = friend.nickname,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NexoraOnSurface
                                )
                                Text(
                                    text = stateLabel,
                                    fontSize = 10.sp,
                                    color = NexoraMuted
                                )
                            }

                            if (roomInvite != null) {
                                val inviteText = when (roomInvite.state) {
                                    InviteState.SENT -> "Davet gönderildi"
                                    InviteState.ACCEPTED -> "Katıldı"
                                    InviteState.PENDING -> "Bekliyor"
                                    InviteState.DECLINED -> "Reddedildi"
                                }
                                Text(
                                    text = inviteText,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NexoraBrandSecondary,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                            } else {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .border(1.dp, NexoraBrand.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                                        .clickable { onSendRoomInvite(friend.nickname) }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Send,
                                        contentDescription = "Davet Et",
                                        tint = NexoraBrand,
                                        modifier = Modifier.size(11.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Davet Et",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = NexoraBrand
                                    )
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                            }

                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Arkadaşı Kaldır",
                                tint = NexoraMuted,
                                modifier = Modifier
                                    .size(15.dp)
                                    .clickable { onRemoveFriend(friend.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
