import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { useT } from "@/i18n";
import { inApp, setOrientation } from "@/lib/native";
import "@/embeds.css";

// Twitch plays in Twitch's own interactive embed (https://dev.twitch.tv/docs/embed/video-and-clips/).
// Twitch's embed rules (https://dev.twitch.tv/docs/embed/): the player must be at least 400x300 and must not be
// covered by other page elements. So the room draws nothing on top of it (Stage.jsx: no lock, chips or buttons over
// it; the buttons sit in the bar under the picture). A smaller picture area (a portrait phone) still gets a player of
// at least 400x300 CSS pixels, shown smaller with a CSS scale; only a very narrow area (<200 px) shows a note instead.
export const TWITCH_MIN = { w: 400, h: 300 };
export const TWITCH_TINY = 200;

/** CSS size of the embed (never below Twitch's minimum) and the scale that fits it into a w x h area. */
export function twitchFit(w, h) {
  const s = Math.min(1, w / TWITCH_MIN.w, h / TWITCH_MIN.h);
  // No rounding up: the drawn size (CSS size x s) must stay inside the area; max() guards against float error.
  return { s, w: Math.max(TWITCH_MIN.w, w / s), h: Math.max(TWITCH_MIN.h, h / s) };
}

let sdk;
function loadTwitch() {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const fail = () => {
        sdk = null;
        reject(new Error("twitch_load"));
      };
      const s = document.createElement("script");
      s.src = "https://player.twitch.tv/js/embed/v1.js";
      s.async = true;
      s.onload = () => (window.Twitch?.Player ? resolve(window.Twitch) : fail());
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  return sdk;
}

let seq = 0;

export const TwitchPlayer = ({ video, playerRef, events, onFatal }) => {
  const t = useT();
  const hostRef = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;
  const [big, setBig] = useState(null); // null = not measured yet; false = area narrower than TWITCH_TINY
  const mountRef = useRef(null);
  const live = !!video.live;
  const vod = video.video_id;
  const channel = video.channel;

  // Sizes the embed to the picture area: at least 400x300 CSS pixels, scaled down to fit when the area is smaller.
  const fit = () => {
    const el = hostRef.current, m = mountRef.current;
    if (!el || !m) return;
    const f = twitchFit(el.clientWidth, el.clientHeight);
    m.style.width = `${f.w}px`;
    m.style.height = `${f.h}px`;
    m.style.transform = f.s < 1 ? `scale(${f.s})` : "";
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useEffect(() => {
    const el = hostRef.current;
    const measure = () => {
      setBig(el.clientWidth >= TWITCH_TINY && el.clientHeight > 0);
      fitRef.current();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!big) return undefined;
    let cancelled = false;
    let player;
    const mount = document.createElement("div");
    mount.id = `nx-twitch-${(seq += 1)}`;
    mount.className = "tw-mount";
    hostRef.current.appendChild(mount);
    mountRef.current = mount;
    fitRef.current();
    const st = { buffering: false, pending: null };
    const setBuffering = (on) => {
      if (st.buffering === on) return;
      st.buffering = on;
      evRef.current.onBuffering?.(on);
    };
    const settle = (ok) => {
      const p = st.pending;
      if (!p) return;
      st.pending = null;
      clearTimeout(p.timer);
      if (ok) p.resolve();
      else p.reject(new Error("blocked"));
    };

    loadTwitch()
      .then((Twitch) => {
        if (cancelled) return;
        const P = Twitch.Player;
        // A past broadcast is started by the room (synced); a live channel simply plays live for everyone.
        const opts = { width: "100%", height: "100%", parent: [window.location.hostname], autoplay: live, muted: false };
        if (live) opts.channel = channel;
        else opts.video = `v${vod}`;
        player = new P(mount.id, opts);
        player.addEventListener(P.PLAY, () => setBuffering(true));
        player.addEventListener(P.PLAYING, () => {
          setBuffering(false);
          settle(true);
          evRef.current.onPlay?.();
        });
        player.addEventListener(P.PAUSE, () => {
          setBuffering(false);
          evRef.current.onPause?.();
        });
        player.addEventListener(P.ENDED, () => {
          setBuffering(false);
          evRef.current.onPause?.();
        });
        player.addEventListener(P.SEEK, () => evRef.current.onSeek?.());
        player.addEventListener(P.PLAYBACK_BLOCKED, () => {
          setBuffering(false);
          settle(false);
        });
        player.addEventListener(P.READY, () => {
          if (cancelled) return;
          playerRef.current = {
            ready: true, supportsRate: false, kind: "twitch",
            getTime: () => (live ? 0 : Number(player.getCurrentTime()) || 0),
            isPaused: () => !!player.isPaused(),
            isBuffering: () => st.buffering,
            play: () => {
              if (!player.isPaused()) return Promise.resolve();
              settle(false);
              return new Promise((resolve, reject) => {
                st.pending = { resolve, reject, timer: setTimeout(() => settle(!player.isPaused()), 1500) };
                player.play();
              });
            },
            pause: () => player.pause(),
            seek: (s) => { if (!live && Number.isFinite(s)) player.seek(Math.max(0, s)); }, // live streams cannot be seeked
            setRate: () => {},
            setMuted: (m) => player.setMuted(!!m),
          };
          evRef.current.onReady?.();
        });
      })
      .catch(() => !cancelled && onFatal("network"));
    return () => {
      cancelled = true;
      settle(false);
      setBuffering(false);
      playerRef.current = null;
      if (mountRef.current === mount) mountRef.current = null;
      mount.remove(); // the embed has no documented destroy(); removing its element stops it
    };
  }, [big, live, vod, channel, playerRef, onFatal]);

  return (
    <div ref={hostRef} className="tw-host" data-testid="twitch-player">
      {big === false && (
        <div className="tw-small" data-testid="twitch-too-small">
          <Smartphone size={26} />
          <b>{t("twitch_small")}</b>
          {inApp() && <button className="btn" onClick={() => setOrientation("landscape")} data-testid="twitch-rotate-btn">{t("rotate")}</button>}
        </div>
      )}
    </div>
  );
};
