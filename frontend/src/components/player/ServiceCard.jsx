import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { appInfo, inApp, postNative } from "@/lib/native";
import "@/service.css";

// In-app subscription services (beta): Netflix, Disney+, Prime Video, HBO Max. Nothing of these sites is shown here (no
// iframe): in the mobile app the native ServicePlayer opens the service's own page, where each person signs in with their
// own account. This card is the room's "player": a playerRef adapter over the native bridge.
//   web -> app:  {type: "service_open", service, url, role}, {type: "service_cmd", cmd...}, {type: "service_close"}
//   app -> web:  window.__nexoraService(report)  (report = {type: ready|state|lost|reverted|blocked|closed, playing, position, ...})
// Hosts' own taps in the service page are reported and published by usePlaybackSync; guests get "follow" commands, and the
// page script keeps them on the host's state (guest lock).
export const SERVICE_BRANDS = {
  netflix: { name: "Netflix", color: "#E50914", letter: "N" },
  disney: { name: "Disney+", color: "#113CCF", letter: "D" },
  prime: { name: "Prime Video", color: "#00A8E1", letter: "P" },
  max: { name: "HBO Max", color: "#002BE7", letter: "M" },
};

export const canServicePlayer = () => inApp() && !!appInfo()?.caps?.includes("service_player");

export const ServiceCard = ({ video, isHost, playerRef, events }) => {
  const t = useT();
  const brand = SERVICE_BRANDS[video.service] || { name: video.title || "?", color: "#555", letter: "?" };
  const evRef = useRef(events);
  evRef.current = events;
  const app = inApp();
  const able = canServicePlayer();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // null | "ready" | "lost" | "blocked"

  useEffect(() => {
    if (!able) return undefined;
    // Last state the page reported, advanced with the clock between reports.
    const st = { position: 0, at: Date.now(), playing: false, buffering: false, duration: 0 };
    const want = { playing: false, position: 0 };
    const now = () => (st.playing && !st.buffering ? st.position + Math.min(2, (Date.now() - st.at) / 1000) : st.position);
    const cmd = (c) => postNative({ type: "service_cmd", ...c });
    const follow = () => cmd({ cmd: "follow", playing: want.playing, position: want.position });
    const adapter = {
      ready: true, supportsRate: false, kind: "service",
      getTime: now,
      getDuration: () => st.duration || undefined,
      isPaused: () => !st.playing,
      isBuffering: () => st.buffering,
      play: () => {
        if (isHost) cmd({ cmd: "play" });
        else { want.playing = true; want.position = now(); follow(); }
        return Promise.resolve();
      },
      pause: () => {
        if (isHost) cmd({ cmd: "pause" });
        else { want.playing = false; want.position = now(); follow(); }
      },
      seek: (s) => {
        if (!Number.isFinite(s)) return;
        if (isHost) cmd({ cmd: "seek", position: Math.max(0, s) });
        else { want.position = Math.max(0, s); follow(); }
        st.position = Math.max(0, s);
        st.at = Date.now();
      },
      setRate: () => {},
      setMuted: () => {},
    };
    const prev = window.__nexoraService;
    window.__nexoraService = (m) => {
      if (!m || typeof m !== "object") return;
      if (m.type === "closed") {
        setOpen(false);
        setStatus(null);
        if (playerRef.current === adapter) playerRef.current = null;
        return;
      }
      const wasPlaying = st.playing;
      if (typeof m.position === "number" && Number.isFinite(m.position)) { st.position = Math.max(0, m.position); st.at = Date.now(); }
      if (typeof m.duration === "number" && Number.isFinite(m.duration)) st.duration = m.duration;
      if (typeof m.playing === "boolean") st.playing = m.playing;
      if (typeof m.buffering === "boolean" && m.buffering !== st.buffering) { st.buffering = m.buffering; evRef.current.onBuffering?.(m.buffering); }
      if (m.type === "ready") {
        setStatus("ready");
        if (playerRef.current !== adapter) { playerRef.current = adapter; evRef.current.onReady?.(); }
        return;
      }
      if (m.type === "lost" || m.type === "blocked") { setStatus(m.type); return; }
      if (m.type !== "state" || playerRef.current !== adapter) return;
      if (st.playing !== wasPlaying) (st.playing ? evRef.current.onPlay : evRef.current.onPause)?.();
      else if (m.reason === "seeked") evRef.current.onSeek?.();
    };
    return () => {
      window.__nexoraService = prev;
      if (playerRef.current === adapter) playerRef.current = null;
      postNative({ type: "service_close" });
    };
  }, [able, isHost, playerRef, video.url]);

  // The room's host may change while the page is open: the page script is told its new role.
  useEffect(() => { if (open) postNative({ type: "service_cmd", cmd: "role", role: isHost ? "host" : "guest" }); }, [open, isHost]);

  const openIt = () => {
    if (postNative({ type: "service_open", service: video.service, url: video.url, role: isHost ? "host" : "guest", title: brand.name })) setOpen(true);
  };

  return (
    <div className="svc-card" data-testid="service-card" data-service={video.service}>
      <div className="svc-logo" style={{ background: brand.color }} aria-hidden="true">{brand.letter}</div>
      <b className="svc-name">{brand.name} <span className="svc-beta" data-testid="service-beta">{t("svc_beta")}</span></b>
      <span className="svc-text">{t("svc_own_account", { name: brand.name })}</span>
      {able ? (
        <>
          <button className="go" onClick={openIt} data-testid="service-open-btn">{t(open ? "svc_reopen" : "svc_open")}</button>
          {status === "blocked" && <span className="svc-hint" data-testid="service-status">{t("svc_blocked")}</span>}
          {status === "lost" && <span className="svc-hint" data-testid="service-status">{t("svc_lost")}</span>}
          {!isHost && <span className="svc-hint">{t("svc_guest_hint")}</span>}
        </>
      ) : (
        <span className="svc-hint" data-testid="service-web-hint">{t(app ? "svc_update_app" : "svc_app_only")}</span>
      )}
    </div>
  );
};
