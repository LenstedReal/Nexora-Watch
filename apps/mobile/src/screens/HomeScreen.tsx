import { useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { DEFAULT_SERVER, FALLBACK_CONFIG, api, errorText, getServer, loadConfig, normalizeServer, setServer, type AppConfig } from "../core/api";
import { store, type RecentRoom } from "../core/storage";
import type { JoinResponse } from "../core/types";
import { useT, type TKey } from "../i18n";
import { Button, Field, IconButton, Segmented } from "../components/ui";
import { GlowBackground, GlowCard, GradientButton, RaveBadge } from "../components/Brand";
import { LangSwitch } from "./ConsentScreen";

const CODE_RE = /^[A-Z2-9]{6}$/;

export function HomeScreen({ onEnter, onOpenCode }: { onEnter: (code: string, res: JoinResponse) => void; onOpenCode: (code: string) => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nick, setNick] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [settings, setSettings] = useState(false);
  const [cfg, setCfg] = useState<AppConfig>(FALLBACK_CONFIG);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    (async () => {
      setNick(await store.getNickname());
      setRecent(await store.getRecent());
      setCfg(await loadConfig());
      api.health().then(() => setServerDown(false), () => setServerDown(true));
    })();
  }, []);

  const submit = async () => {
    setError(null);
    const n = nick.trim();
    if (!n) return setError(t("need_nick"));
    const c = code.trim().toUpperCase();
    if (mode === "join" && !CODE_RE.test(c)) return setError(t("need_code"));
    setBusy(true);
    try {
      await store.setNickname(n);
      const res =
        mode === "create"
          ? await api.createRoom(n, roomName.trim() || t("room_name_default", { nick: n }).slice(0, 48))
          : await api.joinRoom(c, n, await store.getIdent(c));
      await store.setIdent(res.room.code, { participant_id: res.participant.id, token: res.token, nickname: n });
      setServerDown(false);
      onEnter(res.room.code, res);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const features: [string, TKey][] = [
    ["sync", "feat_sync"],
    ["globe-outline", "feat_detect"],
    ["logo-youtube", "feat_sources"],
    ["cloud-upload-outline", "feat_upload"],
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <GlowBackground />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <LangSwitch />
          <View style={{ flex: 1 }} />
          <IconButton icon="settings-outline" onPress={() => setSettings(true)} label={t("settings")} />
        </View>

        <View style={styles.hero}>
          <View style={styles.logoGlow}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} />
          </View>
          <RaveBadge />
          <Text style={styles.brand}>Nexora Watch</Text>
          <Text style={styles.slogan}>{t("slogan")}</Text>
          <Text style={styles.tagline}>{t("tagline")}</Text>
        </View>

        {serverDown && (
          <View style={styles.down}>
            <Ionicons name="cloud-offline-outline" size={16} color={C.warning} />
            <Text style={styles.downText}>{t("server_down")}</Text>
          </View>
        )}

        <GlowCard>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { key: "create", label: t("tab_create"), icon: "add-circle" },
              { key: "join", label: t("tab_join"), icon: "enter" },
            ]}
          />
          <Field label={t("nickname")} icon="person" value={nick} onChangeText={setNick} placeholder={t("nickname_ph")} maxLength={24} autoCorrect={false} />
          {mode === "create" ? (
            <Field
              label={t("room_name")}
              icon="tv"
              value={roomName}
              onChangeText={setRoomName}
              placeholder={nick ? t("room_name_default", { nick }) : t("room_name_ph")}
              maxLength={48}
            />
          ) : (
            <Field
              label={t("room_code")}
              icon="key"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ letterSpacing: 4, fontWeight: "800" }}
            />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <GradientButton title={mode === "create" ? t("create") : t("join")} icon={mode === "create" ? "sparkles" : "arrow-forward"} loading={busy} onPress={submit} />
        </GlowCard>

        {recent.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.section}>{t("recent")}</Text>
            {recent.map((r) => (
              <Pressable key={r.code} onPress={() => onOpenCode(r.code)} style={({ pressed }) => [styles.recent, pressed && { opacity: 0.8 }]}>
                <View style={styles.recentIcon}>
                  <Ionicons name="play" size={16} color={C.cyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.recentCode}>{r.code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.dim} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.features}>
          {features.map(([icon, k]) => (
            <View key={k} style={styles.feature}>
              <Ionicons name={icon as any} size={16} color={C.purple} />
              <Text style={styles.featureText}>{t(k)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.copy}>© LenstedReal · {cfg.contact_email}</Text>
      </ScrollView>

      <SettingsSheet visible={settings} cfg={cfg} onClose={() => setSettings(false)} onServerChanged={() => api.health().then(() => setServerDown(false), () => setServerDown(true))} />
    </KeyboardAvoidingView>
  );
}

function SettingsSheet({ visible, cfg, onClose, onServerChanged }: { visible: boolean; cfg: AppConfig; onClose: () => void; onServerChanged: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [advanced, setAdvanced] = useState(false);
  const [value, setValue] = useState(getServer());
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });

  useEffect(() => {
    if (visible) {
      setValue(getServer());
      setAdvanced(false);
      setState({ busy: false, msg: null, ok: false });
    }
  }, [visible]);

  const test = async (save: boolean) => {
    const url = normalizeServer(value);
    if (!url) return setState({ busy: false, msg: t("empty_url"), ok: false });
    const prev = getServer();
    setServer(url);
    setState({ busy: true, msg: null, ok: false });
    try {
      await api.health();
      if (save) {
        await store.setServer(url === DEFAULT_SERVER ? null : url);
        setState({ busy: false, msg: t("test_ok"), ok: true });
        onServerChanged();
      } else {
        setServer(prev);
        setState({ busy: false, msg: t("test_ok"), ok: true });
      }
    } catch (e) {
      setServer(prev);
      setState({ busy: false, msg: t("unreachable", { e: errorText(e) }), ok: false });
    }
  };

  const legal: [TKey, string][] = [
    ["privacy", cfg.legal.privacy],
    ["terms", cfg.legal.terms],
    ["kvkk", cfg.legal.kvkk],
    ["copyright", cfg.legal.copyright],
    ["delete_data", cfg.legal.delete_data],
    ["child_safety", cfg.legal.child_safety],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.sheetTitle}>{t("settings")}</Text>
            <View style={{ flex: 1 }} />
            <IconButton icon="close" onPress={onClose} label={t("close")} />
          </View>

          <Text style={styles.section}>{t("language")}</Text>
          <LangSwitch />

          <Text style={styles.section}>{t("legal")}</Text>
          <View style={{ gap: 2 }}>
            {legal.map(([k, u]) => (
              <Pressable key={k} style={styles.row} onPress={() => Linking.openURL(u).catch(() => {})}>
                <Text style={styles.rowText}>{t(k)}</Text>
                <Ionicons name="open-outline" size={16} color={C.muted} />
              </Pressable>
            ))}
            <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${cfg.contact_email}`).catch(() => {})}>
              <Text style={styles.rowText}>
                {t("contact")} · {cfg.contact_email}
              </Text>
              <Ionicons name="mail-outline" size={16} color={C.muted} />
            </Pressable>
          </View>

          <Pressable style={styles.row} onPress={() => setAdvanced((a) => !a)}>
            <Text style={[styles.rowText, { color: C.muted }]}>{t("advanced")}</Text>
            <Ionicons name={advanced ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
          </Pressable>
          {advanced && (
            <View style={{ gap: 10 }}>
              <Text style={styles.hint}>{t("server_hint")}</Text>
              <Field value={value} onChangeText={setValue} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" icon="server" />
              {state.msg && <Text style={{ color: state.ok ? C.success : C.error }}>{state.msg}</Text>}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button title={t("test")} variant="ghost" style={{ flex: 1 }} onPress={() => test(false)} disabled={state.busy} />
                <Button title={t("save")} style={{ flex: 1 }} loading={state.busy} onPress={() => test(true)} />
              </View>
              <Pressable onPress={() => setValue(DEFAULT_SERVER)}>
                <Text style={{ color: C.cyan, textAlign: "center", fontSize: 13 }}>{t("reset_default")}</Text>
              </Pressable>
              {state.busy && <ActivityIndicator color={C.cyan} />}
            </View>
          )}
          <Text style={styles.version}>{t("version", { v: Constants.expoConfig?.version ?? "" })}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hero: { alignItems: "center", gap: 10, paddingVertical: 4 },
  logoGlow: { borderRadius: 30, shadowColor: C.purple, shadowOpacity: 0.8, shadowRadius: 26, elevation: 14, backgroundColor: C.card, marginBottom: 4 },
  logo: { width: 96, height: 96, borderRadius: 28 },
  brand: { color: C.text, fontSize: 36, fontWeight: "900", letterSpacing: 0.3, textShadowColor: C.purple, textShadowRadius: 18 },
  slogan: { color: C.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  tagline: { color: C.muted, fontSize: 14, textAlign: "center" },
  down: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: R.md, backgroundColor: C.warning + "14", borderWidth: 1, borderColor: C.warning + "55" },
  downText: { flex: 1, color: C.text, fontSize: 13 },
  error: { color: C.error, fontSize: 13 },
  section: { color: C.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  recent: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.border },
  recentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cyan + "18", alignItems: "center", justifyContent: "center" },
  recentName: { color: C.text, fontSize: 15, fontWeight: "700" },
  recentCode: { color: C.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 2 },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  featureText: { color: C.text, fontSize: 12, fontWeight: "600" },
  copy: { color: C.dim, fontSize: 11, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { maxHeight: "86%", backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderTopWidth: 1, borderColor: C.border },
  sheetTitle: { color: C.text, fontSize: 22, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  rowText: { color: C.text, fontSize: 15, flex: 1 },
  hint: { color: C.muted, fontSize: 12 },
  version: { color: C.dim, fontSize: 12, textAlign: "center", marginTop: 4 },
});
