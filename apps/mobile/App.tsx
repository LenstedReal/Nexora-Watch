import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ExpoLinking from "expo-linking";
import * as ScreenOrientation from "expo-screen-orientation";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Constants from "expo-constants";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./src/theme";
import { WEB_URL } from "./src/core/api";
import { loadLang, t, useT } from "./src/i18n";
import { IntroSplash } from "./src/components/Brand";
import { BrowserModal, type DetectedMedia } from "./src/screens/BrowserModal";

/**
 * Nexora Watch app = the Nexora Watch web app (same screens, same code, always the same version as the website)
 * plus native features the browser cannot offer: the site browser with video detection, screen rotation,
 * keeping the screen on during a room, deep links and the Android back button.
 */
const WEB_HOST = new URL(WEB_URL).host;
const VERSION = Constants.expoConfig?.version ?? "";

/** https://<web>/room/ABC234, nexora://room/ABC234 → the web URL to open. */
export function webUrlFrom(link: string | null): string | null {
  if (!link) return null;
  const m = link.match(/room\/([A-Za-z2-9]{6})(?:[/?#]|$)/);
  return m ? `${WEB_URL}/room/${m[1].toUpperCase()}` : null;
}

const BOOT = `window.__NEXORA_APP__ = { platform: ${JSON.stringify(Platform.OS)}, version: ${JSON.stringify(VERSION)} }; true;`;

function Shell() {
  useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const web = useRef<WebView>(null);
  const canBack = useRef(false);
  const [start, setStart] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [intro, setIntro] = useState(true);
  const [failed, setFailed] = useState(false);
  const [browser, setBrowser] = useState(false);
  const picked = useRef(false);

  useEffect(() => {
    (async () => {
      await loadLang();
      const initial = await ExpoLinking.getInitialURL().catch(() => null);
      setStart(webUrlFrom(initial) ?? WEB_URL);
    })();
    const sub = ExpoLinking.addEventListener("url", ({ url }) => {
      const target = webUrlFrom(url);
      if (target) web.current?.injectJavaScript(`location.href = ${JSON.stringify(target)}; true;`);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (browser) return false; // the modal handles it
      if (canBack.current) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [browser]);

  useEffect(
    () => () => {
      deactivateKeepAwake("room");
      ScreenOrientation.unlockAsync().catch(() => {});
    },
    [],
  );

  const reply = (res: object | null) =>
    web.current?.injectJavaScript(`window.__nexoraPick && window.__nexoraPick(${JSON.stringify(res)}); true;`);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let m: any;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === "open_browser") {
      picked.current = false;
      setBrowser(true);
    } else if (m.type === "orientation") {
      if (m.mode === "landscape") ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      else
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
          .then(() => setTimeout(() => ScreenOrientation.unlockAsync().catch(() => {}), 1200))
          .catch(() => {});
    } else if (m.type === "keep_awake") {
      if (m.on) activateKeepAwakeAsync("room").catch(() => {});
      else deactivateKeepAwake("room");
    }
  }, []);

  const onPick = async (m: DetectedMedia) => {
    picked.current = true;
    reply({ url: m.url, referer: m.page, title: m.title || null, kind: m.kind });
    setBrowser(false);
  };
  const onCloseBrowser = () => {
    if (!picked.current) reply(null);
    setBrowser(false);
  };

  // Our own site stays inside the app; everything else (Play Store, GitHub, mail, other sites) opens outside.
  const onShouldStart = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    if (req.isTopFrame === false) return true;
    const u = req.url;
    if (u.startsWith("about:") || u.startsWith("data:") || u.startsWith("blob:")) return true;
    let host = "";
    try {
      host = new URL(u).host;
    } catch {
      return false;
    }
    if (host === WEB_HOST) return true;
    Linking.openURL(u).catch(() => {});
    return false;
  };

  const retry = () => {
    setFailed(false);
    web.current?.reload();
  };

  return (
    <View style={[styles.root, { paddingTop: landscape ? 0 : insets.top, paddingBottom: landscape ? 0 : insets.bottom }]}>
      <StatusBar style="light" hidden={landscape} />
      {start && (
        <WebView
          ref={web}
          source={{ uri: start }}
          injectedJavaScriptBeforeContentLoaded={BOOT}
          applicationNameForUserAgent={`NexoraWatchApp/${VERSION}`}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStart}
          onNavigationStateChange={(s) => (canBack.current = s.canGoBack)}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500 && e.nativeEvent.url.replace(/\/$/, "") === WEB_URL) setFailed(true);
          }}
          onRenderProcessGone={() => web.current?.reload()}
          onContentProcessDidTerminate={() => web.current?.reload()}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          pullToRefreshEnabled={false}
          overScrollMode="never"
          textZoom={100}
          mixedContentMode="never"
          originWhitelist={["https://*", "http://*", "about:*", "blob:*", "data:*"]}
          style={styles.web}
        />
      )}
      {failed && (
        <View style={styles.fail}>
          <Ionicons name="cloud-offline-outline" size={44} color={C.purple} />
          <Text style={styles.failTitle}>{t("server_down")}</Text>
          <Pressable onPress={retry} style={styles.failBtn}>
            <Text style={styles.failBtnText}>{t("retry")}</Text>
          </Pressable>
        </View>
      )}
      {!loaded && !intro && !failed && (
        <View style={styles.loading}>
          <ActivityIndicator color={C.cyan} size="large" />
        </View>
      )}
      <BrowserModal visible={browser} onClose={onCloseBrowser} onPick={onPick} />
      {intro && <IntroSplash slogan={t("slogan")} onDone={() => setIntro(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  web: { flex: 1, backgroundColor: C.bg },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  fail: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 16, padding: 28, backgroundColor: C.bg },
  failTitle: { color: C.text, fontSize: 16, textAlign: "center" },
  failBtn: { backgroundColor: C.purple, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 14 },
  failBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
