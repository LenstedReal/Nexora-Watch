import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, TriangleAlert, Volume2, VolumeX, Hand, Pause, Plus, Maximize, Minimize } from "lucide-react";
import { useT } from "@/i18n";
import { inApp, setOrientation } from "@/lib/native";
import { HtmlPlayer } from "./HtmlPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

export const Stage = ({ video, playback, isHost, ident, playerRef, sync, onAddVideo }) => {
  const t = useT();
  const [fatal, setFatal] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const onFatal = useCallback((code) => setFatal(code), []);
  const sourceKey = `${video?.media_id || "none"}:${retryKey}`;
  const prev = useRef(video?.media_id);
  const stageRef = useRef(null);
  const app = inApp();
  const [wide, setWide] = useState(() => window.innerWidth > window.innerHeight);

  useEffect(() => { if (prev.current !== video?.media_id) { prev.current = video?.media_id; setFatal(null); } }, [video?.media_id]);
  useEffect(() => {
    if (!app) return undefined;
    const onResize = () => setWide(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [app]);

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (document.fullscreenElement) return document.exitFullscreen?.();
    if (el?.requestFullscreen) return el.requestFullscreen().catch(() => {});
    return el?.querySelector("video")?.webkitEnterFullscreen?.(); // iPhone Safari: only the <video> itself can go fullscreen
  };

  let body;
  if (!video) {
    body = (
      <div className="empty" data-testid="stage-empty">
        <Clapperboard size={34} strokeWidth={1.5} />
        <b>{isHost ? t("add_video") : t("waiting_title")}</b>
        <span>{isHost ? t("host_empty") : t("waiting_sub")}</span>
        {isHost && onAddVideo && <button className="go" onClick={onAddVideo} data-testid="stage-add-video-btn"><Plus size={16} /> {t("add_video")}</button>}
      </div>
    );
  } else if (video.kind === "youtube") {
    body = <YouTubePlayer key={sourceKey} videoId={video.video_id} isHost={isHost} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  } else if (video.kind === "drive_embed") {
    body = <iframe key={sourceKey} title="drive" src={video.embed_url} allow="autoplay; fullscreen" data-testid="drive-embed-player" />;
  } else {
    body = <HtmlPlayer key={sourceKey} video={video} isHost={isHost} ident={ident} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  }

  const embed = video?.kind === "drive_embed";
  const yt = video?.kind === "youtube";
  const showPaused = video && !isHost && !embed && playback && !playback.playing && !sync.stats.buffering && !fatal;
  const warning = video?.warning ? (video.warning_code && t(`warn_${video.warning_code}`) !== `warn_${video.warning_code}` ? t(`warn_${video.warning_code}`) : video.warning) : null;
  return (
    <div className="stage" ref={stageRef} data-testid="video-stage">
      {body}
      {/* Guests cannot touch the player: only the host controls what the room watches. */}
      {video && !isHost && !embed && <div className="lock" data-testid="guest-lock" />}
      {video && sync.stats.buffering && !fatal && <div className="loader" data-testid="buffering-indicator"><span className="ring" /></div>}
      {showPaused && <div className="stage-chip" data-testid="paused-chip"><Pause size={12} /> {t("host_paused")}</div>}
      {warning && <div className="stage-warn" data-testid="source-warning"><TriangleAlert size={13} /> {warning}</div>}
      {video?.title && !video?.warning && !fatal && <div className="stage-title" data-testid="stage-title">{video.title}</div>}
      {sync.needsGesture && !fatal && !isHost && (
        <button className="gesture" onClick={sync.resolveGesture} data-testid="tap-to-sync-btn"><Hand size={18} /> {t("tap_sync")}</button>
      )}
      {sync.autoMuted && !sync.needsGesture && !fatal && !isHost && (
        <button className="sound" onClick={() => sync.setMuted(false)} data-testid="tap-for-sound-btn"><VolumeX size={16} /> {t("tap_sound")}</button>
      )}
      {fatal && (
        <div className="fatal" data-testid="player-error">
          <TriangleAlert size={28} />
          <b>{t("player_error")}</b>
          <span>{t(`err_${fatal}`) === `err_${fatal}` ? fatal : t(`err_${fatal}`)}</span>
          <button className="btn" onClick={() => { setFatal(null); setRetryKey((k) => k + 1); }} data-testid="player-retry-btn">{t("retry")}</button>
        </div>
      )}
      {video && (!embed || app) && (
        <div className="stage-tools">
          {!embed && !isHost && <button onClick={() => sync.setMuted(!sync.muted)} aria-label={t(sync.muted ? "unmute" : "mute")} data-testid="guest-mute-btn">{sync.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>}
          {/* The host's YouTube player has its own fullscreen button; everyone else gets ours. */}
          {!embed && !app && !(yt && isHost) && <button onClick={toggleFullscreen} aria-label={t("fullscreen")} title={t("fullscreen")} data-testid="fullscreen-btn"><Maximize size={16} /></button>}
          {/* The app turns the screen instead. The button sits in this row so it never covers another one. */}
          {app && <button onClick={() => setOrientation(wide ? "portrait" : "landscape")} aria-label={t(wide ? "portrait" : "rotate")} data-testid="rotate-btn">{wide ? <Minimize size={16} /> : <Maximize size={16} />}</button>}
        </div>
      )}
    </div>
  );
};
