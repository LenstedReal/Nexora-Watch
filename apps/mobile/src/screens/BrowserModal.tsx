import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, R } from "../theme";
import { Badge, IconButton } from "../components/ui";

export type DetectedMedia = {
  url: string;
  kind: "hls" | "mp4" | "webm" | "video" | "blocked";
  page: string;
  title: string;
  how: string;
  duration?: number;
};

/**
 * Injected into every page (before content loads, so fetch/XHR hooks catch the first manifest request).
 * Finds media in four ways: <video>/<source> elements, fetch(), XMLHttpRequest and the Resource Timing API.
 * Segment files (.ts/.m4s) are ignored; blob:/MediaSource players are reported as "blocked" (not shareable).
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
    post({t:'page',url:location.href,title:document.title,videos:vs.length});
  }catch(e){}
}
document.addEventListener('play',function(e){if(e.target&&e.target.tagName==='VIDEO')scan()},true);
document.addEventListener('DOMContentLoaded',scan);
setInterval(scan,1500);
})();true;`;

function classify(url: string, blocked: boolean): DetectedMedia["kind"] {
  if (blocked) return "blocked";
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/\.(mp4|m4v|mov)(\?|#|$)/i.test(url)) return "mp4";
  if (/\.webm(\?|#|$)/i.test(url)) return "webm";
  return "video";
}

function rank(m: DetectedMedia): number {
  if (m.kind === "blocked") return 9;
  if (m.kind === "hls") return /master|playlist|index/i.test(m.url) ? 0 : 1;
  if (m.how === "video" || m.how === "source") return 2;
  return 3;
}

function toUrl(input: string): string {
  const t = input.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t)) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

const HOME = "https://www.google.com";

export function BrowserModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (m: DetectedMedia) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [url, setUrl] = useState(HOME);
  const [address, setAddress] = useState("");
  const [nav, setNav] = useState({ back: false, fwd: false, loading: false, title: "" });
  const [found, setFound] = useState<DetectedMedia[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(() => [...found].sort((a, b) => rank(a) - rank(b)), [found]);
  const shareable = sorted.filter((m) => m.kind !== "blocked");

  const go = (text: string) => {
    const next = toUrl(text);
    setFound([]);
    setUrl(next);
  };

  const onNav = (s: WebViewNavigation) => {
    setNav({ back: s.canGoBack, fwd: s.canGoForward, loading: s.loading, title: s.title ?? "" });
    if (!s.loading) setAddress(s.url);
  };

  const pick = async (m: DetectedMedia) => {
    setBusy(m.url);
    try {
      await onPick(m);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="close" onPress={onClose} label="Kapat" />
          <View style={styles.address}>
            <Ionicons name={address.startsWith("https") ? "lock-closed" : "globe-outline"} size={14} color={C.muted} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              onSubmitEditing={() => go(address)}
              placeholder="Site ara veya adres yaz"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              style={styles.addrInput}
            />
            {nav.loading && <ActivityIndicator size="small" color={C.cyan} />}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <WebView
            ref={web}
            source={{ uri: url }}
            injectedJavaScriptBeforeContentLoaded={DETECTOR}
            injectedJavaScript={DETECTOR}
            injectedJavaScriptForMainFrameOnly={false}
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
            onNavigationStateChange={onNav}
            onMessage={(e) => {
              let m: any;
              try {
                m = JSON.parse(e.nativeEvent.data);
              } catch {
                return;
              }
              if (m?.t !== "media" || typeof m.url !== "string") return;
              const item: DetectedMedia = {
                url: m.url,
                kind: classify(m.url, !!m.blocked),
                page: String(m.page || ""),
                title: String(m.title || "").slice(0, 120),
                how: String(m.how || ""),
                duration: typeof m.duration === "number" ? m.duration : undefined,
              };
              setFound((prev) => {
                if (prev.some((p) => p.url === item.url || (item.kind === "blocked" && p.kind === "blocked" && p.page === item.page))) return prev;
                return [...prev, item].slice(-40);
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
        </View>

        {listOpen && (
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sayfada bulunan videolar</Text>
            {sorted.length === 0 ? (
              <Text style={styles.hint}>Videoyu sayfada bir kez oynat; oynatıcı yüklenince burada görünür.</Text>
            ) : (
              <FlatList
                data={sorted}
                keyExtractor={(m) => m.url}
                style={{ maxHeight: 300 }}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <Badge
                          text={item.kind === "blocked" ? "KORUMALI" : item.kind.toUpperCase()}
                          color={item.kind === "blocked" ? C.error : item.kind === "hls" ? C.cyan : C.purple}
                        />
                        {!!item.duration && item.duration > 0 && (
                          <Text style={styles.meta}>{Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, "0")}</Text>
                        )}
                      </View>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title || item.page}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.kind === "blocked" ? "Bu site videoyu şifreli/blob akışla veriyor; paylaşılamaz." : item.url}
                      </Text>
                    </View>
                    {item.kind !== "blocked" && (
                      <Pressable onPress={() => pick(item)} disabled={!!busy} style={[styles.play, !!busy && { opacity: 0.5 }]}>
                        {busy === item.url ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={18} color="#fff" />}
                      </Pressable>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        )}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
          <IconButton icon="chevron-back" onPress={() => web.current?.goBack()} color={nav.back ? C.text : C.dim} />
          <IconButton icon="chevron-forward" onPress={() => web.current?.goForward()} color={nav.fwd ? C.text : C.dim} />
          <IconButton icon="refresh" onPress={() => web.current?.reload()} />
          <Pressable onPress={() => setListOpen((o) => !o)} style={[styles.detectBtn, shareable.length > 0 && styles.detectOn]}>
            <Ionicons name="videocam" size={18} color={shareable.length ? "#fff" : C.muted} />
            <Text style={[styles.detectText, { color: shareable.length ? "#fff" : C.muted }]}>
              {shareable.length ? `${shareable.length} video bulundu` : "Video aranıyor…"}
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
  address: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.input, borderRadius: R.pill, paddingHorizontal: 14, height: 40 },
  addrInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  bottom: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  detectBtn: { flex: 1, height: 40, borderRadius: R.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.input },
  detectOn: { backgroundColor: C.purple },
  detectText: { fontSize: 14, fontWeight: "800" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 10, borderTopWidth: 1, borderColor: C.border },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  hint: { color: C.muted, fontSize: 13 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.cardHi, borderRadius: 14, padding: 12 },
  itemTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 11 },
  play: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
});
