import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { ROUTE_REPORTER, adsEnabled, initialAdState, onBackground, onResume, onRoute, routeOf, type AdEffects, type AdIds } from "./src/core/ads";
import { NexoraAds } from "./modules/nexora-ads/src";

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

// "caps" tells the web app what this version of the app can do, so the web side never has to compare version numbers.
const BOOT = `window.__NEXORA_APP__ = { platform: ${JSON.stringify(Platform.OS)}, version: ${JSON.stringify(VERSION)}, caps: ["open_external"] }; ${ROUTE_REPORTER} true;`;

// InMobi IDs: filled at build time from EXPO_PUBLIC_INMOBI_* (app.config.js `extra.inmobi`). Empty = no ads at all.
const AD_IDS: Partial<AdIds> = (Constants.expoConfig?.extra as any)?.inmobi ?? {};
const ADS_ON = Platform.OS === "android" && NexoraAds != null && adsEnabled(AD_IDS);
// No consent tool (CMP) yet: consent unavailable -> non-personalised, no device identifiers. See docs/ADS.md.
const AD_CONSENT = JSON.stringify({ gdpr_consent_available: false, gdpr: "1" });

/** Only our own site may be sent to the phone's browser: pages shown inside the room (video players) can post messages too. */
export function isOwnWebUrl(url: unknown): url is string {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  try {
    return new URL(url).host === WEB_HOST;
  } catch {
    return false;
  }
}

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
  const ads = useRef(initialAdState(ADS_ON ? AD_IDS : null, Date.now()));
  const [bannerWanted, setBannerWanted] = useState(false);
  const [bannerH, setBannerH] = useState(0);

  const applyAds = useCallback((e: AdEffects) => {
    if (!ADS_ON) return;
    setBannerWanted(e.banner);
    try {
      if (e.preloadInterstitial) NexoraAds!.loadInterstitial(AD_IDS.interstitialId!);
      if (e.showInterstitial) NexoraAds!.showInterstitial(AD_IDS.interstitialId!);
    } catch {}
  }, []);
  const routeChanged = useCallback(
    (urlOrPath: string) => {
      const [s, e] = onRoute(ads.current, routeOf(urlOrPath, WEB_HOST), Date.now());
      if (s.route === ads.current.route && !e.showInterstitial) return;
      ads.current = s;
      applyAds(e);
    },
    [applyAds],
  );

  useEffect(() => {
    if (!ADS_ON) return;
    try {
      NexoraAds!.init(AD_IDS.accountId!, AD_CONSENT, true);
    } catch {}
    const ev = NexoraAds!.addListener("onBanner", (b) => setBannerH(b.visible ? b.height : 0));
    const st = AppState.addEventListener("change", (state) => {
      const [s, e] = state === "active" ? onResume(ads.current, Date.now()) : onBackground(ads.current);
      ads.current = s;
      applyAds(e);
    });
    return () => {
      ev.remove();
      st.remove();
    };
  }, [applyAds]);

  // The banner is native and sits above the navigation bar; the WebView is padded by its height so it never covers content.
  const showBanner = ADS_ON && bannerWanted && !intro && !failed && !browser;
  const navInset = landscape ? 0 : Math.round(insets.bottom);
  useEffect(() => {
    if (!ADS_ON) return;
    try {
      if (showBanner) NexoraAds!.showBanner(AD_IDS.bannerId!, navInset);
      else NexoraAds!.hideBanner();
    } catch {}
  }, [showBanner, navInset]);
  const adPad = showBanner ? bannerH : 0;

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
    } else if (m.type === "route") {
      // SPA navigation reported by ROUTE_REPORTER (pushState / replaceState / popstate).
      if (typeof m.path === "string") routeChanged(m.path);
    } else if (m.type === "open_external") {
      // "Watch on the web": the website opens in the phone's browser.
      if (isOwnWebUrl(m.url)) Linking.openURL(m.url).catch(() => {});
    }
  }, [routeChanged]);

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
    <View style={[styles.root, { paddingTop: landscape ? 0 : insets.top, paddingBottom: (landscape ? 0 : insets.bottom) + adPad }]}>
      <StatusBar style="light" hidden={landscape} />
      {start && (
        <WebView
          ref={web}
          source={{ uri: start }}
          injectedJavaScriptBeforeContentLoaded={BOOT}
          applicationNameForUserAgent={`NexoraWatchApp/${VERSION}`}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStart}
          onNavigationStateChange={(s) => {
            canBack.current = s.canGoBack;
            if (s.url) routeChanged(s.url);
          }}
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
