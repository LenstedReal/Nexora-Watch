import { test } from "node:test";
import assert from "node:assert/strict";
import { ClockEstimator, SYNC, expectedPosition, guestCorrection, hostPublish, nextSeq } from "./sync.ts";

const pb = (playing: boolean, position: number, updated_at = 1_000_000) => ({ playing, position, updated_at });
const guest = (current: number, playing = true, buffering = false, supportsRate = true) => ({ current, playing, buffering, supportsRate });

test("expected position advances only while playing", () => {
  assert.equal(expectedPosition(pb(true, 10), 1_002_500), 12.5);
  assert.equal(expectedPosition(pb(false, 10), 1_002_500), 10);
  assert.equal(expectedPosition(pb(true, 10), 999_000), 10); // clock behind: never go backwards
});

test("clock estimator keeps the lowest-rtt sample", () => {
  const c = new ClockEstimator();
  c.addPong(0, 5_000, 400); // rtt 400 -> offset 4800
  c.addPong(1000, 6_050, 1100); // rtt 100 -> offset 5000
  c.addPong(2000, 7_500, 2600); // rtt 600 -> ignored as best
  assert.equal(c.offset, 5000);
  assert.equal(c.serverNow(10), 5010);
});

test("guest in sync does nothing", () => {
  assert.deepEqual(guestCorrection(pb(true, 10), 1_000_000, guest(10.03), 0, 0, false), { rate: 1 });
});

test("guest small drift nudges rate, never beyond limits", () => {
  const ahead = guestCorrection(pb(true, 10), 1_000_000, guest(10.6), 0, 0, false);
  assert.ok(ahead.rate! < 1 && ahead.rate! >= SYNC.RATE_MIN);
  const behind = guestCorrection(pb(true, 10), 1_000_000, guest(8.5), 0, 0, false);
  assert.ok(behind.rate! > 1 && behind.rate! <= SYNC.RATE_MAX);
  assert.equal(behind.seekTo, undefined);
});

test("guest big drift seeks with lead, respecting cooldown", () => {
  const a = guestCorrection(pb(true, 10), 1_000_000, guest(4), 10_000, 0, false);
  assert.equal(a.seekTo, 10 + SYNC.SEEK_LEAD_S);
  const b = guestCorrection(pb(true, 10), 1_000_000, guest(4), 10_000, 9_000, false);
  assert.equal(b.seekTo, undefined);
});

test("explicit host seek (new revision) bypasses cooldown", () => {
  const a = guestCorrection(pb(true, 60), 1_000_000, guest(10), 10_000, 9_900, true);
  assert.equal(a.seekTo, 60 + SYNC.SEEK_LEAD_S);
});

test("guest pauses and snaps to host position when host paused", () => {
  const a = guestCorrection(pb(false, 30), 1_000_000, guest(31.2, true), 0, 0, false);
  assert.equal(a.play, false);
  assert.equal(a.seekTo, 30);
});

test("guest does not correct while buffering", () => {
  const a = guestCorrection(pb(true, 10), 1_000_000, guest(2, false, true), 10_000, 0, false);
  assert.equal(a.seekTo, undefined);
  assert.equal(a.play, true); // play is idempotent and starts once loaded
});

test("youtube-like guest (no rate support) only seeks", () => {
  const a = guestCorrection(pb(true, 10), 1_000_000, guest(10.9, true, false, false), 0, 0, false);
  assert.equal(a.rate, undefined);
  assert.equal(a.seekTo, undefined);
});

test("host buffering never publishes a pause", () => {
  assert.equal(hostPublish(pb(true, 10), 1_000_000, { current: 10, playing: false, buffering: true }, 50_000, 49_000), null);
});

test("host publishes on pause, seek and keepalive", () => {
  assert.deepEqual(hostPublish(pb(true, 10), 1_000_000, { current: 10, playing: false, buffering: false }, 50_000, 0), { playing: false, position: 10 });
  assert.deepEqual(hostPublish(pb(true, 10), 1_000_000, { current: 42, playing: true, buffering: false }, 50_000, 49_000), { playing: true, position: 42 });
  assert.equal(hostPublish(pb(true, 10), 1_000_000, { current: 10.2, playing: true, buffering: false }, 50_000, 45_000), null);
  assert.ok(hostPublish(pb(true, 10), 1_000_000, { current: 10.2, playing: true, buffering: false }, 70_000, 45_000));
});

test("host respects minimum gap between publishes", () => {
  assert.equal(hostPublish(pb(true, 10), 1_000_000, { current: 99, playing: true, buffering: false }, 50_000, 49_900), null);
});

test("seq is monotonic", () => {
  assert.equal(nextSeq(5, 3), 6);
  assert.equal(nextSeq(5, 100), 100);
});
