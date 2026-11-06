package com.lenstedreal.nexorawatch.ui.room

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lenstedreal.nexorawatch.data.FriendItem
import com.lenstedreal.nexorawatch.data.Message
import com.lenstedreal.nexorawatch.data.NexoraException
import com.lenstedreal.nexorawatch.data.NexoraRepository
import com.lenstedreal.nexorawatch.data.OverlayReaction
import com.lenstedreal.nexorawatch.data.Participant
import com.lenstedreal.nexorawatch.data.Room
import com.lenstedreal.nexorawatch.data.RoomInvite
import com.lenstedreal.nexorawatch.player.NexoraPlayer
import com.lenstedreal.nexorawatch.player.PlaybackSync
import com.lenstedreal.nexorawatch.realtime.ConnectionStatus
import com.lenstedreal.nexorawatch.realtime.NexoraWebSocket
import com.lenstedreal.nexorawatch.realtime.RealtimeEvent
import com.lenstedreal.nexorawatch.session.SessionStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.random.Random

data class RoomUiState(
    val room: Room? = null,
    val roomLoading: Boolean = true,
    val roomError: String? = null,
    val isRoomExpired: Boolean = false,
    val messages: List<Message> = emptyList(),
    val isConnected: Boolean = false,
    val connectionStatus: ConnectionStatus = ConnectionStatus.RECONNECTING,
    val isHost: Boolean = false,
    val participantId: String? = null,
    val nickname: String = "",
    val notice: String? = null,
    val isUploading: Boolean = false,
    val uploadProgress: Int = 0,
    val localVideoName: String? = null,
    val expectedPositionSeconds: Double = 0.0,
    val overlayReactions: List<OverlayReaction> = emptyList(),
    val hapticEnabled: Boolean = true,
    val friends: List<FriendItem> = emptyList(),
    val invites: List<RoomInvite> = emptyList()
)

class RoomViewModel(
    val code: String,
    private val repository: NexoraRepository,
    private val sessionStore: SessionStore,
    private val webSocket: NexoraWebSocket,
    private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(RoomUiState())
    val uiState: StateFlow<RoomUiState> = _uiState.asStateFlow()

    var player: NexoraPlayer? = null
        private set

    private var syncJob: Job? = null
    private var pollingJob: Job? = null
    private var publishDebounceJob: Job? = null
    private var uploadJob: Job? = null

    private var isSyncingRemote = false
    private var lastRemoteSyncTimestamp = 0L
    private var lastReactionSentTimestamp = 0L

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val pid = _uiState.value.participantId
            if (!_uiState.value.isRoomExpired && pid != null) {
                webSocket.connect(code, pid, sessionStore.getRoomToken(code))
                onAppForeground()
            }
        }

        override fun onLost(network: Network) {
            if (!isNetworkAvailable()) {
                webSocket.reportHttpPollResult(success = false, hasNetwork = false)
            }
        }
    }

    init {
        player = NexoraPlayer(context).apply {
            onUserPlayPause = { playing, posSeconds ->
                if (_uiState.value.isHost && !isWithinRemoteSyncGuard()) {
                    publishPlayback(playing, posSeconds)
                }
            }
            onUserSeek = { playing, posSeconds ->
                if (_uiState.value.isHost && !isWithinRemoteSyncGuard()) {
                    publishPlayback(playing, posSeconds)
                }
            }
        }

        val savedNick = sessionStore.getSavedNickname()
        val participantId = sessionStore.getRoomSession(code)
        sessionStore.saveLastActiveRoomCode(code)

        _uiState.value = _uiState.value.copy(
            nickname = savedNick,
            participantId = participantId,
            hapticEnabled = sessionStore.isHapticEnabled(),
            friends = sessionStore.getFriends(),
            invites = sessionStore.getInvites(),
            connectionStatus = if (isNetworkAvailable()) ConnectionStatus.RECONNECTING else ConnectionStatus.DISCONNECTED
        )

        registerNetworkCallback()
        loadInitialData(participantId)
        observeWebSocket()
        startPollingLoop()
        startSyncLoop()
    }

    private fun registerNetworkCallback() {
        try {
            connectivityManager?.registerDefaultNetworkCallback(networkCallback)
        } catch (_: Exception) {}
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = connectivityManager ?: return true
        return try {
            val activeNetwork = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(activeNetwork) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            true
        }
    }

    private fun isWithinRemoteSyncGuard(): Boolean {
        return isSyncingRemote ||
                (System.currentTimeMillis() - lastRemoteSyncTimestamp) < PlaybackSync.REMOTE_SYNC_GUARD_WINDOW_MS
    }

    private fun loadInitialData(participantId: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(roomLoading = true, roomError = null)
            try {
                var room = repository.getRoom(code)
                var effectiveParticipantId = participantId

                // Auto-rejoin if session expired or missing but user has saved nickname
                if (effectiveParticipantId == null || room.participants.none { it.id == effectiveParticipantId }) {
                    val nick = _uiState.value.nickname.ifBlank { "Misafir" }
                    try {
                        val joinRes = repository.joinRoom(code, nick, effectiveParticipantId)
                        room = joinRes.room
                        effectiveParticipantId = joinRes.participant.id
                        sessionStore.saveRoomSession(code, effectiveParticipantId)
                        sessionStore.saveRoomToken(code, joinRes.token)
                    } catch (_: Exception) {}
                }

                val messages = try { repository.getMessages(code) } catch (_: Exception) { emptyList() }

                val me = room.participants.find { it.id == effectiveParticipantId }
                val isHost = me?.isHost == true

                webSocket.reportHttpPollResult(
                    success = true,
                    hasNetwork = isNetworkAvailable(),
                    serverTime = room.serverTime
                )

                val expectedPos = PlaybackSync.calculateExpectedPosition(
                    room.playback,
                    webSocket.serverOffset.value
                )

                _uiState.value = _uiState.value.copy(
                    room = room,
                    messages = messages,
                    roomLoading = false,
                    isHost = isHost,
                    participantId = effectiveParticipantId,
                    expectedPositionSeconds = expectedPos
                )

                if (effectiveParticipantId != null) {
                    webSocket.connect(code, effectiveParticipantId, sessionStore.getRoomToken(code))
                }

                applyRoomVideoSource(room, forceInitialSync = true)

            } catch (e: NexoraException) {
                handleFatalOrTransientError(e)
            } catch (e: Exception) {
                webSocket.reportHttpPollResult(success = false, hasNetwork = isNetworkAvailable())
                _uiState.value = _uiState.value.copy(
                    roomLoading = false,
                    roomError = e.message ?: "Oda bulunamadı veya süresi dolmuş olabilir."
                )
            }
        }
    }

    private fun handleFatalOrTransientError(e: NexoraException) {
        if (e.statusCode == 410 || e.statusCode == 404) {
            // Room expired (410) or not found (404): stop polling & clear session
            pollingJob?.cancel()
            syncJob?.cancel()
            webSocket.disconnect()
            sessionStore.clearRoomSession(code)
            _uiState.value = _uiState.value.copy(
                roomLoading = false,
                room = null,
                isRoomExpired = e.statusCode == 410,
                roomError = if (e.statusCode == 410) {
                    "Bu odanın süresi dolmuş (24 saat sınırı)."
                } else {
                    e.message ?: "Oda bulunamadı veya süresi dolmuş olabilir."
                }
            )
        } else {
            webSocket.reportHttpPollResult(success = false, hasNetwork = isNetworkAvailable())
            if (_uiState.value.room == null) {
                _uiState.value = _uiState.value.copy(
                    roomLoading = false,
                    roomError = e.message ?: "Bağlantı hatası (${e.statusCode})"
                )
            }
        }
    }

    private fun applyRoomVideoSource(room: Room, forceInitialSync: Boolean = false) {
        if (_uiState.value.localVideoName != null) return
        val v = room.video
        if (v == null) {
            player?.clearSource()
            return
        }
        if (v.kind == "youtube") {
            // Handled by YouTubePlayer WebView
            player?.pause()
            return
        }
        val streamUrl = v.streamUrl ?: v.embedUrl ?: v.url
        player?.setSource(streamUrl)

        if (forceInitialSync) {
            syncRemotePlayback(room, forceSeek = true)
        }
    }

    private fun observeWebSocket() {
        viewModelScope.launch {
            webSocket.isConnected.collect { connected ->
                _uiState.value = _uiState.value.copy(isConnected = connected)
            }
        }

        viewModelScope.launch {
            webSocket.connectionStatus.collect { status ->
                _uiState.value = _uiState.value.copy(connectionStatus = status)
            }
        }

        viewModelScope.launch {
            webSocket.events.collect { event ->
                when (event) {
                    is RealtimeEvent.RoomUpdated -> {
                        val currentRoom = _uiState.value.room
                        val updatedRoom = event.room
                        val isHost = updatedRoom.participants.find {
                            it.id == _uiState.value.participantId
                        }?.isHost == true

                        _uiState.value = _uiState.value.copy(
                            room = updatedRoom,
                            isHost = isHost
                        )

                        if (currentRoom?.video?.url != updatedRoom.video?.url) {
                            applyRoomVideoSource(updatedRoom, forceInitialSync = true)
                        }
                    }
                    is RealtimeEvent.PlaybackUpdated -> {
                        val currentRoom = _uiState.value.room
                        if (currentRoom != null) {
                            val updatedRoom = currentRoom.copy(playback = event.playback)
                            val expectedPos = PlaybackSync.calculateExpectedPosition(
                                event.playback,
                                webSocket.serverOffset.value
                            )
                            _uiState.value = _uiState.value.copy(
                                room = updatedRoom,
                                expectedPositionSeconds = expectedPos
                            )
                            if (!_uiState.value.isHost) {
                                syncRemotePlayback(updatedRoom)
                            }
                        }
                    }
                    is RealtimeEvent.MessageReceived -> {
                        val currentMessages = _uiState.value.messages.toMutableList()
                        val newMsg = event.message
                        if (currentMessages.none { it.key == newMsg.key }) {
                            currentMessages.add(newMsg)
                            _uiState.value = _uiState.value.copy(messages = currentMessages)
                        }
                        if (newMsg.text in listOf("🔥", "❤️", "😂", "👏") &&
                            newMsg.participantId != _uiState.value.participantId
                        ) {
                            enqueueOverlayReaction(newMsg.text, newMsg.nickname)
                        }
                    }
                    is RealtimeEvent.PresenceUpdated -> {
                        val currentRoom = _uiState.value.room
                        if (currentRoom != null) {
                            val updatedParticipants = currentRoom.participants.map { p ->
                                if (p.id == event.participantId) p.copy(online = event.online) else p
                            }
                            _uiState.value = _uiState.value.copy(
                                room = currentRoom.copy(participants = updatedParticipants)
                            )
                        }
                    }
                    is RealtimeEvent.WebUpdated -> {
                        val currentRoom = _uiState.value.room
                        if (currentRoom != null) {
                            _uiState.value = _uiState.value.copy(
                                room = currentRoom.copy(webOpen = event.open, webUrl = event.url)
                            )
                        }
                    }
                    is RealtimeEvent.ReactionReceived -> {
                        enqueueOverlayReaction(event.emoji, event.senderNickname)
                    }
                }
            }
        }
    }

    private fun startPollingLoop() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive && !_uiState.value.isRoomExpired) {
                val interval = if (_uiState.value.isConnected) {
                    PlaybackSync.RELAXED_POLL_INTERVAL_MS
                } else {
                    PlaybackSync.NORMAL_POLL_INTERVAL_MS
                }
                delay(interval)

                if (!isNetworkAvailable()) {
                    webSocket.reportHttpPollResult(success = false, hasNetwork = false)
                    continue
                }

                try {
                    val updatedRoom = repository.getRoom(code)
                    val updatedMessages = try {
                        repository.getMessages(code)
                    } catch (_: Exception) {
                        _uiState.value.messages
                    }

                    webSocket.reportHttpPollResult(
                        success = true,
                        hasNetwork = true,
                        serverTime = updatedRoom.serverTime
                    )

                    val prevVideoUrl = _uiState.value.room?.video?.url
                    val isHost = updatedRoom.participants.find {
                        it.id == _uiState.value.participantId
                    }?.isHost == true

                    val expectedPos = PlaybackSync.calculateExpectedPosition(
                        updatedRoom.playback,
                        webSocket.serverOffset.value
                    )

                    _uiState.value = _uiState.value.copy(
                        room = updatedRoom,
                        messages = updatedMessages,
                        isHost = isHost,
                        expectedPositionSeconds = expectedPos
                    )

                    if (prevVideoUrl != updatedRoom.video?.url) {
                        applyRoomVideoSource(updatedRoom, forceInitialSync = true)
                    }
                } catch (e: NexoraException) {
                    handleFatalOrTransientError(e)
                } catch (_: Exception) {
                    webSocket.reportHttpPollResult(
                        success = false,
                        hasNetwork = isNetworkAvailable()
                    )
                }
            }
        }
    }

    private fun startSyncLoop() {
        syncJob?.cancel()
        syncJob = viewModelScope.launch {
            var lastHeartbeatMs = 0L
            while (isActive && !_uiState.value.isRoomExpired) {
                delay(1000)
                val state = _uiState.value
                val room = state.room ?: continue

                val expectedPos = PlaybackSync.calculateExpectedPosition(
                    room.playback,
                    webSocket.serverOffset.value
                )
                _uiState.value = state.copy(expectedPositionSeconds = expectedPos)

                if (state.isHost) {
                    // Host periodic heartbeat for ExoPlayer sources
                    val p = player ?: continue
                    if (room.video?.kind != "youtube" && p.isPlaying && !isWithinRemoteSyncGuard()) {
                        val now = System.currentTimeMillis()
                        if (now - lastHeartbeatMs >= PlaybackSync.HEARTBEAT_INTERVAL_MS) {
                            lastHeartbeatMs = now
                            publishPlayback(playing = true, position = p.currentPositionSeconds)
                        }
                    }
                } else {
                    // Guest synchronization
                    syncRemotePlayback(room)
                }
            }
        }
    }

    fun syncRemotePlayback(room: Room? = _uiState.value.room, forceSeek: Boolean = false) {
        val activeRoom = room ?: return
        val state = _uiState.value
        if (state.localVideoName != null) return
        val roomVideo = activeRoom.video ?: return
        if (roomVideo.kind == "youtube") return // Handled by YouTubePlayer composable

        val p = player ?: return
        val targetPos = PlaybackSync.calculateExpectedPosition(
            activeRoom.playback,
            webSocket.serverOffset.value
        )
        val currentPos = p.currentPositionSeconds

        isSyncingRemote = true
        lastRemoteSyncTimestamp = System.currentTimeMillis()
        try {
            if (forceSeek || PlaybackSync.isDriftExceeded(currentPos, targetPos)) {
                p.seekTo(targetPos)
            }
            if (activeRoom.playback.playing && !p.isPlaying) {
                p.play()
            } else if (!activeRoom.playback.playing && p.isPlaying) {
                p.pause()
            }
        } finally {
            isSyncingRemote = false
        }
    }

    fun publishPlayback(playing: Boolean, position: Double) {
        val state = _uiState.value
        // Strictly enforce host-only authority for PUT /api/rooms/{code}/playback
        if (!state.isHost) return
        val participantId = state.participantId ?: return
        if (isWithinRemoteSyncGuard()) return

        val safePosition = position.coerceAtLeast(0.0)
        publishDebounceJob?.cancel()
        publishDebounceJob = viewModelScope.launch {
            delay(PlaybackSync.PLAYBACK_DEBOUNCE_MS)
            try {
                webSocket.sendPlayback(playing, safePosition)
                val updatedPlayback = repository.setPlayback(
                    code = code,
                    participantId = participantId,
                    playing = playing,
                    position = safePosition
                )
                val currentRoom = _uiState.value.room
                if (currentRoom != null) {
                    _uiState.value = _uiState.value.copy(
                        room = currentRoom.copy(playback = updatedPlayback)
                    )
                }
            } catch (_: Exception) {}
        }
    }

    fun onAppForeground() {
        val state = _uiState.value
        if (state.isRoomExpired) return
        viewModelScope.launch {
            try {
                val room = repository.getRoom(code)
                val messages = try { repository.getMessages(code) } catch (_: Exception) { state.messages }
                webSocket.reportHttpPollResult(
                    success = true,
                    hasNetwork = isNetworkAvailable(),
                    serverTime = room.serverTime
                )
                val isHost = room.participants.find { it.id == state.participantId }?.isHost == true
                val expectedPos = PlaybackSync.calculateExpectedPosition(
                    room.playback,
                    webSocket.serverOffset.value
                )
                _uiState.value = _uiState.value.copy(
                    room = room,
                    messages = messages,
                    isHost = isHost,
                    expectedPositionSeconds = expectedPos
                )
                if (!state.participantId.isNullOrBlank() && !_uiState.value.isConnected) {
                    webSocket.connect(code, state.participantId, sessionStore.getRoomToken(code))
                }
                syncRemotePlayback(room, forceSeek = !isHost)
            } catch (e: NexoraException) {
                handleFatalOrTransientError(e)
            } catch (_: Exception) {}
        }
    }

    fun showNotice(text: String) {
        _uiState.value = _uiState.value.copy(notice = text)
        viewModelScope.launch {
            delay(2600)
            if (_uiState.value.notice == text) {
                _uiState.value = _uiState.value.copy(notice = null)
            }
        }
    }

    fun setVideoSource(url: String) {
        val state = _uiState.value
        // Strictly enforce host-only authority for PUT /api/rooms/{code}/video
        if (!state.isHost) {
            showNotice("Salt okunur mod: Videoyu yalnızca oda sahibi değiştirebilir.")
            return
        }
        val participantId = state.participantId ?: return
        val cleanUrl = url.trim()
        if (cleanUrl.isEmpty()) return

        viewModelScope.launch {
            try {
                val updatedRoom = repository.setVideo(code, participantId, cleanUrl)
                _uiState.value = _uiState.value.copy(
                    room = updatedRoom,
                    localVideoName = null,
                    expectedPositionSeconds = 0.0
                )
                applyRoomVideoSource(updatedRoom, forceInitialSync = true)
                showNotice("Video kaynağı güncellendi.")
            } catch (e: Exception) {
                showNotice(
                    e.message ?: "Bu bağlantı desteklenen bir video kaynağı olarak çözülemedi."
                )
            }
        }
    }

    fun selectLocalVideo(uri: Uri) {
        val state = _uiState.value
        if (!state.isHost) {
            showNotice("Salt okunur mod: Yerel videoyu yalnızca oda sahibi yükleyebilir.")
            return
        }
        val participantId = state.participantId ?: return

        uploadJob?.cancel()
        uploadJob = viewModelScope.launch {
            try {
                val retriever = MediaMetadataRetriever()
                val durationMs = try {
                    retriever.setDataSource(context, uri)
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                } finally {
                    try { retriever.release() } catch (_: Exception) {}
                }

                if (durationMs <= 0L) {
                    showNotice("Video süresi okunamadı.")
                    return@launch
                }

                if (durationMs > 30_500L) {
                    showNotice("Cihazdan seçilen video 30 saniye veya daha kısa olmalıdır.")
                    return@launch
                }

                val fileName = "local_video_${System.currentTimeMillis()}.mp4"
                _uiState.value = _uiState.value.copy(
                    localVideoName = fileName,
                    isUploading = true,
                    uploadProgress = 0
                )

                // Play locally in host player immediately
                player?.setSource(uri.toString())
                player?.play()

                val mimeType = context.contentResolver.getType(uri) ?: "video/mp4"

                // Stream directly from ContentResolver URI without loading file into memory (no OOM)
                val uploadResult = repository.uploadVideoStream(
                    code = code,
                    participantId = participantId,
                    contentResolver = context.contentResolver,
                    uri = uri,
                    fileName = fileName,
                    mimeType = mimeType,
                    onProgress = { pct ->
                        _uiState.value = _uiState.value.copy(uploadProgress = pct)
                    }
                )

                _uiState.value = _uiState.value.copy(
                    isUploading = false,
                    uploadProgress = 100,
                    room = uploadResult.room ?: _uiState.value.room
                )

                showNotice("Yerel video odaya yüklendi ve senkronize edildi.")
            } catch (_: CancellationException) {
                _uiState.value = _uiState.value.copy(
                    isUploading = false,
                    uploadProgress = 0
                )
                showNotice("Video yüklemesi iptal edildi.")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isUploading = false,
                    uploadProgress = 0
                )
                showNotice(e.message ?: "Video yüklenemedi.")
            }
        }
    }

    fun cancelUpload() {
        uploadJob?.cancel()
        uploadJob = null
    }

    fun removeLocalVideo() {
        cancelUpload()
        _uiState.value = _uiState.value.copy(localVideoName = null)
        _uiState.value.room?.let { room ->
            applyRoomVideoSource(room, forceInitialSync = true)
        }
    }

    fun toggleHaptic() {
        val next = !_uiState.value.hapticEnabled
        sessionStore.setHapticEnabled(next)
        _uiState.value = _uiState.value.copy(hapticEnabled = next)
    }

    fun sendReaction(emoji: String) {
        if (emoji !in listOf("🔥", "❤️", "😂", "👏")) return
        val now = System.currentTimeMillis()
        // Rate limit reactions (800ms cooldown) to prevent unbounded spam
        if (now - lastReactionSentTimestamp < 800L) return
        lastReactionSentTimestamp = now

        val nick = _uiState.value.nickname.ifBlank { "Sen" }
        enqueueOverlayReaction(emoji, nick)

        val participantId = _uiState.value.participantId ?: return
        viewModelScope.launch {
            try {
                webSocket.sendReaction(emoji, nick)
                repository.sendMessage(code, participantId, emoji)
            } catch (_: Exception) {}
        }
    }

    private fun enqueueOverlayReaction(emoji: String, senderNickname: String) {
        val reaction = OverlayReaction(
            id = UUID.randomUUID().toString(),
            emoji = emoji,
            senderNickname = senderNickname,
            horizontalFraction = Random.nextFloat() * 0.7f + 0.15f
        )
        val updated = (_uiState.value.overlayReactions + reaction).takeLast(12)
        _uiState.value = _uiState.value.copy(overlayReactions = updated)

        viewModelScope.launch {
            delay(1700)
            _uiState.value = _uiState.value.copy(
                overlayReactions = _uiState.value.overlayReactions.filterNot { it.id == reaction.id }
            )
        }
    }

    fun addFriend(nickname: String, activeRoomCode: String? = null) {
        val updated = sessionStore.addFriend(nickname, activeRoomCode)
        _uiState.value = _uiState.value.copy(friends = updated)
        showNotice("${nickname.trim()} arkadaş listesine eklendi.")
    }

    fun removeFriend(friendId: String) {
        val updated = sessionStore.removeFriend(friendId)
        _uiState.value = _uiState.value.copy(friends = updated)
    }

    fun sendRoomInvite(friendNickname: String) {
        val room = _uiState.value.room ?: return
        val updatedInvites = sessionStore.createInvite(
            fromNickname = _uiState.value.nickname,
            toNickname = friendNickname,
            roomCode = room.code,
            roomName = room.name
        )
        _uiState.value = _uiState.value.copy(invites = updatedInvites)
        showNotice("$friendNickname adlı arkadaşa oda daveti gönderildi.")
    }

    fun sendMessage(text: String) {
        val participantId = _uiState.value.participantId ?: return
        val clean = text.trim()
        if (clean.isEmpty()) return

        viewModelScope.launch {
            try {
                webSocket.sendChatMessage(clean)
                repository.sendMessage(code, participantId, clean)
            } catch (e: Exception) {
                showNotice(e.message ?: "Mesaj gönderilemedi.")
            }
        }
    }

    fun leaveRoom(onLeft: () -> Unit) {
        val participantId = _uiState.value.participantId
        viewModelScope.launch {
            pollingJob?.cancel()
            syncJob?.cancel()
            uploadJob?.cancel()
            if (participantId != null) {
                try {
                    repository.leaveRoom(code, participantId)
                } catch (_: Exception) {}
                sessionStore.clearRoomSession(code)
            }
            sessionStore.saveLastActiveRoomCode(null)
            webSocket.disconnect()
            player?.pause()
            player?.release()
            player = null
            onLeft()
        }
    }

    override fun onCleared() {
        super.onCleared()
        try {
            connectivityManager?.unregisterNetworkCallback(networkCallback)
        } catch (_: Exception) {}
        syncJob?.cancel()
        pollingJob?.cancel()
        publishDebounceJob?.cancel()
        uploadJob?.cancel()
        webSocket.disconnect()
        player?.release()
        player = null
    }
}
