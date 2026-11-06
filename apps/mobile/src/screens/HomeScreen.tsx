import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { DEFAULT_SERVER, api, errorText, getServer, normalizeServer, setServer } from "../core/api";
import { store, type RecentRoom } from "../core/storage";
import type { JoinResponse } from "../core/types";
import { Button, Card, Field, IconButton, Segmented } from "../components/ui";

const CODE_RE = /^[A-Z2-9]{6}$/;

export function HomeScreen({ onEnter, onOpenCode }: { onEnter: (code: string, res: JoinResponse) => void; onOpenCode: (code: string) => void }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nick, setNick] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [settings, setSettings] = useState(false);
  const [server, setServerState] = useState(getServer());

  const refresh = useCallback(async () => {
    setNick((n) => n);
    setRecent(await store.getRecent());
  }, []);

  useEffect(() => {
    (async () => {
      setNick(await store.getNickname());
      setRecent(await store.getRecent());
    })();
  }, []);

  const submit = async () => {
    setError(null);
    const n = nick.trim();
    if (!n) return setError("Önce bir rumuz gir");
    if (!getServer()) {
      setSettings(true);
      return setError("Önce sunucu adresini ayarla");
    }
    const c = code.trim().toUpperCase();
    if (mode === "join" && !CODE_RE.test(c)) return setError("6 haneli oda kodunu gir");
    setBusy(true);
    try {
      await store.setNickname(n);
      const res = mode === "create" ? await api.createRoom(n, roomName.trim()) : await api.joinRoom(c, n, await store.getIdent(c));
      await store.setIdent(res.room.code, { participant_id: res.participant.id, token: res.token, nickname: n });
      onEnter(res.room.code, res);
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={[styles.serverPill, { borderColor: server ? C.success + "55" : C.warning + "88" }]}>
            <View style={[styles.dot, { backgroundColor: server ? C.success : C.warning }]} />
            <Text style={styles.serverText} numberOfLines={1}>
              {server ? server.replace(/^https?:\/\//, "") : "Sunucu ayarlanmadı"}
            </Text>
          </View>
          <IconButton icon="settings-outline" onPress={() => setSettings(true)} label="Ayarlar" />
        </View>

        <View style={styles.hero}>
          <View style={styles.logoGlow}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} />
          </View>
          <Text style={styles.brand}>Nexora Watch</Text>
          <Text style={styles.tagline}>Arkadaşlarınla aynı anda, aynı saniyede izle.</Text>
        </View>

        <Card style={{ gap: 14 }}>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { key: "create", label: "Oda kur", icon: "add-circle" },
              { key: "join", label: "Katıl", icon: "enter" },
            ]}
          />
          <Field label="Rumuz" icon="person" value={nick} onChangeText={setNick} placeholder="Adın" maxLength={24} autoCorrect={false} />
          {mode === "create" ? (
            <Field label="Oda adı (isteğe bağlı)" icon="tv" value={roomName} onChangeText={setRoomName} placeholder={nick ? `${nick}'in odası` : "Film gecesi"} maxLength={48} />
          ) : (
            <Field
              label="Oda kodu"
              icon="key"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ letterSpacing: 4, fontWeight: "800" }}
            />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title={mode === "create" ? "Odayı oluştur" : "Odaya katıl"} icon={mode === "create" ? "sparkles" : "arrow-forward"} loading={busy} onPress={submit} />
        </Card>

        {recent.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.section}>Son odalar</Text>
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
          {[
            ["sync", "Saniyesi saniyesine senkron"],
            ["globe-outline", "Sitelerden video algılama"],
            ["logo-youtube", "YouTube, MP4, HLS, Drive"],
            ["cloud-upload-outline", "Galeriden video yükleme"],
          ].map(([icon, text]) => (
            <View key={text} style={styles.feature}>
              <Ionicons name={icon as any} size={16} color={C.purple} />
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ServerSheet
        visible={settings}
        onClose={() => setSettings(false)}
        onSaved={(u) => {
          setServerState(u);
          setSettings(false);
          setError(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ServerSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (url: string) => void }) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(getServer());
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });

  useEffect(() => {
    if (visible) {
      setValue(getServer());
      setState({ busy: false, msg: null, ok: false });
    }
  }, [visible]);

  const test = async (save: boolean) => {
    const url = normalizeServer(value);
    if (!url) return setState({ busy: false, msg: "Adres boş olamaz", ok: false });
    const prev = getServer();
    setServer(url);
    setState({ busy: true, msg: null, ok: false });
    try {
      await api.health();
      if (save) {
        await store.setServer(url);
        onSaved(url);
      } else {
        setServer(prev);
        setState({ busy: false, msg: "Bağlantı başarılı", ok: true });
      }
    } catch (e) {
      setServer(prev);
      setState({ busy: false, msg: `Ulaşılamadı: ${errorText(e)}`, ok: false });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.sheetTitle}>Sunucu</Text>
        <Text style={styles.sheetSub}>Nexora backend adresi (ör. https://api.alanadin.com veya test için http://192.168.1.20:8001)</Text>
        <Field value={value} onChangeText={setValue} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" icon="server" />
        {state.msg && <Text style={{ color: state.ok ? C.success : C.error }}>{state.msg}</Text>}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Test et" variant="ghost" style={{ flex: 1 }} onPress={() => test(false)} disabled={state.busy} />
          <Button title="Kaydet" style={{ flex: 1 }} loading={state.busy} onPress={() => test(true)} />
        </View>
        {!!DEFAULT_SERVER && (
          <Pressable onPress={() => setValue(DEFAULT_SERVER)}>
            <Text style={{ color: C.cyan, textAlign: "center" }}>Varsayılana dön ({DEFAULT_SERVER.replace(/^https?:\/\//, "")})</Text>
          </Pressable>
        )}
        {state.busy && <ActivityIndicator color={C.cyan} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  serverPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: R.pill, paddingHorizontal: 12, height: 36, backgroundColor: C.card },
  serverText: { color: C.muted, fontSize: 12, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: { alignItems: "center", gap: 8, paddingVertical: 6 },
  logoGlow: { borderRadius: 28, shadowColor: C.purple, shadowOpacity: 0.7, shadowRadius: 24, elevation: 12, backgroundColor: C.card },
  logo: { width: 92, height: 92, borderRadius: 26 },
  brand: { color: C.text, fontSize: 30, fontWeight: "900", letterSpacing: 0.3, marginTop: 8 },
  tagline: { color: C.muted, fontSize: 15, textAlign: "center" },
  error: { color: C.error, fontSize: 13 },
  section: { color: C.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  recent: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.border },
  recentIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cyan + "18", alignItems: "center", justifyContent: "center" },
  recentName: { color: C.text, fontSize: 15, fontWeight: "700" },
  recentCode: { color: C.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: 2 },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  featureText: { color: C.text, fontSize: 12, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, borderTopWidth: 1, borderColor: C.border },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "800" },
  sheetSub: { color: C.muted, fontSize: 13 },
});
