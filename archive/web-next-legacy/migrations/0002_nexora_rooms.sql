create table if not exists nexora_rooms (
  id text primary key,
  code text not null unique,
  name text not null,
  host_id text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  participants jsonb not null default '[]'::jsonb,
  video jsonb,
  playback jsonb not null default '{"playing":false,"position":0,"updated_at":0}'::jsonb
);

create table if not exists nexora_messages (
  id text primary key,
  room_code text not null,
  participant_id text,
  nickname text not null,
  text text not null,
  kind text not null default 'chat',
  created_at timestamptz not null
);

create index if not exists nexora_messages_room_created_idx
on nexora_messages(room_code, created_at);
