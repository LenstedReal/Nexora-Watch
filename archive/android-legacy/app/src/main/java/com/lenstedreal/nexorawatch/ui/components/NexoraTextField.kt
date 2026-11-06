package com.lenstedreal.nexorawatch.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrand
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurface
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary

@Composable
fun NexoraTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    modifier: Modifier = Modifier,
    leadingIcon: (@Composable () -> Unit)? = null,
    maxLength: Int = 100,
    textStyle: TextStyle = TextStyle(
        color = NexoraOnSurface,
        fontSize = 15.sp,
        fontWeight = FontWeight.Normal
    ),
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    singleLine: Boolean = true,
    testTag: String = "nexora_text_field"
) {
    var isFocused by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = NexoraMuted,
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        val borderColor = if (isFocused) NexoraBrand else NexoraBorder

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 52.dp)
                .background(NexoraSurfaceTertiary, RoundedCornerShape(12.dp))
                .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .onFocusChanged { isFocused = it.isFocused },
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(10.dp))
            }

            Box(modifier = Modifier.weight(1f)) {
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        style = textStyle.copy(color = NexoraMuted)
                    )
                }

                BasicTextField(
                    value = value,
                    onValueChange = {
                        if (it.length <= maxLength) {
                            onValueChange(it)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag(testTag),
                    textStyle = textStyle,
                    cursorBrush = SolidColor(NexoraBrand),
                    keyboardOptions = keyboardOptions,
                    keyboardActions = keyboardActions,
                    singleLine = singleLine
                )
            }
        }
    }
}
