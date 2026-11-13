import { useEffect, useRef } from "react";

// Vimeo videos play in Vimeo's own player, driven through the official Player SDK
// (https://github.com/vimeo/player.js): window.Vimeo.Player, promise-based methods, events with {seconds}.
let sdk;
function loadVimeo() {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const fail = () => {
        sdk = null;
        reject(new Error("vimeo_load"));
      };
      const s = document.createElement("script");
      s.src = "https://player.vimeo.com/api/player.js";
      s.async = true;
      s.onload = () => (window.Vimeo?.Player ? resolve(window.Vimeo) : fail());
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  return sdk;
}

/** Errors that mean "this video cannot be played here at all"; everything else (a seek past the end…) is ignored. */
function fatalCode(e) {
  const name = e?.name || "";
  const msg = String(e?.message || "");
  if (name === "PrivacyError" || name === "PasswordError" || /not embeddable|privacy|password/i.test(msg)) return "vimeo_embed";
  if (name === "NotFoundError" || /not found/i.test(msg)) return "vimeo_notfound";
  return null;
}

export const VimeoPlayer = ({ video, isHost, playerRef, events, onFatal }) => {
  const hostRef = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;
  const id = video.video_id;
  const hash = video.video_hash || null;

  useEffect(() => {
    let player;
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current.appendChild(mount);
    // The SDK answers with promises, the sync loop needs plain values: the last reported position is kept here and
    // advanced with the clock between two "timeupdate" events (they arrive about four times a second).
    const st = { base: 0, at: 0, paused: true, buffering: false, muting: null };
    const now = () => (st.paused || st.buffering ? st.base : st.base + Math.min(1, (Date.now() - st.at) / 1000));
    const mark = (seconds) => {
      if (!Number.isFinite(seconds)) return;
      st.base = Math.max(0, seconds);
      st.at = Date.now();
    };
    const setBuffering = (on) => {
      if (st.buffering === on) return;
      if (on) st.base = now();
      else st.at = Date.now();
      st.buffering = on;
      evRef.current.onBuffering?.(on);
    };

    loadVimeo()
      .then((Vimeo) => {
        if (cancelled) return;
        // Only the host gets the player's own controls and keyboard; guests watch what the host plays.
        // (Vimeo honours controls=false only for videos of paid accounts; the room's guest lock covers the rest.)
        const opts = { controls: !!isHost, keyboard: !!isHost, autopause: false, playsinline: true, title: false, byline: false, portrait: false, pip: false, dnt: true };
        if (hash) opts.url = `https://vimeo.com/${id}/${hash}`; // unlisted videos need their key
        else opts.id = Number(id);
        player = new Vimeo.Player(mount, opts);
        player.on("timeupdate", (d) => mark(d?.seconds));
        player.on("playing", (d) => {
          mark(d?.seconds);
          st.paused = false;
          setBuffering(false);
          evRef.current.onPlay?.();
        });
        player.on("pause", (d) => {
          mark(d?.seconds);
          st.paused = true;
          setBuffering(false);
          evRef.current.onPause?.();
        });
        player.on("ended", () => {
          st.base = now();
          st.paused = true;
          setBuffering(false);
          evRef.current.onPause?.();
        });
        player.on("seeked", (d) => {
          mark(d?.seconds);
          evRef.current.onSeek?.();
        });
        player.on("bufferstart", () => setBuffering(true));
        player.on("bufferend", () => setBuffering(false));
        player.on("error", (e) => {
          const code = fatalCode(e);
          if (!code || cancelled) return;
          evRef.current.onError?.();
          onFatal(code);
        });
        player
          .ready()
          .then(() => {
            if (cancelled) return;
            playerRef.current = {
              ready: true, supportsRate: false, kind: "vimeo",
              getTime: now,
              isPaused: () => st.paused,
              isBuffering: () => st.buffering,
              play: () => {
                const asked = (st.muting || Promise.resolve()).then(() => player.play());
                // Blocked autoplay must be reported: the promise may reject, or simply never start playing.
                return new Promise((resolve, reject) => {
                  let done = false;
                  const finish = (ok) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    if (ok) resolve();
                    else reject(new Error("blocked"));
                  };
                  const timer = setTimeout(() => finish(!st.paused), 1500);
                  asked.then(() => finish(true), () => finish(false));
                });
              },
              pause: () => { player.pause().catch(() => {}); },
              seek: (s) => {
                if (!Number.isFinite(s)) return;
                mark(s);
                player.setCurrentTime(Math.max(0, s)).catch(() => {});
              },
              setRate: () => {},
              setMuted: (m) => { st.muting = player.setMuted(!!m).catch(() => {}); },
            };
            evRef.current.onReady?.();
          })
          .catch((e) => {
            if (cancelled) return;
            evRef.current.onError?.();
            onFatal(fatalCode(e) || "unsupported");
          });
      })
      .catch(() => !cancelled && onFatal("network"));
    return () => {
      cancelled = true;
      playerRef.current = null;
      try { player?.destroy()?.catch?.(() => {}); } catch { /* noop */ }
      mount.remove();
    };
  }, [id, hash, isHost, playerRef, onFatal]);

  return <div ref={hostRef} className="yt-host" data-testid="vimeo-player" />;
};
