#!/usr/bin/env bash
# Daily MongoDB backup of the "nexora" database (runs ON THE SERVER from cron, see docs/DEPLOY.md "Yedekleme").
# mongodump runs inside the compose "mongo" container (inside the compose network, nothing is exposed); the gzip
# archive is streamed out to $BACKUP_DIR/nexora-YYYYMMDD.gz. Archives older than $KEEP_DAYS days are deleted.
# Restore:  gunzip -c /srv/backups/nexora-YYYYMMDD.gz | sudo docker compose exec -T mongo mongorestore --archive --drop
set -euo pipefail

APP_DIR="${NEXORA_DIR:-$HOME/Nexora-Watch}"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DB="${DB_NAME:-nexora}"
DOCKER="${DOCKER:-docker}"   # cron runs as root; set DOCKER="sudo docker" for a normal user

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/nexora-$(date +%Y%m%d).gz"
tmp="$out.part"
trap 'rm -f "$tmp"' EXIT

# --gzip + --archive: one compressed file; written to .part first so a failed dump never replaces a good one.
$DOCKER compose exec -T mongo mongodump --quiet --db "$DB" --archive --gzip > "$tmp"
[ -s "$tmp" ] || { echo "backup: empty dump" >&2; exit 1; }
mv -f "$tmp" "$out"
chmod 600 "$out"

find "$BACKUP_DIR" -maxdepth 1 -name 'nexora-*.gz' -type f -mtime +"$((KEEP_DAYS - 1))" -delete
echo "backup ok: $out ($(du -h "$out" | cut -f1))"
