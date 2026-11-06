import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, R, avatarColor, initials } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Button({
  title,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "ghost" | "danger" | "soft";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const bg = variant === "primary" ? C.purple : variant === "danger" ? C.error : variant === "soft" ? C.cardHi : "transparent";
  const fg = variant === "ghost" ? C.text : "#fff";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === "ghost" && { borderWidth: 1, borderColor: C.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = C.text,
  size = 20,
  bg = C.cardHi,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  bg?: string;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field(props: ComponentProps<typeof TextInput> & { label?: string; icon?: IconName }) {
  const { label, icon, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrap}>
        {icon && <Ionicons name={icon} size={18} color={C.muted} />}
        <TextInput placeholderTextColor={C.dim} selectionColor={C.cyan} style={[styles.input, style]} {...rest} />
      </View>
    </View>
  );
}

export function Avatar({ name, seed, size = 34, online }: { name: string; seed: string; size?: number; online?: boolean }) {
  return (
    <View>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(seed) }]}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.38 }}>{initials(name)}</Text>
      </View>
      {online !== undefined && (
        <View style={[styles.dot, { backgroundColor: online ? C.success : C.dim, right: -1, bottom: -1 }]} />
      )}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ text, color = C.purple }: { text: string; color?: string }) {
  return (
    <View style={[styles.badge, { borderColor: color + "66", backgroundColor: color + "1F" }]}>
      <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>{text}</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; icon?: IconName; badge?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.segItem, on && styles.segOn]}>
            {o.icon && <Ionicons name={o.icon} size={16} color={on ? C.text : C.muted} />}
            <Text style={[styles.segText, { color: on ? C.text : C.muted }]}>{o.label}</Text>
            {!!o.badge && (
              <View style={styles.segBadge}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{o.badge > 99 ? "99+" : o.badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: R.md,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { fontSize: 15, fontWeight: "800" },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { color: C.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.input,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 13 },
  avatar: { alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: C.card },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 16 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: R.pill, borderWidth: 1 },
  seg: { flexDirection: "row", backgroundColor: C.input, borderRadius: R.md, padding: 4, gap: 4 },
  segItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 11 },
  segOn: { backgroundColor: C.purpleDeep, borderWidth: 1, borderColor: C.purple + "88" },
  segText: { fontSize: 14, fontWeight: "700" },
  segBadge: { backgroundColor: C.error, borderRadius: 9, minWidth: 18, paddingHorizontal: 4, alignItems: "center" },
});
