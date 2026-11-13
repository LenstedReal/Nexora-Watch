// Pure checks for the service controller helpers. The injected script itself is tested in Chromium against fake service
// pages (play / pause / seek / drift / guest lock / Netflix player API): see docs/SERVICES.md, "Testler".
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTROLLER_SRC, allowedInServicePlayer, commandScript, controllerScript, isServiceId, parseServiceCommand, parseServiceReport, serviceUrlOk } from "./serviceController.ts";

test("commands from the room: only known commands with valid values", () => {
  assert.deepEqual(parseServiceCommand({ cmd: "play" }), { cmd: "play" });
  assert.deepEqual(parseServiceCommand({ cmd: "seek", position: -2 }), { cmd: "seek", position: 0 });
  assert.deepEqual(parseServiceCommand({ cmd: "follow", playing: false, position: 7, x: 1 }), { cmd: "follow", playing: false, position: 7 });
  assert.equal(parseServiceCommand({ cmd: "seek", position: NaN }), null);
  assert.equal(parseServiceCommand({ cmd: "role", role: "owner" }), null);
  assert.equal(parseServiceCommand({ cmd: "run", code: "alert(1)" }), null);
  assert.equal(parseServiceCommand(null), null);
});

test("reports from the service page: only our fields pass", () => {
  const r = parseServiceReport(JSON.stringify({ source: "nexora-service", type: "state", playing: true, position: 12, duration: 3600, user: true, cookie: "x" }));
  assert.deepEqual(r, { source: "nexora-service", type: "state", playing: true, position: 12, duration: 3600, user: true });
  assert.equal(parseServiceReport(JSON.stringify({ source: "other", type: "state" })), null);
  assert.equal(parseServiceReport(JSON.stringify({ source: "nexora-service", type: "eval" })), null);
  assert.equal(parseServiceReport("not json"), null);
});

test("scripts are self-contained strings", () => {
  assert.ok(!/`|\$\{/.test(CONTROLLER_SRC));
  const s = controllerScript({ service: "netflix", role: "guest" });
  assert.ok(s.startsWith("(function (cfg) {") && s.includes('{"service":"netflix","role":"guest"}') && s.trim().endsWith("true;"));
  assert.ok(new Function(s)); // parses
  assert.equal(commandScript({ cmd: "pause" }), 'window.__nxCtl && window.__nxCtl.command({"cmd":"pause"});\ntrue;');
});

test("service ids and navigation", () => {
  assert.ok(isServiceId("disney") && !isServiceId("youtube"));
  assert.ok(allowedInServicePlayer("https://www.primevideo.com/ap/signin"));
  assert.ok(!allowedInServicePlayer("intent://open#Intent;scheme=nflx;end"));
  assert.ok(!allowedInServicePlayer("market://details?id=com.netflix.mediaclient"));
});

test("serviceUrlOk: only https pages on the service's own host", () => {
  assert.equal(serviceUrlOk("netflix", "https://www.netflix.com/watch/80100172"), true);
  assert.equal(serviceUrlOk("disney", "https://www.disneyplus.com/video/abc123"), true);
  assert.equal(serviceUrlOk("prime", "https://www.amazon.de/gp/video/detail/B0ABCDEFGH"), true);
  assert.equal(serviceUrlOk("max", "https://play.max.com/video/watch/abc123"), true);
  assert.equal(serviceUrlOk("max", "https://play.hbomax.com/movie/abc123"), true);
  assert.equal(serviceUrlOk("netflix", "http://www.netflix.com/watch/80100172"), false);
  assert.equal(serviceUrlOk("netflix", "https://www.netflix.com.evil.example/watch/1"), false);
  assert.equal(serviceUrlOk("netflix", "https://www.disneyplus.com/video/abc123"), false);
  assert.equal(serviceUrlOk("hulu", "https://www.hulu.com/watch/1"), false);
  assert.equal(serviceUrlOk("netflix", 5), false);
});
