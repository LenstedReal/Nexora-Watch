import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, TriangleAlert, Volume2, VolumeX, Hand, Pause, Plus, Maximize, Minimize } from "lucide-react";
import { useT } from "@/i18n";
import { inApp, setOrientation } from "@/lib/native";
import { HtmlPlayer } from "./HtmlPlayer";
import { YouTubePlayer } from "./YouTubePlayer";
import { VimeoPlayer } from "./VimeoPlayer"; // sources worker: official-player kinds
import { TwitchPlayer } from "./TwitchPlayer"; // sources worker
import { KickPlayer } from "./KickPlayer"; // sources worker
import { PlayerControls, fmtTime, useSyncState } from "./PlayerControls";

const NOTICE_KEYS = { resumed: "pl_resumed_by", paused: "pl_paused_by", seeked: "pl_seeked_by" };

export const Stage = ({ video, playback, isHost, ident, playerRef, sync, onAddVideo }) => {
  const t = useT();
  const [fatal, setFatal] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [media, setMedia] = useState(null); // {el, hls} of our own player while it is mounted
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

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (document.fullscreenElement) return document.exitFullscreen?.();
    if (el?.requestFullscreen) return el.requestFullscreen().catch(() => {});
    return el?.querySelector("video")?.webkitEnterFullscreen?.(); // iPhone Safari: only the <video> itself can go fullscreen
  }, []);
  const rotate = useCallback(() => setOrientation(wide ? "portrait" : "landscape"), [wide]);

  // `own` = our own player with our own controls. Every other kind keeps its provider's player and the small tool row.
  let body;
  let own = false;
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
  } else if (video.kind === "vimeo") {
    body = <VimeoPlayer key={sourceKey} video={video} isHost={isHost} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  } else if (video.kind === "twitch") {
    body = <TwitchPlayer key={sourceKey} video={video} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  } else if (video.kind === "kick") { // sources worker: live embed without JS control (no sync)
    body = <KickPlayer key={sourceKey} video={video} />;
  } else if (video.kind === "drive_embed") {
    body = <iframe key={sourceKey} title="drive" src={video.embed_url} allow="autoplay; fullscreen" data-testid="drive-embed-player" />;
  } else {
    own = true;
    body = <HtmlPlayer key={sourceKey} video={video} isHost={isHost} ident={ident} playerRef={playerRef} events={sync.events} onFatal={onFatal} onMedia={setMedia} />;
  }

  const embed = video?.kind === "drive_embed" || video?.kind === "kick"; // sources worker: + kick
  const yt = video?.kind === "youtube" || video?.kind === "vimeo"; // official players: the host has their own fullscreen button
  // sources worker: Twitch may not be covered by anything (its embed rules), so nothing is drawn over it; buttons go to a side rail.
  const bare = video?.kind === "twitch";
  const showPaused = video && !isHost && !embed && !bare && playback && !playback.playing && !sync.stats.buffering && !fatal;
  const warning = video?.warning ? (video.warning_code && t(`warn_${video.warning_code}`) !== `warn_${video.warning_code}` ? t(`warn_${video.warning_code}`) : video.warning) : null;
  const pill = useSyncState(sync.stats.drift, own && !isHost && !!playback?.playing && video?.capabilities?.sync !== false && !sync.needsGesture && !sync.stats.buffering, video?.media_id);
  // Who did what, for everyone else. A pause is already told by the chip below, so it is not announced twice.
  const n = own && !fatal ? sync.notice : null;
  const notice = n && NOTICE_KEYS[n.kind] && !(n.kind === "paused" && showPaused) ? t(NOTICE_KEYS[n.kind], { name: n.name, time: fmtTime(n.time), rate: n.rate }) : null;
  return (
    <div className={`stage${own ? " nxp" : ""}`} ref={stageRef} data-testid="video-stage">
      {body}
      {/* Guests cannot touch the player: only the host controls what the room watches. */}
      {video && !isHost && !embed && !bare && <div className="lock" data-testid="guest-lock" />}
      {video && sync.stats.buffering && !fatal && !bare && <div className="loader" data-testid="buffering-indicator"><span className="ring" /></div>}
      {warning && <div className="stage-warn" data-testid="source-warning"><TriangleAlert size={13} /> {warning}</div>}
      {showPaused && <div className="stage-chip" data-testid="paused-chip"><Pause size={12} /> {sync.pausedBy ? t("pl_paused_by", { name: sync.pausedBy }) : t("host_paused")}</div>}
      {video?.title && !video?.warning && !fatal && !bare && <div className="stage-title" data-testid="stage-title">{video.title}</div>}
      {notice && <div key={n.id} className="nxp-notice" role="status" data-testid="playback-notice">{notice}</div>}
      {sync.needsGesture && !fatal && !isHost && !bare && (
        <button className="gesture" onClick={sync.resolveGesture} data-testid="tap-to-sync-btn"><Hand size={18} /> {t("tap_sync")}</button>
      )}
      {sync.autoMuted && !sync.needsGesture && !fatal && !isHost && !bare && (
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
      {own && media && !fatal && (
        <PlayerControls
          key={`controls:${sourceKey}`} media={media} stageRef={stageRef} isHost={isHost} muted={sync.muted} onMuted={sync.setMuted}
          app={app} wide={wide} onRotate={rotate} onFullscreen={toggleFullscreen} syncState={pill}
        />
      )}
      {video && !own && (!embed || app) && (
        <div className={bare ? "stage-tools rail" : "stage-tools"}>
          {!embed && !isHost && <button onClick={() => sync.setMuted(!sync.muted)} aria-label={t(sync.muted ? "unmute" : "mute")} data-testid="guest-mute-btn">{sync.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>}
          {/* The host's YouTube player has its own fullscreen button; everyone else gets ours. */}
          {!embed && !app && !(yt && isHost) && <button onClick={toggleFullscreen} aria-label={t("fullscreen")} title={t("fullscreen")} data-testid="fullscreen-btn"><Maximize size={16} /></button>}
          {/* The app turns the screen instead. The button sits in this row so it never covers another one. */}
          {app && <button onClick={rotate} aria-label={t(wide ? "portrait" : "rotate")} data-testid="rotate-btn">{wide ? <Minimize size={16} /> : <Maximize size={16} />}</button>}
        </div>
      )}
    </div>
  );
};
