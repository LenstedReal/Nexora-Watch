import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export const DRIFT_SEEK_S = 2;
const RATE_BAND_S = 0.25;
const HOST_TOLERANCE_S = 0.75;
const KEEPALIVE_MS = 20000;

// The host's chosen speed (0.25–2, 1 when the room has none): the room's clock runs at this speed.
export const rateOf = (pb) => (typeof pb?.rate === "number" && pb.rate >= 0.25 && pb.rate <= 2 ? pb.rate : 1);

export function expectedPosition(pb, offset) {
  if (!pb) return 0;
  if (!pb.playing) return pb.position;
  return Math.max(0, pb.position + ((Date.now() + offset - pb.updated_at) / 1000) * rateOf(pb));
}

export function usePlaybackSync({ room, isHost, conn, playerRef, ident }) {
  const [needsGesture, setNeedsGesture] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [autoMuted, setAutoMuted] = useState(false);
  const [stats, setStats] = useState({ drift: null, corrections: 0, buffering: false, errors: 0 });
  const seqRef = useRef(0);
  const lastPubRef = useRef(null);
  const suppressUntil = useRef(0);
  const cooldown = useRef(0);
  const playTry = useRef(0);
  const corrections = useRef(0);
  const errors = useRef(0);
  const bufferStart = useRef(null);
  const samples = useRef([]);
  const roomRef = useRef(room);
  roomRef.current = room;
  const mutedRef = useRef(false);
  const caps = room?.video?.capabilities || {};
  const mediaId = room?.video?.media_id;
  const [notice, setNotice] = useState(null); // {id, kind, name, time}: what someone else just did, for a few seconds
  const [pausedBy, setPausedBy] = useState(null);
  const lastPb = useRef(null);
  const noticeTimer = useRef(0);
  const [rate, setRateState] = useState(() => rateOf(room?.playback));
  const rateRef = useRef(rate);

  const setMuted = useCallback((m) => {
    mutedRef.current = m;
    playerRef.current?.setMuted?.(m);
    setMutedState(m);
    if (!m) setAutoMuted(false);
  }, [playerRef]);

  // Guest autoplay: try with sound, fall back to muted autoplay, finally ask for a tap.
  const tryPlay = useCallback(async (p) => {
    try {
      await p.play();
      setNeedsGesture(false);
    } catch {
      if (mutedRef.current) { setNeedsGesture(true); return; }
      try {
        p.setMuted?.(true);
        await p.play();
        mutedRef.current = true;
        setMutedState(true);
        setAutoMuted(true);
        setNeedsGesture(false);
      } catch {
        p.setMuted?.(false);
        setNeedsGesture(true);
      }
    }
  }, []);

  const push = useCallback((s) => {
    samples.current.push({ t: Date.now(), reconnects: conn.statsRef.current.reconnects, corrections: corrections.current, player_errors: errors.current, ...s });
  }, [conn.statsRef]);

  const publish = useCallback((playing) => {
    const p = playerRef.current;
    const r = roomRef.current;
    if (!isHost || !p?.ready || !r?.video || Date.now() < suppressUntil.current) return;
    // Never fall behind the sequence stored for the room (another device, or this clock was corrected backwards).
    const seq = Math.max(seqRef.current + 1, Date.now(), (r.playback?.seq || 0) + 1);
    seqRef.current = seq;
    const position = Math.max(0, p.getTime());
    lastPubRef.current = { at: Date.now(), playing, position, rate: rateRef.current };
    conn.publishPlayback({ playing, position, seq, media_id: r.playback.media_id, rate: rateRef.current });
  }, [isHost, conn, playerRef]);

  const onReady = useCallback(() => {
    const p = playerRef.current;
    const pb = roomRef.current?.playback;
    if (!p || !pb) return;
    p.setMuted?.(mutedRef.current);
    const target = expectedPosition(pb, conn.clockRef.current.offset);
    if (isHost) {
      suppressUntil.current = Date.now() + 1500;
      lastPubRef.current = { at: Date.now(), playing: pb.playing, position: target, rate: rateOf(pb) };
      p.setRate(rateRef.current);
      if (target > 0.5) p.seek(target);
      if (pb.playing) p.play().catch(() => setNeedsGesture(true));
    } else {
      cooldown.current = 0;
      if (target > 0.5) p.seek(target);
      if (pb.playing) { playTry.current = Date.now(); tryPlay(p); }
    }
  }, [isHost, conn.clockRef, playerRef, tryPlay]);

  const onBuffering = useCallback((on) => {
    setStats((s) => (s.buffering === on ? s : { ...s, buffering: on }));
    conn.sendRaw({ type: "buffering", buffering: on });
    if (on && bufferStart.current == null) bufferStart.current = Date.now();
    if (!on && bufferStart.current != null) {
      push({ event: "buffering", buffering_ms: Date.now() - bufferStart.current });
      bufferStart.current = null;
    }
  }, [conn, push]);

  const onError = useCallback(() => {
    errors.current += 1;
    setStats((s) => ({ ...s, errors: errors.current }));
    push({ event: "player_error" });
  }, [push]);

  const events = {
    onReady,
    onBuffering,
    onError,
    onPlay: () => isHost && publish(true),
    onPause: () => isHost && publish(false),
    onSeek: () => isHost && publish(!playerRef.current?.isPaused()),
  };

  useEffect(() => {
    lastPubRef.current = null;
    cooldown.current = 0;
    playTry.current = 0;
    setNeedsGesture(false);
    setStats((s) => ({ ...s, buffering: false }));
  }, [mediaId]);

  // Main loop: host verifies its own state; guest follows the host.
  useEffect(() => {
    if (!mediaId || caps.sync === false) return undefined;
    const id = setInterval(() => {
      const p = playerRef.current;
      const r = roomRef.current;
      if (!p?.ready || !r?.video || r.playback.media_id !== r.video.media_id) return;
      const offset = conn.clockRef.current.offset;
      const now = Date.now();
      if (isHost) {
        if (now < suppressUntil.current || p.isBuffering()) return;
        const playing = !p.isPaused();
        const ref = lastPubRef.current || { at: now, playing: r.playback.playing, position: expectedPosition(r.playback, offset) };
        const exp = ref.position + (ref.playing ? ((now - ref.at) / 1000) * (ref.rate || 1) : 0);
        if (playing !== ref.playing || Math.abs(p.getTime() - exp) > HOST_TOLERANCE_S || (playing && now - ref.at > KEEPALIVE_MS)) publish(playing);
        return;
      }
      const pb = r.playback;
      const base = rateOf(pb);
      const target = expectedPosition(pb, offset);
      const t = p.getTime();
      if (!pb.playing) {
        if (!p.isPaused()) p.pause();
        if (Math.abs(t - target) > 0.5 && now > cooldown.current) {
          p.seek(target);
          cooldown.current = now + 1500;
        }
        p.setRate(base);
        setStats((s) => ({ ...s, drift: t - target }));
        return;
      }
      if (p.isPaused()) {
        if (now - playTry.current > 2500) {
          playTry.current = now;
          if (Math.abs(t - target) > 0.5) p.seek(target);
          tryPlay(p);
        }
        return;
      }
      if (p.isBuffering()) return;
      const drift = t - target;
      if (Math.abs(drift) > DRIFT_SEEK_S && now > cooldown.current) {
        p.setRate(base);
        p.seek(target + 0.15 * base);
        cooldown.current = now + 3000;
        corrections.current += 1;
        push({ event: "correction", drift });
      } else if (p.supportsRate && Math.abs(drift) > RATE_BAND_S && Math.abs(drift) <= DRIFT_SEEK_S) {
        p.setRate(base * Math.min(1.05, Math.max(0.95, 1 - drift * 0.1)));
      } else {
        p.setRate(base);
      }
      setStats((s) => ({ ...s, drift, corrections: corrections.current }));
    }, isHost ? 1000 : 500);
    return () => clearInterval(id);
  }, [mediaId, caps.sync, isHost, conn.clockRef, playerRef, publish, push, tryPlay]);

  // "Deniz paused", "Deniz jumped to 1:23": told to everyone except the person who did it. Nothing on the first look
  // at a room or a new video, nothing for old news after a reconnect, never more than one at a time.
  const pb = room?.playback;
  useEffect(() => {
    const prev = lastPb.current;
    lastPb.current = pb;
    if (!pb) return;
    if (!prev || prev.media_id !== pb.media_id) {
      setPausedBy(null);
      setNotice(null);
      return;
    }
    if ((pb.revision ?? 0) <= (prev.revision ?? 0)) return;
    if (pb.playing) setPausedBy(null);
    const by = pb.updated_by;
    const me = ident?.participant_id;
    if (!by || by === me) return;
    const name = roomRef.current?.participants?.find((x) => x.id === by)?.nickname;
    if (!name || Date.now() + conn.clockRef.current.offset - pb.updated_at > 5000) return;
    let kind = null;
    if (pb.playing !== prev.playing) {
      const dur = playerRef.current?.getDuration?.();
      const atEnd = !pb.playing && Number.isFinite(dur) && dur > 0 && pb.position >= dur - 1; // the video ended by itself
      if (!atEnd) kind = pb.playing ? "resumed" : "paused";
    } else {
      const expected = prev.playing ? prev.position + ((pb.updated_at - prev.updated_at) / 1000) * rateOf(prev) : prev.position;
      if (Math.abs(pb.position - expected) > 2.5) kind = "seeked";
    }
    if (!kind) return;
    if (kind === "paused") setPausedBy(name);
    setNotice({ id: pb.revision, kind, name, time: pb.position });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }, [pb, ident?.participant_id, conn.clockRef, playerRef]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  useEffect(() => conn.onPlaybackEvent((msg) => {
    const recv = Date.now() + conn.clockRef.current.offset;
    if (typeof msg.cmd_sent_at === "number") push({ event: "command_received", cmd_sent_at: msg.cmd_sent_at, server_at: msg.server_time, received_at: recv });
  }), [conn, push]);

  useEffect(() => {
    const s = setInterval(() => {
      const p = playerRef.current;
      const r = roomRef.current;
      if (!p?.ready || !r?.playback?.playing || p.isBuffering() || caps.sync === false) return;
      const { offset, rtt } = conn.clockRef.current;
      const drift = p.getTime() - expectedPosition(r.playback, offset);
      push({ event: "sample", drift, rtt: rtt ?? undefined, offset, position: p.getTime() });
    }, 2000);
    const f = setInterval(() => {
      if (!samples.current.length || !ident) return;
      const batch = samples.current.splice(0, 120);
      api.metrics(room.code, ident, batch).catch(() => samples.current.unshift(...batch.slice(-60)));
    }, 20000);
    return () => {
      clearInterval(s);
      clearInterval(f);
    };
  }, [conn.clockRef, playerRef, push, ident, room?.code, caps.sync]);

  // The room's speed: follows the stored playback (another host device, a new video resets it to 1).
  const pbRate = rateOf(pb);
  useEffect(() => {
    rateRef.current = pbRate;
    setRateState(pbRate);
    if (isHost) playerRef.current?.setRate?.(pbRate);
  }, [pbRate, mediaId, isHost, playerRef]);
  // Host only: pick a speed for everyone. The element changes at once; the room hears it as a playback command.
  const setRate = useCallback((r) => {
    const p = playerRef.current;
    if (!isHost || !p?.ready || !(r >= 0.25 && r <= 2)) return;
    rateRef.current = r;
    setRateState(r);
    p.setRate(r);
    suppressUntil.current = 0;
    publish(!p.isPaused());
  }, [isHost, playerRef, publish]);

  const resolveGesture = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const r = roomRef.current;
    setMuted(false);
    p.seek(expectedPosition(r.playback, conn.clockRef.current.offset));
    p.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
  }, [playerRef, conn.clockRef, setMuted]);

  return { events, needsGesture, resolveGesture, stats, muted, setMuted, autoMuted, notice, pausedBy, rate, setRate };
}
