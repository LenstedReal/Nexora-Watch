import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { C, R } from "../theme";
import { useT, type TKey } from "../i18n";
import { Button, Field, type IconName } from "./ui";
import type { VideoSource } from "../core/types";

/** Upload or Drive import in progress. */
export type UploadState = { name: string; sent: number; total: number; kind?: "upload" | "drive" } | null;

export const isDriveUrl = (u: string) => /drive\.google\.com|drive\.usercontent\.google\.com/i.test(u);

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
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await onSetUrl(url.trim());
      setUrl("");
    } catch {
      /* error already shown */
    } finally {
      setBusy(false);
    }
  };

  const pct = upload && upload.total ? Math.min(100, Math.round((upload.sent / upload.total) * 100)) : 0;
  const kindKey = video ? (`k_${video.kind}` as TKey) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
      {video && (
        <View style={styles.now}>
          <Ionicons name="play-circle" size={22} color={C.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nowLabel}>
              {t("now")} · {kindKey ? t(kindKey) : video.kind}
            </Text>
            <Text style={styles.nowTitle} numberOfLines={1}>
              {video.title || video.url}
            </Text>
          </View>
          <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={t("close")}>
            <Ionicons name="close-circle" size={22} color={C.muted} />
          </Pressable>
        </View>
      )}
      {!!video?.warning && <Text style={styles.warn}>{video.warning}</Text>}

      <Field
        icon="link"
        value={url}
        onChangeText={setUrl}
        placeholder={t("link_ph")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {isDriveUrl(url) && (
        <View style={styles.info}>
          <Ionicons name="information-circle" size={16} color={C.cyan} />
          <Text style={styles.infoText}>{t("drive_hint")}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={t("paste")} icon="clipboard-outline" variant="soft" style={{ flex: 1 }} onPress={async () => setUrl((await Clipboard.getStringAsync()).trim())} />
        <Button title={t("play")} icon="play" style={{ flex: 1.4 }} loading={busy} disabled={!url.trim() || !!upload} onPress={submit} />
      </View>

      <Tile icon="globe-outline" color={C.cyan} title={t("detect_t")} sub={t("detect_d")} onPress={onOpenBrowser} />

      {upload ? (
        <View style={styles.upload}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={upload.kind === "drive" ? "logo-google" : "cloud-upload"} size={18} color={C.purple} />
            <Text style={styles.tileTitle} numberOfLines={1}>
              {upload.kind === "drive" ? `${t("drive_importing")} · ` : ""}
              {upload.name}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(pct, 3)}%` }]} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.tileSub}>
              %{pct} · {(upload.sent / 1048576).toFixed(1)} / {upload.total ? (upload.total / 1048576).toFixed(1) : "?"} MB
            </Text>
            {upload.kind !== "drive" && (
              <Pressable onPress={onCancelUpload} hitSlop={8}>
                <Text style={{ color: C.error, fontWeight: "700" }}>{t("cancel")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <Tile icon="images-outline" color={C.purple} title={t("gallery_t")} sub={t("gallery_d")} onPress={onPickFile} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  now: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.cardHi, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.cyan + "33" },
  nowLabel: { color: C.cyan, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  nowTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  warn: { color: C.warning, fontSize: 12 },
  info: { flexDirection: "row", gap: 8, backgroundColor: C.cyan + "12", borderColor: C.cyan + "40", borderWidth: 1, borderRadius: R.sm, padding: 10 },
  infoText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 17 },
  tile: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: C.border },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tileTitle: { color: C.text, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  tileSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  upload: { backgroundColor: C.card, borderRadius: R.md, padding: 14, gap: 10, borderWidth: 1, borderColor: C.purple + "55" },
  track: { height: 8, backgroundColor: C.input, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, backgroundColor: C.purple, borderRadius: 4 },
});
