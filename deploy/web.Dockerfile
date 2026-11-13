# Builds the React web client and serves it, the API proxy, the personal site and the download page with Caddy.
# Build context: repository root (see docker-compose.yml -> caddy.build).
# The build stage always runs on the build machine's own CPU (its output is plain static files), so the
# arm64 image does not run yarn under emulation.

FROM --platform=$BUILDPLATFORM node:20-alpine AS web
WORKDIR /src/frontend
ENV CI=false GENERATE_SOURCEMAP=false NODE_OPTIONS=--max-old-space-size=1536 REACT_APP_BACKEND_URL=
COPY frontend/package.json frontend/yarn.lock* ./
RUN (yarn install --frozen-lockfile --network-timeout 600000 || yarn install --network-timeout 600000) && yarn cache clean
COPY frontend/ ./
RUN yarn build
# Which build is live: https://<domain>/version.txt  ->  "<app version> <git sha>"
# The same commit id is written into the page (<meta name="nexora-build">), so an open page can tell that the server
# has a newer release and reload itself (frontend/src/lib/update.js). Done after the build, so the build stays cached.
ARG APP_VERSION=dev
ARG GIT_SHA=local
RUN printf '%s %s\n' "$APP_VERSION" "$GIT_SHA" > build/version.txt \
 && sed -i "s/__NEXORA_BUILD__/$GIT_SHA/" build/index.html
# Personal site is optional: an empty folder is served if it does not exist yet.
COPY . /tmp/ctx
RUN mkdir -p /out/personal && if [ -d /tmp/ctx/site/personal ]; then cp -r /tmp/ctx/site/personal/. /out/personal/; fi \
 && if [ ! -f /out/personal/index.html ]; then echo '<!doctype html><meta charset="utf-8"><title>LenstedReal</title><p>Yakında.</p>' > /out/personal/index.html; fi
# Download page (apk.lenstedreal.info): optional in the same way.
RUN mkdir -p /out/apk && if [ -d /tmp/ctx/site/apk ]; then cp -r /tmp/ctx/site/apk/. /out/apk/; fi \
 && if [ ! -f /out/apk/index.html ]; then echo '<!doctype html><meta charset="utf-8"><title>LenstedReal</title><p>Yakında.</p>' > /out/apk/index.html; fi

# The Caddyfile is checked here, on the build machine: a mistake in it fails the build (the server is not touched
# and keeps running the previous release) instead of stopping both sites when the new image starts.
FROM --platform=$BUILDPLATFORM caddy:2 AS caddyfile
COPY deploy/Caddyfile /etc/caddy/Caddyfile
RUN DOMAIN=check.example PERSONAL_DOMAIN=me.check.example APK_DOMAIN=apk.check.example caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

FROM caddy:2
COPY --from=web /src/frontend/build /srv/web
COPY --from=web /out/personal /srv/personal
COPY --from=web /out/apk /srv/apk
COPY --from=caddyfile /etc/caddy/Caddyfile /etc/caddy/Caddyfile
