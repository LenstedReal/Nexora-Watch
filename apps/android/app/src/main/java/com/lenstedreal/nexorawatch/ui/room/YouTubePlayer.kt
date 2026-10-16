package com.lenstedreal.nexorawatch.ui.room

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import com.lenstedreal.nexorawatch.player.PlaybackSync
import kotlin.math.abs

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun YouTubePlayer(
    videoId: String,
    isHost: Boolean,
    expectedPlaying: Boolean,
    expectedPositionSeconds: Double,
    onHostPlaybackChanged: (playing: Boolean, positionSeconds: Double) -> Unit,
    onPlayerError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val currentIsHost by rememberUpdatedState(isHost)
    val currentExpectedPlaying by rememberUpdatedState(expectedPlaying)
    val currentExpectedPosition by rememberUpdatedState(expectedPositionSeconds)
    val currentOnHostPlaybackChanged by rememberUpdatedState(onHostPlaybackChanged)
    val currentOnPlayerError by rememberUpdatedState(onPlayerError)

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var isPlayerReady by remember { mutableStateOf(false) }
    var ytState by remember { mutableIntStateOf(-1) }
    var ytPositionSeconds by remember { mutableDoubleStateOf(0.0) }
    var lastRemoteSyncMs by remember { mutableStateOf(0L) }

    val mainHandler = remember { Handler(Looper.getMainLooper()) }

    // Synchronize Guest (or initial Host state) without jumping to 0 continuously
    LaunchedEffect(
        isPlayerReady,
        isHost,
        expectedPlaying,
        expectedPositionSeconds,
        ytPositionSeconds,
        ytState
    ) {
        val wv = webViewRef ?: return@LaunchedEffect
        if (!isPlayerReady) return@LaunchedEffect

        if (!isHost) {
            val target = expectedPositionSeconds.coerceAtLeast(0.0)
            // Guard against jumping to 0 when player is still buffering (state == 3) or unstarted (-1)
            val isBufferingOrUnstarted = (ytState == 3 || ytState == -1)
            val drift = abs(ytPositionSeconds - target)

            if (!isBufferingOrUnstarted && drift > PlaybackSync.DRIFT_TOLERANCE_SECONDS) {
                lastRemoteSyncMs = System.currentTimeMillis()
                wv.evaluateJavascript("window.nexoraSyncSeek($target);", null)
            }

            if (expectedPlaying && ytState != 1 && ytState != 3) {
                lastRemoteSyncMs = System.currentTimeMillis()
                wv.evaluateJavascript("window.nexoraSyncPlay();", null)
            } else if (!expectedPlaying && ytState == 1) {
                lastRemoteSyncMs = System.currentTimeMillis()
                wv.evaluateJavascript("window.nexoraSyncPause();", null)
            }
        }
    }

    DisposableEffect(videoId) {
        onDispose {
            webViewRef?.destroy()
            webViewRef = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .testTag("youtube_webview_player")
    ) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(android.graphics.Color.BLACK)
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    webChromeClient = WebChromeClient()
                    webViewClient = WebViewClient()

                    addJavascriptInterface(
                        object {
                            @JavascriptInterface
                            fun onReady(initialDuration: Double) {
                                mainHandler.post {
                                    isPlayerReady = true
                                    val target = currentExpectedPosition.coerceAtLeast(0.0)
                                    lastRemoteSyncMs = System.currentTimeMillis()
                                    if (target > 0.5) {
                                        evaluateJavascript("window.nexoraSyncSeek($target);", null)
                                    }
                                    if (currentExpectedPlaying) {
                                        evaluateJavascript("window.nexoraSyncPlay();", null)
                                    } else {
                                        evaluateJavascript("window.nexoraSyncPause();", null)
                                    }
                                }
                            }

                            @JavascriptInterface
                            fun onStateChange(state: Int, currentTime: Double) {
                                mainHandler.post {
                                    ytState = state
                                    if (currentTime.isFinite() && currentTime >= 0.0) {
                                        ytPositionSeconds = currentTime
                                    }
                                    val now = System.currentTimeMillis()
                                    val withinRemoteGuard =
                                        (now - lastRemoteSyncMs) < PlaybackSync.REMOTE_SYNC_GUARD_WINDOW_MS

                                    if (currentIsHost && !withinRemoteGuard) {
                                        when (state) {
                                            1 -> currentOnHostPlaybackChanged(true, ytPositionSeconds)
                                            2 -> currentOnHostPlaybackChanged(false, ytPositionSeconds)
                                        }
                                    }
                                }
                            }

                            @JavascriptInterface
                            fun onTick(currentTime: Double, state: Int) {
                                mainHandler.post {
                                    val prevPos = ytPositionSeconds
                                    if (currentTime.isFinite() && currentTime >= 0.0) {
                                        ytPositionSeconds = currentTime
                                    }
                                    ytState = state
                                    val now = System.currentTimeMillis()
                                    val withinRemoteGuard =
                                        (now - lastRemoteSyncMs) < PlaybackSync.REMOTE_SYNC_GUARD_WINDOW_MS

                                    // Detect manual scrub/seek by host (> 2.2s jump within 500ms tick)
                                    if (currentIsHost && !withinRemoteGuard && abs(currentTime - prevPos) > 2.2) {
                                        currentOnHostPlaybackChanged(state == 1, ytPositionSeconds)
                                    }
                                }
                            }

                            @JavascriptInterface
                            fun onError(code: Int) {
                                mainHandler.post {
                                    currentOnPlayerError("YouTube video oynatılamadı (Hata kodu: $code).")
                                }
                            }
                        },
                        "NexoraYTBridge"
                    )

                    val controlsFlag = if (isHost) 1 else 0
                    val html = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                            <style>
                                html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                                #player { width: 100%; height: 100%; }
                            </style>
                        </head>
                        <body>
                            <div id="player"></div>
                            <script src="https://www.youtube.com/iframe_api"></script>
                            <script>
                                var player = null;
                                function onYouTubeIframeAPIReady() {
                                    player = new YT.Player('player', {
                                        width: '100%',
                                        height: '100%',
                                        videoId: '$videoId',
                                        playerVars: {
                                            autoplay: 0,
                                            controls: $controlsFlag,
                                            disablekb: ${if (isHost) 0 else 1},
                                            fs: $controlsFlag,
                                            playsinline: 1,
                                            rel: 0,
                                            modestbranding: 1,
                                            enablejsapi: 1,
                                            origin: 'https://nexorawatch-beta.vercel.app'
                                        },
                                        events: {
                                            onReady: function(e) {
                                                var dur = 0;
                                                try { dur = e.target.getDuration() || 0; } catch (_) {}
                                                if (window.NexoraYTBridge) window.NexoraYTBridge.onReady(dur);
                                                setInterval(function() {
                                                    if (!player || typeof player.getCurrentTime !== 'function') return;
                                                    try {
                                                        var t = player.getCurrentTime() || 0;
                                                        var s = player.getPlayerState();
                                                        if (window.NexoraYTBridge) window.NexoraYTBridge.onTick(t, s);
                                                    } catch (_) {}
                                                }, 500);
                                            },
                                            onStateChange: function(e) {
                                                var t = 0;
                                                try { t = e.target.getCurrentTime() || 0; } catch (_) {}
                                                if (window.NexoraYTBridge) window.NexoraYTBridge.onStateChange(e.data, t);
                                            },
                                            onError: function(e) {
                                                if (window.NexoraYTBridge) window.NexoraYTBridge.onError(e.data || -1);
                                            }
                                        }
                                    });
                                }
                                window.nexoraSyncSeek = function(sec) {
                                    if (player && typeof player.seekTo === 'function') {
                                        player.seekTo(sec, true);
                                    }
                                };
                                window.nexoraSyncPlay = function() {
                                    if (player && typeof player.playVideo === 'function') {
                                        player.playVideo();
                                    }
                                };
                                window.nexoraSyncPause = function() {
                                    if (player && typeof player.pauseVideo === 'function') {
                                        player.pauseVideo();
                                    }
                                };
                            </script>
                        </body>
                        </html>
                    """.trimIndent()

                    loadDataWithBaseURL(
                        "https://nexorawatch-beta.vercel.app",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                    )
                    webViewRef = this
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
