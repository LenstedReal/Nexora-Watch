import { getSql } from "../db";
import { resolveVideoSource } from "./video";
import type { VideoSource } from "./api";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_LIFETIME = 24 * 60 * 60 * 1000;

export type Participant = {
  id: string;
  nickname: string;
  is_host: boolean;
  online: boolean;
  joined_at: string;
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
  web_open: boolean;
  server_time: number;
};

export type JoinResponse = {
  room: Room;
  participant: Participant;
};

export type Message = {
  id: string;
  room_code: string;
  participant_id: string | null;
  nickname: string;
  text: string;
  kind: "chat" | "system";
  created_at: string;
};

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();

  const text = String(value ?? "");
  const parsed = Date.parse(text);

  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : text;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

type RoomRow = {
  id: string;
  code: string;
  name: string;
  host_id: string;
  created_at: unknown;
  expires_at: unknown;
  participants: unknown;
  video: unknown;
  playback: unknown;
  web_open: unknown;
};

function rowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: normalizeCode(row.code),
    name: row.name,
    host_id: row.host_id,
    created_at: asIso(row.created_at),
    expires_at: asIso(row.expires_at),
    participants: parseJson<Participant[]>(row.participants, []),
    video: parseJson<VideoSource | null>(row.video, null),
    playback: parseJson<Playback>(row.playback, {
      playing: false,
      position: 0,
      updated_at: 0,
    }),
    web_open: Boolean(row.web_open),
    server_time: Date.now(),
  };
}

async function updateParticipants(
  code: string,
  participants: Participant[],
): Promise<void> {
  const sql = await getSql();

  await sql.query(
    `update nexora_rooms
        set participants = $2::jsonb
      where code = $1`,
    [code, JSON.stringify(participants)],
  );
}

async function updatePlaybackRow(
  code: string,
  playback: Playback,
): Promise<void> {
  const sql = await getSql();

  await sql.query(
    `update nexora_rooms
        set playback = $2::jsonb
      where code = $1`,
    [code, JSON.stringify(playback)],
  );
}

async function updateVideoRow(
  code: string,
  video: VideoSource | null,
  playback: Playback,
): Promise<void> {
  const sql = await getSql();

  await sql.query(
    `update nexora_rooms
        set video = $2::jsonb,
            playback = $3::jsonb
      where code = $1`,
    [code, JSON.stringify(video), JSON.stringify(playback)],
  );
}

async function updateWebOpenRow(
  code: string,
  webOpen: boolean,
): Promise<void> {
  const sql = await getSql();

  await sql.query(
    `update nexora_rooms
        set web_open = $2
      where code = $1`,
    [code, webOpen],
  );
}

async function deleteRoom(code: string): Promise<void> {
  const sql = await getSql();

  await sql.query(
    `delete from nexora_messages where room_code = $1`,
    [code],
  );

  await sql.query(
    `delete from nexora_rooms where code = $1`,
    [code],
  );
}

async function generateCode(): Promise<string> {
  const sql = await getSql();

  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = "";

    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[
        Math.floor(Math.random() * CODE_ALPHABET.length)
      ];
    }

    const rows = await sql.query<{ id: string }>(
      `select id from nexora_rooms where code = $1 limit 1`,
      [code],
    );

    if (rows.length === 0) {
      return code;
    }
  }

  throw jsonError(500, "Kod üretilemedi");
}

function validateNickname(value: unknown): string {
  const nickname =
    typeof value === "string" ? value.trim() : "";

  if (!nickname || nickname.length > 24) {
    throw jsonError(
      400,
      "Takma ad 1-24 karakter olmalı",
    );
  }

  return nickname;
}

function validateRoomName(value: unknown): string {
  const name =
    typeof value === "string" ? value.trim() : "";

  if (!name || name.length > 48) {
    throw jsonError(
      400,
      "Oda adı 1-48 karakter olmalı",
    );
  }

  return name;
}

export async function loadRoom(code: string): Promise<Room> {
  const normalized = normalizeCode(code);
  const sql = await getSql();

  const rows = await sql.query<RoomRow>(
    `select
       id,
       code,
       name,
       host_id,
       created_at,
       expires_at,
       participants,
       video,
       playback,
       web_open
     from nexora_rooms
     where code = $1
     limit 1`,
    [normalized],
  );

  const row = rows[0];

  if (!row) {
    throw jsonError(404, "Oda bulunamadı");
  }

  const room = rowToRoom(row);

  if (Date.parse(room.expires_at) < Date.now()) {
    await deleteRoom(normalized);

    throw jsonError(
      410,
      "Odanın süresi doldu (24 saat)",
    );
  }

  room.server_time = Date.now();

  return room;
}

export async function createRoom(
  nicknameInput: unknown,
  nameInput: unknown,
): Promise<JoinResponse> {
  const nickname = validateNickname(nicknameInput);
  const name = validateRoomName(nameInput);

  const created = new Date();
  const expires = new Date(
    created.getTime() + ROOM_LIFETIME,
  );

  const participant: Participant = {
    id: crypto.randomUUID(),
    nickname,
    is_host: true,
    online: true,
    joined_at: created.toISOString(),
  };

  const playback: Playback = {
    playing: false,
    position: 0,
    updated_at: Date.now(),
  };

  const id = crypto.randomUUID();

  const sql = await getSql();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = await generateCode();

    try {
      await sql.query(
        `insert into nexora_rooms
          (
            id,
            code,
            name,
            host_id,
            created_at,
            expires_at,
            participants,
            video,
            playback,
            web_open
          )
         values
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10
          )`,
        [
          id,
          code,
          name,
          participant.id,
          created.toISOString(),
          expires.toISOString(),
          JSON.stringify([participant]),
          JSON.stringify(null),
          JSON.stringify(playback),
          false,
        ],
      );

      const room: Room = {
        id,
        code,
        name,
        host_id: participant.id,
        created_at: created.toISOString(),
        expires_at: expires.toISOString(),
        participants: [participant],
        video: null,
        playback,
        web_open: false,
        server_time: Date.now(),
      };

      return {
        room,
        participant,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      if (
        !message.toLowerCase().includes("unique") &&
        !message.toLowerCase().includes("duplicate")
      ) {
        throw error;
      }
    }
  }

  throw jsonError(500, "Kod üretilemedi");
}

export async function joinRoom(
  code: string,
  nicknameInput: unknown,
  participantIdInput?: unknown,
): Promise<JoinResponse> {
  const room = await loadRoom(code);
  const nickname = validateNickname(nicknameInput);

  const participantId =
    typeof participantIdInput === "string" &&
    participantIdInput.trim()
      ? participantIdInput.trim()
      : null;

  const existing = participantId
    ? room.participants.find(
        (p) => p.id === participantId,
      )
    : undefined;

  const participant: Participant = existing
    ? {
        ...existing,
        nickname,
        online: true,
      }
    : {
        id: crypto.randomUUID(),
        nickname,
        is_host: false,
        online: true,
        joined_at: new Date().toISOString(),
      };

  room.participants = existing
    ? room.participants.map((p) =>
        p.id === participant.id ? participant : p,
      )
    : [...room.participants, participant];

  room.server_time = Date.now();

  await updateParticipants(room.code, room.participants);

  return {
    room,
    participant,
  };
}

function validateParticipantId(
  value: unknown,
): string {
  const id =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!id) {
    throw jsonError(
      400,
      "Katılımcı kimliği gerekli",
    );
  }

  return id;
}

async function participantForRoom(
  code: string,
  participantIdInput: unknown,
) {
  const room = await loadRoom(code);

  const participantId =
    validateParticipantId(participantIdInput);

  const participant = room.participants.find(
    (item) => item.id === participantId,
  );

  if (!participant) {
    throw jsonError(
      403,
      "Bu katılımcı odada değil",
    );
  }

  return {
    room,
    participant,
  };
}

export async function getMessages(
  code: string,
): Promise<Message[]> {
  const room = await loadRoom(code);
  const sql = await getSql();

  const rows = await sql.query<{
    id: string;
    room_code: string;
    participant_id: string | null;
    nickname: string;
    text: string;
    kind: string;
    created_at: unknown;
  }>(
    `select
       id,
       room_code,
       participant_id,
       nickname,
       text,
       kind,
       created_at
     from nexora_messages
     where room_code = $1
     order by created_at asc
     limit 500`,
    [room.code],
  );

  return rows.map((row) => ({
    id: row.id,
    room_code: row.room_code,
    participant_id: row.participant_id,
    nickname: row.nickname,
    text: row.text,
    kind:
      row.kind === "system"
        ? "system"
        : "chat",
    created_at: asIso(row.created_at),
  }));
}

function validateMessage(
  value: unknown,
): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!text) {
    throw jsonError(
      400,
      "Mesaj boş olamaz",
    );
  }

  if (text.length > 1000) {
    throw jsonError(
      400,
      "Mesaj en fazla 1000 karakter olabilir",
    );
  }

  return text;
}

export async function sendMessage(
  code: string,
  participantIdInput: unknown,
  textInput: unknown,
): Promise<Message> {
  const { room, participant } =
    await participantForRoom(
      code,
      participantIdInput,
    );

  const text = validateMessage(textInput);

  const message: Message = {
    id: crypto.randomUUID(),
    room_code: room.code,
    participant_id: participant.id,
    nickname: participant.nickname,
    text,
    kind: "chat",
    created_at: new Date().toISOString(),
  };

  const sql = await getSql();

  await sql.query(
    `insert into nexora_messages
      (
        id,
        room_code,
        participant_id,
        nickname,
        text,
        kind,
        created_at
      )
     values
      ($1, $2, $3, $4, $5, $6, $7)`,
    [
      message.id,
      message.room_code,
      message.participant_id,
      message.nickname,
      message.text,
      message.kind,
      message.created_at,
    ],
  );

  await sql.query(
    `delete from nexora_messages
     where room_code = $1
       and id not in (
         select id
         from nexora_messages
         where room_code = $1
         order by created_at desc
         limit 500
       )`,
    [room.code],
  );

  return message;
}

export async function setVideo(
  code: string,
  participantIdInput: unknown,
  urlInput: unknown,
): Promise<Room> {
  const { room, participant } =
    await participantForRoom(
      code,
      participantIdInput,
    );

  if (!participant.is_host) {
    throw jsonError(
      403,
      "Videoyu yalnızca oda sahibi değiştirebilir",
    );
  }

  const url =
    typeof urlInput === "string"
      ? urlInput.trim()
      : "";

  if (!url || url.length > 2000) {
    throw jsonError(
      400,
      "Geçerli bir video adresi gerekli",
    );
  }

  let resolved;

  try {
    resolved = await resolveVideoSource(url);
  } catch {
    throw jsonError(
      400,
      "Geçersiz video adresi",
    );
  }

  const video: VideoSource = {
    url: resolved.url,
    kind: resolved.kind,
    video_id: resolved.video_id,
    embed_url: resolved.embed_url,
    stream_url: resolved.stream_url,
    title: resolved.title,
    mime_type: resolved.mime_type,
    provider: resolved.provider,
    confidence: resolved.confidence,
    method: resolved.method,
  };

  const now = Date.now();

  room.video = video;
  room.playback = {
    playing: false,
    position: 0,
    updated_at: now,
  };
  room.server_time = now;

  await updateVideoRow(room.code, room.video, room.playback);

  return room;
}

export async function setPlayback(
  code: string,
  participantIdInput: unknown,
  playingInput: unknown,
  positionInput: unknown,
): Promise<Playback> {
  const { room, participant } =
    await participantForRoom(
      code,
      participantIdInput,
    );

  if (!participant.is_host) {
    throw jsonError(
      403,
      "Oynatmayı yalnızca oda sahibi kontrol edebilir",
    );
  }

  const playing = Boolean(playingInput);

  const rawPosition =
    typeof positionInput === "number"
      ? positionInput
      : Number(positionInput);

  if (
    !Number.isFinite(rawPosition) ||
    rawPosition < 0
  ) {
    throw jsonError(
      400,
      "Geçersiz oynatma konumu",
    );
  }

  const now = Date.now();

  const playback: Playback = {
    playing,
    position: rawPosition,
    updated_at: now,
  };

  room.playback = playback;
  room.server_time = now;

  await updatePlaybackRow(room.code, playback);

  return playback;
}

export async function leaveRoom(
  code: string,
  participantIdInput: unknown,
): Promise<{ ok: boolean }> {
  const { room, participant } =
    await participantForRoom(
      code,
      participantIdInput,
    );

  room.participants =
    room.participants.map((item) =>
      item.id === participant.id
        ? {
            ...item,
            online: false,
          }
        : item,
    );

  room.server_time = Date.now();

  await updateParticipants(room.code, room.participants);

  return { ok: true };
}

export async function setWebOpen(
  code: string,
  participantIdInput: unknown,
  openInput: unknown,
): Promise<Room> {
  const { room, participant } = await participantForRoom(
    code,
    participantIdInput,
  );

  if (!participant.is_host) {
    throw jsonError(
      403,
      "Web görünümünü yalnızca oda sahibi kontrol edebilir",
    );
  }

  const open = Boolean(openInput);

  room.web_open = open;
  room.server_time = Date.now();

  await updateWebOpenRow(room.code, open);

  return room;
}
