import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { Badge, IconButton } from "../components/ui";
import { FALLBACK_CONFIG, loadConfig, type SiteInfo } from "../core/api";
import { useT } from "../i18n";

export type DetectedMedia = {
  url: string;
  kind: "hls" | "mp4" | "webm" | "video" | "youtube" | "vimeo" | "twitch" | "kick" | "archive" | "tiktok" | "instagram" | "x" | "facebook" | "blocked";
  page: string;
  title: string;
  how: string;
  duration?: number;
};

/**
 * Injected into pages of supported sites (before content loads, so fetch/XHR hooks catch the first manifest request).
 * Finds media via <video>/<source>, fetch(), XMLHttpRequest and the Resource Timing API.
 * Segment files are ignored; blob:/MediaSource players are reported as "blocked" (not shareable).
 */
const DETECTOR = `(function(){
if(window.__nxDetector)return;window.__nxDetector=true;
var seen={};
var RX=/\\.(m3u8|mp4|webm|mov|m4v)(\\?|#|$)/i;
var SKIP=/(\\.ts|\\.m4s|\\.aac|\\.vtt|\\.jpg|\\.png)(\\?|#|$)|\\/init\\.mp4|segment|\\/seg-|\\/frag/i;
function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}
function report(url,how,extra){
  try{
    if(!url||typeof url!=='string')return;
    if(url.indexOf('blob:')===0||url.indexOf('mediasource:')===0){
      var k='blob:'+location.host+location.pathname; if(seen[k])return; seen[k]=1;
      post({t:'media',url:url,how:'blob',page:location.href,title:document.title,blocked:true});return;
    }
    if(url.indexOf('data:')===0)return;
    var abs=new URL(url,location.href).href; if(seen[abs])return; seen[abs]=1;
    var o={t:'media',url:abs,how:how,page:location.href,title:document.title};
    if(extra)for(var x in extra)o[x]=extra[x];
    post(o);
  }catch(e){}
}
function check(u,how){if(typeof u==='string'&&RX.test(u)&&!SKIP.test(u))report(u,how);}
try{var of=window.fetch;if(of){window.fetch=function(i){try{check(typeof i==='string'?i:(i&&i.url),'fetch')}catch(e){}return of.apply(this,arguments)}}}catch(e){}
try{var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{check(String(u),'xhr')}catch(e){}return oo.apply(this,arguments)}}catch(e){}
try{new PerformanceObserver(function(l){l.getEntries().forEach(function(en){check(en.name,'net')})}).observe({type:'resource',buffered:true})}catch(e){}
function scan(){
  try{
    var vs=document.querySelectorAll('video');
    for(var i=0;i<vs.length;i++){
      var v=vs[i],s=v.currentSrc||v.src;
      if(s)report(s,'video',{duration:isFinite(v.duration)?v.duration:0});
      var ss=v.querySelectorAll('source');for(var j=0;j<ss.length;j++){if(ss[j].src)report(ss[j].src,'source')}
    }
  }catch(e){}
}
document.addEventListener('play',function(e){if(e.target&&e.target.tagName==='VIDEO')scan()},true);
document.addEventListener('DOMContentLoaded',scan);
setInterval(scan,1500);
})();true;`;

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
// Sites with an official player in the room: the page itself is offered (the server turns it into that player).
const VIMEO_RE = /^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|album\/\d+\/video\/|showcase\/\d+\/video\/)?(\d{6,12})(?:\/([0-9a-f]{6,16}))?\/?(?:[?#]|$)/i;
const TWITCH_VOD_RE = /^https?:\/\/(?:www\.|m\.)?twitch\.tv\/(?:videos|[A-Za-z0-9_]{3,25}\/(?:v|video))\/(\d{6,12})\/?(?:[?#]|$)/i;
const TWITCH_LIVE_RE = /^https?:\/\/(?:www\.|m\.)?twitch\.tv\/([A-Za-z0-9][A-Za-z0-9_]{2,24})\/?(?:[?#]|$)/i;
const TWITCH_PAGES = new Set(["directory", "videos", "settings", "downloads", "search", "subscriptions", "wallet", "turbo", "store", "jobs",
  "privacy", "legal", "about", "friends", "inventory", "drops", "prime", "team", "teams", "user", "collections", "popout", "moderator",
  "embed", "login", "signup", "following", "broadcast", "partner", "creatorcamp", "bits", "payments", "messages", "activate",
  "annual-recap", "events", "clips", "category", "security", "safety", "ads"]);
// Kick: only a live channel has an official embed (player.kick.com/<channel>); videos/clips are not offered.
const KICK_LIVE_RE = /^https?:\/\/(?:www\.|m\.)?kick\.com\/([A-Za-z0-9][A-Za-z0-9_-]{2,39})\/?(?:[?#]|$)/i;
const KICK_PAGES = new Set(["browse", "categories", "category", "following", "dashboard", "video", "videos", "clips", "search", "settings",
  "about", "terms-of-service", "privacy-policy", "community-guidelines", "dmca-policy", "careers", "help", "login", "signup", "auth",
  "api", "popout", "transactions", "subscriptions", "messages", "creator-program", "leaderboards", "emotes", "store", "download", "apps",
  "mobile", "contact", "partners", "security"]);
const ARCHIVE_RE = /^https?:\/\/(?:www\.)?archive\.org\/details\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})(?:[/?#]|$)/i;
// src2: TikTok / Instagram / X / Facebook posts: the page address is offered; the room plays it in the official embed.
const TIKTOK_RE = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/(\d{15,21})/i;
const IG_RE = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]{5,40})/i;
const X_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[\w]{1,20}\/status(?:es)?\/(\d{5,20})/i;
const FB_RE = /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:watch\/?\?(?:.*&)?v=(\d{6,20})|[\w.-]+\/videos\/(?:[\w.-]+\/)?(\d{6,20})|reel\/(\d{6,20}))/i;
// Their players stream through MediaSource or their own CDNs: what the page loads is never offered for these sites.
const NO_SNIFF = /youtube\.com|youtu\.be|googlevideo\.com|vimeo\.com|vimeocdn\.com|twitch\.tv|ttvnw\.net|kick\.com|tiktok\.com|tiktokcdn|instagram\.com|cdninstagram|fbcdn\.net|facebook\.com|x\.com|twitter\.com|twimg\.com/i;
const PAGE_KINDS = new Set<DetectedMedia["kind"]>(["youtube", "vimeo", "twitch", "archive", "tiktok", "facebook"]);

/** The page being viewed, when it is a video of a site with an official player (or an Internet Archive item). */
export function pageOffer(url: string, title: string, fallbackTitle: string): DetectedMedia | null {
  const yt = url.match(YT_RE);
  if (yt) return { url: `https://www.youtube.com/watch?v=${yt[1]}`, kind: "youtube", page: url, title: title || fallbackTitle, how: "page" };
  const vm = url.match(VIMEO_RE);
  if (vm) return { url: `https://vimeo.com/${vm[1]}${vm[2] ? `/${vm[2]}` : ""}`, kind: "vimeo", page: url, title: title || "Vimeo", how: "page" };
  const tv = url.match(TWITCH_VOD_RE);
  if (tv) return { url: `https://www.twitch.tv/videos/${tv[1]}`, kind: "twitch", page: url, title: title || "Twitch", how: "page" };
  // Twitch live channels, Kick, Instagram and X are not offered: they cannot play in sync for everyone.
  const tt = url.match(TIKTOK_RE);
  if (tt) return { url: url.split(/[?#]/)[0], kind: "tiktok", page: url, title: title || "TikTok", how: "page" };
  const fb = url.match(FB_RE);
  if (fb) return { url: fb[1] ? `https://www.facebook.com/watch/?v=${fb[1]}` : url.split(/[?#]/)[0], kind: "facebook", page: url, title: title || "Facebook", how: "page" };
  const ia = url.match(ARCHIVE_RE);
  if (ia) return { url: `https://archive.org/details/${ia[1]}`, kind: "archive", page: url, title: title || "Internet Archive", how: "page" };
  return null;
}
const MAX_ITEMS = 12;

export function hostOf(url: string): string {
  const m = url.match(/^https?:\/\/([^/?#:]+)/i);
  return m ? m[1].toLowerCase() : "";
}

// Short-link domains of supported sites.
const ALIASES: Record<string, string> = { "youtu.be": "youtube.com", "fb.watch": "facebook.com", "redd.it": "reddit.com", "v.redd.it": "reddit.com" };

// Pages the supported sites send you through (cookie consent). Allowed for navigation only; never a video source.
const HELPER_HOSTS = ["consent.google.com", "consent.youtube.com"];

export function isAllowedHost(host: string, sites: SiteInfo[]): boolean {
  const h = ALIASES[host] ?? host;
  return !!h && sites.some((s) => h === s.domain || h.endsWith(`.${s.domain}`));
}

function classify(url: string, blocked: boolean): DetectedMedia["kind"] {
  if (blocked) return "blocked";
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/\.(mp4|m4v|mov)(\?|#|$)/i.test(url)) return "mp4";
  if (/\.webm(\?|#|$)/i.test(url)) return "webm";
  return "video";
}

function rank(m: DetectedMedia): number {
  if (PAGE_KINDS.has(m.kind)) return -1;
  if (m.kind === "blocked") return 9;
  if (m.kind === "hls") return /master|playlist|index/i.test(m.url) ? 0 : 1;
  if (m.how === "video" || m.how === "source") return 2;
  return 3;
}

export function BrowserModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (m: DetectedMedia) => Promise<void>;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const web = useRef<WebView>(null);
  const [sites, setSites] = useState<SiteInfo[]>(FALLBACK_CONFIG.allowed_sites.filter((x) => x.domain !== "drive.google.com"));
  const [url, setUrl] = useState<string | null>(null); // null = start page with supported sites
  const [address, setAddress] = useState("");
  const [nav, setNav] = useState({ back: false, fwd: false, loading: false });
  const [found, setFound] = useState<DetectedMedia[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pageHost = useRef("");

  useEffect(() => {
    // Drive needs a Google sign-in, which Google blocks inside in-app browsers: Drive links are added by pasting
    // the share link in the Video tab instead, so it is not offered here.
    if (visible) loadConfig().then((c) => setSites(c.allowed_sites.filter((x) => x.domain !== "drive.google.com")));
  }, [visible]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const sorted = useMemo(() => [...found].sort((a, b) => rank(a) - rank(b)), [found]);
  const shareable = sorted.filter((m) => m.kind !== "blocked");

  const addItem = (item: DetectedMedia) =>
    setFound((prev) => {
      if (prev.some((p) => p.url === item.url || (item.kind === "blocked" && p.kind === "blocked"))) return prev;
      return [...prev, item].slice(-MAX_ITEMS);
    });

  const open = (target: string) => {
    const host = hostOf(target);
    if (!isAllowedHost(host, sites)) {
      setNotice(t("b_unsupported"));
      return;
    }
    setFound([]);
    setListOpen(false);
    pageHost.current = host;
    setUrl(target);
    setAddress(target);
  };

  const submitAddress = () => {
    const t = address.trim();
    if (!t) return;
    if (/^https?:\/\//i.test(t)) return open(t);
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t)) return open(`https://${t}`);
    // Free text: search on YouTube (a supported site) instead of a general web search.
    open(`https://m.youtube.com/results?search_query=${encodeURIComponent(t)}`);
  };

  const pick = async (m: DetectedMedia) => {
    setBusy(m.url);
    try {
      await onPick(m);
    } finally {
      setBusy(null);
    }
  };

  const remove = (u: string) => setFound((prev) => prev.filter((x) => x.url !== u));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="close" onPress={onClose} label={t("close")} />
          <View style={styles.address}>
            <Ionicons name={url ? "lock-closed" : "search"} size={14} color={C.muted} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              onFocus={() => setListOpen(false)}
              onSubmitEditing={submitAddress}
              placeholder={t("b_ph")}
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              style={styles.addrInput}
            />
            {nav.loading && <ActivityIndicator size="small" color={C.cyan} />}
            {!!url && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setUrl(null);
                  setFound([]);
                  setAddress("");
                }}
              >
                <Ionicons name="apps" size={18} color={C.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {notice && (
          <View style={styles.notice}>
            <Ionicons name="shield-checkmark" size={16} color={C.warning} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {!url ? (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Text style={styles.startTitle}>{t("b_title")}</Text>
              <Text style={styles.startSub}>{t("b_sub")}</Text>
              <View style={styles.grid}>
                {sites.map((s) => (
                  <Pressable key={s.domain} onPress={() => open(`https://${s.domain === "youtube.com" ? "m.youtube.com" : s.domain}`)} style={({ pressed }) => [styles.site, pressed && { opacity: 0.8 }]}>
                    <View style={styles.siteIcon}>
                      <Text style={styles.siteLetter}>{s.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.siteName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.siteDomain} numberOfLines={1}>
                      {s.domain}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.legal}>
                <Ionicons name="information-circle" size={16} color={C.muted} />
                <Text style={styles.legalText}>{t("b_legal")}</Text>
              </View>
            </ScrollView>
          ) : (
            <WebView
              ref={web}
              source={{ uri: url }}
              injectedJavaScriptBeforeContentLoaded={DETECTOR}
              injectedJavaScript={DETECTOR}
              injectedJavaScriptForMainFrameOnly={false}
              injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
              onShouldStartLoadWithRequest={(r) => {
                if (!/^https?:/i.test(r.url)) return false; // intent://, market:// etc.
                if ((r as any).isTopFrame === false) return true;
                if (r.url === "about:blank") return true;
                const host = hostOf(r.url);
                if (isAllowedHost(host, sites) || HELPER_HOSTS.includes(host)) return true;
                setNotice(host === "accounts.google.com" ? t("b_no_login") : t("b_blocked_nav"));
                // Nothing loaded yet (the site redirected straight away): go back to the site list, not a black page.
                if (!nav.back) {
                  setUrl(null);
                  setAddress("");
                }
                return false;
              }}
              onNavigationStateChange={(s) => {
                setNav({ back: s.canGoBack, fwd: s.canGoForward, loading: s.loading });
                if (s.loading) return;
                setAddress(s.url);
                const host = hostOf(s.url);
                if (host && host !== pageHost.current) {
                  // New site: forget videos detected on the previous one.
                  pageHost.current = host;
                  setFound([]);
                }
                const offer = pageOffer(s.url, s.title || "", t("yt_video"));
                if (offer) addItem(offer);
              }}
              onMessage={(e) => {
                let m: any;
                try {
                  m = JSON.parse(e.nativeEvent.data);
                } catch {
                  return;
                }
                if (m?.t !== "media" || typeof m.url !== "string") return;
                if (!isAllowedHost(hostOf(String(m.page || "")), sites)) return;
                // These sites stream through MediaSource or their own CDNs; the page itself is offered instead (see above).
                if (NO_SNIFF.test(String(m.page || ""))) return;
                addItem({
                  url: m.url,
                  kind: classify(m.url, !!m.blocked),
                  page: String(m.page || ""),
                  title: String(m.title || "").slice(0, 120),
                  how: String(m.how || ""),
                  duration: typeof m.duration === "number" ? m.duration : undefined,
                });
              }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              style={{ backgroundColor: "#000" }}
            />
          )}
        </View>

        {listOpen && (
          <View style={[styles.sheet, { maxHeight: height * 0.42 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("b_found")}</Text>
              {found.length > 0 && (
                <Pressable onPress={() => setFound([])} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={14} color={C.error} />
                  <Text style={{ color: C.error, fontWeight: "800", fontSize: 12 }}>{t("b_clear")}</Text>
                </Pressable>
              )}
            </View>
            {sorted.length === 0 ? (
              <Text style={styles.hint}>{t("b_hint")}</Text>
            ) : (
              <FlatList
                data={sorted}
                keyExtractor={(m) => m.url}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <Badge
                          text={item.kind === "blocked" ? t("b_protected") : item.kind.toUpperCase()}
                          color={item.kind === "blocked" ? C.error : item.kind === "hls" || PAGE_KINDS.has(item.kind) ? C.cyan : C.purple}
                        />
                        {!!item.duration && item.duration > 0 && (
                          <Text style={styles.meta}>
                            {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, "0")}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title || hostOf(item.page)}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.kind === "blocked" ? t("b_protected_d") : hostOf(item.url)}
                      </Text>
                    </View>
                    {item.kind !== "blocked" && (
                      <Pressable onPress={() => pick(item)} disabled={!!busy} style={[styles.play, !!busy && { opacity: 0.5 }]}>
                        {busy === item.url ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={18} color="#fff" />}
                      </Pressable>
                    )}
                    <Pressable onPress={() => remove(item.url)} hitSlop={8} style={styles.del} accessibilityLabel={t("close")}>
                      <Ionicons name="close" size={18} color={C.muted} />
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
          <IconButton icon="chevron-back" onPress={() => (nav.back ? web.current?.goBack() : setUrl(null))} color={url ? C.text : C.dim} />
          <IconButton icon="refresh" onPress={() => web.current?.reload()} color={url ? C.text : C.dim} />
          <Pressable onPress={() => setListOpen((o) => !o)} style={[styles.detectBtn, shareable.length > 0 && styles.detectOn]}>
            <Ionicons name="videocam" size={18} color={shareable.length ? "#fff" : C.muted} />
            <Text style={[styles.detectText, { color: shareable.length ? "#fff" : C.muted }]}>
              {shareable.length ? t("b_n_found", { n: shareable.length }) : url ? t("b_searching") : t("b_pick_site")}
            </Text>
            <Ionicons name={listOpen ? "chevron-down" : "chevron-up"} size={16} color={shareable.length ? "#fff" : C.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingBottom: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  address: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.input, borderRadius: R.pill, paddingHorizontal: 14, height: 42 },
  addrInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  notice: { flexDirection: "row", gap: 8, alignItems: "center", padding: 10, backgroundColor: C.warning + "18", borderBottomWidth: 1, borderBottomColor: C.warning + "44" },
  noticeText: { flex: 1, color: C.text, fontSize: 12 },
  startTitle: { color: C.text, fontSize: 22, fontWeight: "900" },
  startSub: { color: C.muted, fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  site: { width: "48%", flexGrow: 1, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 },
  siteIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.purpleDeep, borderWidth: 1, borderColor: C.purple + "77", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  siteLetter: { color: C.text, fontSize: 18, fontWeight: "900" },
  siteName: { color: C.text, fontSize: 15, fontWeight: "800" },
  siteDomain: { color: C.muted, fontSize: 11 },
  legal: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  legalText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 17 },
  bottom: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  detectBtn: { flex: 1, height: 42, borderRadius: R.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.input },
  detectOn: { backgroundColor: C.purple },
  detectText: { fontSize: 14, fontWeight: "800" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, gap: 10, borderTopWidth: 1, borderColor: C.border },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  hint: { color: C.muted, fontSize: 13 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.cardHi, borderRadius: 14, padding: 12 },
  itemTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 11 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  del: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: C.input },
});
