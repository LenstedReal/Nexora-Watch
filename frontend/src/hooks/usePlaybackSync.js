import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export const DRIFT_SEEK_S = 2;
const RATE_BAND_S = 0.25;
const HOST_TOLERANCE_S = 0.75;
const KEEPALIVE_MS = 20000;

export function expectedPosition(pb, offset) {
  if (!pb) return 0;
  if (!pb.playing) return pb.position;
  return Math.max(0, pb.position + (Date.now() + offset - pb.updated_at) / 1000);
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
    const seq = Math.max(seqRef.current + 1, Date.now());
    seqRef.current = seq;
    const position = Math.max(0, p.getTime());
    lastPubRef.current = { at: Date.now(), playing, position };
    conn.publishPlayback({ playing, position, seq, media_id: r.playback.media_id });
  }, [isHost, conn, playerRef]);

  const onReady = useCallback(() => {
    const p = playerRef.current;
    const pb = roomRef.current?.playback;
    if (!p || !pb) return;
    p.setMuted?.(mutedRef.current);
    const target = expectedPosition(pb, conn.clockRef.current.offset);
    if (isHost) {
      suppressUntil.current = Date.now() + 1500;
      lastPubRef.current = { at: Date.now(), playing: pb.playing, position: target };
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
        const exp = ref.position + (ref.playing ? (now - ref.at) / 1000 : 0);
        if (playing !== ref.playing || Math.abs(p.getTime() - exp) > HOST_TOLERANCE_S || (playing && now - ref.at > KEEPALIVE_MS)) publish(playing);
        return;
      }
      const pb = r.playback;
      const target = expectedPosition(pb, offset);
      const t = p.getTime();
      if (!pb.playing) {
        if (!p.isPaused()) p.pause();
        if (Math.abs(t - target) > 0.5 && now > cooldown.current) {
          p.seek(target);
          cooldown.current = now + 1500;
        }
        p.setRate(1);
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
        p.setRate(1);
        p.seek(target + 0.15);
        cooldown.current = now + 3000;
        corrections.current += 1;
        push({ event: "correction", drift });
      } else if (p.supportsRate && Math.abs(drift) > RATE_BAND_S && Math.abs(drift) <= DRIFT_SEEK_S) {
        p.setRate(Math.min(1.05, Math.max(0.95, 1 - drift * 0.1)));
      } else {
        p.setRate(1);
      }
      setStats((s) => ({ ...s, drift, corrections: corrections.current }));
    }, isHost ? 1000 : 500);
    return () => clearInterval(id);
  }, [mediaId, caps.sync, isHost, conn.clockRef, playerRef, publish, push, tryPlay]);

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
    }, 10000);
    return () => {
      clearInterval(s);
      clearInterval(f);
    };
  }, [conn.clockRef, playerRef, push, ident, room?.code, caps.sync]);

  const resolveGesture = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const r = roomRef.current;
    setMuted(false);
    p.seek(expectedPosition(r.playback, conn.clockRef.current.offset));
    p.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
  }, [playerRef, conn.clockRef, setMuted]);

  return { events, needsGesture, resolveGesture, stats, muted, setMuted, autoMuted };
}
