import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, TriangleAlert, Volume2, VolumeX, Hand, Pause, Plus } from "lucide-react";
import { useT } from "@/i18n";
import { HtmlPlayer } from "./HtmlPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

export const Stage = ({ video, playback, isHost, ident, playerRef, sync, onAddVideo }) => {
  const t = useT();
  const [fatal, setFatal] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const onFatal = useCallback((code) => setFatal(code), []);
  const sourceKey = `${video?.media_id || "none"}:${retryKey}`;
  const prev = useRef(video?.media_id);

  useEffect(() => { if (prev.current !== video?.media_id) { prev.current = video?.media_id; setFatal(null); } }, [video?.media_id]);

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
  const showPaused = video && !isHost && !embed && playback && !playback.playing && !sync.stats.buffering && !fatal;
  return (
    <div className="stage" data-testid="video-stage">
      {body}
      {video && !isHost && !embed && <div className="lock" />}
      {video && sync.stats.buffering && !fatal && <div className="loader" data-testid="buffering-indicator"><span className="ring" /></div>}
      {showPaused && <div className="stage-chip" data-testid="paused-chip"><Pause size={12} /> {t("host_paused")}</div>}
      {video?.warning && <div className="stage-warn" data-testid="source-warning"><TriangleAlert size={13} /> {video.warning}</div>}
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
      {video && !isHost && !embed && (
        <div className="stage-tools">
          <button onClick={() => sync.setMuted(!sync.muted)} aria-label="mute" data-testid="guest-mute-btn">{sync.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        </div>
      )}
    </div>
  );
};
