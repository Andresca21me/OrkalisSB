# FASE-08 · Recordatorios 24h + 2h configurables

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.

## Objetivo
Soportar **múltiples ventanas de recordatorio** (24h y 2h antes, además de una configurable) sin duplicados. Hoy `cita.recordatorio_enviado` es un booleano único con una sola ventana (`ventana_recordatorio_horas`).

## Prerrequisitos / Dependencias
- FASE-02 (outbox) y FASE-03 (cupos por canal).

## Cambios técnicos (Pasos de Claude)
1. **Tabla `cita_recordatorio`** (Parte III.6): `cita_id, ventana(h24|h2|config), enviado_en`, `pk(cita_id, ventana)`. Migración. Deprecar/eliminar `cita.recordatorio_enviado`.
2. **Config de ventanas** en `config-module/registry.ts`: habilitar `agendamiento.recordatorio_24h` (bool), `agendamiento.recordatorio_2h` (bool), y conservar `agendamiento.ventana_recordatorio_horas` como ventana "config" extra. Con herencia negocio/sucursal.
3. **`RecordatoriosScheduler`**: para cada cita confirmada futura, evaluar cada ventana habilitada; si está dentro de su rango y no existe fila `cita_recordatorio(cita, ventana)`, encolar recordatorio e insertar la fila. Idempotente por `pk`.
4. Respetar zona horaria `America/Bogota` (ya usada en `templates.ts`).

## Archivos afectados
- `apps/api/src/db/schema/appointments.ts` (o nueva tabla), `apps/api/drizzle/*`
- `apps/api/src/notificaciones/recordatorios.scheduler.ts`
- `apps/api/src/config-module/registry.ts`
- `apps/web/src/pages/admin/ConfigScreen.tsx` (toggles de ventanas, opcional)

## ⚠️ Acción requerida del desarrollador
- Ninguna.

## Riesgos y mitigaciones
- **Citas creadas dentro de la ventana** (p. ej. reserva para dentro de 1h) → enviar solo las ventanas aún alcanzables; no duplicar.
- **Duplicados** → `pk(cita_id, ventana)` garantiza una sola vez por ventana.
- **Escaneo costoso** → mantener el filtro por estado/tiempo y los índices `cita_especialista_inicio_idx`.
- **TZ** → usar America/Bogota consistentemente.

## Criterios de aceptación (Done)
- Una cita a >24h recibe recordatorio a **24h** y a **2h**, sin repetir.
- Las ventanas se respetan según config del negocio.
- No hay recordatorios duplicados tras reinicios.

## Pruebas
- Unit del scanner por ventana (dentro/fuera de rango, ya enviado).
- No-duplicado tras reinicio del scheduler.
- Config: desactivar 2h y ver que solo sale 24h.

## Trazabilidad
RF-047 (recordatorios), `Plan-Ejecucion-V1/FASE-11` (scheduler), Parte III del plan.

## Resultado esperado
Recordatorios múltiples y configurables, robustos ante reinicios.
