import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { ApiError, WEB_URL, api, errorText, type ReportReason } from "../core/api";
import { store } from "../core/storage";
import { MAX_ATTEMPTS, TERMINAL, useRoom, type ConnStatus } from "../core/useRoom";
import { usePlaybackSync } from "../core/usePlaybackSync";
import { VIDEO_EXT, UploadCancelled, fileSize, startUpload } from "../core/upload";
import type { ChatMessage, Identity, JoinResponse, Participant, Room } from "../core/types";
import { t as tt, useT, type TKey } from "../i18n";
import type { PlayerHandle } from "../components/players";
import { Stage } from "../components/Stage";
import { Chat } from "../components/Chat";
import { People } from "../components/People";
import { SourcePanel, isDriveUrl, type UploadState } from "../components/SourcePanel";
import { Reactions } from "../components/Reactions";
import { ActionSheet, type SheetOption } from "../components/ActionSheet";
import { Button, Field, IconButton, Segmented } from "../components/ui";
import { BrowserModal, type DetectedMedia } from "./BrowserModal";

const GATE_KEY: Partial<Record<string, TKey>> = {
  room_closed: "gate_closed",
  room_expired: "gate_expired",
  room_not_found: "gate_notfound",
  replaced: "gate_replaced",
  kicked: "gate_kicked",
};

export function RoomScreen({ code, initial, onExit }: { code: string; initial?: JoinResponse; onExit: () => void }) {
  const t = useT();
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
          store.removeRecent(code);
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

  const onIdentLost = useCallback(
    async (reason: "kicked" | "unauthorized") => {
      await store.setIdent(code, null);
      setIdent(null);
      setRoom(null);
      if (reason === "kicked") {
        await store.removeRecent(code);
        setGate("kicked");
      }
    },
    [code],
  );

  if (loading) return <Centered><ActivityIndicator color={C.cyan} size="large" /></Centered>;
  if (gate && !gate.startsWith("error:")) return <Gate title={t(GATE_KEY[gate] ?? "gate_default")} onExit={onExit} />;
  if (!ident || !room || gate) {
    return (
      <Gate title={t("join_title", { code })} onExit={onExit} error={gate?.startsWith("error:") ? gate.slice(6) : undefined}>
        <Field label={t("nickname")} icon="person" value={nick} onChangeText={setNick} maxLength={24} placeholder={t("nickname_ph")} autoFocus />
        <Button title={t("join_btn")} icon="enter" loading={joining} disabled={!nick.trim()} onPress={() => join(nick.trim(), ident)} />
      </Gate>
    );
  }
  return <RoomView key={ident.participant_id} code={code} ident={ident} initialRoom={room} onExit={onExit} onIdentLost={onIdentLost} />;
}

type Sheet = { title: string; subtitle?: string; options: SheetOption[] } | null;

function RoomView({
  code,
  ident,
  initialRoom,
  onExit,
  onIdentLost,
}: {
  code: string;
  ident: Identity;
  initialRoom: Room;
  onExit: () => void;
  onIdentLost: (reason: "kicked" | "unauthorized") => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    setNotice(msg);
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
  const [sheet, setSheet] = useState<Sheet>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [sideChat, setSideChat] = useState(false);
  const uploadCtl = useRef<{ cancel: () => void } | null>(null);
  const importPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const video = room.video;
  const syncable = !!video && video.capabilities?.sync !== false && video.kind !== "drive_embed";
  const sync = usePlaybackSync({ conn, isHost, ident, player: playerRef, syncable, mediaId: video?.media_id ?? null });

  useEffect(() => {
    store.getBlocked().then(setBlocked);
  }, []);
  const messages = useMemo(() => conn.messages.filter((m) => !m.participant_id || !blocked.includes(m.participant_id)), [conn.messages, blocked]);

  const msgCount = messages.length;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (msgCount && tabRef.current !== "chat") setUnread((u) => u + 1);
  }, [msgCount]);

  useEffect(() => {
    if (conn.status === "unauthorized") onIdentLost("unauthorized");
    if (conn.status === "kicked") onIdentLost("kicked");
  }, [conn.status, onIdentLost]);

  // Leaving the room always restores free rotation.
  useEffect(
    () => () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      uploadCtl.current?.cancel();
      if (importPoll.current) clearInterval(importPoll.current);
    },
    [],
  );

  const toggleLandscape = useCallback(async () => {
    try {
      if (landscape) {
        // Back to portrait, then release the lock so turning the phone works normally again.
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setTimeout(() => ScreenOrientation.unlockAsync().catch(() => {}), 1200);
      } else {
        // Stay in landscape until the user exits full screen (button or back).
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
    } catch {
      /* orientation API unavailable */
    }
  }, [landscape]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (browser) {
        setBrowser(false);
        return true;
      }
      if (landscape) {
        toggleLandscape();
        return true;
      }
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [browser, landscape, onExit, toggleLandscape]);

  const switchTab = (k: "chat" | "people" | "video") => {
    setTab(k);
    if (k === "chat") setUnread(0);
  };

  if (TERMINAL.includes(conn.status) && conn.status !== "unauthorized" && conn.status !== "kicked") {
    return <Gate title={t(GATE_KEY[conn.status] ?? "gate_default")} onExit={onExit} />;
  }

  // ---- actions ---------------------------------------------------------------------------------------------
  const importDrive = async (url: string) => {
    const res = await api.importDrive(code, ident, url);
    setUpload({ name: res.filename, sent: 0, total: res.size, kind: "drive" });
    if (importPoll.current) clearInterval(importPoll.current);
    importPoll.current = setInterval(async () => {
      try {
        const st = await api.importStatus(res.media_id, ident);
        if (st.status === "completed") {
          if (importPoll.current) clearInterval(importPoll.current);
          setUpload(null);
          toast(t("drive_done"));
          switchTab("chat");
        } else if (st.status === "failed") {
          if (importPoll.current) clearInterval(importPoll.current);
          setUpload(null);
          toast(st.error || t("drive_failed"));
        } else setUpload((u) => (u ? { ...u, sent: st.bytes_done, total: st.size || u.total } : u));
      } catch {
        /* keep polling */
      }
    }, 1500);
  };

  const setUrl = async (url: string, extra?: { referer?: string; title?: string }) => {
    try {
      if (isDriveUrl(url) && !extra?.referer) {
        await importDrive(url);
        return;
      }
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
    if (!perm.granted) return toast(t("gallery_perm"));
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
      if (!fromMime) return toast(t("formats"));
      ext = fromMime;
    }
    const fileName = name.includes(".") ? name : `${name}.${ext}`;
    const size = await fileSize(a.uri, a.fileSize);
    if (!size) return toast(t("size_unknown"));
    setUpload({ name: fileName, sent: 0, total: size, kind: "upload" });
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
      toast(t("uploaded"));
      switchTab("chat");
    } catch (e) {
      if (!(e instanceof UploadCancelled)) toast(errorText(e));
    } finally {
      uploadCtl.current = null;
      setUpload(null);
    }
  };

  const share = async () => {
    const lines = [t("invite_1", { name: room.name }), t("invite_2", { code })];
    if (WEB_URL) lines.push(`${WEB_URL}/room/${code}`);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      /* dismissed */
    }
  };

  const reportFlow = (target: { id: string | null; nickname: string }, messageId?: string) => {
    const reasons: [ReportReason, TKey][] = [
      ["spam", "r_spam"],
      ["abuse", "r_abuse"],
      ["sexual", "r_sexual"],
      ["violence", "r_violence"],
      ["copyright", "r_copyright"],
      ["other", "r_other"],
    ];
    setSheet({
      title: t("report_title"),
      subtitle: target.nickname,
      options: reasons.map(([reason, label]) => ({
        label: t(label),
        onPress: () =>
          api
            .report(code, ident, { target_id: target.id, message_id: messageId, reason })
            .then(() => toast(t("report_sent")))
            .catch((e) => toast(errorText(e))),
      })),
    });
  };

  const toggleBlock = async (id: string, nickname: string) => {
    const next = blocked.includes(id) ? blocked.filter((x) => x !== id) : [...blocked, id];
    setBlocked(next);
    await store.setBlocked(next);
    if (next.includes(id)) toast(t("block_done", { n: nickname }));
  };

  const personOptions = (p: { id: string; nickname: string; is_host?: boolean }, messageId?: string): SheetOption[] => {
    const opts: SheetOption[] = [
      { label: t("report"), icon: "flag-outline", onPress: () => setTimeout(() => reportFlow({ id: p.id, nickname: p.nickname }, messageId), 250) },
      { label: blocked.includes(p.id) ? t("unblock") : t("block"), icon: "eye-off-outline", onPress: () => toggleBlock(p.id, p.nickname) },
    ];
    if (isHost && !p.is_host && p.id !== ident.participant_id) {
      opts.push({
        label: t("kick"),
        icon: "exit-outline",
        danger: true,
        onPress: () =>
          Alert.alert(t("kick"), t("kick_confirm", { n: p.nickname }), [
            { text: t("cancel"), style: "cancel" },
            { text: t("kick"), style: "destructive", onPress: () => api.kick(code, ident, p.id).then(conn.setRoom).catch((e) => toast(errorText(e))) },
          ]),
      });
    }
    return opts;
  };

  const onMessageAction = (m: ChatMessage) => {
    if (!m.participant_id) return;
    const p = room.participants.find((x) => x.id === m.participant_id);
    setSheet({ title: m.nickname, subtitle: m.text, options: personOptions({ id: m.participant_id, nickname: m.nickname, is_host: p?.is_host }, m.id) });
  };
  const onPersonAction = (p: Participant) => setSheet({ title: p.nickname, options: personOptions(p) });

  const menu = () => {
    const opts: SheetOption[] = [
      { label: t("fullscreen"), icon: "phone-landscape-outline", onPress: toggleLandscape },
      {
        label: t("leave"),
        icon: "log-out-outline",
        onPress: async () => {
          await api.leave(code, ident).catch(() => {});
          onExit();
        },
      },
    ];
    if (isHost) {
      opts.push({
        label: t("close_room"),
        icon: "power",
        danger: true,
        onPress: () =>
          Alert.alert(t("close_room"), t("close_room_msg"), [
            { text: t("cancel"), style: "cancel" },
            { text: t("close"), style: "destructive", onPress: () => api.close(code, ident).catch((e) => toast(errorText(e))) },
          ]),
      });
    }
    setSheet({ title: room.name, subtitle: `${t("room_code")}: ${code}`, options: opts });
  };

  const pick = async (m: DetectedMedia) => {
    try {
      await setUrl(m.url, { referer: m.page, title: m.title || undefined });
      setBrowser(false);
    } catch {
      /* toast already shown */
    }
  };

  const chat = (
    <Chat
      messages={messages}
      me={ident.participant_id}
      onSend={(text) => conn.sendChat(text).catch((e) => toast(errorText(e)))}
      onReact={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        conn.sendReaction(e);
      }}
      onMessageAction={onMessageAction}
    />
  );

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
      {!landscape && (
        <Pressable onPress={toggleLandscape} style={styles.fsBtn} hitSlop={8} accessibilityLabel={t("fullscreen")}>
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );

  const overlays = (
    <>
      {notice && (
        <View pointerEvents="none" style={[styles.toast, { top: (landscape ? 12 : insets.top + 64) }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
      <BrowserModal visible={browser} onClose={() => setBrowser(false)} onPick={pick} />
      <ActionSheet visible={!!sheet} title={sheet?.title ?? ""} subtitle={sheet?.subtitle} options={sheet?.options ?? []} onClose={() => setSheet(null)} />
    </>
  );

  if (landscape) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#000" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar hidden />
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            {stage}
            <View style={[styles.lsBar, { left: insets.left + 10 }]}>
              <Pressable onPress={toggleLandscape} style={styles.lsBtn} accessibilityLabel={t("fullscreen")}>
                <Ionicons name="contract" size={18} color="#fff" />
              </Pressable>
              <Pressable onPress={() => setSideChat((v) => !v)} style={[styles.lsBtn, sideChat && { backgroundColor: C.purple }]} accessibilityLabel={t("chat_toggle")}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
          {sideChat && <View style={[styles.side, { paddingRight: insets.right }]}>{chat}</View>}
        </View>
        <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} floating />
        {overlays}
      </KeyboardAvoidingView>
    );
  }

  const online = room.participants.filter((p) => p.online).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevron-back" onPress={onExit} label={t("home")} />
        <View style={{ flex: 1 }}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.name}
          </Text>
          <Pressable
            style={styles.codeRow}
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              toast(t("code_copied"));
            }}
          >
            <View style={[styles.dot, { backgroundColor: conn.status === "connected" ? C.success : conn.status === "failed" ? C.error : C.warning }]} />
            <Text style={styles.code}>{code}</Text>
            <Ionicons name="copy-outline" size={12} color={C.cyan} />
            <Text style={styles.online}> · {t("online_n", { n: online })}</Text>
          </Pressable>
        </View>
        <IconButton icon="person-add" onPress={share} color={C.cyan} label="+" />
        <IconButton icon="ellipsis-horizontal" onPress={menu} label="..." />
      </View>
      <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} />
      {stage}
      <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
        <Segmented
          value={tab}
          onChange={switchTab}
          options={[
            { key: "chat", label: t("tab_chat"), icon: "chatbubble-ellipses", badge: tab === "chat" ? 0 : unread },
            { key: "people", label: t("tab_people"), icon: "people" },
            ...(isHost ? [{ key: "video" as const, label: t("tab_video"), icon: "film" as const }] : []),
          ]}
        />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
        {tab === "chat" && chat}
        {tab === "people" && <People people={room.participants} me={ident.participant_id} buffering={conn.peerBuffering} onAction={onPersonAction} />}
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
      {overlays}
    </KeyboardAvoidingView>
  );
}

function ConnectionBanner({ status, attempt, onRetry, floating }: { status: ConnStatus; attempt: number; onRetry: () => void; floating?: boolean }) {
  const t = useT();
  if (status === "connected" || status === "connecting") return null;
  const failed = status === "failed";
  return (
    <View style={[styles.banner, floating && styles.bannerFloat, failed && { borderColor: C.error + "88" }]}>
      {failed ? <Ionicons name="cloud-offline" size={16} color={C.error} /> : <ActivityIndicator size="small" color={C.warning} />}
      <Text style={styles.bannerText}>{failed ? t("conn_failed") : t("reconnecting", { a: attempt, m: MAX_ATTEMPTS })}</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={{ color: C.cyan, fontWeight: "800" }}>{t("retry")}</Text>
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
        {!children && <Button title={tt("home")} variant="ghost" icon="home" onPress={onExit} style={{ alignSelf: "stretch" }} />}
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
  bannerFloat: { position: "absolute", top: 12, left: 70, right: 12 },
  bannerText: { flex: 1, color: C.text, fontSize: 13 },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: C.cardHi, borderColor: C.purple + "66", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, maxWidth: "90%" },
  toastText: { color: C.text, fontSize: 13, fontWeight: "600", textAlign: "center" },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  gateTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  fsBtn: { position: "absolute", right: 10, top: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  lsBar: { position: "absolute", top: 12, gap: 10 },
  lsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  side: { width: 320, maxWidth: "42%", backgroundColor: C.bg, borderLeftWidth: 1, borderLeftColor: C.border },
});
