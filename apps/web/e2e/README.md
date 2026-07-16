# Pruebas E2E (Playwright) — Orkalis v3

Suite de verificación funcional extremo a extremo, **desde el frontend**, contra la API real + seed.
Plan y convenciones: `Plan-Ejecucion-V3/` (en especial `_ESTRATEGIA-Y-CONVENCIONES.md`).

## Cómo correr

```bash
# 1) Base de datos + seed
docker compose up -d db
pnpm --filter api db:migrate && pnpm --filter api db:seed
# 2) API real (NODE_ENV ≠ production → OTP devuelve devCode)
pnpm --filter api start          # :3000
# 3) Suite (Playwright arranca Vite :5173 con su webServer)
pnpm --filter web e2e            # o e2e:ui para modo interactivo
```

En CI el gate levanta DB+API+seed antes de `pnpm --filter web e2e` (`.github/workflows/ci.yml`).

## Estructura

```
e2e/
  fixtures/   roles (login), api (oráculo), data (únicos/fechas), auth.fixture (páginas logueadas)
  pages/      Page Objects ligeros por pantalla
  specs/      pruebas por fase (NN-<area>/*.spec.ts)
```

## Convenciones (resumen)

- Selectores: rol ARIA + texto primero; `data-testid` solo donde sea ambiguo (única edición permitida en `src`).
- Datos únicos por prueba (`fixtures/data.ts`); ids del seed vía oráculo (`fixtures/api.ts`), nunca hardcodear UUIDs.
- Flujos cruzados: un `BrowserContext` por rol (`abrirRoles`); recargar la vista observadora antes de afirmar (no hay push en vivo).
- Sin `waitForTimeout`; esperar por condición. Política **fix-forward**: si una prueba revela un defecto, se corrige el código y la prueba queda en verde (ver plan).
