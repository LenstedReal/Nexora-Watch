import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C, GRAD } from "../theme";
import type { IconName } from "./ui";

export { GRAD as GRADIENT } from "../theme";

/** Soft neon blobs behind a screen. Pure Views (no blur lib needed). */
export function GlowBackground() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const drift = v.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.blob, { top: -120, left: -90, backgroundColor: C.blue, transform: [{ translateX: drift }] }]} />
      <Animated.View style={[styles.blob, { top: 180, right: -140, backgroundColor: C.purple, opacity: 0.13, transform: [{ translateY: drift }] }]} />
      <Animated.View style={[styles.blob, { bottom: -160, left: 20, backgroundColor: C.violet, opacity: 0.1 }]} />
    </View>
  );
}

export function GradientButton({
  title,
  onPress,
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
      <LinearGradient colors={[...GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={18} color="#fff" />}
            <Text style={styles.btnText}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function RaveBadge() {
  return (
    <LinearGradient colors={[C.blue + "40", C.purple + "40"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
      <Ionicons name="flash" size={13} color={C.cyan} />
      <Text style={styles.badgeText}>BETTER THAN RAVE</Text>
    </LinearGradient>
  );
}

export function GlowCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={[C.blue + "77", C.border, C.purple + "77"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cardOuter, style]}>
      <View style={styles.cardInner}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", width: 320, height: 320, borderRadius: 160, opacity: 0.16 },
  btn: { height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.cyan + "55" },
  badgeText: { color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  cardOuter: { borderRadius: 22, padding: 1 },
  cardInner: { backgroundColor: "rgba(20,20,31,0.96)", borderRadius: 21, padding: 16, gap: 14 },
});

/** Animated intro shown after the native splash: logo pops in with a neon glow, then the wordmark and slogan. */
export function IntroSplash({ slogan, onDone }: { slogan: string; onDone: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.spring(logo, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(text, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(out, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
  }, [logo, glow, text, out, onDone]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, introStyles.intro, { opacity: out }]}>
      <GlowBackground />
      <Animated.View
        style={[
          introStyles.introRing,
          { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.25] }) }] },
        ]}
      />
      <Animated.Image
        source={require("../../assets/logo.png")}
        style={[introStyles.introLogo, { opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}
      />
      <Animated.View style={{ alignItems: "center", gap: 10, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Text style={introStyles.introTitle}>Nexora Watch</Text>
        <LinearGradient colors={[...GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={introStyles.introLine} />
        <Text style={introStyles.introSlogan}>{slogan}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const introStyles = StyleSheet.create({
  intro: { backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 26, zIndex: 100 },
  introRing: { position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderColor: C.purple, shadowColor: C.cyan, shadowOpacity: 1, shadowRadius: 40, elevation: 20 },
  introLogo: { width: 128, height: 128, borderRadius: 34 },
  introTitle: { color: C.text, fontSize: 32, fontWeight: "900", letterSpacing: 0.5, textShadowColor: C.purple, textShadowRadius: 20 },
  introLine: { width: 120, height: 3, borderRadius: 2 },
  introSlogan: { color: C.muted, fontSize: 15, textAlign: "center", paddingHorizontal: 30 },
});
