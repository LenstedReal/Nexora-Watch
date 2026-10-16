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
  const [attempt, setAttempt] = useState(0);

  const setBuf = (on) => {
    if (buffering.current === on) return;
    buffering.current = on;
    evRef.current.onBuffering?.(on);
  };

  useEffect(() => {
    let alive = true;
    setBuf(true);
    if (video.kind === "upload") {
      api.mediaUrl(video.media_id, ident).then((r) => alive && setSrc(absUrl(r.url))).catch((e) => alive && onFatal(e.code || "network"));
    } else setSrc(video.stream_url || video.url);
    return () => { alive = false; };
  }, [video.kind, video.media_id, video.stream_url, video.url, ident, onFatal, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => setBuf(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return undefined;
    let hls;
    let ready = false;
    let disposed = false;
    const stalled = () => !el.ended && el.readyState < 3 && (!el.paused || el.readyState < 1);
    const tick = setInterval(() => setBuf(stalled()), 250);
    playerRef.current = {
      get ready() { return ready; }, supportsRate: true, kind: "html",
      getTime: () => el.currentTime,
      isPaused: () => el.paused,
      isBuffering: () => stalled(),
      play: () => el.play(),
      pause: () => el.pause(),
      seek: (s) => { if (Number.isFinite(s)) el.currentTime = s; },
      setRate: (r) => { if (Math.abs(el.playbackRate - r) > 0.004) el.playbackRate = r; },
      setMuted: (m) => { el.muted = m; },
    };
    const on = {
      loadedmetadata: () => { ready = true; setBuf(stalled()); evRef.current.onReady?.(); },
      play: () => evRef.current.onPlay?.(),
      pause: () => { setBuf(false); evRef.current.onPause?.(); },
      seeked: () => { setBuf(stalled()); evRef.current.onSeek?.(); },
      waiting: () => setBuf(true),
      playing: () => setBuf(false),
      canplay: () => setBuf(false),
      error: () => {
        if (disposed || (!hls && !el.getAttribute("src"))) return;
        const c = el.error?.code;
        evRef.current.onError?.();
        if (video.kind === "upload" && (c === 2 || c === 4) && attempt < 1) setTimeout(() => setAttempt((n) => n + 1), 700);
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
      el.load();
    }
    return () => {
      disposed = true;
      clearInterval(tick);
      Object.entries(on).forEach(([k, fn]) => el.removeEventListener(k, fn));
      hls?.destroy();
      playerRef.current = null;
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [src, video.kind, playerRef, onFatal, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return <video ref={ref} playsInline controls={isHost} preload="auto" className="html-video" data-testid="html-video-player" />;
};
