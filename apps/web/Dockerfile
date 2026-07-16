# Orkalis Web — imagen estática de producción (todo-en-Railway, FASE-14).
# Build multi-stage desde la RAÍZ del monorepo (igual que apps/api/Dockerfile):
#   docker build -f apps/web/Dockerfile -t orkalis-web .
# Las variables VITE_* se HORNEAN en el build (no se leen en runtime): Railway
# inyecta las variables del servicio como build args, así que hay un build por
# entorno (staging/prod). El estático final se sirve con Caddy (fallback SPA).
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
# Build args → env para que Vite las hornee. Railway pasa las variables del
# servicio como build args automáticamente (BuildKit).
ARG VITE_API_URL
ARG VITE_MP_PUBLIC_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MP_PUBLIC_KEY=$VITE_MP_PUBLIC_KEY
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @orkalis/shared build \
  && pnpm --filter web build

# ── Runtime (estático con Caddy) ──────────────────────────────────────────────
FROM caddy:2-alpine AS runtime
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
# Caddy escucha en $PORT (lo inyecta Railway); ver Caddyfile.
