# syntax=docker/dockerfile:1

# ── Build: type-check, test-free production bundle ──────────────────────────
FROM node:24.22.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Type-checks, then bundles. VITE_* values are not baked in: settings are
# supplied at runtime through /config.js (see docker/40-runtime-config.sh).
RUN npm run build

# ── Runtime: static files on unprivileged nginx (runs as uid 101) ───────────
FROM nginxinc/nginx-unprivileged:1.28-alpine

# nginx listens on $PORT. 8088 is the local default (avoids clashing with tools on 8080);
# Cloud Run always sets PORT=8080 itself, which overrides this.
ENV PORT=8088 \
    APP_API_MODE=mock \
    APP_API_BASE_URL=/api \
    APP_ACTOR_EMAIL=admin@rollerdigital.com \
    CSP_CONNECT_SRC="'self'"

# The base image renders /etc/nginx/templates/*.template with envsubst at start-up
# and runs every /docker-entrypoint.d/*.sh script before nginx.
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=0755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8088
