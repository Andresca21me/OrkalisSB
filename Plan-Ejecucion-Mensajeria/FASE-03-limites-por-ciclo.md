# FASE-03 · Límites por ciclo de cobro + política de bloqueo + alertas

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Implementa **D1** (reinicio por ciclo) y **D2** (marketing duro / transaccional blando).

## Objetivo
Alinear el consumo de cupos al **ciclo de cobro** (aniversario `diaCobro`/`proximoCobro`), contabilizar por **canal real** (no fijo `sms`), aplicar la **política de bloqueo** (marketing duro, transaccional blando con alerta) y corregir los bugs de consumo detectados.

## Prerrequisitos / Dependencias
- FASE-02 (outbox: el consumo se incrementa al enviar con éxito).

## Cambios técnicos (Pasos de Claude)
1. **Reindexar `consumo_mensajeria` por ciclo** (Parte III.4): reemplazar `periodo text 'YYYY-MM'` por `ciclo_inicio`/`ciclo_fin timestamptz`; `unique(negocio_id, canal, ciclo_inicio)`. Migración: recomputar filas vivas al ciclo vigente o archivar el histórico.
2. **`CuposService.cicloActual(suscripcion)`**: calcula `[cicloInicio, cicloFin)` desde `diaCobro`/`proximoCobro` (reusar la lógica de aniversario de `cobro-cron.service.ts` `siguienteCobro`, día 1..28). Caso prueba/sin `proximoCobro`: usar `trialFin` o ventana desde `creado_en`.
3. **Contabilizar por canal real:** el incremento (`registrar`) lo hace el `OutboxWorker` tras enviar, con el `canal` real del mensaje (sms/whatsapp/email), no el fijo `sms`.
4. **Verificación antes de encolar / política D2** en el dispatcher:
   - `marketing` (`whatsapp_marketing`) sin cupo → **no** se inserta como enviable: fila `estado='sin_cupo'`.
   - transaccional sin cupo → se envía, `sobre_cupo=true`, y dispara alerta.
5. **Alertas de sobreconsumo:** al cruzar 80% y 100% por canal/ciclo → notificación in-app al admin (persistente) + email si hay cupo. Evitar spam (una alerta por umbral y ciclo).
6. **Fixes:**
   - `cupos.service.ts`: filtrar el `select` de consumo también por `negocio_id` (no depender solo de RLS).
   - `pagos/plataforma.service.ts`: dejar de sumar **todos** los períodos; filtrar por ciclo vigente.
7. **`GET /notificaciones/cupos`**: devolver también `cicloInicio/cicloFin` y `restante`.

## Archivos afectados
- `apps/api/src/db/schema/notificaciones.ts`, `apps/api/drizzle/*`
- `apps/api/src/notificaciones/cupos.service.ts`
- `apps/api/src/notificaciones/notificaciones.service.ts` (dispatcher + política)
- `apps/api/src/notificaciones/outbox.worker.ts` (incremento por canal real)
- `apps/api/src/notificaciones/notificaciones.controller.ts`
- `apps/api/src/pagos/plataforma.service.ts`
- Alertas: servicio/tabla de avisos in-app (reusar el mecanismo de notificación al admin, o tabla `alerta_admin` mínima)

## ⚠️ Acción requerida del desarrollador
- Ninguna.

## Riesgos y mitigaciones
- **Migración de consumo** → tabla de contadores; aceptable recomputar/arrancar en 0 el ciclo actual (documentarlo).
- **Ciclo indefinido en prueba** → fallback claro cuando no hay `proximoCobro`.
- **Carrera al incrementar** → mantener el upsert atómico `+1` (`onConflictDoUpdate`).
- **Falsos 100%** por reintentos → incrementar solo en `enviado` definitivo, nunca por intento fallido.

## Criterios de aceptación (Done)
- El consumo se reinicia en el **aniversario de cobro**, no el día 1.
- `whatsapp_marketing` sin cupo → no envía (`sin_cupo`); transaccional sin cupo → envía + `sobre_cupo` + alerta.
- El consumo se suma al **canal real** enviado.
- `GET /notificaciones/cupos` refleja el ciclo correcto; vista de plataforma ya no suma todos los períodos.

## Pruebas
- Unit `cicloActual` (varios `diaCobro`, borde de mes, prueba sin `proximoCobro`).
- Enforcement por canal (marketing vs transaccional), registro de `sobre_cupo`.
- Alertas 80/100% (una vez por umbral/ciclo).
- Migración: contadores coherentes tras migrar.

## Trazabilidad
ADR-009 (cupos por plan), RF-006, Parte V del plan, D1/D2.

## Resultado esperado
Límites por plan **respetados y alineados al cobro**, con bloqueo correcto y visibilidad de sobreconsumo.
