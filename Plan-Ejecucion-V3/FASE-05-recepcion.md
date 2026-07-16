# FASE-05 · Recepción (REC)

## Objetivo
Probar el tablero del recepcionista: ver y administrar la agenda del día de la sucursal, crear citas en nombre del cliente, **reasignar** un especialista, registrar **walk-in** y procesar el **cobro** al final, y exportar el resumen diario. Verificar el reflejo cruzado (REC → ESP/ADM), en especial la reasignación (un especialista pierde la cita y otro la gana).

## Prerrequisitos
- FASE-00, FASE-01. Seed barbería (recepción + 2 especialistas + citas de hoy).

## Pantallas / rutas bajo prueba
- `RecepcionApp` (`/recepcion`) — `apps/web/src/pages/recepcion/RecepcionApp.tsx` (reutiliza `agenda-ui` del admin).

## Casos de prueba

### Agenda del día (HU-REC-003)
1. **Vista del día**: el recepcionista de *Sede Centro* ve los turnos de todos los especialistas de la sede, ordenados por hora.
2. **Estados**: carga (skeleton), vacío (día sin citas en una sede), error (5xx → ErrorState).
3. **Exportar resumen diario**: la acción de exportar produce el documento del día (PDF/descarga) con citas/servicios/ingresos. *(Bug puntual → corregir sobre la marcha; feature PDF ausente → hallazgo a escalar, verificar el disparo de la descarga mientras tanto.)*

### Gestionar citas (HU-REC-001)
4. **Crear cita para un cliente**: crear una cita con especialista y franja libre → queda **Confirmada** en la agenda de la sucursal; al recargar, el especialista la ve (cruzado).
5. **Editar cita**: modificar datos de una cita (p. ej. servicio) y verlo reflejado.
6. **Reasignar especialista (cruzado)**: reasignar las citas de un especialista ausente a otro disponible de la **misma** sede → la cita conserva su información; al recargar, el especialista **origen** ya no la tiene y el **destino** sí; el admin lo ve igual.
7. **Reasignar a especialista inválido**: no permite asignar a un especialista de otra sede / no disponible (solo muestra válidos) y respeta el anti-solape (no genera conflicto de horario).

### Walk-in y cobro (HU-REC-002)
8. **Walk-in con cobro al cierre**: registrar un cliente sin cita → al final ingresar servicios + método de pago → queda **Completado** con el monto real.
9. **Cobro con varios servicios**: agregar tratamientos durante la atención → el monto final los refleja.
10. **Reflejo del cobro**: el turno completado por recepción aparece, tras recargar, en finanzas/panel del admin y (si aplica) en ganancias del especialista.

## Datos de prueba
- Recepción barbería + Carlos/Diana (*Sede Centro*). Clientes/teléfonos únicos para walk-ins y citas creadas.
- La reasignación usa citas de hoy del seed o creadas en la prueba.

## Huecos de testabilidad
- Reutiliza `data-testid` de agenda (FASE-03): `appt-row-{id}`, `appt-estado`, columnas por especialista `agenda-col-{espId}`.
- Acción reasignar: `data-testid="appt-reasignar"`, selector destino `data-testid="reasignar-destino"`.
- Resumen diario: `data-testid="recepcion-exportar-dia"`.

## Verificación / Done
- Crear/editar/reasignar citas funciona y respeta validez de especialista y anti-solape.
- Reasignación reflejada en especialista origen/destino y admin.
- Walk-in + cobro al final cubierto y reflejado en finanzas.
- `specs/05-recepcion/*` verde y estable.

## Trazabilidad
- HU-REC-001..003, HU-ESP-006 (walk-in desde REC); flujos cruzados REC→ESP/ADM (`_MATRIZ §2`).
