// In-app subscription services (beta, "Rave method"): Netflix, Disney+, Prime Video, HBO Max.
// Each person opens the service's own website in ServicePlayer and signs in with their OWN account. The script below is
// injected into that page and works like a remote control: it finds the page's main <video>, reports
// {playing, position, duration} and applies play / pause / seek. It never reads, copies, records or proxies the stream
// and never touches DRM. No React / React Native imports, so it can be unit-tested with plain Node and Playwright.

export type ServiceId = "netflix" | "disney" | "prime" | "max";
export type Role = "host" | "guest";

export type ControllerConfig = {
  service: string;
  role: Role;
  /** timeupdate reports at most this often (ms) */
  reportMs?: number;
  /** a guest seeks only when it is further than this from the host (s) */
  driftS?: number;
  /** no second drift seek within this time (ms) */
  cooldownMs?: number;
  /** media events this soon after one of our own commands are not the user's (ms) */
  quietMs?: number;
};

/** What the page reports (ServicePlayer passes it on to the room, i.e. the web app's ServiceCard). */
export type ServiceReport = {
  source: "nexora-service";
  type: "ready" | "state" | "lost" | "reverted" | "blocked";
  playing?: boolean;
  position?: number;
  duration?: number;
  buffering?: boolean;
  reason?: string;
  /** true when the person on this phone did it (not one of our commands) */
  user?: boolean;
  role?: Role;
  netflix_api?: boolean;
};

export type ServiceCommand =
  | { cmd: "play" }
  | { cmd: "pause" }
  | { cmd: "seek"; position: number }
  /** guests: the host's state; the page is kept there (drift correction + guest lock) */
  | { cmd: "follow"; playing: boolean; position: number }
  | { cmd: "role"; role: Role }
  | { cmd: "status" };

export const SERVICE_DRIFT_S = 1.5;

export const SERVICE_BRANDS: Record<ServiceId, { name: string; color: string; letter: string; home: string }> = {
  netflix: { name: "Netflix", color: "#E50914", letter: "N", home: "https://www.netflix.com/" },
  disney: { name: "Disney+", color: "#113CCF", letter: "D", home: "https://www.disneyplus.com/" },
  prime: { name: "Prime Video", color: "#00A8E1", letter: "P", home: "https://www.primevideo.com/" },
  max: { name: "HBO Max", color: "#002BE7", letter: "M", home: "https://play.hbomax.com/" },
};

// The services send phones to their own apps; their desktop sites play in a browser. A normal desktop Chrome UA.
export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * The controller, as source text: Hermes (the app's JS engine) has no function source, so this cannot be a real function.
 * Plain ES5 + MutationObserver so it runs in old Android WebViews. It must not contain back-ticks or dollar-brace.
 */
export const CONTROLLER_SRC = String.raw`
var w = window, d = document;
if (w.__nxCtl) { w.__nxCtl.configure(cfg); return; }
var C = {};
function configure(c) {
  c = c || {};
  C.role = c.role === "host" ? "host" : "guest";
  C.service = String(c.service || C.service || "");
  C.reportMs = c.reportMs || C.reportMs || 1000;
  C.driftS = c.driftS || C.driftS || 1.5;
  C.cooldownMs = c.cooldownMs || C.cooldownMs || 2500;
  C.quietMs = c.quietMs || C.quietMs || 900;
  if (C.role === "host") want = null;
}
var video = null, want = null, quietUntil = 0, lastReport = 0, lastSeekAt = 0, scanPending = false;
configure(cfg);
function now() { return Date.now(); }
function r3(x) { return Math.round((+x || 0) * 1000) / 1000; }
function post(m) {
  m.source = "nexora-service";
  try { if (w.ReactNativeWebView) w.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
}
// Netflix: setting video.currentTime crashes its player, so Netflix is driven through the page's own player API.
function nf() {
  if (C.service !== "netflix") return null;
  try {
    var vp = w.netflix.appContext.state.playerApp.getAPI().videoPlayer;
    var ids = vp.getAllPlayerSessionIds() || [];
    var id = ids[0];
    for (var i = 0; i < ids.length; i++) if (String(ids[i]).indexOf("watch") === 0) { id = ids[i]; break; }
    return id ? vp.getVideoPlayerBySessionId(id) || null : null;
  } catch (e) { return null; }
}
function area(v) {
  try { var r = v.getBoundingClientRect(); return r.width * r.height; } catch (e) { return 0; }
}
function pick() {
  var vs = d.getElementsByTagName("video"), best = null, score = -1;
  for (var i = 0; i < vs.length; i++) {
    var s = area(vs[i]) + (vs[i].readyState > 0 ? 1 : 0) + (vs[i].duration > 0 ? 1 : 0);
    if (s > score) { score = s; best = vs[i]; }
  }
  return best;
}
function pos() {
  var p = nf();
  if (p) { try { var t = p.getCurrentTime(); if (typeof t === "number" && isFinite(t)) return t / 1000; } catch (e) {} }
  return video ? video.currentTime || 0 : 0;
}
function dur() {
  var p = nf();
  if (p) { try { var x = p.getDuration(); if (x > 0) return x / 1000; } catch (e) {} }
  return video && isFinite(video.duration) ? video.duration : 0;
}
function paused() {
  var p = nf();
  if (p && typeof p.isPaused === "function") { try { return !!p.isPaused(); } catch (e) {} }
  return !video || video.paused;
}
function snapshot(type, reason, user) {
  return { type: type, playing: !paused(), position: r3(pos()), duration: r3(dur()), buffering: !!video && !video.paused && video.readyState < 3,
           reason: reason, user: !!user, role: C.role, netflix_api: !!nf() };
}
function report(reason) { lastReport = now(); post(snapshot("state", reason, now() >= quietUntil)); }
function quiet() { quietUntil = now() + C.quietMs; }
function doPlay() {
  quiet();
  var p = nf();
  if (p) { try { p.play(); return; } catch (e) {} }
  if (!video) return;
  try { var r = video.play(); if (r && r.catch) r.catch(function () { post({ type: "blocked" }); }); } catch (e) {}
}
function doPause() {
  quiet();
  var p = nf();
  if (p) { try { p.pause(); return; } catch (e) {} }
  if (video) { try { video.pause(); } catch (e) {} }
}
function doSeek(t) {
  t = Math.max(0, +t || 0);
  quiet();
  lastSeekAt = now();
  var p = nf();
  if (p) { try { p.seek(Math.round(t * 1000)); return; } catch (e) {} }
  if (C.service === "netflix") return; // never video.currentTime on Netflix
  if (video) { try { video.currentTime = t; } catch (e) {} }
}
function wantPos() { return want.playing ? want.position + (now() - want.at) / 1000 : want.position; }
// Keep a guest where the host is: same play/pause state; seek only when more than driftS away.
function enforce(force) {
  if (!want || (!video && !nf())) return null;
  var isPaused = paused();
  if (want.playing && isPaused) doPlay();
  else if (!want.playing && !isPaused) doPause();
  var target = wantPos(), drift = pos() - target;
  if (Math.abs(drift) > C.driftS && (force || now() - lastSeekAt > C.cooldownMs)) doSeek(target);
  return drift;
}
var EVENTS = ["play", "pause", "seeked", "timeupdate", "waiting", "playing", "loadedmetadata", "durationchange", "ended"];
function onEvent(e) {
  var t = e.type;
  if (t === "timeupdate") { if (now() - lastReport >= C.reportMs) report(t); return; }
  var user = now() >= quietUntil;
  // Guest lock: a guest's own play / pause / seek is undone; the host decides what the room watches.
  if (C.role === "guest" && user && want && (t === "play" || t === "pause" || t === "seeked")) {
    var isPaused = paused();
    var off = want.playing === isPaused || Math.abs(pos() - wantPos()) > C.driftS;
    if (off) { enforce(true); post({ type: "reverted", reason: t }); return; }
  }
  report(t);
}
function bind(v) {
  if (v === video) return;
  var i;
  if (video) for (i = 0; i < EVENTS.length; i++) video.removeEventListener(EVENTS[i], onEvent);
  video = v;
  if (!v) { post({ type: "lost" }); return; }
  for (i = 0; i < EVENTS.length; i++) v.addEventListener(EVENTS[i], onEvent);
  lastReport = now();
  post(snapshot("ready", "ready", false));
  if (want) enforce(true);
}
function scan() { scanPending = false; bind(pick()); }
function command(c) {
  if (!c || typeof c !== "object") return;
  if (c.cmd === "play") { if (want) { want = { playing: true, position: wantPos(), at: now() }; } doPlay(); }
  else if (c.cmd === "pause") { if (want) { want = { playing: false, position: pos(), at: now() }; } doPause(); }
  else if (c.cmd === "seek") { if (want) { want = { playing: want.playing, position: +c.position || 0, at: now() }; } doSeek(c.position); }
  else if (c.cmd === "follow") {
    if (C.role !== "guest") return;
    want = { playing: !!c.playing, position: Math.max(0, +c.position || 0), at: now() };
    enforce(true);
  }
  else if (c.cmd === "role") configure({ role: c.role, service: C.service });
  else if (c.cmd === "status") report("status");
}
new MutationObserver(function () {
  if (scanPending) return;
  scanPending = true;
  setTimeout(scan, 150);
}).observe(d.documentElement || d, { childList: true, subtree: true });
setInterval(function () {
  if (video && !d.documentElement.contains(video)) scan();
  else if (!video) scan();
  if (C.role === "guest" && want) enforce(false);
  if (video && now() - lastReport > 3 * C.reportMs) report("tick"); // paused pages send no timeupdate
}, 1000);
w.__nxCtl = { command: command, configure: configure, status: function () { return snapshot("state", "status", false); }, version: 1 };
scan();
`;

/** The script injected into the service page (react-native-webview `injectedJavaScript`). */
export function controllerScript(cfg: ControllerConfig): string {
  return `(function (cfg) {${CONTROLLER_SRC}})(${JSON.stringify(cfg)});\ntrue;`;
}

/** Runs one command in the service page (react-native-webview `injectJavaScript`). */
export function commandScript(c: ServiceCommand): string {
  return `window.__nxCtl && window.__nxCtl.command(${JSON.stringify(c)});\ntrue;`;
}

const REPORT_TYPES = new Set(["ready", "state", "lost", "reverted", "blocked"]);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

/** A message from the service page, or null. The page itself can post anything, so only known fields pass. */
export function parseServiceReport(data: unknown): ServiceReport | null {
  let m: any;
  try {
    m = typeof data === "string" ? JSON.parse(data) : null;
  } catch {
    return null;
  }
  if (!m || m.source !== "nexora-service" || !REPORT_TYPES.has(m.type)) return null;
  const out: ServiceReport = { source: "nexora-service", type: m.type };
  if (typeof m.playing === "boolean") out.playing = m.playing;
  if (num(m.position) !== undefined) out.position = Math.max(0, m.position);
  if (num(m.duration) !== undefined) out.duration = Math.max(0, m.duration);
  if (typeof m.buffering === "boolean") out.buffering = m.buffering;
  if (typeof m.reason === "string") out.reason = m.reason.slice(0, 20);
  if (typeof m.user === "boolean") out.user = m.user;
  if (m.role === "host" || m.role === "guest") out.role = m.role;
  if (typeof m.netflix_api === "boolean") out.netflix_api = m.netflix_api;
  return out;
}

/** A command from the room (web app), or null. */
export function parseServiceCommand(m: any): ServiceCommand | null {
  if (!m || typeof m !== "object") return null;
  if (m.cmd === "play" || m.cmd === "pause" || m.cmd === "status") return { cmd: m.cmd };
  if (m.cmd === "seek" && num(m.position) !== undefined) return { cmd: "seek", position: Math.max(0, m.position) };
  if (m.cmd === "follow" && typeof m.playing === "boolean" && num(m.position) !== undefined)
    return { cmd: "follow", playing: m.playing, position: Math.max(0, m.position) };
  if (m.cmd === "role" && (m.role === "host" || m.role === "guest")) return { cmd: "role", role: m.role };
  return null;
}

export function isServiceId(s: unknown): s is ServiceId {
  return s === "netflix" || s === "disney" || s === "prime" || s === "max";
}

/** Only https pages are opened inside ServicePlayer (the service, its sign-in pages); app links (intent:, market:) are not. */
export function allowedInServicePlayer(url: string): boolean {
  return /^https:\/\//i.test(url) || url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:");
}

const SERVICE_HOSTS: Record<ServiceId, RegExp> = {
  netflix: /^(?:www\.|m\.)?netflix\.com$/,
  disney: /^(?:www\.|apps\.)?disneyplus\.com$/,
  prime: /^(?:www\.)?(?:primevideo\.com|amazon\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2}))$/,
  max: /^(?:www\.|play\.)?(?:hbo)?max\.com$/,
};

/** The page ServicePlayer may open for this service: https on the service's own host (what the backend resolved). */
export function serviceUrlOk(service: unknown, url: unknown): boolean {
  if (!isServiceId(service) || typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  try {
    return SERVICE_HOSTS[service].test(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}
