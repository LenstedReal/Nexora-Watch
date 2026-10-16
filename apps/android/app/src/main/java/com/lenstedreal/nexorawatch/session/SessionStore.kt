package com.lenstedreal.nexorawatch.session

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.lenstedreal.nexorawatch.data.FriendItem
import com.lenstedreal.nexorawatch.data.FriendState
import com.lenstedreal.nexorawatch.data.InviteState
import com.lenstedreal.nexorawatch.data.RoomInvite
import java.util.UUID

class SessionStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("nexora_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val KEY_NICKNAME_PRIMARY = "nexorawatch:nickname"
        private const val KEY_NICKNAME_LEGACY = "sinerave:nickname"
        private const val PREFIX_ROOM_PRIMARY = "nexorawatch:room:"
        private const val PREFIX_ROOM_LEGACY = "sinerave:room:"
        private const val KEY_LAST_ACTIVE_ROOM = "nexorawatch:last_active_room"
        private const val KEY_HAPTIC_ENABLED = "nexorawatch:haptic_enabled"
        private const val KEY_FRIENDS_LIST = "nexorawatch:friends"
        private const val KEY_ROOM_INVITES = "nexorawatch:invites"
        private const val KEY_FCM_TOKEN = "nexorawatch:fcm_token"
        private const val KEY_FCM_SYNCED_TOKEN = "nexorawatch:fcm_synced_token"
    }

    fun getSavedNickname(): String {
        val primary = prefs.getString(KEY_NICKNAME_PRIMARY, null)
        if (!primary.isNullOrBlank()) return primary
        val legacy = prefs.getString(KEY_NICKNAME_LEGACY, null)
        return legacy ?: ""
    }

    fun saveNickname(nickname: String) {
        val clean = nickname.trim()
        prefs.edit()
            .putString(KEY_NICKNAME_PRIMARY, clean)
            .putString(KEY_NICKNAME_LEGACY, clean)
            .apply()
    }

    fun getRoomSession(code: String): String? {
        val cleanCode = code.trim().uppercase()
        val primary = prefs.getString("$PREFIX_ROOM_PRIMARY$cleanCode", null)
        if (!primary.isNullOrBlank()) return primary
        val legacy = prefs.getString("$PREFIX_ROOM_LEGACY$cleanCode", null)
        return legacy?.takeIf { it.isNotBlank() }
    }

    /** Participant secret issued by POST /api/rooms|join. Required by the server for host actions and WebSocket auth. */
    fun saveRoomToken(code: String, token: String?) {
        if (token.isNullOrBlank()) return
        prefs.edit().putString("nx_room_token_${code.trim().uppercase()}", token).apply()
    }

    fun getRoomToken(code: String): String =
        prefs.getString("nx_room_token_${code.trim().uppercase()}", null).orEmpty()

    fun saveRoomSession(code: String, participantId: String) {
        val cleanCode = code.trim().uppercase()
        val cleanId = participantId.trim()
        prefs.edit()
            .putString("$PREFIX_ROOM_PRIMARY$cleanCode", cleanId)
            .putString("$PREFIX_ROOM_LEGACY$cleanCode", cleanId)
            .putString(KEY_LAST_ACTIVE_ROOM, cleanCode)
            .apply()
    }

    fun clearRoomSession(code: String) {
        val cleanCode = code.trim().uppercase()
        val editor = prefs.edit()
            .remove("$PREFIX_ROOM_PRIMARY$cleanCode")
            .remove("$PREFIX_ROOM_LEGACY$cleanCode")
        if (getLastActiveRoomCode() == cleanCode) {
            editor.remove(KEY_LAST_ACTIVE_ROOM)
        }
        editor.apply()
    }

    fun getLastActiveRoomCode(): String? {
        val code = prefs.getString(KEY_LAST_ACTIVE_ROOM, null)?.trim()?.uppercase()
        if (code.isNullOrBlank()) return null
        return if (getRoomSession(code) != null) code else null
    }

    fun saveLastActiveRoomCode(code: String?) {
        val editor = prefs.edit()
        if (code.isNullOrBlank()) {
            editor.remove(KEY_LAST_ACTIVE_ROOM)
        } else {
            editor.putString(KEY_LAST_ACTIVE_ROOM, code.trim().uppercase())
        }
        editor.apply()
    }

    fun isHapticEnabled(): Boolean {
        return prefs.getBoolean(KEY_HAPTIC_ENABLED, true)
    }

    fun setHapticEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_HAPTIC_ENABLED, enabled).apply()
    }

    fun getFriends(): List<FriendItem> {
        val raw = prefs.getString(KEY_FRIENDS_LIST, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<FriendItem>>() {}.type
            gson.fromJson<List<FriendItem>>(raw, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun addFriend(nickname: String, activeRoomCode: String? = null): List<FriendItem> {
        val clean = nickname.trim()
        if (clean.isEmpty()) return getFriends()
        val current = getFriends().toMutableList()
        val existingIdx = current.indexOfFirst { it.nickname.equals(clean, ignoreCase = true) }
        val state = if (!activeRoomCode.isNullOrBlank()) FriendState.IN_ROOM else FriendState.ONLINE
        if (existingIdx >= 0) {
            current[existingIdx] = current[existingIdx].copy(
                state = state,
                activeRoomCode = activeRoomCode ?: current[existingIdx].activeRoomCode
            )
        } else {
            current.add(
                FriendItem(
                    id = UUID.randomUUID().toString(),
                    nickname = clean,
                    state = state,
                    activeRoomCode = activeRoomCode
                )
            )
        }
        prefs.edit().putString(KEY_FRIENDS_LIST, gson.toJson(current)).apply()
        return current
    }

    fun removeFriend(friendId: String): List<FriendItem> {
        val updated = getFriends().filterNot { it.id == friendId }
        prefs.edit().putString(KEY_FRIENDS_LIST, gson.toJson(updated)).apply()
        return updated
    }

    fun getInvites(): List<RoomInvite> {
        val raw = prefs.getString(KEY_ROOM_INVITES, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<RoomInvite>>() {}.type
            gson.fromJson<List<RoomInvite>>(raw, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun createInvite(fromNickname: String, toNickname: String, roomCode: String, roomName: String): List<RoomInvite> {
        val current = getInvites().toMutableList()
        current.add(
            0,
            RoomInvite(
                id = UUID.randomUUID().toString(),
                fromNickname = fromNickname.ifBlank { "Ev Sahibi" },
                toNickname = toNickname.trim(),
                roomCode = roomCode.trim().uppercase(),
                roomName = roomName,
                state = InviteState.SENT
            )
        )
        val trimmed = current.take(25)
        prefs.edit().putString(KEY_ROOM_INVITES, gson.toJson(trimmed)).apply()
        return trimmed
    }

    fun updateInviteState(inviteId: String, newState: InviteState): List<RoomInvite> {
        val updated = getInvites().map {
            if (it.id == inviteId) it.copy(state = newState) else it
        }
        prefs.edit().putString(KEY_ROOM_INVITES, gson.toJson(updated)).apply()
        return updated
    }

    fun saveFcmToken(token: String, syncedWithServer: Boolean = false) {
        val editor = prefs.edit().putString(KEY_FCM_TOKEN, token)
        if (syncedWithServer) {
            editor.putString(KEY_FCM_SYNCED_TOKEN, token)
        }
        editor.apply()
    }

    fun isFcmTokenSynced(token: String): Boolean {
        return prefs.getString(KEY_FCM_SYNCED_TOKEN, null) == token
    }
}
