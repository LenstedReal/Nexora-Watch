// Empty = same origin (Caddy serves the web app and proxies /api to the backend).
const BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Sunucuya ulaşılamıyor");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.code || `http_${res.status}`, typeof data.detail === "string" ? data.detail : `HTTP ${res.status}`);
  }
  return data;
}

const cred = (ident) => ({ participant_id: ident.participant_id, token: ident.token });
const q = (ident) => `participant_id=${encodeURIComponent(ident.participant_id)}&token=${encodeURIComponent(ident.token)}`;

export const absUrl = (u) => (/^https?:\/\//.test(u) ? u : `${BASE}${u}`);

const wsBase = () => {
  if (BASE) return BASE.replace(/^http/, "ws");
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}`;
};

export const wsUrl = (code, ident) => `${wsBase()}/api/ws?code=${encodeURIComponent(code)}&${q(ident)}`;

export const api = {
  createRoom: (nickname, name) => req("POST", "/rooms", { nickname, name }),
  joinRoom: (code, nickname, ident) => req("POST", `/rooms/${code}/join`, { nickname, ...(ident ? cred(ident) : {}) }),
  getRoom: (code) => req("GET", `/rooms/${code}`),
  getMessages: (code) => req("GET", `/rooms/${code}/messages`),
  sendMessage: (code, ident, text, client_id) => req("POST", `/rooms/${code}/messages`, { ...cred(ident), text, client_id }),
  setVideo: (code, ident, url) => req("PUT", `/rooms/${code}/video`, { ...cred(ident), url }),
  setPlayback: (code, ident, cmd) => req("PUT", `/rooms/${code}/playback`, { ...cred(ident), ...cmd }),
  leave: (code, ident) => req("POST", `/rooms/${code}/leave`, cred(ident)),
  close: (code, ident) => req("POST", `/rooms/${code}/close`, cred(ident)),
  metrics: (code, ident, samples) => req("POST", `/rooms/${code}/metrics`, { ...cred(ident), samples }),
  metricsSummary: (code, ident) => req("GET", `/rooms/${code}/metrics/summary?${q(ident)}`),
  storageUsage: () => req("GET", "/storage/usage"),
  mediaUrl: (id, ident) => req("GET", `/media/${id}/url?${q(ident)}`),
  uploadInit: (body) => req("POST", "/uploads/init", body),
  partUrls: (id, ident, parts) => req("POST", `/uploads/${id}/part-urls`, { ...cred(ident), parts }),
  uploadComplete: (id, ident) => req("POST", `/uploads/${id}/complete`, cred(ident)),
  uploadAbort: (id, ident) => req("POST", `/uploads/${id}/abort`, cred(ident)),
  config: () => req("GET", "/config"),
  importDrive: (code, ident, url) => req("POST", "/uploads/import", { code, ...cred(ident), url }),
  importStatus: (id, ident) => req("GET", `/uploads/${id}/import-status?${q(ident)}`),
  report: (code, ident, body) => req("POST", `/rooms/${code}/report`, { ...cred(ident), ...body }),
  kick: (code, ident, target_id) => req("POST", `/rooms/${code}/kick`, { ...cred(ident), target_id }),
};
