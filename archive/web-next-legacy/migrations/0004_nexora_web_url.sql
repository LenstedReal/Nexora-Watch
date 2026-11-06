alter table nexora_rooms
  add column if not exists web_url text not null default 'https://www.google.com/search?igu=1';
