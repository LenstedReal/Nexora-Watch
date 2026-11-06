export type Participant = {
  id: string;
  nickname: string;
  is_host: boolean;
  online: boolean;
  joined_at?: string;
};

export type Playback = {
  playing: boolean;
  position: number;
  updated_at: number; // server ms
  revision: number;
  media_id: string | null;
  updated_by?: string | null;
};

export type VideoKind = "youtube" | "direct" | "hls" | "upload" | "drive_embed";

export type VideoSource = {
  url: string;
  kind: VideoKind;
  media_id: string;
  video_id?: string | null;
  embed_url?: string | null;
  stream_url?: string | null;
  title?: string | null;
  mime_type?: string | null;
  capabilities?: { seek?: boolean; rate_correction?: boolean; sync?: boolean } | null;
  warning?: string | null;
  headers?: Record<string, string> | null;
};

export type Room = {
  code: string;
  name: string;
  host_id: string;
  status: string;
  version: number;
  expires_at: string;
  participants: Participant[];
  video: VideoSource | null;
  playback: Playback;
  server_time: number;
};

export type ChatMessage = {
  id: string;
  participant_id: string | null;
  nickname: string;
  text: string;
  kind: "chat" | "system";
  client_id?: string | null;
  created_at: string;
};

export type JoinResponse = {
  room: Room;
  participant: Participant;
  token: string;
  rejoined?: boolean;
};

export type Identity = { participant_id: string; token: string; nickname: string };

export type PlaybackCommand = { playing: boolean; position: number; seq: number; media_id: string | null };
