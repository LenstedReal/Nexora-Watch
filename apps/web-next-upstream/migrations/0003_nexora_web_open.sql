alter table nexora_rooms
  add column if not exists web_open boolean not null default false;
