import { useEffect, useRef } from "react";

let ytReady;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => {
        ytReady = null;
        reject(new Error("yt_load"));
      };
      document.head.appendChild(s);
    });
  }
  return ytReady;
}

const YT_ERR = { 2: "invalid_url", 5: "codec", 100: "yt_notfound", 101: "yt_embed", 150: "yt_embed", 152: "yt_embed", 153: "yt_embed" };

export const YouTubePlayer = ({ videoId, isHost, playerRef, events, onFatal }) => {
  const hostRef = useRef(null);
  const evRef = useRef(events);
  evRef.current = events;

  useEffect(() => {
    let player;
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current.appendChild(mount);
    loadYT()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId, width: "100%", height: "100%",
          // Only the host gets player controls; guests watch what the host plays.
          playerVars: { playsinline: 1, controls: isHost ? 1 : 0, disablekb: isHost ? 0 : 1, rel: 0, origin: window.location.origin },
          events: {
            onReady: () => {
              const state = () => player.getPlayerState?.();
              playerRef.current = {
                ready: true, supportsRate: false, kind: "youtube",
                getTime: () => player.getCurrentTime?.() || 0,
                isPaused: () => ![1, 3].includes(state()),
                isBuffering: () => state() === 3,
                play: () => {
                  player.playVideo();
                  return new Promise((res, rej) => setTimeout(() => ([1, 3].includes(state()) ? res() : rej(new Error("blocked"))), 1500));
                },
                pause: () => player.pauseVideo(),
                seek: (s) => player.seekTo(s, true),
                setRate: () => {},
                setMuted: (m) => (m ? player.mute() : player.unMute()),
              };
              evRef.current.onReady?.();
            },
            onStateChange: (e) => {
              if (e.data === 1) {
                evRef.current.onBuffering?.(false);
                evRef.current.onPlay?.();
              } else if (e.data === 2 || e.data === 0) {
                evRef.current.onBuffering?.(false);
                evRef.current.onPause?.();
              } else if (e.data === 3) evRef.current.onBuffering?.(true);
            },
            onError: (e) => {
              evRef.current.onError?.();
              onFatal(YT_ERR[e.data] || "unsupported");
            },
          },
        });
      })
      .catch(() => onFatal("network"));
    return () => {
      cancelled = true;
      playerRef.current = null;
      try { player?.destroy(); } catch { /* noop */ }
      mount.remove();
    };
  }, [videoId, isHost, playerRef, onFatal]);

  return <div ref={hostRef} className="yt-host" data-testid="youtube-player" />;
};
