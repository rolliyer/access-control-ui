# syntax=docker/dockerfile:1
#
# One image, one process: FastAPI serves the API under /api and the built Vue
# app everywhere else. Build from the repo root:
#   docker build --platform linux/amd64 -t access-control-ui:local .

# ── 1. Build the UI ─────────────────────────────────────────────────────────
FROM node:24.22.0-alpine AS frontend
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
# Type-checks, then bundles into /frontend/dist.
RUN npm run build

# ── 2. Run the API (and serve the UI) ───────────────────────────────────────
FROM python:3.12.11-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.7.17 /uv /bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY --from=frontend /frontend/dist ./static
# Metric domains, from `npm run sync:domains` (frontend/).
COPY frontend/src/api/mock/domains.generated.json ./domains.json

# Safe defaults: sample data in memory, and IAP sign-in required.
# Cloud Run sets PORT=8080; 8088 is the local default (avoids tools on 8080).
ENV PATH=/app/.venv/bin:$PATH \
    PORT=8088 \
    STATIC_DIR=/app/static \
    DOMAINS_FILE=/app/domains.json \
    STORE=memory \
    AUTH_MODE=iap

RUN useradd --system --uid 10001 --no-create-home app
USER 10001
EXPOSE 8088

CMD ["sh", "-c", "exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
