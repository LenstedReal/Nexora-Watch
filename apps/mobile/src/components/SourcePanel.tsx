import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { C, R } from "../theme";
import { Button, Field, type IconName } from "./ui";
import type { VideoSource } from "../core/types";

export type UploadState = { name: string; sent: number; total: number } | null;

const KIND_LABEL: Record<string, string> = {
  youtube: "YouTube",
  direct: "Video dosyası",
  hls: "Canlı/HLS akış",
  upload: "Yüklenen video",
  drive_embed: "Google Drive (senkronsuz)",
};

function Tile({ icon, title, sub, onPress, color }: { icon: IconName; title: string; sub: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      <View style={[styles.tileIcon, { backgroundColor: color + "22", borderColor: color + "55" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.dim} />
    </Pressable>
  );
}

export function SourcePanel({
  video,
  upload,
  onSetUrl,
  onOpenBrowser,
  onPickFile,
  onCancelUpload,
  onClear,
}: {
  video: VideoSource | null;
  upload: UploadState;
  onSetUrl: (url: string) => Promise<void>;
  onOpenBrowser: () => void;
  onPickFile: () => void;
  onCancelUpload: () => void;
  onClear: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await onSetUrl(url.trim());
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  const pct = upload && upload.total ? Math.round((upload.sent / upload.total) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
      {video && (
        <View style={styles.now}>
          <Ionicons name="play-circle" size={22} color={C.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nowLabel}>ŞU AN · {KIND_LABEL[video.kind] ?? video.kind}</Text>
            <Text style={styles.nowTitle} numberOfLines={1}>
              {video.title || video.url}
            </Text>
          </View>
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={C.muted} />
          </Pressable>
        </View>
      )}
      {!!video?.warning && <Text style={styles.warn}>{video.warning}</Text>}

      <Field
        icon="link"
        value={url}
        onChangeText={setUrl}
        placeholder="YouTube, MP4, M3U8 veya Drive bağlantısı"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title="Yapıştır"
          icon="clipboard-outline"
          variant="soft"
          style={{ flex: 1 }}
          onPress={async () => setUrl((await Clipboard.getStringAsync()).trim())}
        />
        <Button title="Oynat" icon="play" style={{ flex: 1.4 }} loading={busy} disabled={!url.trim()} onPress={submit} />
      </View>

      <Tile icon="globe-outline" color={C.cyan} title="Siteden video algıla" sub="Bir siteyi aç, oynatılan video otomatik bulunur" onPress={onOpenBrowser} />

      {upload ? (
        <View style={styles.upload}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="cloud-upload" size={18} color={C.purple} />
            <Text style={styles.tileTitle} numberOfLines={1}>
              {upload.name}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.tileSub}>
              %{pct} · {(upload.sent / 1048576).toFixed(1)} / {(upload.total / 1048576).toFixed(1)} MB
            </Text>
            <Pressable onPress={onCancelUpload} hitSlop={8}>
              <Text style={{ color: C.error, fontWeight: "700" }}>İptal</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Tile icon="images-outline" color={C.purple} title="Galeriden yükle" sub="MP4, MOV, WebM · en fazla 2 GB" onPress={onPickFile} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  now: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.cardHi, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.cyan + "33" },
  nowLabel: { color: C.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  nowTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  warn: { color: C.warning, fontSize: 12 },
  tile: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.border },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tileTitle: { color: C.text, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  tileSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  upload: { backgroundColor: C.card, borderRadius: R.md, padding: 14, gap: 10, borderWidth: 1, borderColor: C.purple + "55" },
  track: { height: 8, backgroundColor: C.input, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, backgroundColor: C.purple, borderRadius: 4 },
});
