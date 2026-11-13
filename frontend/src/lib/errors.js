// Crash reports without a third-party service: uncaught errors, unhandled promise rejections and React render errors
// are sent as a small JSON to POST /api/client-errors (no nickname, no room token, page without query string).
// At most MAX_PER_PAGE reports per page load and never the same message twice; the server rate-limits per IP too.
import { BUILD } from "@/lib/update";

const BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const URL_ = `${BASE}/api/client-errors`;
const MAX_PER_PAGE = 5;
const seen = new Set();
let sent = 0;

const cut = (s, n) => (typeof s === "string" ? s : String(s ?? "")).slice(0, n);

export function reportError(err, kind = "error") {
  try {
    const message = cut((err && err.message) || err || "unknown", 500).trim() || "unknown";
    if (sent >= MAX_PER_PAGE || seen.has(message)) return;
    seen.add(message);
    sent += 1;
    const body = JSON.stringify({
      kind,
      message,
      stack: cut(err && err.stack, 4096),
      page: cut(window.location.pathname, 300),
      version: cut(BUILD || "dev", 40),
      ua: cut(navigator.userAgent, 300),
    });
    const blob = typeof Blob !== "undefined" ? new Blob([body], { type: "application/json" }) : null;
    if (blob && navigator.sendBeacon && navigator.sendBeacon(URL_, blob)) return;
    fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* reporting must never throw */
  }
}

export function startErrorReporting() {
  window.addEventListener("error", (e) => {
    // Resource load errors (img/script) have no error object and are not crashes.
    if (!e || (!e.error && !e.message)) return;
    reportError(e.error || { message: e.message, stack: `${e.filename || ""}:${e.lineno || 0}:${e.colno || 0}` }, "error");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    reportError(r instanceof Error ? r : { message: `unhandled rejection: ${cut(typeof r === "string" ? r : JSON.stringify(r ?? null), 400)}` }, "rejection");
  });
}
