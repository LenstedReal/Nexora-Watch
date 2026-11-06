import { memo, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, avatarColor } from "../theme";
import { Avatar } from "./ui";
import { REACTIONS } from "../core/useRoom";
import type { ChatMessage } from "../core/types";

function time(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const Bubble = memo(function Bubble({ m, mine, grouped }: { m: ChatMessage; mine: boolean; grouped: boolean }) {
  if (m.kind === "system") {
    return (
      <View style={styles.sysRow}>
        <Text style={styles.sys}>{m.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.row, mine && { flexDirection: "row-reverse" }, grouped && { marginTop: 2 }]}>
      <View style={{ width: 30 }}>{!grouped && !mine && <Avatar name={m.nickname} seed={m.participant_id ?? m.nickname} size={30} />}</View>
      <View style={{ maxWidth: "78%", alignItems: mine ? "flex-end" : "flex-start" }}>
        {!grouped && !mine && <Text style={[styles.name, { color: avatarColor(m.participant_id ?? m.nickname) }]}>{m.nickname}</Text>}
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          <Text style={styles.text}>{m.text}</Text>
          <Text style={styles.time}>{time(m.created_at)}</Text>
        </View>
      </View>
    </View>
  );
});

export function Chat({
  messages,
  me,
  onSend,
  onReact,
}: {
  messages: ChatMessage[];
  me: string;
  onSend: (t: string) => void;
  onReact: (e: string) => void;
}) {
  const [text, setText] = useState("");
  const data = useMemo(() => [...messages].reverse(), [messages]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 1000));
    setText("");
  };
  return (
    <View style={{ flex: 1 }}>
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={34} color={C.dim} />
          <Text style={styles.emptyText}>Henüz mesaj yok. İlk merhabayı sen de!</Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const older = data[index + 1];
            const grouped = !!older && older.kind !== "system" && item.kind !== "system" && older.participant_id === item.participant_id;
            return <Bubble m={item} mine={item.participant_id === me} grouped={grouped} />;
          }}
        />
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 10 }} keyboardShouldPersistTaps="handled">
        {REACTIONS.map((e) => (
          <Pressable key={e} onPress={() => onReact(e)} style={({ pressed }) => [styles.emoji, pressed && { transform: [{ scale: 0.88 }] }]}>
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Mesaj yaz…"
          placeholderTextColor={C.dim}
          selectionColor={C.cyan}
          style={styles.input}
          maxLength={1000}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <Pressable onPress={send} style={[styles.send, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  name: { fontSize: 12, fontWeight: "800", marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  mine: { backgroundColor: C.purpleDeep, borderWidth: 1, borderColor: C.purple + "66", borderBottomRightRadius: 5 },
  theirs: { backgroundColor: C.cardHi, borderBottomLeftRadius: 5 },
  text: { color: C.text, fontSize: 15, flexShrink: 1 },
  time: { color: C.muted, fontSize: 10 },
  sysRow: { alignItems: "center", marginVertical: 6 },
  sys: { color: C.muted, fontSize: 12, backgroundColor: C.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, overflow: "hidden" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: C.muted, fontSize: 14 },
  emojiBar: { flexGrow: 0, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border },
  emoji: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, paddingTop: 4 },
  input: { flex: 1, backgroundColor: C.input, color: C.text, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15, borderWidth: 1, borderColor: C.border },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
});
