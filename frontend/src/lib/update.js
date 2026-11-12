// Keeps a long-open tab, and the mobile app (which shows this same web app), on the current release.
// The page knows which build it is (a <meta> written at build time); /version.txt says which build the server has.
// When they differ the page reloads itself, but only at a moment that interrupts nobody: never inside a room and
// never while someone is typing.
const meta = typeof document !== "undefined" ? document.querySelector('meta[name="nexora-build"]') : null;
export const BUILD = ((meta && meta.content) || "").trim().toLowerCase();
const VALID = /^[0-9a-f]{7,40}$/;
const KEY = "nx:update";
const CHECK_EVERY_MS = 2 * 60 * 1000;
const QUIET_AFTER_INPUT_MS = 2 * 60 * 1000;

let latest = ""; // the server's build, when it is not ours
let lastCheck = 0;
let lastInput = 0;
let checking = false;

const inRoom = () => window.location.pathname.startsWith("/room/");
const typing = () => {
  const el = document.activeElement;
  return (!!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !!el.value) || Date.now() - lastInput < QUIET_AFTER_INPUT_MS;
};
// One reload per new build and browser session: if the page still is not new afterwards (a cache in between),
// it must not reload in a loop. Without session storage there is no way to remember that, so nothing is reloaded.
const tried = (id) => { try { return sessionStorage.getItem(KEY) === id; } catch { return true; } };
const remember = (id) => { try { sessionStorage.setItem(KEY, id); return sessionStorage.getItem(KEY) === id; } catch { return false; } };

/** Reloads into the new build when one is known and this is a safe moment. Returns true when a reload was started. */
export function applyUpdateIfSafe() {
  if (!latest || inRoom() || typing() || tried(latest) || !remember(latest)) return false;
  window.location.reload();
  return true;
}

export async function checkForUpdate(force = false) {
  if (!VALID.test(BUILD) || checking) return;
  const now = Date.now();
  if (!force && now - lastCheck < CHECK_EVERY_MS) {
    applyUpdateIfSafe();
    return;
  }
  lastCheck = now;
  checking = true;
  try {
    const res = await fetch(`/version.txt?t=${now}`, { cache: "no-store" });
    if (res.ok) {
      const id = ((await res.text()).trim().split(/\s+/)[1] || "").toLowerCase(); // "<app version> <git sha>"
      latest = VALID.test(id) && id !== BUILD ? id : "";
    }
  } catch {
    /* offline: the next check will tell */
  } finally {
    checking = false;
  }
  applyUpdateIfSafe();
}

export function startUpdateWatch() {
  if (!VALID.test(BUILD)) return; // development build: nothing to compare with
  document.addEventListener("input", () => { lastInput = Date.now(); }, true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
  setInterval(() => { if (document.visibilityState === "visible") checkForUpdate(); }, 15 * 60 * 1000);
  setTimeout(() => checkForUpdate(true), 4000);
}
