import { useEffect, useRef } from "react";

// TikTok videos play in TikTok's official Embed Player (https://developers.tiktok.com/doc/embed-player): an iframe of
// www.tiktok.com/player/v1/<id>, driven with postMessage. Messages both ways are {"x-tiktok-player": true, type, value}:
// we send play / pause / seekTo / mute / unMute, it reports onPlayerReady, onStateChange (-1 init, 0 ended, 1 playing,
// 2 paused, 3 buffering), onCurrentTime {currentTime, duration}, onMute and onPlayerError {errorCode, errorType}.
const ORIGIN = "https://www.tiktok.com";
const ERRORS = { 1001: "tiktok_notfound", 2001: "network" }; // 3001 playback / 3002 autoplay are handled as blocked play

export const TikTokPlayer = ({ video, isHost, playerRef, events, onFatal }) => {
  const frameRef = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;
  const id = video.video_id;
  // Only the host gets TikTok's own controls; guests watch what the host plays (and the room's lock covers the player).
  const params = new URLSearchParams({
    controls: isHost ? "1" : "0", autoplay: "0", loop: "0", rel: "0", music_info: "0", description: "0", native_context_menu: "0",
  });
  const src = `${ORIGIN}/player/v1/${encodeURIComponent(id)}?${params}`;

  useEffect(() => {
    let cancelled = false;
    // Events arrive as plain values; the last reported position is advanced with the clock between two of them.
    const st = { base: 0, at: Date.now(), paused: true, buffering: false, duration: 0, waiters: [] };
    const now = () => (st.paused || st.buffering ? st.base : st.base + Math.min(2, (Date.now() - st.at) / 1000));
    const send = (type, value) => {
      try { frameRef.current?.contentWindow?.postMessage({ "x-tiktok-player": true, type, value }, ORIGIN); } catch { /* frame gone */ }
    };
    const settle = (ok) => { const w = st.waiters; st.waiters = []; w.forEach((f) => f(ok)); };
    const setBuffering = (on) => {
      if (st.buffering === on) return;
      if (on) st.base = now();
      else st.at = Date.now();
      st.buffering = on;
      evRef.current.onBuffering?.(on);
    };
    const ready = () => {
      if (playerRef.current?.kind === "tiktok") return;
      playerRef.current = {
        ready: true, supportsRate: false, kind: "tiktok",
        getTime: now,
        getDuration: () => st.duration || undefined,
        isPaused: () => st.paused,
        isBuffering: () => st.buffering,
        play: () => {
          if (!st.paused) return Promise.resolve();
          send("play");
          // Blocked autoplay must be reported: an AUTOPLAY_ERROR, or playback that simply never starts.
          return new Promise((resolve, reject) => {
            let done = false;
            const finish = (ok) => {
              if (done) return;
              done = true;
              clearTimeout(timer);
              if (ok) resolve();
              else reject(new Error("blocked"));
            };
            const timer = setTimeout(() => finish(!st.paused || st.buffering), 1500);
            st.waiters.push(finish);
          });
        },
        pause: () => send("pause"),
        seek: (s) => {
          if (!Number.isFinite(s)) return;
          st.base = Math.max(0, s);
          st.at = Date.now();
          st.seekedAt = Date.now();
          send("seekTo", Math.max(0, s));
        },
        setRate: () => {},
        setMuted: (m) => send(m ? "mute" : "unMute"),
      };
      evRef.current.onReady?.();
    };
    const onMessage = (e) => {
      if (cancelled || e.origin !== ORIGIN || e.source !== frameRef.current?.contentWindow) return;
      let d = e.data;
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch { return; }
      }
      if (!d || d["x-tiktok-player"] !== true || typeof d.type !== "string") return;
      const v = d.value;
      switch (d.type) {
        case "onPlayerReady":
          ready();
          break;
        case "onCurrentTime": {
          const t = Number(v?.currentTime ?? v);
          if (!Number.isFinite(t)) return;
          if (Number.isFinite(Number(v?.duration))) st.duration = Number(v.duration);
          // A jump the host made with TikTok's own progress bar (there is no "seeked" event).
          const jumped = !st.paused && !st.buffering && Math.abs(t - now()) > 1.5 && Date.now() - (st.seekedAt || 0) > 1500;
          st.base = Math.max(0, t);
          st.at = Date.now();
          if (jumped) evRef.current.onSeek?.();
          break;
        }
        case "onStateChange":
          if (v === 1) {
            const was = st.paused;
            st.paused = false;
            setBuffering(false);
            st.at = Date.now();
            settle(true);
            if (was) evRef.current.onPlay?.();
          } else if (v === 2 || v === 0) {
            st.base = now();
            const was = !st.paused;
            st.paused = true;
            setBuffering(false);
            if (was) evRef.current.onPause?.();
          } else if (v === 3) {
            setBuffering(true);
          }
          break;
        case "onPlayerError": {
          const code = Number(v?.errorCode ?? v);
          if (code === 3002 || code === 3001) { settle(false); return; }
          if (ERRORS[code]) {
            evRef.current.onError?.();
            onFatal(ERRORS[code]);
          }
          break;
        }
        default:
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      settle(false);
      if (playerRef.current?.kind === "tiktok") playerRef.current = null;
    };
  }, [id, isHost, playerRef, onFatal]);

  return (
    <iframe
      ref={frameRef}
      key={src}
      title="TikTok"
      src={src}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      data-testid="tiktok-player"
    />
  );
};
