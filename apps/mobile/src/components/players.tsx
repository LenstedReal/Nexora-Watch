import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";
import { C } from "../theme";
import { t } from "../i18n";
import { WEB_URL } from "../core/api";

/** What the sync engine needs from any player. */
export interface PlayerHandle {
  ready(): boolean;
  getTime(): number;
  isPlaying(): boolean;
  isBuffering(): boolean;
  supportsRate: boolean;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setRate(rate: number): void;
}

type CommonProps = { controls: boolean; onError?: (msg: string) => void };

// ---------------------------------------------------------------------------------------------------------------
// Native player (MP4 / WebM / MOV / HLS / uploaded files) on expo-video (ExoPlayer on Android, AVPlayer on iOS).
// State is polled instead of using event payloads, which keeps it stable across expo-video versions.
// ---------------------------------------------------------------------------------------------------------------
export const NativePlayer = forwardRef<PlayerHandle, CommonProps & { uri: string; headers?: Record<string, string> | null }>(
  function NativePlayer({ uri, headers, controls, onError }, ref) {
  const player = useVideoPlayer(headers ? { uri, headers } : { uri }, (p) => {
    p.loop = false;
    try {
      (p as any).timeUpdateEventInterval = 0;
    } catch {
      /* optional */
    }
  });
  const rateRef = useRef(1);
  const [status, setStatus] = useState<string>("loading");
  const errorReported = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      let s = "loading";
      try {
        s = String((player as any).status ?? "loading");
      } catch {
        /* player released */
      }
      setStatus((prev) => (prev === s ? prev : s));
      if (s === "error" && !errorReported.current) {
        errorReported.current = true;
        onError?.(t("play_error"));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [player, onError]);

  useImperativeHandle(
    ref,
    () => ({
      supportsRate: true,
      ready: () => {
        try {
          const s = (player as any).status;
          return s === "readyToPlay" || s === "loading";
        } catch {
          return false;
        }
      },
      getTime: () => {
        try {
          return player.currentTime || 0;
        } catch {
          return 0;
        }
      },
      isPlaying: () => {
        try {
          return !!player.playing;
        } catch {
          return false;
        }
      },
      isBuffering: () => {
        try {
          return (player as any).status === "loading";
        } catch {
          return true;
        }
      },
      play: () => {
        try {
          player.play();
        } catch {
          /* released */
        }
      },
      pause: () => {
        try {
          player.pause();
        } catch {
          /* released */
        }
      },
      seek: (sec: number) => {
        try {
          player.currentTime = Math.max(0, sec);
        } catch {
          /* released */
        }
      },
      setRate: (r: number) => {
        if (Math.abs(r - rateRef.current) < 0.005) return;
        rateRef.current = r;
        try {
          player.playbackRate = r;
          (player as any).preservesPitch = true;
        } catch {
          /* released */
        }
      },
    }),
    [player],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={controls}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
      {status === "loading" && (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator color={C.cyan} />
        </View>
      )}
    </View>
  );
  },
);

// ---------------------------------------------------------------------------------------------------------------
// YouTube through the official IFrame Player API inside a WebView.
// ---------------------------------------------------------------------------------------------------------------
// Must be a real https origin we own: YouTube rejects embeds without a valid referrer (error 152/153).
const YT_ORIGIN = WEB_URL;

function ytHtml(videoId: string, controls: boolean) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#p{position:absolute;top:0;left:0;width:100%;height:100%}</style>
</head><body><div id="p"></div><script>
var player=null,ready=false;
function send(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.body.appendChild(tag);
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{videoId:${JSON.stringify(videoId)},width:'100%',height:'100%',
    playerVars:{playsinline:1,controls:${controls ? 1 : 0},rel:0,modestbranding:1,disablekb:${controls ? 0 : 1},fs:${controls ? 1 : 0},origin:${JSON.stringify(YT_ORIGIN)}},
    events:{
      onReady:function(){ready=true;send({t:'ready'})},
      onStateChange:function(e){send({t:'tick',s:e.data,time:player.getCurrentTime()})},
      onError:function(e){send({t:'error',code:e.data})}
    }});
}
setInterval(function(){if(ready&&player&&player.getCurrentTime){send({t:'tick',s:player.getPlayerState(),time:player.getCurrentTime()})}},250);
window.nx=function(c){if(!ready||!player)return;
  if(c.a==='play')player.playVideo();else if(c.a==='pause')player.pauseVideo();else if(c.a==='seek')player.seekTo(c.t,true);};
</script></body></html>`;
}

const ytError = (code: number) =>
  code === 100 ? t("yt_notfound") : code === 101 || code === 150 || code === 152 || code === 153 ? t("yt_embed") : t("yt_error", { c: code });

export const YouTubePlayer = forwardRef<PlayerHandle, CommonProps & { videoId: string }>(function YouTubePlayer(
  { videoId, controls, onError },
  ref,
) {
  const web = useRef<WebView>(null);
  const st = useRef({ ready: false, state: -1, time: 0, at: Date.now() });
  const html = useMemo(() => ytHtml(videoId, controls), [videoId, controls]);
  const cmd = (c: object) => web.current?.injectJavaScript(`window.nx && window.nx(${JSON.stringify(c)});true;`);

  useImperativeHandle(ref, () => ({
    supportsRate: false,
    ready: () => st.current.ready,
    getTime: () => {
      const s = st.current;
      // Extrapolate between 250 ms ticks.
      return s.state === 1 ? s.time + (Date.now() - s.at) / 1000 : s.time;
    },
    isPlaying: () => st.current.state === 1 || st.current.state === 3,
    isBuffering: () => st.current.state === 3,
    play: () => cmd({ a: "play" }),
    pause: () => cmd({ a: "pause" }),
    seek: (t: number) => {
      st.current = { ...st.current, time: t, at: Date.now() };
      cmd({ a: "seek", t: Math.max(0, t) });
    },
    setRate: () => {},
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={controls ? "auto" : "none"}>
      <WebView
        ref={web}
        source={{ html, baseUrl: YT_ORIGIN }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={controls}
        scrollEnabled={false}
        style={{ backgroundColor: "#000" }}
        onMessage={(e) => {
          let m: any;
          try {
            m = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (m.t === "ready") st.current = { ...st.current, ready: true };
          else if (m.t === "tick") st.current = { ready: true, state: Number(m.s), time: Number(m.time) || 0, at: Date.now() };
          else if (m.t === "error") onError?.(ytError(Number(m.code)));
        }}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Google Drive preview (no sync possible: Drive does not expose a player API).
// ---------------------------------------------------------------------------------------------------------------
export function EmbedPlayer({ url }: { url: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        source={{ uri: url }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        style={{ backgroundColor: "#000" }}
      />
    </View>
  );
}

export function PlayerMessage({ icon, title, detail }: { icon?: ReactNode; title: string; detail?: string }) {
  return (
    <View style={styles.center}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {!!detail && <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20, gap: 8 },
  title: { color: C.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  detail: { color: C.muted, fontSize: 13, textAlign: "center" },
});
