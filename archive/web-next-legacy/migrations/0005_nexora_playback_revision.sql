-- Additive only: no data loss. Rollback: drop the two columns (old code ignores them).
alter table nexora_rooms add column if not exists playback_revision bigint not null default 0;
alter table nexora_rooms add column if not exists playback_last_seq bigint not null default 0;
alter table nexora_rooms add column if not exists status text not null default 'active';
