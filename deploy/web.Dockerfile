# Builds the React web client and serves it, the API proxy and the personal site with Caddy.
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
ARG APP_VERSION=dev
ARG GIT_SHA=local
RUN printf '%s %s\n' "$APP_VERSION" "$GIT_SHA" > build/version.txt
# Personal site is optional: an empty folder is served if it does not exist yet.
COPY . /tmp/ctx
RUN mkdir -p /out/personal && if [ -d /tmp/ctx/site/personal ]; then cp -r /tmp/ctx/site/personal/. /out/personal/; fi \
 && if [ ! -f /out/personal/index.html ]; then echo '<!doctype html><meta charset="utf-8"><title>LenstedReal</title><p>Yakında.</p>' > /out/personal/index.html; fi

FROM caddy:2
COPY --from=web /src/frontend/build /srv/web
COPY --from=web /out/personal /srv/personal
COPY deploy/Caddyfile /etc/caddy/Caddyfile
