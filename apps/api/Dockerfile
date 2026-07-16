# Orkalis API — imagen de producción (FASE-14, ADR-008).
# Build multi-stage desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t orkalis-api .
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ── Dependencias (cacheable) ──────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @orkalis/shared build \
  && pnpm --filter api build \
  && pnpm --filter api deploy --legacy --prod /export

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Artefactos compilados + dependencias de producción.
COPY --from=build /export/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /repo/packages/shared/dist ./node_modules/@orkalis/shared/dist
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
EXPOSE 3000
# El entrypoint aplica migraciones y luego arranca la API (ADR-004). Se invoca
# como `sh <script>` para no depender de que Railway interprete `&&` con shell.
CMD ["sh", "docker-entrypoint.sh"]
