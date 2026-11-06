import { useEffect, useRef, type RefObject } from "react";
import { api } from "./api";
import { guestCorrection, hostPublish, nextSeq } from "./sync";
import type { RoomConn } from "./useRoom";
import type { Identity } from "./types";
import type { PlayerHandle } from "../components/players";

const TICK_MS = 250;
const SAMPLE_MS = 2000;
const FLUSH_MS = 20000;

/**
 * Drives the local player from the room state.
 * Host: first aligns to the existing room state (so re-opening the app never resets the room), then publishes
 *       play/pause/seek changes it detects on its own player. Buffering is never published as a pause.
 * Guest: follows the room with rate nudges (native player) or seeks (YouTube), never while buffering.
 */
export function usePlaybackSync(opts: {
  conn: RoomConn;
  isHost: boolean;
  ident: Identity;
  player: RefObject<PlayerHandle | null>;
  syncable: boolean;
  mediaId: string | null;
}) {
  const { conn, isHost, ident, player, syncable, mediaId } = opts;
  const roomRef = useRef(conn.room);
  roomRef.current = conn.room;

  const state = useRef({
    aligned: false,
    lastSeekAt: 0,
    lastRevision: -1,
    lastPublishAt: 0,
    lastSeq: 0,
    buffering: false,
    corrections: 0,
    errors: 0,
    bufferingSince: 0,
    bufferingMs: 0,
  });
  const samples = useRef<object[]>([]);

  // Reset per media.
  useEffect(() => {
    state.current.aligned = false;
    state.current.lastRevision = -1;
    state.current.lastPublishAt = 0;
  }, [mediaId]);

  useEffect(() => {
    if (!syncable || !mediaId) return;
    let lastSample = 0;

    const tick = (fromEvent = false) => {
      const p = player.current;
      const room = roomRef.current;
      const pb = room.playback;
      if (!p || !p.ready() || pb.media_id !== mediaId) return;
      const s = state.current;
      const localNow = Date.now();
      const serverNow = conn.serverNow();
      const buffering = p.isBuffering();

      if (buffering !== s.buffering) {
        s.buffering = buffering;
        if (buffering) s.bufferingSince = localNow;
        else if (s.bufferingSince) s.bufferingMs += localNow - s.bufferingSince;
        conn.sendRaw({ type: "buffering", buffering });
      }

      if (isHost) {
        if (!s.aligned) {
          // Join the room where it is instead of overwriting it with position 0 / paused.
          const a = guestCorrection(pb, serverNow, { current: p.getTime(), playing: p.isPlaying(), buffering: false, supportsRate: false }, localNow, 0, true);
          if (a.seekTo !== undefined) p.seek(a.seekTo);
          if (a.play === true) p.play();
          if (a.play === false) p.pause();
          s.aligned = true;
          s.lastPublishAt = localNow + 1500; // grace period while the player applies the alignment
          return;
        }
        const cmd = hostPublish(pb, serverNow, { current: p.getTime(), playing: p.isPlaying(), buffering }, localNow, s.lastPublishAt);
        if (cmd) {
          s.lastPublishAt = localNow;
          s.lastSeq = nextSeq(s.lastSeq, localNow);
          conn.publishPlayback({ ...cmd, seq: s.lastSeq, media_id: mediaId });
        }
        return;
      }

      const revisionChanged = pb.revision !== s.lastRevision;
      s.lastRevision = pb.revision;
      const current = p.getTime();
      const a = guestCorrection(
        pb,
        serverNow,
        { current, playing: p.isPlaying(), buffering, supportsRate: p.supportsRate },
        localNow,
        s.lastSeekAt,
        revisionChanged || fromEvent,
      );
      if (a.play === true) p.play();
      if (a.play === false) p.pause();
      if (a.seekTo !== undefined) {
        p.seek(a.seekTo);
        s.lastSeekAt = localNow;
        s.corrections += 1;
      }
      if (a.rate !== undefined) p.setRate(a.rate);

      if (localNow - lastSample > SAMPLE_MS && pb.playing && !buffering) {
        lastSample = localNow;
        const target = pb.position + (serverNow - pb.updated_at) / 1000;
        samples.current.push({ t: serverNow, event: "sample", drift: current - target, rtt: conn.rtt ?? undefined, position: current });
      }
    };

    const t = setInterval(() => tick(false), TICK_MS);
    const off = conn.onPlaybackEvent(() => setTimeout(() => tick(true), 0));
    const flush = setInterval(() => {
      const s = state.current;
      const batch = samples.current.splice(0, samples.current.length);
      batch.push({
        t: conn.serverNow(),
        event: "stats",
        corrections: s.corrections,
        reconnects: conn.reconnects.current,
        player_errors: s.errors,
        buffering_ms: s.bufferingMs,
      });
      s.bufferingMs = 0;
      api.metrics(conn.room.code, ident, batch.slice(-120)).catch(() => {});
    }, FLUSH_MS);
    return () => {
      clearInterval(t);
      clearInterval(flush);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncable, mediaId, isHost, ident.participant_id]);

  return {
    reportError: () => {
      state.current.errors += 1;
    },
  };
}
