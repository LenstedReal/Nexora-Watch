#!/usr/bin/env bash
# Runs ON THE SERVER, sent over SSH by .github/workflows/deploy.yml (never needs to be copied by hand).
# Expects: NEXORA_TAG (git sha of the images), GHCR_USER, GHCR_TOKEN (valid only while the workflow runs).
#
# What it does: fast-forward the checkout (compose file), pull the two images that GitHub built,
# restart, verify that the new version answers. It never builds on the server, never rewrites git
# history and never touches .env, docker-compose.override.yml or the data volumes.
set -euo pipefail

BACKEND_IMAGE=ghcr.io/lenstedreal/nexora-watch-backend
WEB_IMAGE=ghcr.io/lenstedreal/nexora-watch-web
APP_DIR="${NEXORA_DIR:-$HOME/Nexora-Watch}"

# A line starting with ::error is shown as a red annotation on the public GitHub run page.
fail() { echo "::error title=Deploy::$1"; exit 1; }
quote() { sed 's/^/  | /'; }   # log lines can never be mistaken for workflow commands
dc() { sudo docker compose --profile tls "$@"; }

main() {
  : "${NEXORA_TAG:?NEXORA_TAG missing}" "${GHCR_USER:?GHCR_USER missing}" "${GHCR_TOKEN:?GHCR_TOKEN missing}"
  cd "$APP_DIR" || fail "Sunucuda $APP_DIR klasoru yok. / $APP_DIR does not exist on the server."
  [ -f .env ] || fail "Sunucuda $APP_DIR/.env yok (docs/DEPLOY.md). / .env is missing on the server."

  # One update at a time (also against a manual run in another terminal).
  exec 9>/tmp/nexora-deploy.lock
  flock -w 600 9 || fail "Sunucuda baska bir guncelleme hala calisiyor. / Another update is still running on the server."

  echo "== 1/4 kod (ileri sarma) =="
  export GIT_TERMINAL_PROMPT=0
  git fetch --quiet --prune origin main || fail "GitHub'dan kod alinamadi (git fetch). / git fetch failed."
  if ! git merge --ff-only --quiet FETCH_HEAD; then
    git status --short | head -20 | quote
    fail "Sunucudaki kopya ileri sarilamiyor: yerel degisiklik var ya da gecmis degismis (docs/DEPLOY.md > Sorun giderme). / The server checkout cannot be fast-forwarded."
  fi
  echo "  kod: $(git rev-parse --short HEAD)"

  echo "== 2/4 imajlar =="
  trap 'sudo docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  printf '%s' "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
    || fail "GHCR girisi basarisiz. / Registry login failed."
  for image in "$BACKEND_IMAGE" "$WEB_IMAGE"; do
    sudo docker pull --quiet "$image:$NEXORA_TAG" >/dev/null \
      || fail "Imaj indirilemedi: $image (disk dolu olabilir: df -h /). / Could not pull $image."
    sudo docker tag "$image:$NEXORA_TAG" "$image:latest"
  done
  df -h / | tail -1 | quote

  echo "== 3/4 yeniden baslat =="
  if ! dc up -d --no-build --remove-orphans 2>&1 | quote; then
    dc ps 2>&1 | quote || true
    fail "Servisler baslatilamadi (docker compose up). / docker compose up failed."
  fi

  echo "== 4/4 kontrol =="
  domain="$(dc exec -T caddy printenv DOMAIN 2>/dev/null | tr -d '\r' || true)"
  domain="${domain:-nexora.lenstedreal.info}"
  live=""
  for _ in $(seq 1 30); do
    # Straight to this machine (no trip through the public IP), with the real certificate.
    if curl -fsS -m 5 --resolve "$domain:443:127.0.0.1" "https://$domain/api/config" >/dev/null 2>&1; then
      live="$(curl -fsS -m 5 --resolve "$domain:443:127.0.0.1" "https://$domain/version.txt" 2>/dev/null || true)"
      case "$live" in *"$NEXORA_TAG"*) break ;; esac
    fi
    live=""
    sleep 3
  done
  if [ -z "$live" ]; then
    dc ps 2>&1 | quote || true
    dc logs --tail 40 backend caddy 2>&1 | quote || true
    fail "Yeni surum https://$domain adresinde cevap vermiyor (kayitlar yukarida). / The new version does not answer on https://$domain."
  fi
  echo "  canli: $live"

  # Housekeeping: older images of this app, and the images that used to be built on the server.
  sudo docker images --format '{{.Repository}}:{{.Tag}}' \
    | grep -E "^($BACKEND_IMAGE|$WEB_IMAGE):" | grep -v -e ":$NEXORA_TAG\$" -e ':latest$' \
    | xargs -r sudo docker rmi >/dev/null 2>&1 || true
  sudo docker rmi nexora-watch-backend:latest nexora-watch-caddy:latest >/dev/null 2>&1 || true
  sudo docker image prune -f >/dev/null 2>&1 || true
  echo "NEXORA_LIVE=$live"
}

# The script arrives on stdin: run everything from a function with stdin closed, so no command can eat the rest of it.
main </dev/null
