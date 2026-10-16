import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, Maximize, TriangleAlert, Volume2, VolumeX, Hand } from "lucide-react";
import { useT } from "@/i18n";
import { HtmlPlayer } from "./HtmlPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

export const Stage = ({ video, isHost, ident, playerRef, sync, peerBuffering }) => {
  const t = useT();
  const boxRef = useRef(null);
  const [fatal, setFatal] = useState(null);
  const [muted, setMuted] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const onFatal = useCallback((code) => setFatal(code), []);
  const sourceKey = `${video?.media_id || "none"}:${retryKey}`;

  useEffect(() => setFatal(null), [video?.media_id]);

  const toggleMute = () => {
    playerRef.current?.setMuted?.(!muted);
    setMuted(!muted);
  };
  const fullscreen = () => {
    const el = boxRef.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).then?.(() => window.screen.orientation?.lock?.("landscape").catch(() => {}));
  };

  let body;
  if (!video) {
    body = (
      <div className="empty" data-testid="stage-empty">
        <Clapperboard size={30} strokeWidth={1.5} />
        <b>{t("waiting_title")}</b>
        <span>{t("waiting_sub")}</span>
      </div>
    );
  } else if (video.kind === "youtube") {
    body = <YouTubePlayer key={sourceKey} videoId={video.video_id} isHost={isHost} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  } else if (video.kind === "drive_embed") {
    body = <iframe key={sourceKey} title="drive" src={video.embed_url} allow="autoplay; fullscreen" data-testid="drive-embed-player" />;
  } else {
    body = <HtmlPlayer key={sourceKey} video={video} isHost={isHost} ident={ident} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  }

  return (
    <div className="stage" ref={boxRef} data-testid="video-stage">
      {body}
      {video && !isHost && video.kind !== "drive_embed" && <div className="lock" />}
      {sync.stats.buffering && !fatal && (
        <div className="stage-chip" data-testid="buffering-indicator"><Loader2 className="spin" size={14} /> {t("buffering")}</div>
      )}
      {!isHost && peerBuffering && !sync.stats.buffering && <div className="stage-chip alt">{peerBuffering}</div>}
      {video?.warning && <div className="stage-warn" data-testid="source-warning"><TriangleAlert size={13} /> {video.warning}</div>}
      {sync.needsGesture && !fatal && !isHost && (
        <button className="gesture" onClick={sync.resolveGesture} data-testid="tap-to-sync-btn"><Hand size={18} /> {t("tap_sync")}</button>
      )}
      {fatal && (
        <div className="fatal" data-testid="player-error">
          <TriangleAlert size={26} />
          <b>{t("player_error")}</b>
          <span>{t(`err_${fatal}`) === `err_${fatal}` ? fatal : t(`err_${fatal}`)}</span>
          <button className="btn" onClick={() => { setFatal(null); setRetryKey((k) => k + 1); }} data-testid="player-retry-btn">{t("retry")}</button>
        </div>
      )}
      {video && (
        <div className="stage-tools">
          {!isHost && video.kind !== "drive_embed" && (
            <button onClick={toggleMute} aria-label="mute" data-testid="guest-mute-btn">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          )}
          <button onClick={fullscreen} aria-label="fullscreen" data-testid="fullscreen-btn"><Maximize size={16} /></button>
        </div>
      )}
    </div>
  );
};
