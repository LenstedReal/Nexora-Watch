import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../theme";
import { useT } from "../i18n";
import {
  DESKTOP_UA,
  SERVICE_BRANDS,
  allowedInServicePlayer,
  commandScript,
  controllerScript,
  parseServiceReport,
  type Role,
  type ServiceCommand,
  type ServiceId,
  type ServiceReport,
} from "../core/serviceController";

/**
 * In-app subscription services (beta). The service's own website in a WebView: the person signs in with their OWN
 * account (cookies stay in the app's shared cookie store, so the next time they are still signed in). The injected
 * controller only reads / drives the page's player like a remote control; nothing of the stream is read or copied.
 * The overlay can be made small (a corner box that keeps playing) so the room and its chat stay reachable.
 */
export type ServiceSession = { service: ServiceId; url: string; role: Role; key: number };

export function ServicePlayer({
  session,
  commandRef,
  onReport,
  onClose,
}: {
  session: ServiceSession | null;
  /** App.tsx calls commandRef.current(cmd) for "service_cmd" messages from the room */
  commandRef: MutableRefObject<((c: ServiceCommand) => void) | null>;
  onReport: (r: ServiceReport) => void;
  onClose: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const view = useRef<WebView>(null);
  const [small, setSmall] = useState(false);
  const role = useRef<Role>("guest");

  useEffect(() => {
    setSmall(false);
    role.current = session?.role ?? "guest";
  }, [session?.key]);

  useEffect(() => {
    commandRef.current = session
      ? (c) => {
          if (c.cmd === "role") role.current = c.role;
          view.current?.injectJavaScript(commandScript(c));
        }
      : null;
    return () => {
      commandRef.current = null;
    };
  }, [session, commandRef]);

  if (!session) return null;
  const brand = SERVICE_BRANDS[session.service];
  const boxW = Math.min(220, Math.round(width * 0.46));
  const boxStyle = small
    ? { position: "absolute" as const, right: 10, bottom: 10 + insets.bottom + 56, width: boxW, height: Math.round((boxW * 9) / 16), borderRadius: 12 }
    : { ...StyleSheet.absoluteFillObject, paddingTop: insets.top };

  return (
    <View style={[styles.box, boxStyle]} pointerEvents="box-none">
      {!small && (
        <View style={styles.bar}>
          <View style={[styles.logo, { backgroundColor: brand.color }]}>
            <Text style={styles.logoText}>{brand.letter}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {brand.name}
          </Text>
          <Text style={styles.beta}>{t("sp_beta")}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("close")} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1 }} pointerEvents={small ? "none" : "auto"}>
        <WebView
          key={session.key}
          ref={view}
          source={{ uri: session.url }}
          // The services send phones to their own apps; their desktop sites play in a browser.
          userAgent={DESKTOP_UA}
          injectedJavaScript={controllerScript({ service: session.service, role: session.role })}
          injectedJavaScriptForMainFrameOnly
          onMessage={(e) => {
            const r = parseServiceReport(e.nativeEvent.data);
            if (r) onReport(r);
          }}
          // Sign-in pages and the player stay here; app links (intent:, market:, nflx:) are not opened.
          onShouldStartLoadWithRequest={(req) => allowedInServicePlayer(req.url)}
          onRenderProcessGone={() => view.current?.reload()}
          onContentProcessDidTerminate={() => view.current?.reload()}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          originWhitelist={["https://*", "about:*", "blob:*", "data:*"]}
          style={styles.web}
        />
      </View>
      {/* Back to the room (chat, people); the page keeps playing in a small box. Tapping the box opens it again. */}
      {small ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSmall(false)} accessibilityLabel={t("sp_expand")} />
      ) : (
        <Pressable style={[styles.fab, { bottom: 18 + insets.bottom }]} onPress={() => setSmall(true)} accessibilityLabel={t("sp_back_room")}>
          <Ionicons name="chatbubbles" size={18} color="#fff" />
          <Text style={styles.fabText}>{t("sp_back_room")}</Text>
        </Pressable>
      )}
      {!small && role.current === "guest" && <Text style={[styles.note, { bottom: 24 + insets.bottom }]}>{t("sp_guest")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#000", overflow: "hidden", zIndex: 20, elevation: 20 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.bg },
  logo: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  title: { color: C.text, fontWeight: "800", fontSize: 15, flexShrink: 1 },
  beta: { color: "#000", backgroundColor: "#facc15", fontWeight: "800", fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  iconBtn: { padding: 4 },
  web: { flex: 1, backgroundColor: "#000" },
  fab: { position: "absolute", left: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#7c3aedee" },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  note: { position: "absolute", right: 14, color: "#fff", fontSize: 11, backgroundColor: "#000a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
});
