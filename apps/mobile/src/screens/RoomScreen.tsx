import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { ApiError, WEB_URL, api, errorText } from "../core/api";
import { store } from "../core/storage";
import { MAX_ATTEMPTS, TERMINAL, useRoom } from "../core/useRoom";
import { usePlaybackSync } from "../core/usePlaybackSync";
import { VIDEO_EXT, UploadCancelled, fileSize, startUpload } from "../core/upload";
import type { Identity, JoinResponse, Room } from "../core/types";
import type { PlayerHandle } from "../components/players";
import { Stage } from "../components/Stage";
import { Chat } from "../components/Chat";
import { People } from "../components/People";
import { SourcePanel, type UploadState } from "../components/SourcePanel";
import { Reactions } from "../components/Reactions";
import { Button, Field, IconButton, Segmented } from "../components/ui";
import { BrowserModal, type DetectedMedia } from "./BrowserModal";

const GATE_TEXT: Record<string, string> = {
  room_closed: "Oda sahibi odayı kapattı",
  room_expired: "Bu odanın süresi doldu",
  room_not_found: "Oda bulunamadı",
  replaced: "Bu odaya başka bir cihazdan bağlandın",
};

export function RoomScreen({ code, initial, onExit }: { code: string; initial?: JoinResponse; onExit: () => void }) {
  const [ident, setIdent] = useState<Identity | null>(
    initial ? { participant_id: initial.participant.id, token: initial.token, nickname: initial.participant.nickname } : null,
  );
  const [room, setRoom] = useState<Room | null>(initial?.room ?? null);
  const [gate, setGate] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [nick, setNick] = useState("");
  const [joining, setJoining] = useState(false);

  const join = useCallback(
    async (nickname: string, existing: Identity | null) => {
      setJoining(true);
      try {
        const res = await api.joinRoom(code, nickname, existing);
        const next = { participant_id: res.participant.id, token: res.token, nickname };
        await store.setIdent(code, next);
        await store.setNickname(nickname);
        await store.pushRecent({ code, name: res.room.name, at: Date.now() });
        setRoom(res.room);
        setIdent(next);
        setGate(null);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 410)) {
          setGate(e.code);
          if (e.status === 404) store.removeRecent(code);
        } else setGate(`error:${errorText(e)}`);
      } finally {
        setJoining(false);
        setLoading(false);
      }
    },
    [code],
  );

  useEffect(() => {
    if (initial) {
      store.pushRecent({ code, name: initial.room.name, at: Date.now() });
      return;
    }
    (async () => {
      const saved = await store.getIdent(code);
      setNick((await store.getNickname()) || "");
      if (saved) await join(saved.nickname, saved);
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (loading) return <Centered><ActivityIndicator color={C.cyan} size="large" /></Centered>;
  if (gate && !gate.startsWith("error:")) return <Gate title={GATE_TEXT[gate] ?? "Odaya girilemedi"} onExit={onExit} />;
  if (!ident || !room || gate) {
    return (
      <Gate title={`Odaya katıl · ${code}`} onExit={onExit} error={gate?.startsWith("error:") ? gate.slice(6) : undefined}>
        <Field label="Rumuz" icon="person" value={nick} onChangeText={setNick} maxLength={24} placeholder="Adın" autoFocus />
        <Button title="Katıl" icon="enter" loading={joining} disabled={!nick.trim()} onPress={() => join(nick.trim(), ident)} />
      </Gate>
    );
  }
  return (
    <RoomView
      key={ident.participant_id}
      code={code}
      ident={ident}
      initialRoom={room}
      onExit={onExit}
      onIdentLost={async () => {
        await store.setIdent(code, null);
        setIdent(null);
        setRoom(null);
      }}
    />
  );
}

function RoomView({ code, ident, initialRoom, onExit, onIdentLost }: { code: string; ident: Identity; initialRoom: Room; onExit: () => void; onIdentLost: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((t: string) => {
    setNotice(t);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  const conn = useRoom(code, ident, initialRoom, toast);
  const { room } = conn;
  const isHost = room.host_id === ident.participant_id;
  const [tab, setTab] = useState<"chat" | "people" | "video">(isHost && !room.video ? "video" : "chat");
  const [unread, setUnread] = useState(0);
  const [browser, setBrowser] = useState(false);
  const [upload, setUpload] = useState<UploadState>(null);
  const uploadCtl = useRef<{ cancel: () => void } | null>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const video = room.video;
  const syncable = !!video && video.capabilities?.sync !== false && video.kind !== "drive_embed";
  const sync = usePlaybackSync({ conn, isHost, ident, player: playerRef, syncable, mediaId: video?.media_id ?? null });

  const msgCount = conn.messages.length;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (msgCount && tabRef.current !== "chat") setUnread((u) => u + 1);
  }, [msgCount]);

  useEffect(() => {
    if (conn.status === "unauthorized") onIdentLost();
  }, [conn.status, onIdentLost]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (browser) {
        setBrowser(false);
        return true;
      }
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [browser, onExit]);

  useEffect(() => () => uploadCtl.current?.cancel(), []);

  const switchTab = (k: "chat" | "people" | "video") => {
    setTab(k);
    if (k === "chat") setUnread(0);
  };

  if (TERMINAL.includes(conn.status) && conn.status !== "unauthorized") {
    return <Gate title={GATE_TEXT[conn.status] ?? "Bağlantı kapandı"} onExit={onExit} />;
  }

  const setUrl = async (url: string, extra?: { referer?: string; title?: string }) => {
    try {
      conn.setRoom(await api.setVideo(code, ident, url, extra));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      switchTab("chat");
    } catch (e) {
      toast(errorText(e));
      throw e;
    }
  };

  const pickFile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast("Galeri izni gerekli");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const name = a.fileName || a.uri.split("/").pop() || `video-${Date.now()}.mp4`;
    let ext = (name.split(".").pop() || "").toLowerCase();
    if (!VIDEO_EXT[ext]) {
      const fromMime = Object.entries(VIDEO_EXT).find(([, m]) => m === a.mimeType)?.[0];
      if (!fromMime) return toast("Desteklenen formatlar: MP4, MOV, M4V, WebM");
      ext = fromMime;
    }
    const fileName = name.includes(".") ? name : `${name}.${ext}`;
    const size = await fileSize(a.uri, a.fileSize);
    if (!size) return toast("Dosya boyutu okunamadı");
    setUpload({ name: fileName, sent: 0, total: size });
    const ctl = startUpload({
      code,
      ident,
      uri: a.uri,
      fileName,
      size,
      mime: VIDEO_EXT[ext],
      onProgress: (p) => setUpload((u) => (u ? { ...u, sent: p.sent, total: p.total } : u)),
    });
    uploadCtl.current = ctl;
    try {
      await ctl.promise;
      toast("Video yüklendi, oynatılıyor");
      switchTab("chat");
    } catch (e) {
      if (!(e instanceof UploadCancelled)) toast(errorText(e));
    } finally {
      uploadCtl.current = null;
      setUpload(null);
    }
  };

  const share = async () => {
    const lines = [`Nexora Watch odama katıl: ${room.name}`, `Oda kodu: ${code}`];
    if (WEB_URL) lines.push(`${WEB_URL}/room/${code}`);
    lines.push(`nexora://room/${code}`);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      /* dismissed */
    }
  };

  const menu = () => {
    const buttons: { text: string; style?: "destructive" | "cancel"; onPress?: () => void }[] = [
      {
        text: "Odadan çık",
        onPress: async () => {
          await api.leave(code, ident).catch(() => {});
          onExit();
        },
      },
    ];
    if (isHost) {
      buttons.push({
        text: "Odayı kapat",
        style: "destructive",
        onPress: () =>
          Alert.alert("Odayı kapat", "Oda herkes için kapanacak.", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Kapat", style: "destructive", onPress: () => api.close(code, ident).catch((e) => toast(errorText(e))) },
          ]),
      });
    }
    buttons.push({ text: "Vazgeç", style: "cancel" });
    Alert.alert(room.name, `Kod: ${code}`, buttons);
  };

  const stage = (
    <View style={landscape ? { flex: 1 } : undefined}>
      <Stage
        video={video}
        isHost={isHost}
        ident={ident}
        playerRef={playerRef}
        fill={landscape}
        onAddVideo={() => switchTab("video")}
        onPlayerError={() => sync.reportError()}
      />
      <Reactions items={conn.reactions} />
    </View>
  );

  const pick = async (m: DetectedMedia) => {
    try {
      await setUrl(m.url, { referer: m.page, title: m.title || undefined });
      setBrowser(false);
    } catch {
      /* toast already shown */
    }
  };

  if (landscape) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar hidden />
        {stage}
        <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} floating />
        <BrowserModal visible={browser} onClose={() => setBrowser(false)} onPick={pick} />
      </View>
    );
  }

  const online = room.participants.filter((p) => p.online).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevron-back" onPress={onExit} label="Geri" />
        <View style={{ flex: 1 }}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.name}
          </Text>
          <Pressable
            style={styles.codeRow}
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              toast("Oda kodu kopyalandı");
            }}
          >
            <View style={[styles.dot, { backgroundColor: conn.status === "connected" ? C.success : conn.status === "failed" ? C.error : C.warning }]} />
            <Text style={styles.code}>{code}</Text>
            <Ionicons name="copy-outline" size={12} color={C.cyan} />
            <Text style={styles.online}> · {online} çevrimiçi</Text>
          </Pressable>
        </View>
        <IconButton icon="person-add" onPress={share} color={C.cyan} label="Davet et" />
        <IconButton icon="ellipsis-horizontal" onPress={menu} label="Menü" />
      </View>
      <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} />
      {stage}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <Segmented
          value={tab}
          onChange={switchTab}
          options={[
            { key: "chat", label: "Sohbet", icon: "chatbubble-ellipses", badge: tab === "chat" ? 0 : unread },
            { key: "people", label: "Kişiler", icon: "people" },
            ...(isHost ? [{ key: "video" as const, label: "Video", icon: "film" as const }] : []),
          ]}
        />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {tab === "chat" && (
          <Chat
            messages={conn.messages}
            me={ident.participant_id}
            onSend={(t) => conn.sendChat(t).catch((e) => toast(errorText(e)))}
            onReact={(e) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              conn.sendReaction(e);
            }}
          />
        )}
        {tab === "people" && <People people={room.participants} me={ident.participant_id} buffering={conn.peerBuffering} />}
        {tab === "video" && isHost && (
          <SourcePanel
            video={video}
            upload={upload}
            onSetUrl={(u) => setUrl(u)}
            onOpenBrowser={() => setBrowser(true)}
            onPickFile={() => pickFile().catch((e) => toast(errorText(e)))}
            onCancelUpload={() => uploadCtl.current?.cancel()}
            onClear={() => api.clearVideo(code, ident).then(conn.setRoom).catch((e) => toast(errorText(e)))}
          />
        )}
      </View>
      {notice && (
        <View pointerEvents="none" style={[styles.toast, { top: insets.top + 64 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
      <BrowserModal visible={browser} onClose={() => setBrowser(false)} onPick={pick} />
    </KeyboardAvoidingView>
  );
}

function ConnectionBanner({ status, attempt, onRetry, floating }: { status: string; attempt: number; onRetry: () => void; floating?: boolean }) {
  if (status === "connected" || status === "connecting") return null;
  const failed = status === "failed";
  return (
    <View style={[styles.banner, floating && styles.bannerFloat, failed && { borderColor: C.error + "88" }]}>
      {failed ? <Ionicons name="cloud-offline" size={16} color={C.error} /> : <ActivityIndicator size="small" color={C.warning} />}
      <Text style={styles.bannerText}>{failed ? "Bağlantı kurulamadı" : `Yeniden bağlanıyor… (${attempt}/${MAX_ATTEMPTS})`}</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={{ color: C.cyan, fontWeight: "800" }}>Yeniden dene</Text>
      </Pressable>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

function Gate({ title, onExit, error, children }: { title: string; onExit: () => void; error?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
        <IconButton icon="chevron-back" onPress={onExit} />
      </View>
      <View style={styles.gate}>
        <Ionicons name="tv-outline" size={44} color={C.purple} />
        <Text style={styles.gateTitle}>{title}</Text>
        {!!error && <Text style={{ color: C.error, textAlign: "center" }}>{error}</Text>}
        <View style={{ width: "100%", gap: 12 }}>{children}</View>
        {!children && <Button title="Ana sayfa" variant="ghost" icon="home" onPress={onExit} style={{ alignSelf: "stretch" }} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: C.bg },
  roomName: { color: C.text, fontSize: 17, fontWeight: "800" },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  code: { color: C.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  online: { color: C.muted, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.warning + "66" },
  bannerFloat: { position: "absolute", top: 12, left: 12, right: 12 },
  bannerText: { flex: 1, color: C.text, fontSize: 13 },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: C.cardHi, borderColor: C.purple + "66", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, maxWidth: "90%" },
  toastText: { color: C.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  gateTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
});
