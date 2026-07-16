# FASE-03 · Flujo cruzado de la reserva (CLI → ESP / ADM / REC)

> **FLUJO INSIGNIA de la v3** — el caso que pidió explícitamente el USUARIO: una reserva del cliente debe reflejarse correctamente en **todas** las vistas (especialista, administrador, recepcionista). Esta fase ejecuta el **patrón maestro** (PLAN-V3 §5) de forma exhaustiva para la reserva y para cada transición de estado posterior.

## Objetivo
Probar que una acción del cliente (reservar, y luego el ciclo de vida del turno) se propaga con datos correctos a las vistas del **especialista**, del **administrador** y del **recepcionista** de la misma sucursal/tenant — y que **no** se filtra a otra sede ni a otro tenant. Verificar también que las transiciones de estado (confirmada → en progreso → completada / cancelada / no asistió) son coherentes entre todas las vistas.

## Prerrequisitos
- FASE-02 (reserva por UI) y FASE-00 (multi-rol). Conviene tener avanzadas FASE-04/05/06 para los Page Objects de las vistas observadoras, pero esta fase puede escribirse incrementalmente (empezar con ESP, sumar ADM y REC).
- Recordatorio: la app **no** tiene push en vivo → cada observador **recarga** su vista antes de afirmar (documentado).

## Pantallas / rutas bajo prueba
- Origen: `BookingPage` (`/reservar/:suc`).
- Observadores: `SpecApp` (`/especialista`), `AdminApp` Agenda+Panel (`/admin`), `RecepcionApp` (`/recepcion`).

## Casos de prueba

### Reserva nueva se refleja en todas las vistas (HU-CLI-003, HU-ESP-002, HU-REC-003, HU-ADM-012)
1. **CLI → ESP**: el cliente reserva con **Carlos** en *Sede Centro*; al recargar la agenda de Carlos (logueado), aparece la cita **Confirmada** con cliente, servicio y hora correctos.
2. **CLI → ADM (agenda)**: el admin de la barbería, en la agenda de *Sede Centro*, ve la misma cita con los mismos datos.
3. **CLI → ADM (panel/KPIs)**: el contador de citas del día / próximos turnos del panel admin refleja la nueva cita (incremento observable o aparición en "próximos").
4. **CLI → REC**: el recepcionista de la barbería ve la cita en su tablero del día, en la columna/fila del especialista correcto.
5. **Un solo origen, múltiples observadores en paralelo**: abrir ESP+ADM+REC simultáneamente (3 contextos), ejecutar la reserva una vez, recargar las tres y afirmar en las tres.

### Aislamiento del reflejo
6. **No se filtra a otra sucursal**: la cita en *Sede Centro* **no** aparece en la agenda admin filtrada por *Sede Norte*.
7. **No se filtra a otro tenant**: el admin/recepción/especialista del **Salón** no ven la cita de la barbería (refuerzo de FASE-11 sobre este flujo concreto).
8. **Especialista ajeno**: la cita de Carlos no aparece en la agenda de **Diana** (otro especialista de la sede).

### Propagación de transiciones de estado (HU-ESP-003/004/005)
9. **Confirmada → En progreso (ESP inicia)**: el especialista inicia el turno; al recargar, ADM y REC ven el estado **En progreso** en esa cita.
10. **En progreso → Completada (ESP cobra)**: el especialista completa con cobro; ADM (agenda y finanzas/panel) y REC ven **Completada**; el monto cobrado aparece donde corresponde.
11. **Confirmada → Cancelada**: cancelar desde una vista (ESP/REC/ADM) se refleja como **Cancelada** en las demás y libera la franja (reaparece en disponibilidad pública).
12. **Confirmada → No asistió**: marcar inasistencia se propaga a todas las vistas.

### Vista consolidada
13. **Consolidado del admin**: en vista "Todo el negocio", la cita de *Sede Centro* aparece dentro de los indicadores agregados; al filtrar por sede vuelve a verse aislada.

## Datos de prueba
- Reserva creada por la UI con teléfono/cliente únicos para identificarla inequívocamente en las vistas observadoras (buscar por el nombre/teléfono únicos, no por posición).
- Roles del **mismo** tenant (barbería) para el reflejo; roles del **salón** para el no-reflejo.

## Huecos de testabilidad
- Identificación de una cita concreta en cada agenda: añadir `data-testid="appt-row-{citaId}"` y `data-testid="appt-estado"` en las filas/tarjetas de agenda (admin `agenda-ui.tsx`, spec `spec-agenda.tsx`, recepción). Es el `data-testid` más reutilizado de la v3.
- Contadores del panel admin: `data-testid="kpi-citas-hoy"` (u homólogo) para afirmar el incremento.
- Helper `agenda.buscarCita({ cliente })` en los Page Objects para localizar por dato único tras `reload()`.

## Verificación / Done
- Una reserva del cliente aparece, con datos correctos, en ESP + ADM (agenda y panel) + REC del mismo tenant/sede.
- El reflejo respeta sucursal y tenant (no se filtra).
- Las 4 transiciones de estado se propagan a todas las vistas.
- `specs/03-flujo-cruzado/*` verde y estable, usando varios `BrowserContext`.

## Trazabilidad
- HU-CLI-003, HU-ESP-002/003/004/005, HU-REC-003, HU-ADM-012; ADR-001 (aislamiento). Es la materialización del patrón maestro (PLAN-V3 §5) y de la matriz de flujos cruzados (`_MATRIZ-TRAZABILIDAD §2`).
