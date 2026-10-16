package com.lenstedreal.nexorawatch.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = NexoraBrand,
    onPrimary = NexoraOnBrand,
    secondary = NexoraBrandSecondary,
    onSecondary = NexoraOnSurface,
    tertiary = NexoraBrandTertiary,
    background = NexoraSurface,
    onBackground = NexoraOnSurface,
    surface = NexoraSurface,
    onSurface = NexoraOnSurface,
    surfaceVariant = NexoraSurfaceSecondary,
    onSurfaceVariant = NexoraOnSurfaceSecondary,
    outline = NexoraBorder,
    outlineVariant = NexoraBorderStrong,
    error = NexoraError,
    onError = NexoraOnSurface
)

@Composable
fun NexoraWatchTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = NexoraSurface.toArgb()
                window.navigationBarColor = NexoraSurface.toArgb()
                val controller = WindowCompat.getInsetsController(window, view)
                controller.isAppearanceLightStatusBars = false
                controller.isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
