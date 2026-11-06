import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../theme";
import type { IconName } from "./ui";

export type SheetOption = { label: string; icon?: IconName; danger?: boolean; onPress: () => void };

/** Bottom action sheet (Android Alert supports only 3 buttons). */
export function ActionSheet({ visible, title, subtitle, options, onClose }: { visible: boolean; title: string; subtitle?: string; options: SheetOption[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.handle} />
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.sub} numberOfLines={3}>
            {subtitle}
          </Text>
        )}
        {options.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => {
              onClose();
              o.onPress();
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.cardHi }]}
          >
            {o.icon && <Ionicons name={o.icon} size={20} color={o.danger ? C.error : C.text} />}
            <Text style={[styles.label, o.danger && { color: C.error }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderColor: C.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 10 },
  title: { color: C.text, fontSize: 16, fontWeight: "800", paddingHorizontal: 8 },
  sub: { color: C.muted, fontSize: 13, paddingHorizontal: 8, marginTop: 4, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 10, borderRadius: 12 },
  label: { color: C.text, fontSize: 15, fontWeight: "600" },
});
