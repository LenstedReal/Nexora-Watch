import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { absUrl, api } from "@/lib/api";

const MEDIA_ERR = { 1: "network", 2: "network", 3: "decode", 4: "codec" };

export const HtmlPlayer = ({ video, isHost, ident, playerRef, events, onFatal }) => {
  const ref = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;
  const buffering = useRef(false);
  const [src, setSrc] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    if (video.kind === "upload") {
      api.mediaUrl(video.media_id, ident).then((r) => alive && setSrc(absUrl(r.url))).catch((e) => alive && onFatal(e.code || "network"));
    } else setSrc(video.stream_url || video.url);
    return () => { alive = false; };
  }, [video.kind, video.media_id, video.stream_url, video.url, ident, onFatal, refresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return undefined;
    let hls;
    let ready = false;
    const setBuf = (on) => {
      if (buffering.current === on) return;
      buffering.current = on;
      evRef.current.onBuffering?.(on);
    };
    playerRef.current = {
      get ready() { return ready; }, supportsRate: true, kind: "html",
      getTime: () => el.currentTime,
      isPaused: () => el.paused,
      isBuffering: () => buffering.current,
      play: () => el.play(),
      pause: () => el.pause(),
      seek: (s) => { if (Number.isFinite(s)) el.currentTime = s; },
      setRate: (r) => { if (Math.abs(el.playbackRate - r) > 0.004) el.playbackRate = r; },
      setMuted: (m) => { el.muted = m; },
    };
    const on = {
      loadedmetadata: () => { ready = true; evRef.current.onReady?.(); },
      play: () => evRef.current.onPlay?.(),
      pause: () => evRef.current.onPause?.(),
      seeked: () => evRef.current.onSeek?.(),
      waiting: () => setBuf(true),
      playing: () => setBuf(false),
      canplay: () => setBuf(false),
      error: () => {
        evRef.current.onError?.();
        const c = el.error?.code;
        if (video.kind === "upload" && c === 2 && refresh < 1) setRefresh((n) => n + 1);
        else onFatal(MEDIA_ERR[c] || "unsupported");
      },
    };
    Object.entries(on).forEach(([k, fn]) => el.addEventListener(k, fn));
    const nativeHls = el.canPlayType("application/vnd.apple.mpegurl");
    if (video.kind === "hls" && !nativeHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        evRef.current.onError?.();
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else onFatal(d.details?.includes("manifest") ? "manifest_invalid" : "network");
      });
      hls.loadSource(src);
      hls.attachMedia(el);
    } else if (video.kind === "hls" && !nativeHls) {
      onFatal("codec");
    } else {
      el.src = src;
    }
    return () => {
      Object.entries(on).forEach(([k, fn]) => el.removeEventListener(k, fn));
      hls?.destroy();
      playerRef.current = null;
      el.removeAttribute("src");
      el.load();
    };
  }, [src, video.kind, playerRef, onFatal, refresh]);

  return <video ref={ref} playsInline controls={isHost} preload="auto" className="html-video" data-testid="html-video-player" />;
};
