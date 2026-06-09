# FASE-01 · Monorepo y tooling

## Objetivo
Crear la estructura de **monorepo** con tres workspaces (`api`, `web`, `shared`) y el tooling base (TypeScript, lint, formato, scripts), tal como exige ADR-008 (tipos/contratos compartidos sin publicar paquetes).

## Prerrequisitos
- FASE-00 completa (Node ≥ 20, pnpm, Docker, git, `.gitignore`).

---

## Pasos de Claude

### 1. Estructura de carpetas
Crear esta estructura en la raíz `OrkalisSB/`:
```
OrkalisSB/
├─ package.json            (raíz, workspaces)
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .editorconfig
├─ .prettierrc
├─ .eslintrc.cjs
├─ apps/
│  ├─ api/                 (backend NestJS — se llena en FASE-02+)
│  └─ web/                 (frontend React — se llena en FASE-13)
└─ packages/
   └─ shared/             (tipos y contratos compartidos front↔back)
```

### 2. `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3. `package.json` raíz
- `"private": true`.
- Scripts orquestadores: `dev`, `build`, `lint`, `test`, `typecheck` que deleguen a los workspaces (usar `pnpm -r` o `pnpm --filter`).
- Dev dependencies compartidas: `typescript`, `eslint`, `prettier`, `@typescript-eslint/*`, `vitest` (o `jest`; NestJS trae jest por defecto, mantener jest en api).

### 4. `tsconfig.base.json`
- `target` ES2022, `module` NodeNext (api) / bundler (web), `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`.
- `paths` para que `api` y `web` importen desde `@orkalis/shared`.

### 5. Workspace `packages/shared`
- `package.json` con `"name": "@orkalis/shared"`, `main`/`types` apuntando a `src/index.ts`.
- `src/index.ts` que reexporta:
  - `src/enums.ts` — enums de dominio: `RolUsuario` (`admin` | `especialista` | `recepcionista` | `operador_plataforma`), `PerfilNegocio` (`salon` | `barberia`), `EstadoCita` (`solicitada` | `confirmada` | `en_progreso` | `completada` | `cancelada` | `no_asistio`), `OrigenCita` (`agendamiento_publico` | `creacion_interna`), `EstadoSuscripcion` (`activa` | `suspendida`), `TipoGasto` (`fijo` | `variable`), `TipoProducto` (`servicio` | `venta`), `MetodoPago` (`efectivo` | `tarjeta` | `transferencia` | `nequi` | `otro`), `SplitType` (`porcentaje` | `valor_fijo`), `NivelConfig` (`sistema` | `negocio` | `sucursal`).
  - `src/dtos.ts` — placeholder; los DTOs concretos se agregan en cada fase.
- Estos enums son la **fuente de verdad** compartida; tanto la BD (FASE-03) como la API y el front deben usar exactamente estos valores.

### 6. Workspace `apps/api`
- Inicializar proyecto **NestJS** (`@nestjs/cli`) dentro de `apps/api` (o crear manualmente `main.ts`, `app.module.ts`).
- Dependencias base: `@nestjs/core`, `@nestjs/common`, `@nestjs/config`, `@nestjs/platform-express`.
- Configurar `@nestjs/config` para leer `.env` con validación de variables (usar un esquema con `zod` o `joi`).
- `main.ts`: prefijo global `/api`, `ValidationPipe` global con `whitelist: true`, CORS configurable por env.

### 7. Workspace `apps/web`
- Solo dejar el `package.json` y un README placeholder. **No** montar React aquí todavía: en FASE-13 se integrará la **demo de Claude Design** que traerá el USUARIO, y montar un scaffold ahora podría chocar con esa demo.

### 8. Archivos de entorno
- Crear `apps/api/.env.example` con TODAS las variables que se irán necesitando, vacías o con placeholder y un comentario de en qué fase se llenan:
  ```
  # General
  NODE_ENV=development
  PORT=3000
  CORS_ORIGIN=http://localhost:5173
  # Base de datos (FASE-02)
  DATABASE_URL=postgres://orkalis:orkalis@localhost:5432/orkalis
  # Auth (FASE-05)
  JWT_ACCESS_SECRET=
  JWT_REFRESH_SECRET=
  JWT_ACCESS_TTL=900           # 15 min en segundos
  JWT_REFRESH_TTL=1209600      # 14 días en segundos
  # OTP / SMS (FASE-08 / FASE-11) — Twilio
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_FROM_NUMBER=
  # Email (FASE-11) — SendGrid (opcional)
  SENDGRID_API_KEY=
  MAIL_FROM=
  # Pasarela suscripción (FASE-12) — Wompi
  WOMPI_PUBLIC_KEY=
  WOMPI_PRIVATE_KEY=
  WOMPI_EVENTS_SECRET=
  WOMPI_ENV=sandbox
  ```
- Copiar a `apps/api/.env` (este SÍ está en `.gitignore`). Llenar solo lo de desarrollo (DATABASE_URL); el resto se llena en su fase.

### 9. Lint y formato
- `.prettierrc` (comillas simples, `printWidth: 100`, `singleQuote: true`).
- `.eslintrc.cjs` con `@typescript-eslint`, reglas razonables, `prettier` al final.
- (Opcional) `husky` + `lint-staged` para pre-commit que corra lint + typecheck.

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna obligatoria. (Si Claude no tiene permisos para instalar paquetes globales o correr `pnpm install`, el USUARIO debe ejecutarlo).

---

## Verificación / Done
- `pnpm install` en la raíz instala todo sin errores.
- `pnpm --filter @orkalis/shared build` (o `typecheck`) compila los enums.
- `pnpm --filter api typecheck` pasa.
- `pnpm --filter api start` levanta NestJS y responde algo en `GET /api` (aunque sea un 404 controlado o un healthcheck simple).
- `apps/api/.env.example` existe con todas las variables; `apps/api/.env` existe y está ignorado por git.

## Trazabilidad
- ADR-000 (TypeScript end-to-end), ADR-008 (monorepo con workspaces y tipos compartidos), RNF-014 (modularidad).
