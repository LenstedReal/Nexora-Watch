export type Participant = {
  id: string;
  nickname: string;
  is_host: boolean;
  online: boolean;
  joined_at: string;
};

export type VideoKind = "youtube" | "drive" | "direct" | "web";

export type VideoSource = {
  url: string;
  kind: VideoKind;
  video_id?: string | null;
  embed_url?: string | null;
  stream_url?: string | null;
  title: string;
};

export type Playback = {
  playing: boolean;
  position: number;
  updated_at: number;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  created_at: string;
  expires_at: string;
  participants: Participant[];
  video: VideoSource | null;
  playback: Playback;
  server_time: number;
};

export type Message = {
  id?: string;
  _id?: string;
  room_code: string;
  participant_id?: string | null;
  nickname: string;
  text: string;
  kind: "chat" | "system";
  created_at: string;
};

export type JoinResponse = { room: Room; participant: Participant };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function base(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const root = base();
  if (!root) throw new ApiError(0, "Sunucu adresi tanımlı değil.");
  let res: Response;
  try {
    res = await fetch(`${root}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Sunucuya ulaşılamadı.");
  }
  if (!res.ok) {
    let detail = "İstek başarısız oldu";
    try {
      const body = (await res.json()) as { detail?: string };
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  createRoom: (nickname: string, name: string) =>
    request<JoinResponse>("/rooms", { method: "POST", body: JSON.stringify({ nickname, name }) }),
  joinRoom: (code: string, nickname: string, participant_id?: string | null) =>
    request<JoinResponse>(`/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname, participant_id: participant_id ?? null }),
    }),
  getRoom: (code: string) => request<Room>(`/rooms/${code}`),
  getMessages: (code: string) => request<Message[]>(`/rooms/${code}/messages`),
  sendMessage: (code: string, participant_id: string, text: string) =>
    request<Message>(`/rooms/${code}/messages`, {
      method: "POST",
      body: JSON.stringify({ participant_id, text }),
    }),
  setVideo: (code: string, participant_id: string, url: string) =>
    request<Room>(`/rooms/${code}/video`, { method: "PUT", body: JSON.stringify({ participant_id, url }) }),
  setPlayback: (code: string, participant_id: string, playing: boolean, position: number) =>
    request<Playback>(`/rooms/${code}/playback`, {
      method: "PUT",
      body: JSON.stringify({ participant_id, playing, position }),
    }),
  leaveRoom: (code: string, participant_id: string) =>
    request<{ ok: boolean }>(`/rooms/${code}/leave`, {
      method: "POST",
      body: JSON.stringify({ participant_id }),
    }),
};

export function wsUrl(code: string, participantId: string): string {
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8080";
  return `${proto}//${host}/api/ws/rooms/${code}?participant_id=${encodeURIComponent(participantId)}`;
}

export function messageKey(m: Message): string {
  return m.id ?? m._id ?? `${m.created_at}-${m.nickname}`;
}
