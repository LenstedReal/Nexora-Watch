package com.lenstedreal.nexorawatch.ui.room

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.R
import com.lenstedreal.nexorawatch.data.Message
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraGlassBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary

private val QUICK_EMOJIS = listOf(
    "😀", "😂", "❤️", "🔥", "👍", "😎", "😭", "😡", "👀", "🎉", "💀", "🤣"
)

@Composable
fun ChatPanel(
    messages: List<Message>,
    myParticipantId: String?,
    myNickname: String,
    onSendMessage: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, NexoraGlassBorder, RoundedCornerShape(14.dp))
            .background(NexoraSurfaceSecondary)
            .testTag("chat_panel")
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NexoraSurfaceSecondary)
                    .padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ChatBubbleOutline,
                    contentDescription = null,
                    tint = NexoraBrand,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.chat_title),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexoraOnSurface
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${messages.size}",
                    fontSize = 12.sp,
                    color = NexoraMuted
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(NexoraBorder)
            )

            // Message List
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 180.dp, max = 320.dp)
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                if (messages.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.no_messages),
                            fontSize = 12.sp,
                            color = NexoraMuted,
                            textAlign = TextAlign.Center,
                            lineHeight = 18.sp
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages, key = { it.key }) { msg ->
                            val isMe = msg.participantId == myParticipantId

                            if (msg.kind == "system") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = msg.text,
                                        fontSize = 11.sp,
                                        color = NexoraMuted,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            } else {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
                                ) {
                                    Text(
                                        text = msg.nickname,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (isMe) NexoraBrand else NexoraBrandSecondary,
                                        modifier = Modifier.padding(bottom = 2.dp, start = 4.dp, end = 4.dp)
                                    )
                                    Box(
                                        modifier = Modifier
                                            .clip(
                                                RoundedCornerShape(
                                                    topStart = 10.dp,
                                                    topEnd = 10.dp,
                                                    bottomStart = if (isMe) 10.dp else 2.dp,
                                                    bottomEnd = if (isMe) 2.dp else 10.dp
                                                )
                                            )
                                            .background(
                                                if (isMe) NexoraSurfaceTertiary
                                                else NexoraSurfaceTertiary.copy(alpha = 0.6f)
                                            )
                                            .border(
                                                1.dp,
                                                if (isMe) NexoraBrand.copy(alpha = 0.3f) else NexoraBorder,
                                                RoundedCornerShape(10.dp)
                                            )
                                            .padding(horizontal = 12.dp, vertical = 8.dp)
                                    ) {
                                        Text(
                                            text = msg.text,
                                            fontSize = 13.sp,
                                            color = NexoraOnSurfaceSecondary,
                                            lineHeight = 18.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(NexoraBorder)
            )

            // Emoji Reaction Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                QUICK_EMOJIS.take(8).forEach { emoji ->
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(NexoraSurfaceTertiary)
                            .border(1.dp, NexoraBorder, RoundedCornerShape(6.dp))
                            .clickable {
                                inputText += emoji
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = emoji, fontSize = 14.sp)
                    }
                }
            }

            // Chat Input Box
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 12.dp, end = 12.dp, bottom = 12.dp, top = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 44.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(NexoraSurfaceTertiary)
                        .border(1.dp, NexoraBorder, RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    if (inputText.isEmpty()) {
                        val placeholder = if (myNickname.isNotBlank()) {
                            stringResource(R.string.chat_placeholder, myNickname)
                        } else {
                            stringResource(R.string.chat_placeholder_empty)
                        }
                        Text(
                            text = placeholder,
                            fontSize = 13.sp,
                            color = NexoraMuted
                        )
                    }

                    BasicTextField(
                        value = inputText,
                        onValueChange = { if (it.length <= 1000) inputText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("chat_input"),
                        textStyle = TextStyle(
                            color = NexoraOnSurface,
                            fontSize = 13.sp
                        ),
                        cursorBrush = SolidColor(NexoraBrand),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = {
                            if (inputText.trim().isNotEmpty()) {
                                onSendMessage(inputText.trim())
                                inputText = ""
                            }
                        })
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (inputText.trim().isNotEmpty()) NexoraBrand
                            else NexoraBrand.copy(alpha = 0.4f)
                        )
                        .clickable(enabled = inputText.trim().isNotEmpty()) {
                            onSendMessage(inputText.trim())
                            inputText = ""
                        }
                        .testTag("send_chat_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = stringResource(R.string.send_message),
                        tint = NexoraOnBrand,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
