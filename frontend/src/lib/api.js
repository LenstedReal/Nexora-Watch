import { deviceHeaders, getDevice, markRegistered } from "@/lib/device";
// Empty = same origin (Caddy serves the web app and proxies /api to the backend).
const BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TIMEOUT_MS = 20000;

async function req(method, path, body, timeoutMs = TIMEOUT_MS, extraHeaders) {
  let res;
  // A request on a dead mobile connection can otherwise hang for minutes with no feedback.
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body || extraHeaders ? { ...(body ? { "Content-Type": "application/json" } : {}), ...(extraHeaders || {}) } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch {
    throw new ApiError(0, "unreachable", "Sunucuya ulaşılamıyor");
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.code || `http_${res.status}`, typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`);
  }
  return data;
}

const cred = (ident) => ({ participant_id: ident.participant_id, token: ident.token });
const q = (ident) => `participant_id=${encodeURIComponent(ident.participant_id)}&token=${encodeURIComponent(ident.token)}`;

// Registers the anonymous device once; failures are ignored (the room still works without it).
let devReg = null;
export function ensureDevice() {
  const d = getDevice();
  if (d.reg) return Promise.resolve(true);
  if (!devReg) {
    devReg = req("POST", "/devices", { device_id: d.id, secret: d.key }, 8000)
      .then(() => { markRegistered(); return true; })
      .catch(() => { devReg = null; return false; });
  }
  return devReg;
}
const withDev = async (method, path, body, timeoutMs) => {
  const ok = await ensureDevice();
  return req(method, path, body, timeoutMs, ok ? deviceHeaders() : undefined);
};

export const absUrl = (u) => (/^https?:\/\//.test(u) ? u : `${BASE}${u}`);

const wsBase = () => {
  if (BASE) return BASE.replace(/^http/, "ws");
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}`;
};

export const wsUrl = (code, ident) => `${wsBase()}/api/ws?code=${encodeURIComponent(code)}&${q(ident)}`;

export const api = {
  createRoom: (nickname, name) => withDev("POST", "/rooms", { nickname, name }),
  joinRoom: (code, nickname, ident) => withDev("POST", `/rooms/${code}/join`, { nickname, ...(ident ? cred(ident) : {}) }),
  people: () => withDev("GET", "/devices/me/people"),
  testPush: () => withDev("POST", "/devices/me/test-push", {}),
  forgetPerson: (id) => withDev("DELETE", `/devices/me/people/${encodeURIComponent(id)}`),
  forgetAll: () => withDev("DELETE", "/devices/me/people"),
  invitePerson: (code, ident, to) => withDev("POST", `/rooms/${code}/invite`, { ...cred(ident), to }),
  publicRooms: () => req("GET", "/rooms/public"),
  setPublic: (code, ident, value) => req("PUT", `/rooms/${code}/public`, { ...cred(ident), public: !!value }),
  getRoom: (code) => req("GET", `/rooms/${code}`),
  getMessages: (code) => req("GET", `/rooms/${code}/messages`),
  sendMessage: (code, ident, text, client_id) => req("POST", `/rooms/${code}/messages`, { ...cred(ident), text, client_id }),
  setVideo: (code, ident, url, extra) => req("PUT", `/rooms/${code}/video`, { ...cred(ident), url, ...(extra || {}) }, 45000), // the server checks the link first
  setPlayback: (code, ident, cmd) => req("PUT", `/rooms/${code}/playback`, { ...cred(ident), ...cmd }),
  leave: (code, ident) => req("POST", `/rooms/${code}/leave`, cred(ident)),
  close: (code, ident) => req("POST", `/rooms/${code}/close`, cred(ident)),
  metrics: (code, ident, samples) => req("POST", `/rooms/${code}/metrics`, { ...cred(ident), samples }),
  metricsSummary: (code, ident) => req("GET", `/rooms/${code}/metrics/summary?${q(ident)}`),
  storageUsage: () => req("GET", "/storage/usage"),
  mediaUrl: (id, ident) => req("GET", `/media/${id}/url?${q(ident)}`),
  uploadInit: (body) => req("POST", "/uploads/init", body),
  partUrls: (id, ident, parts) => req("POST", `/uploads/${id}/part-urls`, { ...cred(ident), parts }),
  uploadComplete: (id, ident) => req("POST", `/uploads/${id}/complete`, cred(ident), 300000), // joining the parts of a large file takes a while
  uploadAbort: (id, ident) => req("POST", `/uploads/${id}/abort`, cred(ident)),
  config: () => req("GET", "/config"),
  importDrive: (code, ident, url) => req("POST", "/uploads/import", { code, ...cred(ident), url }, 60000),
  importStatus: (id, ident) => req("GET", `/uploads/${id}/import-status?${q(ident)}`),
  report: (code, ident, body) => req("POST", `/rooms/${code}/report`, { ...cred(ident), ...body }),
  kick: (code, ident, target_id) => req("POST", `/rooms/${code}/kick`, { ...cred(ident), target_id }),
  makeHost: (code, ident, target_id) => req("POST", `/rooms/${code}/host`, { ...cred(ident), target_id }),
  queueAdd: (code, ident, url) => req("POST", `/rooms/${code}/queue`, { ...cred(ident), url }, 45000),
  queueVote: (code, ident, id) => req("POST", `/rooms/${code}/queue/${id}/vote`, cred(ident)),
  queueRemove: (code, ident, id) => req("DELETE", `/rooms/${code}/queue/${id}`, cred(ident)),
  setSubtitle: (code, ident, body) => req("PUT", `/rooms/${code}/subtitle`, { ...cred(ident), ...body }, 45000),
  queueNext: (code, ident, body) => req("POST", `/rooms/${code}/queue/next`, { ...cred(ident), ...body }, 45000),
};
