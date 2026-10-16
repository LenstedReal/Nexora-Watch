package com.lenstedreal.nexorawatch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.lenstedreal.nexorawatch.data.NexoraRepository
import com.lenstedreal.nexorawatch.realtime.NexoraWebSocket
import com.lenstedreal.nexorawatch.session.SessionStore
import com.lenstedreal.nexorawatch.ui.home.HomeScreen
import com.lenstedreal.nexorawatch.ui.home.HomeViewModel
import com.lenstedreal.nexorawatch.ui.room.RoomScreen
import com.lenstedreal.nexorawatch.ui.room.RoomViewModel
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraWatchTheme

class MainActivity : ComponentActivity() {

    private lateinit var repository: NexoraRepository
    private lateinit var sessionStore: SessionStore
    private lateinit var webSocket: NexoraWebSocket

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessionStore = SessionStore(this)
        repository = NexoraRepository(
            baseUrl = BuildConfig.NEXORA_API_BASE_URL,
            tokenProvider = { code -> sessionStore.getRoomToken(code) }
        )
        webSocket = NexoraWebSocket(repository.okHttpClient, BuildConfig.NEXORA_WS_URL)

        setContent {
            NexoraWatchTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = NexoraSurface
                ) {
                    NexoraAppNav(
                        repository = repository,
                        sessionStore = sessionStore,
                        webSocket = webSocket
                    )
                }
            }
        }
    }
}

@Composable
fun NexoraAppNav(
    repository: NexoraRepository,
    sessionStore: SessionStore,
    webSocket: NexoraWebSocket
) {
    // Session recovery (Global Test Matrix: TEST — SESSION):
    // Automatically restore last active room if app was killed and reopened
    var activeRoomCode by remember {
        mutableStateOf(sessionStore.getLastActiveRoomCode())
    }

    if (activeRoomCode == null) {
        val homeViewModel = remember {
            HomeViewModel(repository, sessionStore)
        }
        HomeScreen(
            viewModel = homeViewModel,
            onNavigateToRoom = { code ->
                sessionStore.saveLastActiveRoomCode(code)
                activeRoomCode = code
            }
        )
    } else {
        val roomCode = activeRoomCode!!
        val context = androidx.compose.ui.platform.LocalContext.current
        val roomViewModel = remember(roomCode) {
            RoomViewModel(
                code = roomCode,
                repository = repository,
                sessionStore = sessionStore,
                webSocket = webSocket,
                context = context.applicationContext
            )
        }
        RoomScreen(
            viewModel = roomViewModel,
            onNavigateBack = {
                sessionStore.saveLastActiveRoomCode(null)
                activeRoomCode = null
            }
        )
    }
}
