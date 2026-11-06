import { useEffect, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../theme";
import { FALLBACK_CONFIG, loadConfig, type AppConfig } from "../core/api";
import { store } from "../core/storage";
import { LANGS, getLang, setLang, useT, type TKey } from "../i18n";
import { GlowBackground, GlowCard, GradientButton, RaveBadge } from "../components/Brand";

function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow} hitSlop={4} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
      <View style={[styles.box, on && styles.boxOn]}>{on && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

export function LangSwitch() {
  const t = useT();
  const cur = getLang();
  return (
    <View style={styles.langRow} accessibilityLabel={t("language")}>
      {LANGS.map((l) => (
        <Pressable key={l.key} onPress={() => setLang(l.key)} style={[styles.lang, cur === l.key && styles.langOn]}>
          <Text style={[styles.langText, cur === l.key && { color: "#fff" }]}>{l.key.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** First-launch gate: age (13+) and acceptance of terms / privacy / KVKK. Required by Google Play UGC policy. */
export function ConsentScreen({ onDone }: { onDone: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<AppConfig>(FALLBACK_CONFIG);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    loadConfig().then(setCfg);
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const points: [string, TKey, TKey][] = [
    ["person-outline", "c_p1_t", "c_p1_d"],
    ["time-outline", "c_p2_t", "c_p2_d"],
    ["shield-checkmark-outline", "c_p3_t", "c_p3_d"],
    ["flag-outline", "c_p4_t", "c_p4_d"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <GlowBackground />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <LangSwitch />
        <View style={{ alignItems: "center", gap: 12 }}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} />
          <RaveBadge />
          <Text style={styles.title}>{t("c_welcome")}</Text>
          <Text style={styles.sub}>{t("c_sub")}</Text>
        </View>

        <GlowCard>
          {points.map(([icon, h, d]) => (
            <View key={h} style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name={icon as any} size={18} color={C.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pointTitle}>{t(h)}</Text>
                <Text style={styles.pointText}>{t(d)}</Text>
              </View>
            </View>
          ))}
        </GlowCard>

        <View style={{ gap: 14 }}>
          <Check on={age} onPress={() => setAge(!age)}>
            {t("c_age", { age: cfg.min_age })}
          </Check>
          <Check on={terms} onPress={() => setTerms(!terms)}>
            {t("c_accept")}
          </Check>
          <View style={styles.links}>
            {(
              [
                ["terms", cfg.legal.terms],
                ["privacy", cfg.legal.privacy],
                ["kvkk", cfg.legal.kvkk],
              ] as [TKey, string][]
            ).map(([k, u]) => (
              <Text key={k} style={styles.a} onPress={() => open(u)}>
                {t(k)}
              </Text>
            ))}
          </View>
        </View>

        <GradientButton
          title={t("c_start")}
          icon="arrow-forward"
          disabled={!age || !terms}
          onPress={async () => {
            await store.setConsent();
            onDone();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 22 },
  logo: { width: 84, height: 84, borderRadius: 24 },
  title: { color: C.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  sub: { color: C.muted, fontSize: 14, textAlign: "center" },
  point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pointIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cyan + "16", alignItems: "center", justifyContent: "center" },
  pointTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  pointText: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.dim, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: C.purple, borderColor: C.purple },
  checkText: { flex: 1, color: C.text, fontSize: 14, lineHeight: 20 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingLeft: 36 },
  a: { color: C.cyan, fontWeight: "800", textDecorationLine: "underline", fontSize: 13 },
  langRow: { flexDirection: "row", alignSelf: "flex-end", backgroundColor: C.input, borderRadius: 999, padding: 3, gap: 2 },
  lang: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  langOn: { backgroundColor: C.purple },
  langText: { color: C.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
});
