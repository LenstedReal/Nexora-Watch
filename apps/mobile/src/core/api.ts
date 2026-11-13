import type { ChatMessage, Identity, JoinResponse, Playback, PlaybackCommand, Room } from "./types";
import { t, type TKey } from "../i18n";

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
export const DEFAULT_SERVER = ((process.env.EXPO_PUBLIC_API_URL ?? "").trim() || "https://nexora.lenstedreal.info").replace(/\/+$/, "");
export const WEB_URL = ((process.env.EXPO_PUBLIC_WEB_URL ?? "").trim() || "https://nexora.lenstedreal.info").replace(/\/+$/, "");

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
  if (!base) throw new ApiError(0, "no_server", t("no_server"));
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
    throw new ApiError(0, "network", t("network"));
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

export type SiteInfo = { domain: string; name: string };
export type AppConfig = {
  allowed_sites: SiteInfo[];
  web_url: string;
  play_url: string;
  apk_url: string;
  contact_email: string;
  legal: { privacy: string; terms: string; kvkk: string; copyright: string; delete_data: string; child_safety: string };
  min_age: number;
};

export const FALLBACK_CONFIG: AppConfig = {
  allowed_sites: [
    { domain: "youtube.com", name: "YouTube" },
    { domain: "tiktok.com", name: "TikTok" },
    { domain: "facebook.com", name: "Facebook" },
    { domain: "twitch.tv", name: "Twitch" },
    { domain: "drive.google.com", name: "Google Drive" },
  ],
  web_url: WEB_URL,
  play_url: "",
  apk_url: "https://github.com/LenstedReal/NexoraWatch/releases/latest",
  contact_email: "contact.nexorawatch@protonmail.com",
  legal: {
    privacy: `${WEB_URL}/gizlilik`,
    terms: `${WEB_URL}/kosullar`,
    kvkk: `${WEB_URL}/kvkk`,
    copyright: `${WEB_URL}/telif`,
    delete_data: `${WEB_URL}/veri-silme`,
    child_safety: `${WEB_URL}/cocuk-guvenligi`,
  },
  min_age: 16,
};

let configCache: AppConfig | null = null;
export async function loadConfig(): Promise<AppConfig> {
  if (configCache) return configCache;
  try {
    const c = await req<Partial<AppConfig>>("GET", "/config", undefined, 8000);
    configCache = {
      ...FALLBACK_CONFIG,
      ...c,
      allowed_sites: c.allowed_sites?.length ? c.allowed_sites : FALLBACK_CONFIG.allowed_sites,
      legal: { ...FALLBACK_CONFIG.legal, ...(c.legal ?? {}) },
    };
    return configCache;
  } catch {
    return FALLBACK_CONFIG;
  }
}

export type ReportReason = "spam" | "abuse" | "sexual" | "violence" | "copyright" | "other";

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
  report: (code: string, i: Identity, body: { target_id?: string | null; message_id?: string; reason: ReportReason; note?: string }) =>
    req<{ ok: boolean }>("POST", `/rooms/${code}/report`, { ...cred(i), ...body }),
  kick: (code: string, i: Identity, target_id: string) => req<Room>("POST", `/rooms/${code}/kick`, { ...cred(i), target_id }),
  importDrive: (code: string, i: Identity, url: string) =>
    req<{ media_id: string; status: string; size: number; filename: string }>("POST", "/uploads/import", { code, ...cred(i), url }, 40000),
  importStatus: (id: string, i: Identity) =>
    req<{ status: "importing" | "completed" | "failed"; size: number; bytes_done: number; error?: string | null }>("GET", `/uploads/${id}/import-status?${q(i)}`),
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const key = `e_${e.code}` as TKey;
    const tr = t(key);
    return tr !== key ? tr : e.message;
  }
  if (e instanceof Error) return e.message;
  return t("error_generic");
}
