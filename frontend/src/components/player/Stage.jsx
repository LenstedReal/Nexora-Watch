import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, TriangleAlert, Volume2, VolumeX, Hand, Pause, Plus, Maximize, Minimize } from "lucide-react";
import { useI18n, useT } from "@/i18n";
import { inApp, setOrientation } from "@/lib/native";
import { HtmlPlayer } from "./HtmlPlayer";
import { YouTubePlayer } from "./YouTubePlayer";
import { VimeoPlayer } from "./VimeoPlayer"; // sources worker: official-player kinds
import { TwitchPlayer } from "./TwitchPlayer"; // sources worker
import { KickPlayer } from "./KickPlayer"; // sources worker
import { TikTokPlayer } from "./TikTokPlayer"; // src2 worker: TikTok, Facebook, Instagram, X
import { FacebookPlayer } from "./FacebookPlayer"; // src2
import { SocialEmbed, SOCIAL_KINDS } from "./SocialEmbed"; // src2
import { ServiceCard } from "./ServiceCard"; // rave worker: in-app subscription services (beta)
import { PlayerControls, fmtTime, useSyncState } from "./PlayerControls";
import "@/stage.css"; // fix worker: provider players get their bar outside the picture

const NOTICE_KEYS = { resumed: "pl_resumed_by", paused: "pl_paused_by", seeked: "pl_seeked_by" };

export const Stage = ({ video, playback, isHost, ident, playerRef, sync, onAddVideo, onPlainEmbed }) => {
  const t = useT();
  const { lang } = useI18n(); // src2
  const [fbPlain, setFbPlain] = useState(false); // src2: Facebook fell back to its plain iframe (no sync, no lock)
  const onFbPlain = useCallback(() => setFbPlain(true), []); // src2
  const plain = fbPlain && video?.kind === "facebook";
  useEffect(() => { onPlainEmbed?.(plain); }, [plain, onPlainEmbed]); // src2: Room shows the "no sync" note
  const [fatal, setFatal] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [media, setMedia] = useState(null); // {el, hls} of our own player while it is mounted
  const onFatal = useCallback((code) => setFatal(code), []);
  const sourceKey = `${video?.media_id || "none"}:${retryKey}`;
  const prev = useRef(video?.media_id);
  const stageRef = useRef(null);
  const app = inApp();
  const [wide, setWide] = useState(() => window.innerWidth > window.innerHeight);

  useEffect(() => { if (prev.current !== video?.media_id) { prev.current = video?.media_id; setFatal(null); setFbPlain(false); } }, [video?.media_id]);
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
  } else if (video.kind === "tiktok") { // src2: official embed player, postMessage API (synced)
    body = <TikTokPlayer key={sourceKey} video={video} isHost={isHost} playerRef={playerRef} events={sync.events} onFatal={onFatal} />;
  } else if (video.kind === "facebook") { // src2: official embedded video player, JS SDK (synced)
    body = <FacebookPlayer key={sourceKey} video={video} lang={lang} playerRef={playerRef} events={sync.events} onFatal={onFatal} onFallback={onFbPlain} />;
  } else if (SOCIAL_KINDS.has(video.kind)) { // src2: Instagram / X embeds without JS control (no sync)
    body = <SocialEmbed key={sourceKey} video={video} lang={lang} />;
  } else if (video.kind === "service") { // rave worker: the service plays in the app's ServicePlayer, this is only a card
    body = <ServiceCard key={sourceKey} video={video} isHost={isHost} playerRef={playerRef} events={sync.events} />;
  } else if (video.kind === "drive_embed") {
    body = <iframe key={sourceKey} title="drive" src={video.embed_url} allow="autoplay; fullscreen" data-testid="drive-embed-player" />;
  } else {
    own = true;
    body = <HtmlPlayer key={sourceKey} video={video} isHost={isHost} ident={ident} playerRef={playerRef} events={sync.events} onFatal={onFatal} onMedia={setMedia} />;
  }

  const embed = video?.kind === "drive_embed" || video?.kind === "kick" || video?.kind === "service" || SOCIAL_KINDS.has(video?.kind) || (video?.kind === "facebook" && fbPlain); // no JS control (kick, instagram, x, plain facebook) or a card (service): nothing to lock
  const yt = ["youtube", "vimeo", "tiktok", "facebook"].includes(video?.kind); // official players: the host has their own fullscreen button
  // Twitch's embed rules forbid covering it, so it gets no guest lock either.
  const bare = video?.kind === "twitch";
  // `prov` = a provider's own player (YouTube, Vimeo, Twitch, Kick, Drive, any iframe): we draw NOTHING over its picture.
  // Our title, notes and buttons go to a bar under the picture (a side rail on a sideways phone). Only the guest lock,
  // which is transparent, lies over synced provider players.
  const prov = !!video && !own;
  const showPaused = video && !isHost && !embed && (prov || !bare) && playback && !playback.playing && !sync.stats.buffering && !fatal;
  const warning = video?.warning ? (video.warning_code && t(`warn_${video.warning_code}`) !== `warn_${video.warning_code}` ? t(`warn_${video.warning_code}`) : video.warning) : null;
  const pill = useSyncState(sync.stats.drift, own && !isHost && !!playback?.playing && video?.capabilities?.sync !== false && !sync.needsGesture && !sync.stats.buffering, video?.media_id);
  // Who did what, for everyone else. A pause is already told by the chip below, so it is not announced twice.
  const n = own && !fatal ? sync.notice : null;
  const notice = n && NOTICE_KEYS[n.kind] && !(n.kind === "paused" && showPaused) ? t(NOTICE_KEYS[n.kind], { name: n.name, time: fmtTime(n.time), rate: n.rate }) : null;
  const gesture = sync.needsGesture && !fatal && !isHost && (prov || !bare);
  const sound = sync.autoMuted && !sync.needsGesture && !fatal && !isHost && (prov || !bare);

  /* Guests cannot touch the player: only the host controls what the room watches. Over a provider player a tap on the
     (invisible) lock also does what the "tap to sync" button in the bar does. */
  const lock = video && !isHost && !embed && !bare && (
    <div className="lock" data-testid="guest-lock" onClick={prov && sync.needsGesture ? sync.resolveGesture : undefined} />
  );
  const fatalBox = fatal && (
    <div className="fatal" data-testid="player-error">
      <TriangleAlert size={28} />
      <b>{t("player_error")}</b>
      <span>{t(`err_${fatal}`) === `err_${fatal}` ? fatal : t(`err_${fatal}`)}</span>
      <button className="btn" onClick={() => { setFatal(null); setRetryKey((k) => k + 1); }} data-testid="player-retry-btn">{t("retry")}</button>
    </div>
  );
  const warnBox = warning && <div className="stage-warn" data-testid="source-warning"><TriangleAlert size={13} /> <span>{warning}</span></div>;
  const chip = showPaused && <div className="stage-chip" data-testid="paused-chip"><Pause size={12} /> <span className="lbl">{sync.pausedBy ? t("pl_paused_by", { name: sync.pausedBy }) : t("host_paused")}</span></div>;
  const gestureBtn = gesture && <button className="gesture" onClick={sync.resolveGesture} data-testid="tap-to-sync-btn" aria-label={t("tap_sync")}><Hand size={18} /> <span className="lbl">{t("tap_sync")}</span></button>;
  const soundBtn = sound && <button className="sound" onClick={() => sync.setMuted(false)} data-testid="tap-for-sound-btn" aria-label={t("tap_sound")}><VolumeX size={16} /> <span className="lbl">{t("tap_sound")}</span></button>;

  if (prov) {
    return (
      <div className="stage prov" ref={stageRef} data-testid="video-stage">
        <div className="stage-pic">
          {body}
          {lock}
          {fatalBox}
        </div>
        <div className="stage-side" data-testid="stage-bar">
          {warnBox}
          <div className="stage-bar">
            {video.title && video.kind !== "service" && !SOCIAL_KINDS.has(video.kind) && <div className="stage-title" data-testid="stage-title" title={video.title}>{video.title}</div>}
            {sync.stats.buffering && !fatal && <span className="ring" data-testid="buffering-indicator" />}
            {chip}
            {gestureBtn}
            {soundBtn}
            {(!embed || app) && (
              <div className="stage-tools">
                {!embed && !isHost && <button onClick={() => sync.setMuted(!sync.muted)} aria-label={t(sync.muted ? "unmute" : "mute")} data-testid="guest-mute-btn">{sync.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>}
                {/* The host's YouTube player has its own fullscreen button; everyone else gets ours. */}
                {!embed && !app && !(yt && isHost) && <button onClick={toggleFullscreen} aria-label={t("fullscreen")} title={t("fullscreen")} data-testid="fullscreen-btn"><Maximize size={16} /></button>}
                {/* The app turns the screen instead. */}
                {app && <button onClick={rotate} aria-label={t(wide ? "portrait" : "rotate")} data-testid="rotate-btn">{wide ? <Minimize size={16} /> : <Maximize size={16} />}</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`stage${own ? " nxp" : ""}`} ref={stageRef} data-testid="video-stage">
      {body}
      {lock}
      {video && sync.stats.buffering && !fatal && <div className="loader" data-testid="buffering-indicator"><span className="ring" /></div>}
      {warnBox}
      {chip}
      {video?.title && !video?.warning && !fatal && <div className="stage-title" data-testid="stage-title">{video.title}</div>}
      {notice && <div key={n.id} className="nxp-notice" role="status" data-testid="playback-notice">{notice}</div>}
      {gestureBtn}
      {soundBtn}
      {fatalBox}
      {own && media && !fatal && (
        <PlayerControls
          key={`controls:${sourceKey}`} media={media} stageRef={stageRef} isHost={isHost} muted={sync.muted} onMuted={sync.setMuted}
          app={app} wide={wide} onRotate={rotate} onFullscreen={toggleFullscreen} syncState={pill}
          rate={sync.rate} onRate={isHost && video?.capabilities?.rate_correction !== false ? sync.setRate : undefined}
        />
      )}
    </div>
  );
};
