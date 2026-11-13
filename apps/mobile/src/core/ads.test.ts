import { test } from "node:test";
import assert from "node:assert/strict";
import { ADS, adsEnabled, initialAdState, onBackground, onResume, onRoute, routeOf, type AdState, type Route } from "./ads.ts";

const IDS = { accountId: "abc123", bannerId: "1111111111", interstitialId: "2222222222" };
const T0 = 1_000_000;
const MIN = 60_000;

/** Runs route changes and returns the final state plus every effect. */
function walk(s: AdState, steps: [Route, number][]) {
  const effects = [];
  for (const [r, t] of steps) {
    const [ns, e] = onRoute(s, r, t);
    s = ns;
    effects.push(e);
  }
  return { s, effects };
}

test("routes are recognised from URLs and paths", () => {
  const host = "nexora.lenstedreal.info";
  assert.equal(routeOf("https://nexora.lenstedreal.info/", host), "home");
  assert.equal(routeOf("https://nexora.lenstedreal.info", host), "home");
  assert.equal(routeOf("https://nexora.lenstedreal.info/?x=1#a", host), "home");
  assert.equal(routeOf("https://nexora.lenstedreal.info/room/ABC234", host), "room");
  assert.equal(routeOf("/room/ABC234", host), "room");
  assert.equal(routeOf("/", host), "home");
  assert.equal(routeOf("/profile", host), "other");
  assert.equal(routeOf("https://evil.example/", host), "other");
  assert.equal(routeOf("not a url:::", host), "other");
});

test("disabled when any ID is empty or placement not numeric", () => {
  assert.equal(adsEnabled(IDS), true);
  assert.equal(adsEnabled({ ...IDS, accountId: "" }), false);
  assert.equal(adsEnabled({ ...IDS, bannerId: "" }), false);
  assert.equal(adsEnabled({ ...IDS, interstitialId: " " }), false);
  assert.equal(adsEnabled({ ...IDS, bannerId: "abc" }), false);
  assert.equal(adsEnabled(null), false);
  const { effects } = walk(initialAdState({ ...IDS, bannerId: "" }, T0), [
    ["home", T0],
    ["room", T0 + MIN],
    ["home", T0 + 10 * MIN],
  ]);
  for (const e of effects) assert.deepEqual(e, { banner: false, preloadInterstitial: false, showInterstitial: false });
});

test("banner only on home, never in a room or elsewhere", () => {
  let s = initialAdState(IDS, T0);
  let e;
  [s, e] = onRoute(s, "home", T0);
  assert.equal(e.banner, true);
  [s, e] = onRoute(s, "room", T0 + 1000);
  assert.equal(e.banner, false);
  assert.equal(e.showInterstitial, false);
  [s, e] = onRoute(s, "other", T0 + 2000);
  assert.equal(e.banner, false);
});

test("no interstitial at app start (first route home, or deep link into room and quick exit)", () => {
  const a = walk(initialAdState(IDS, T0), [["home", T0]]);
  assert.equal(a.effects[0].showInterstitial, false);
  const b = walk(initialAdState(IDS, T0), [
    ["room", T0],
    ["home", T0 + 1000],
  ]);
  assert.equal(b.effects[1].showInterstitial, false);
});

test("interstitial only on room -> home, preloaded on entering the room", () => {
  const { effects } = walk(initialAdState(IDS, T0), [
    ["home", T0],
    ["room", T0 + MIN],
    ["home", T0 + 5 * MIN],
  ]);
  assert.equal(effects[1].preloadInterstitial, true);
  assert.equal(effects[1].showInterstitial, false);
  assert.equal(effects[2].showInterstitial, true);
  assert.equal(effects[2].banner, true);
});

test("never when the next route is a room or another page", () => {
  const { effects } = walk(initialAdState(IDS, T0), [
    ["home", T0],
    ["room", T0 + MIN],
    ["room", T0 + 5 * MIN], // room -> another room
    ["other", T0 + 6 * MIN], // room -> profile
    ["home", T0 + 7 * MIN], // other -> home
  ]);
  for (const e of effects) assert.equal(e.showInterstitial, false);
});

test("at most once per 3 minutes", () => {
  const { effects } = walk(initialAdState(IDS, T0), [
    ["home", T0],
    ["room", T0 + MIN],
    ["home", T0 + 2 * MIN], // shown
    ["room", T0 + 3 * MIN],
    ["home", T0 + 4 * MIN], // 2 min later: no
    ["room", T0 + 4.5 * MIN],
    ["home", T0 + 2 * MIN + ADS.INTERSTITIAL_GAP_MS], // exactly 3 min: yes
  ]);
  assert.deepEqual(
    effects.map((e) => e.showInterstitial),
    [false, false, true, false, false, false, true],
  );
});

test("never on return from background, nor while in background", () => {
  let s = walk(initialAdState(IDS, T0), [
    ["home", T0],
    ["room", T0 + MIN],
  ]).s;
  let e;
  [s, e] = onBackground(s);
  assert.equal(e.banner, false);
  // route change reported while in background
  [s, e] = onRoute(s, "home", T0 + 5 * MIN);
  assert.equal(e.showInterstitial, false);
  assert.equal(e.banner, false);
  [s, e] = onResume(s, T0 + 6 * MIN);
  assert.equal(e.showInterstitial, false);
  assert.equal(e.banner, true);
  // leaving a room right after resume (WebView restoring) does not count either
  [s] = onRoute(s, "room", T0 + 6 * MIN + 100);
  [s, e] = onRoute(s, "home", T0 + 6 * MIN + 1000);
  assert.equal(e.showInterstitial, false);
  // a real room -> home later does
  [s] = onRoute(s, "room", T0 + 7 * MIN);
  [s, e] = onRoute(s, "home", T0 + 9 * MIN);
  assert.equal(e.showInterstitial, true);
});

test("resume inside a room shows no banner", () => {
  let s = walk(initialAdState(IDS, T0), [["room", T0]]).s;
  [s] = onBackground(s);
  const [, e] = onResume(s, T0 + MIN);
  assert.deepEqual(e, { banner: false, preloadInterstitial: false, showInterstitial: false });
});
