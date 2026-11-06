import { ScrollView, StyleSheet, Text, View } from "react-native";
import { C } from "../theme";
import { Avatar, Badge } from "./ui";
import type { Participant } from "../core/types";

export function People({ people, me, buffering }: { people: Participant[]; me: string; buffering: Record<string, boolean> }) {
  const sorted = [...people].sort((a, b) => Number(b.is_host) - Number(a.is_host) || Number(b.online) - Number(a.online));
  const online = people.filter((p) => p.online).length;
  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }}>
      <Text style={styles.head}>
        {online} çevrimiçi · {people.length} kişi
      </Text>
      {sorted.map((p) => (
        <View key={p.id} style={styles.row}>
          <Avatar name={p.nickname} seed={p.id} online={p.online} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, !p.online && { color: C.muted }]} numberOfLines={1}>
              {p.nickname}
              {p.id === me ? <Text style={{ color: C.muted, fontWeight: "500" }}> (sen)</Text> : null}
            </Text>
            <Text style={styles.sub}>{!p.online ? "Çevrimdışı" : buffering[p.id] ? "Yükleniyor…" : "İzliyor"}</Text>
          </View>
          {p.is_host && <Badge text="HOST" />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { color: C.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  name: { color: C.text, fontSize: 15, fontWeight: "700" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
});
