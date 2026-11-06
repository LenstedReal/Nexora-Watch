import type { ChatMessage, Identity, JoinResponse, Playback, PlaybackCommand, Room } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Build-time default (GitHub Actions variable NEXORA_API_URL -> EXPO_PUBLIC_API_URL). Can be overridden in-app. */
export const DEFAULT_SERVER = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").trim().replace(/\/+$/, "");

let base = DEFAULT_SERVER;

export function setServer(url: string) {
  base = normalizeServer(url);
}
export function getServer() {
  return base;
}
export function normalizeServer(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/api$/, "");
}

export const absUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u}`);
export const wsUrl = (code: string, ident: Identity) =>
  `${base.replace(/^http/i, "ws")}/api/ws?code=${encodeURIComponent(code)}&participant_id=${encodeURIComponent(
    ident.participant_id,
  )}&token=${encodeURIComponent(ident.token)}`;

async function req<T>(method: string, path: string, body?: unknown, timeoutMs = 20000): Promise<T> {
  if (!base) throw new ApiError(0, "no_server", "Sunucu adresi ayarlanmamış");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, "network", "Sunucuya ulaşılamıyor");
  } finally {
    clearTimeout(timer);
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`;
    throw new ApiError(res.status, data?.code || `http_${res.status}`, detail);
  }
  return data as T;
}

const cred = (i: Identity) => ({ participant_id: i.participant_id, token: i.token });
const q = (i: Identity) => `participant_id=${encodeURIComponent(i.participant_id)}&token=${encodeURIComponent(i.token)}`;

export const api = {
  health: () => req<{ ok: boolean; server_time: number }>("GET", "/", undefined, 8000),
  createRoom: (nickname: string, name: string) => req<JoinResponse>("POST", "/rooms", { nickname, name }),
  joinRoom: (code: string, nickname: string, ident?: Identity | null) =>
    req<JoinResponse>("POST", `/rooms/${code}/join`, { nickname, ...(ident ? cred(ident) : {}) }),
  getRoom: (code: string) => req<Room>("GET", `/rooms/${code}`),
  getMessages: (code: string) => req<ChatMessage[]>("GET", `/rooms/${code}/messages`),
  sendMessage: (code: string, i: Identity, text: string, client_id: string) =>
    req<ChatMessage>("POST", `/rooms/${code}/messages`, { ...cred(i), text, client_id }),
  setVideo: (code: string, i: Identity, url: string, extra?: { referer?: string; title?: string }) =>
    req<Room>("PUT", `/rooms/${code}/video`, { ...cred(i), url, ...(extra ?? {}) }, 40000),
  clearVideo: (code: string, i: Identity) => req<Room>("PUT", `/rooms/${code}/video`, { ...cred(i), url: "", clear: true }),
  setPlayback: (code: string, i: Identity, cmd: PlaybackCommand) =>
    req<Playback & { applied: boolean }>("PUT", `/rooms/${code}/playback`, { ...cred(i), ...cmd }),
  leave: (code: string, i: Identity) => req<{ ok: boolean }>("POST", `/rooms/${code}/leave`, cred(i)),
  close: (code: string, i: Identity) => req<{ ok: boolean }>("POST", `/rooms/${code}/close`, cred(i)),
  metrics: (code: string, i: Identity, samples: object[]) => req("POST", `/rooms/${code}/metrics`, { ...cred(i), samples }),
  mediaUrl: (id: string, i: Identity) => req<{ url: string; mime: string; expires_in: number }>("GET", `/media/${id}/url?${q(i)}`),
  uploadInit: (body: object) =>
    req<{
      media_id: string;
      status: "uploading" | "completed";
      part_size?: number;
      part_count?: number;
      parts_done?: number[];
      deduplicated?: boolean;
    }>("POST", "/uploads/init", body),
  partUrls: (id: string, i: Identity, parts: number[]) =>
    req<{ urls: Record<string, string> }>("POST", `/uploads/${id}/part-urls`, { ...cred(i), parts }),
  uploadComplete: (id: string, i: Identity) => req<{ status: string; room?: Room }>("POST", `/uploads/${id}/complete`, cred(i), 120000),
  uploadAbort: (id: string, i: Identity) => req("POST", `/uploads/${id}/abort`, cred(i)),
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Bir hata oluştu";
}
