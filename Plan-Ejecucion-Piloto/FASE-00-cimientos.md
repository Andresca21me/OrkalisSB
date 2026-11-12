# FASE-00 · Cimientos y red de seguridad

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🔴: bloquea todo.

## Objetivo
Dejar una base en la que cada fase siguiente pueda **probar sus cambios con confianza**:
rama creada, entorno de pruebas reproducible, la suite E2E en verde contra la UI actual y
el lint sin warnings. Esta fase **no cambia comportamiento** del producto.

## Alcance (archivos que se pueden tocar)
- `apps/web/e2e/pages/booking.page.ts`
- `apps/web/e2e/fixtures/*` (solo si hace falta para la estabilidad del seed)
- Imports sin uso de: `apps/api/src/db/schema/scheduling.ts`, `apps/api/src/db/schema/team.ts`,
  `apps/api/src/db/seed.ts`, `apps/api/src/operacion/inventario.service.ts`
- `apps/api/.env.example` (solo si le falta alguna variable que ya lee el código)

## Fuera de alcance
- Cualquier cambio en `apps/api/src/**` que no sea quitar imports sin uso.
- El fallo del CSV del análisis (`09-finanzas/analisis.spec.ts`): es FASE-05. Aquí solo se
  confirma que sigue fallando por la misma razón y se deja anotado.

## Pasos 🤖
1. **Rama.** Desde `main` actualizado: `git checkout -b piloto/endurecimiento`.
   Si ya existe, continuar sobre ella.
2. **Acceso de escritura.** Intentar adjuntar el repo con permiso de push. Si no se
   puede, seguir: Andrés sube la rama desde su PC (`_GUIA-MANUAL.md`, Parte A).
3. **Entorno local de pruebas** (igual que el CI, `.github/workflows/ci.yml`):
   Postgres 16 con el rol `orkalis` (dueño) → `db:migrate` → `db:seed`. Crear
   `apps/api/.env` **local** (ignorado por git) con `DATABASE_URL` y `DATABASE_URL_ADMIN`,
   porque `e2e/fixtures/suscripcion.ts` lo lee directamente.
4. **Línea base:** correr el gate completo y la suite E2E una vez **sin cambios**, y
   guardar el resumen (pasan / fallan) en "Qué quedó hecho".
5. **Page object de reserva.** En `booking.page.ts`, `elegirPrimerServicio()` debe pulsar
   el botón real del paso 1, que hoy se llama **"Continuar"** (`BookingPage.tsx`, línea ~461:
   `'Continuar'` / `'Selecciona un servicio'`). Usar `{ name: /^Continuar$/ }` para no
   confundirlo con el "Continuar · 3:30 p.m." del paso de la franja.
6. **Intermitente del seed** (`01-auth/cuenta-suspendida.spec.ts`, falló una vez con
   `Command failed: pnpm --filter api db:seed`): correr ese spec 5 veces seguidas. Si falla
   alguna, mirar el error real del seed y corregir **en el fixture**. Si no falla, anotar
   "no reproducible" y seguir.
7. **Lint:** quitar los 6 imports sin uso hasta `pnpm --filter api lint` con 0 warnings.
8. Correr el gate y la suite E2E completa.

## ✅ Criterio de hecho
- Gate en verde; lint con **0 warnings**.
- E2E: todo en verde **excepto** `09-finanzas/analisis.spec.ts › exporta el análisis a CSV`
  (se arregla en FASE-05).
- `02-reserva/*` en verde: el flujo completo de reserva vuelve a estar protegido.

## Qué quedó hecho
**Cerrada el 11-nov-2026.**

- **Línea base** (`main` @ `2b69f78`, corrida de la auditoría del mismo día): Jest 415/415;
  lint con 6 warnings; E2E 133 ✓ / 6 ✘ / 3 omitidas / 1 sin correr.
- **Rama** `piloto/endurecimiento` creada; el repo quedó conectado con permiso de escritura
  (Claude puede subir la rama y abrir el Pull Request).
- **Entorno:** Postgres 16 local desde cero → `db:migrate` → `db:seed`; `apps/api/.env`
  local (ignorado por git). Para correr Playwright con el Chrome del sistema se usó una
  config local no versionada (`playwright.local.config.ts`, excluida en `.git/info/exclude`),
  porque el entorno no puede descargar el navegador de Playwright. En el CI no cambia nada.
- **Page object** (`booking.page.ts`): el paso 1 pulsa `/^Continuar$/`. Con esto vuelven a
  verde los 4 specs de `02-reserva` que fallaban.
- **Intermitente del seed** (`cuenta-suspendida.spec.ts`): 5 de 5 corridas en verde con
  `--retries=0`. **No reproducible.** El fallo de la auditoría coincidió con una corrida sin
  `apps/api/.env`, que el fixture necesita.
- **Lint:** 0 warnings. Se quitaron los imports sin uso en `scheduling.ts`, `team.ts`,
  `seed.ts` e `inventario.service.ts`, y **un sexto que el plan no listaba**
  (`correo/correo-auth.service.ts`, `FilaTokenAccion`). Mismo tipo de cambio, sin efecto en
  el comportamiento.
- **Gate:** typecheck ✓ · lint 0 warnings ✓ · Jest **415/415** ✓ · build web ✓.
- **E2E completa:** **139 ✓ / 1 ✘ / 3 omitidas**. El único rojo es
  `09-finanzas/analisis.spec.ts › exporta el análisis a CSV`, que queda para la FASE-05.

## Hallazgos para fases futuras
- Dos E2E marcadas `test.fixme` desde antes de este plan, es decir, funciones que el
  equipo dejó sin terminar o sin probar:
  - `05-recepcion/agenda-dia.spec.ts` › exportar el resumen diario (PDF/descarga).
  - `07-clientes/baja-logica.spec.ts` › reactivar un cliente dado de baja.
  
  No bloquean el piloto. Si la barbería pide alguna de las dos, revisar antes de prometerla.
