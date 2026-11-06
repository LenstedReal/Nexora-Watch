package com.lenstedreal.nexorawatch.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lenstedreal.nexorawatch.ui.theme.NexoraBorder
import com.lenstedreal.nexorawatch.ui.theme.NexoraBrandSecondary
import com.lenstedreal.nexorawatch.ui.theme.NexoraMuted
import com.lenstedreal.nexorawatch.ui.theme.NexoraOnSurfaceTertiary
import com.lenstedreal.nexorawatch.ui.theme.NexoraSurfaceTertiary

@Composable
fun SourceChip(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    isBeta: Boolean = false,
    onInfoClick: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .border(1.dp, NexoraBorder, RoundedCornerShape(999.dp))
            .background(NexoraSurfaceTertiary, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = NexoraBrandSecondary,
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            color = NexoraOnSurfaceTertiary,
            fontWeight = FontWeight.Medium
        )
        if (isBeta) {
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "(BETA)",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = NexoraBrandSecondary
            )
            if (onInfoClick != null) {
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.HelpOutline,
                    contentDescription = "Bilgi",
                    tint = NexoraMuted,
                    modifier = Modifier
                        .size(13.dp)
                        .clickable(onClick = onInfoClick)
                )
            }
        }
    }
}
