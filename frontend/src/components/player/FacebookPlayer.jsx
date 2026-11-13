import { useEffect, useRef, useState } from "react";

// Facebook videos play in Facebook's official Embedded Video Player, driven through the JavaScript SDK
// (https://developers.facebook.com/docs/plugins/embedded-video-player/api): an fb-video element parsed by the SDK hands
// out a player instance on "xfbml.ready" with play / pause / seek / mute / unmute / getCurrentPosition / getDuration and
// the events startedPlaying, paused, finishedPlaying, startedBuffering, finishedBuffering, error.
// No app id is passed (the embed page's own SDK snippet has none). If the SDK or the player instance does not come up,
// a translated error is shown instead (a video that cannot be synced has no place in a watch-together room).
const SDK_VERSION = "v25.0";
const SDK_LOCALES = { tr: "tr_TR", en: "en_US", de: "de_DE" };
const INSTANCE_TIMEOUT_MS = 10000;
let sdk;

function loadFacebook(lang) {
  if (window.FB?.XFBML && window.FB?.Event) return Promise.resolve(window.FB);
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const fail = () => {
        sdk = null;
        reject(new Error("facebook_load"));
      };
      const prev = window.fbAsyncInit;
      window.fbAsyncInit = () => {
        try {
          window.FB.init({ xfbml: false, version: SDK_VERSION });
        } catch { /* already initialised */ }
        resolve(window.FB);
        if (typeof prev === "function") prev();
      };
      if (!document.getElementById("fb-root")) {
        const root = document.createElement("div");
        root.id = "fb-root";
        document.body.prepend(root);
      }
      const s = document.createElement("script");
      s.src = `https://connect.facebook.net/${SDK_LOCALES[lang] || "en_US"}/sdk.js`;
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.onload = () => { if (window.FB?.XFBML) window.fbAsyncInit?.(); else setTimeout(() => (window.FB?.XFBML ? resolve(window.FB) : fail()), 3000); };
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  return sdk;
}

let seq = 0;

export const FacebookPlayer = ({ video, playerRef, events, onFatal, onFallback, lang = "tr" }) => {
  const hostRef = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;
  const [fallback, setFallback] = useState(false);
  const href = video.href;

  useEffect(() => {
    if (fallback) return undefined;
    let cancelled = false;
    let FBref = null;
    let onXfbml = null;
    const tokens = [];
    const elId = `nx-fb-${++seq}`;
    const mount = document.createElement("div");
    mount.className = "fb-video";
    mount.id = elId;
    mount.setAttribute("data-href", href);
    mount.setAttribute("data-allowfullscreen", "true");
    mount.setAttribute("data-autoplay", "false");
    mount.setAttribute("data-show-text", "false");
    mount.setAttribute("data-show-captions", "false");
    mount.setAttribute("data-width", String(Math.max(220, Math.round(hostRef.current.clientWidth || 640))));
    hostRef.current.appendChild(mount);
    const st = { paused: true, buffering: false, waiters: [], inst: null };
    const settle = (ok) => { const w = st.waiters; st.waiters = []; w.forEach((f) => f(ok)); };
    const pos = () => {
      try {
        const v = Number(st.inst?.getCurrentPosition());
        return Number.isFinite(v) ? v : 0;
      } catch { return 0; }
    };
    const setBuffering = (on) => {
      if (st.buffering === on) return;
      st.buffering = on;
      evRef.current.onBuffering?.(on);
    };
    const giveUp = setTimeout(() => !cancelled && !st.inst && setFallback(true), INSTANCE_TIMEOUT_MS);

    const attach = (inst) => {
      st.inst = inst;
      const on = (ev, cb) => { try { const tk = inst.subscribe(ev, cb); if (tk) tokens.push(tk); } catch { /* old SDK */ } };
      on("startedPlaying", () => {
        const was = st.paused;
        st.paused = false;
        setBuffering(false);
        settle(true);
        if (was) evRef.current.onPlay?.();
      });
      on("paused", () => {
        const was = !st.paused;
        st.paused = true;
        setBuffering(false);
        if (was) evRef.current.onPause?.();
      });
      on("finishedPlaying", () => {
        st.paused = true;
        setBuffering(false);
        evRef.current.onPause?.();
      });
      on("startedBuffering", () => setBuffering(true));
      on("finishedBuffering", () => setBuffering(false));
      on("error", () => {
        if (cancelled) return;
        settle(false);
        evRef.current.onError?.();
        onFatal("facebook_embed");
      });
      playerRef.current = {
        ready: true, supportsRate: false, kind: "facebook",
        getTime: pos,
        getDuration: () => { try { return Number(inst.getDuration()) || undefined; } catch { return undefined; } },
        isPaused: () => st.paused,
        isBuffering: () => st.buffering,
        play: () => {
          if (!st.paused) return Promise.resolve();
          try { inst.play(); } catch { /* reported below as blocked */ }
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
        pause: () => { try { inst.pause(); } catch { /* noop */ } },
        seek: (s) => { if (Number.isFinite(s)) try { inst.seek(Math.max(0, s)); } catch { /* noop */ } },
        setRate: () => {},
        setMuted: (m) => { try { if (m) inst.mute(); else inst.unmute(); } catch { /* noop */ } },
      };
      evRef.current.onReady?.();
    };

    loadFacebook(lang)
      .then((FB) => {
        if (cancelled) return;
        FBref = FB;
        onXfbml = (msg) => {
          if (cancelled || st.inst || msg?.type !== "video" || msg?.id !== elId || !msg.instance) return;
          attach(msg.instance);
        };
        FB.Event.subscribe("xfbml.ready", onXfbml);
        FB.XFBML.parse(hostRef.current);
      })
      .catch(() => !cancelled && setFallback(true));
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      settle(false);
      tokens.forEach((tk) => { try { tk.release?.(); } catch { /* noop */ } });
      try { if (FBref && onXfbml) FBref.Event.unsubscribe("xfbml.ready", onXfbml); } catch { /* noop */ }
      if (playerRef.current?.kind === "facebook") playerRef.current = null;
      mount.remove();
    };
  }, [href, lang, fallback, playerRef, onFatal]);
  // Without Facebook's SDK the video could only play unsynced, which a watch-together room cannot use: show an error.
  useEffect(() => { if (fallback) { onFallback?.(); onFatal?.("facebook_sdk"); } }, [fallback, onFallback, onFatal]);
  if (fallback) return null;
  return <div ref={hostRef} className="yt-host fb-host" data-testid="facebook-player" />;
};
