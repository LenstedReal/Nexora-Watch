package com.lenstedreal.nexorawatch.data

import com.google.gson.annotations.SerializedName

data class Participant(
    @SerializedName("id") val id: String,
    @SerializedName("nickname") val nickname: String,
    @SerializedName("is_host") val isHost: Boolean,
    @SerializedName("online") val online: Boolean,
    @SerializedName("joined_at") val joinedAt: String? = null
)

data class VideoSource(
    @SerializedName("url") val url: String,
    @SerializedName("kind") val kind: String, // "youtube", "drive", "direct", "hls", "embed", "web"
    @SerializedName("video_id") val videoId: String? = null,
    @SerializedName("embed_url") val embedUrl: String? = null,
    @SerializedName("stream_url") val streamUrl: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("mime_type") val mimeType: String? = null,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("confidence") val confidence: Double? = null,
    @SerializedName("method") val method: String? = null
)

data class Playback(
    @SerializedName("playing") val playing: Boolean = false,
    @SerializedName("position") val position: Double = 0.0,
    @SerializedName("updated_at") val updatedAt: Long = 0L
)

data class Room(
    @SerializedName("id") val id: String? = null,
    @SerializedName("code") val code: String,
    @SerializedName("name") val name: String,
    @SerializedName("host_id") val hostId: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("expires_at") val expiresAt: String? = null,
    @SerializedName("participants") val participants: List<Participant> = emptyList(),
    @SerializedName("video") val video: VideoSource? = null,
    @SerializedName("playback") val playback: Playback = Playback(),
    @SerializedName("web_open") val webOpen: Boolean = false,
    @SerializedName("web_url") val webUrl: String? = null,
    @SerializedName("server_time") val serverTime: Long = 0L
)

data class Message(
    @SerializedName("id") val id: String? = null,
    @SerializedName("_id") val underscoreId: String? = null,
    @SerializedName("room_code") val roomCode: String,
    @SerializedName("participant_id") val participantId: String? = null,
    @SerializedName("nickname") val nickname: String,
    @SerializedName("text") val text: String,
    @SerializedName("kind") val kind: String = "chat", // "chat" or "system"
    @SerializedName("created_at") val createdAt: String? = null
) {
    val key: String
        get() = id ?: underscoreId ?: "$createdAt-$nickname-${text.hashCode()}"
}

data class JoinResponse(
    @SerializedName("room") val room: Room,
    @SerializedName("participant") val participant: Participant,
    @SerializedName("token") val token: String? = null
)

data class CreateRoomRequest(
    @SerializedName("nickname") val nickname: String,
    @SerializedName("name") val name: String
)

data class JoinRoomRequest(
    @SerializedName("nickname") val nickname: String,
    @SerializedName("participant_id") val participantId: String? = null
)

data class SendMessageRequest(
    @SerializedName("participant_id") val participantId: String,
    @SerializedName("text") val text: String
)

data class SetVideoRequest(
    @SerializedName("participant_id") val participantId: String,
    @SerializedName("url") val url: String
)

data class SetPlaybackRequest(
    @SerializedName("participant_id") val participantId: String,
    @SerializedName("playing") val playing: Boolean,
    @SerializedName("position") val position: Double
)

data class SetWebRequest(
    @SerializedName("participant_id") val participantId: String,
    @SerializedName("open") val open: Boolean,
    @SerializedName("url") val url: String? = null
)

data class LeaveRoomRequest(
    @SerializedName("participant_id") val participantId: String
)

data class LeaveResponse(
    @SerializedName("ok") val ok: Boolean = true
)

data class UploadResponse(
    @SerializedName("url") val url: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("room") val room: Room? = null
)

enum class FriendState {
    ONLINE,
    IN_ROOM,
    OFFLINE,
    PENDING
}

enum class InviteState {
    PENDING,
    SENT,
    ACCEPTED,
    DECLINED
}

data class FriendItem(
    @SerializedName("id") val id: String,
    @SerializedName("nickname") val nickname: String,
    @SerializedName("state") val state: FriendState = FriendState.ONLINE,
    @SerializedName("active_room_code") val activeRoomCode: String? = null
)

data class RoomInvite(
    @SerializedName("id") val id: String,
    @SerializedName("from_nickname") val fromNickname: String,
    @SerializedName("to_nickname") val toNickname: String,
    @SerializedName("room_code") val roomCode: String,
    @SerializedName("room_name") val roomName: String,
    @SerializedName("state") val state: InviteState = InviteState.SENT,
    @SerializedName("created_at") val createdAt: Long = System.currentTimeMillis()
)

data class OverlayReaction(
    val id: String,
    val emoji: String,
    val senderNickname: String,
    val horizontalFraction: Float,
    val createdAt: Long = System.currentTimeMillis()
)
