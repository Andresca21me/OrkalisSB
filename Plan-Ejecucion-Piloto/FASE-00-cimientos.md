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
_(Claude lo completa al cerrar la fase: línea base, cambios, resultado del gate.)_

## Hallazgos para fases futuras
_(Claude anota aquí lo que vea fuera de alcance.)_
