import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";
import { Avatar, Badge } from "./ui";
import type { Participant } from "../core/types";
import { useT } from "../i18n";

export function People({
  people,
  me,
  buffering,
  onAction,
}: {
  people: Participant[];
  me: string;
  buffering: Record<string, boolean>;
  onAction?: (p: Participant) => void;
}) {
  const sorted = [...people].sort((a, b) => Number(b.is_host) - Number(a.is_host) || Number(b.online) - Number(a.online));
  const t = useT();
  const online = people.filter((p) => p.online).length;
  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }}>
      <Text style={styles.head}>
        {t("people_count", { o: online, n: people.length })}
      </Text>
      {sorted.map((p) => (
        <View key={p.id} style={styles.row}>
          <Avatar name={p.nickname} seed={p.id} online={p.online} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, !p.online && { color: C.muted }]} numberOfLines={1}>
              {p.nickname}
              {p.id === me ? <Text style={{ color: C.muted, fontWeight: "500" }}> {t("you")}</Text> : null}
            </Text>
            <Text style={styles.sub}>{!p.online ? t("offline") : buffering[p.id] ? t("peer_loading") : t("watching")}</Text>
          </View>
          {p.is_host && <Badge text="HOST" />}
          {p.id !== me && onAction && (
            <Pressable hitSlop={8} onPress={() => onAction(p)} style={styles.more} accessibilityLabel="...">
              <Ionicons name="ellipsis-vertical" size={16} color={C.muted} />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { color: C.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  name: { color: C.text, fontSize: 15, fontWeight: "700" },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.input },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
});
