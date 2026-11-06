// Pure playback-sync math. No React / React Native imports so it can be unit-tested with plain Node
// and shared with the web client later.

export type PlaybackLike = { playing: boolean; position: number; updated_at: number };

export const SYNC = {
  HARD_DRIFT_S: 2, // above this a guest seeks
  SOFT_DRIFT_S: 0.25, // above this a guest nudges playback rate
  SETTLED_S: 0.08, // below this the rate goes back to 1.0
  SEEK_LEAD_S: 0.15, // seek slightly ahead to absorb seek latency
  SEEK_COOLDOWN_MS: 3000,
  RATE_MIN: 0.95,
  RATE_MAX: 1.05,
  HOST_MISMATCH_S: 0.75, // host republishes when its player is this far from the room state
  HOST_KEEPALIVE_MS: 20000,
  HOST_MIN_GAP_MS: 300,
};

/** Where the room playback should be at `serverNow` (ms, server clock). */
export function expectedPosition(pb: PlaybackLike, serverNow: number): number {
  if (!pb.playing || !pb.updated_at) return Math.max(0, pb.position);
  return Math.max(0, pb.position + Math.max(0, serverNow - pb.updated_at) / 1000);
}

export type ClockSample = { rtt: number; offset: number };

/** NTP-style estimate: keep the last N samples and trust the one with the smallest round trip. */
export class ClockEstimator {
  private samples: ClockSample[] = [];
  offset = 0;
  rtt: number | null = null;

  private readonly keep: number;

  constructor(keep = 8) {
    this.keep = keep;
  }

  /** Rough first guess from a server timestamp (before any pong arrived). */
  seed(serverTime: number, localNow: number) {
    if (!this.samples.length) this.offset = serverTime - localNow;
  }

  addPong(clientSent: number, serverTime: number, localNow: number): ClockSample | null {
    const rtt = localNow - clientSent;
    if (!(rtt >= 0) || rtt > 30000) return null;
    const sample = { rtt, offset: serverTime + rtt / 2 - localNow };
    this.samples = [...this.samples.slice(-(this.keep - 1)), sample];
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = rtt;
    return sample;
  }

  serverNow(localNow: number): number {
    return localNow + this.offset;
  }
}

export type GuestState = {
  current: number;
  playing: boolean;
  buffering: boolean;
  supportsRate: boolean;
};

export type GuestAction = {
  play?: boolean; // true -> play, false -> pause, undefined -> leave as is
  seekTo?: number;
  rate?: number;
};

/**
 * Decide how a guest should correct its player.
 * `lastSeekAt` is the local ms timestamp of the previous corrective seek; `revisionChanged` bypasses the cooldown
 * so an explicit host seek is followed immediately.
 */
export function guestCorrection(
  pb: PlaybackLike,
  serverNow: number,
  s: GuestState,
  localNow: number,
  lastSeekAt: number,
  revisionChanged: boolean,
): GuestAction {
  const action: GuestAction = {};
  const target = expectedPosition(pb, serverNow);
  const drift = s.current - target; // > 0 means we are ahead

  // play()/pause() are idempotent, so they are issued even while buffering (a loading player starts when ready).
  if (pb.playing !== s.playing) action.play = pb.playing;

  if (!pb.playing) {
    if (Math.abs(drift) > 0.5) action.seekTo = target;
    if (s.supportsRate) action.rate = 1;
    return action;
  }

  if (s.buffering) return action; // never fight the player while it is loading

  const canSeek = revisionChanged ? Math.abs(drift) > 0.5 : localNow - lastSeekAt > SYNC.SEEK_COOLDOWN_MS;
  if (Math.abs(drift) > SYNC.HARD_DRIFT_S || (revisionChanged && Math.abs(drift) > 0.5)) {
    if (canSeek) {
      action.seekTo = target + SYNC.SEEK_LEAD_S;
      if (s.supportsRate) action.rate = 1;
    }
    return action;
  }

  if (s.supportsRate) {
    if (Math.abs(drift) > SYNC.SOFT_DRIFT_S) {
      action.rate = clamp(1 - drift * 0.1, SYNC.RATE_MIN, SYNC.RATE_MAX);
    } else if (Math.abs(drift) < SYNC.SETTLED_S) {
      action.rate = 1;
    }
  }
  return action;
}

export type HostState = { current: number; playing: boolean; buffering: boolean };

/**
 * Decide whether the host must publish its player state. Buffering never turns into a pause.
 * Returns the command body or null.
 */
export function hostPublish(
  room: PlaybackLike,
  serverNow: number,
  s: HostState,
  localNow: number,
  lastPublishAt: number,
): { playing: boolean; position: number } | null {
  if (localNow - lastPublishAt < SYNC.HOST_MIN_GAP_MS) return null;
  const playing = s.buffering ? room.playing : s.playing;
  const target = expectedPosition(room, serverNow);
  const stateChanged = playing !== room.playing;
  const positionOff = !s.buffering && Math.abs(s.current - target) > SYNC.HOST_MISMATCH_S;
  const keepalive = playing && !s.buffering && localNow - lastPublishAt > SYNC.HOST_KEEPALIVE_MS;
  if (stateChanged || positionOff || keepalive) return { playing, position: Math.max(0, round3(s.current)) };
  return null;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Monotonic, restart-safe sequence numbers for playback commands. */
export function nextSeq(last: number, now: number): number {
  return Math.max(last + 1, now);
}
