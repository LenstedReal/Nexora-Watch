package com.lenstedreal.nexorawatch.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lenstedreal.nexorawatch.data.NexoraRepository
import com.lenstedreal.nexorawatch.session.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class HomeMode {
    CREATE, JOIN
}

data class HomeUiState(
    val mode: HomeMode = HomeMode.CREATE,
    val nickname: String = "",
    val roomName: String = "",
    val roomCode: String = "",
    val isLoading: Boolean = false,
    val toastMessage: String? = null,
    val isToastError: Boolean = true,
    val showWebHintDialog: Boolean = false
)

class HomeViewModel(
    private val repository: NexoraRepository,
    private val sessionStore: SessionStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        val savedNick = sessionStore.getSavedNickname()
        if (savedNick.isNotBlank()) {
            _uiState.value = _uiState.value.copy(nickname = savedNick)
        }
    }

    fun setMode(mode: HomeMode) {
        _uiState.value = _uiState.value.copy(mode = mode)
    }

    fun setNickname(nickname: String) {
        _uiState.value = _uiState.value.copy(nickname = nickname)
    }

    fun setRoomName(roomName: String) {
        _uiState.value = _uiState.value.copy(roomName = roomName)
    }

    fun setRoomCode(code: String) {
        val filtered = code.uppercase().filter { it.isLetterOrDigit() }.take(6)
        _uiState.value = _uiState.value.copy(roomCode = filtered)
    }

    fun setShowWebHintDialog(show: Boolean) {
        _uiState.value = _uiState.value.copy(showWebHintDialog = show)
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toastMessage = null)
    }

    fun submit(onSuccess: (roomCode: String) -> Unit) {
        val state = _uiState.value
        val nick = state.nickname.trim()

        if (nick.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                toastMessage = "Bir rumuz gir",
                isToastError = true
            )
            return
        }

        if (state.mode == HomeMode.JOIN && state.roomCode.trim().length != 6) {
            _uiState.value = _uiState.value.copy(
                toastMessage = "6 haneli geçerli bir oda kodu gir",
                isToastError = true
            )
            return
        }

        _uiState.value = _uiState.value.copy(isLoading = true)

        viewModelScope.launch {
            try {
                sessionStore.saveNickname(nick)

                val joinResponse = if (state.mode == HomeMode.CREATE) {
                    repository.createRoom(
                        nickname = nick,
                        name = state.roomName.trim().ifEmpty { "${nick}'in odası" }
                    )
                } else {
                    repository.joinRoom(
                        code = state.roomCode.trim().uppercase(),
                        nickname = nick
                    )
                }

                sessionStore.saveRoomSession(joinResponse.room.code, joinResponse.participant.id)
                sessionStore.saveRoomToken(joinResponse.room.code, joinResponse.token)
                _uiState.value = _uiState.value.copy(isLoading = false)
                onSuccess(joinResponse.room.code)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    toastMessage = e.message ?: "Bir hata oluştu",
                    isToastError = true
                )
            }
        }
    }
}
