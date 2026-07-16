# FASE-04 · Especialista · ciclo del turno (ESP)

## Objetivo
Probar por la UI móvil del especialista todo su día de trabajo: ver agenda (día/semana), el ciclo de un turno (iniciar → cobrar → completar), cancelar / marcar no asistió, registrar **walk-in** y **atención retroactiva**, consultar **ganancias**, y cambiar **disponibilidad/sucursal activa**. Verificar que cada acción se refleja en las vistas de admin y recepción (flujo cruzado ESP →).

## Prerrequisitos
- FASE-00, FASE-01. Seed con citas de hoy en varios estados (barbería, Carlos).
- Móvil-first: usar viewport móvil + safe-area (proyecto Playwright con `devices['Pixel 7']` o similar para esta fase).

## Pantallas / rutas bajo prueba
- `SpecApp` y `spec-*` (`apps/web/src/pages/spec/`): `spec-agenda`, `spec-cobro`, `spec-walkin`, `spec-extra` (ganancias/perfil/sucursal).

## Casos de prueba

### Agenda (HU-ESP-001, 002)
1. **Agenda del día con citas**: Carlos ve sus turnos de hoy ordenados por hora, con cliente, servicio y estado.
2. **Día sin citas**: con un especialista/fecha sin turnos, se ve el empty state ("no hay turnos").
3. **Vista semana**: alternar a semana muestra los turnos de la semana; navegar entre días.
4. **Estados de carga/error** de la agenda (skeleton; 5xx → ErrorState).

### Ciclo del turno (HU-ESP-003, 004)
5. **Iniciar**: un turno **Confirmado** → "Iniciar" → pasa a **En progreso** (en la propia vista y, tras recargar, en admin/recepción).
6. **No iniciar un completado**: un turno **Completado** no ofrece "Iniciar" / lo impide.
7. **Completar con cobro**: turno En progreso → registrar servicios + método de pago → "Completar" → **Completado**; el monto y la repartición se calculan sobre lo registrado.
8. **No completar sin pago**: intentar completar sin método de pago lo impide y lo solicita.
9. **Cobro con varios servicios**: agregar un servicio extra durante el cobro suma al monto final.

### Cancelación / inasistencia (HU-ESP-005)
10. **No asistió**: marcar un confirmado como "No asistió" cambia el estado y libera la franja.
11. **Cancelar completado**: intentar cancelar un Completado exige revertir efectos de forma controlada (o lo impide) — no deja datos inconsistentes.

### Walk-in y retroactiva (HU-ESP-006, 007)
12. **Walk-in inmediato**: crear un turno de creación interna y atenderlo → entra **En progreso** sin validación de disponibilidad futura.
13. **Walk-in con datos mínimos**: permite registrar sin teléfono/nombre, pero sugiere capturarlos.
14. **Atención retroactiva válida**: registrar un turno con horas pasadas como Completado + cobro → aceptado (chequeos de sanidad: fin ≥ inicio, período abierto).
15. **Retroactiva con horas inválidas**: fin anterior a inicio → rechazado con mensaje de coherencia.

### Ganancias y disponibilidad (HU-ESP-008, 009)
16. **Ganancias del día/semana/mes**: tras completar turnos, el resumen muestra los totales (incl. comisiones por venta).
17. **Partición desactivada**: si el negocio no usa partición por especialista, el resumen lo indica y no muestra ganancias individuales *(coordinar con FASE-10)*.
18. **Marcarse ocupado/disponible**: cambiar a "Ocupado" retira las franjas del enlace público (verificable en disponibilidad pública).
19. **Cambiar sucursal activa**: Carlos (en 2 sedes) cambia a *Sede Norte* → su agenda/disponibilidad se gestionan para esa sede.

### Flujo cruzado (ESP →)
20. **Reflejo en admin/recepción**: iniciar/completar/cancelar por Carlos se ve, tras recargar, en la agenda admin y el tablero de recepción (enlaza con FASE-03 casos 9–12).

## Datos de prueba
- Carlos (barbería). Clientes/teléfonos únicos para walk-ins. Para "no asistió"/"cancelar", usar citas de hoy del seed o crear unas propias.
- Re-sembrar si la fase deja el día muy alterado para fases posteriores.

## Huecos de testabilidad
- Tarjetas de turno: `data-testid="turno-{citaId}"`, `data-testid="turno-estado"`, botones `data-testid="turno-iniciar|completar|cancelar|no-asistio"`.
- Cobro: `data-testid="cobro-metodo-{metodo}"`, `data-testid="cobro-total"`, `data-testid="cobro-confirmar"`.
- Ganancias: `data-testid="ganancias-hoy|semana|mes"`.

## Verificación / Done
- Ciclo completo iniciar→cobrar→completar funciona y bloquea los caminos inválidos.
- Walk-in y retroactiva (válida e inválida) cubiertos.
- Ganancias y disponibilidad/sucursal cubiertos.
- Reflejo en admin/recepción verificado.
- `specs/04-especialista/*` verde y estable (viewport móvil).

## Trazabilidad
- HU-ESP-001..009; flujos cruzados ESP→ADM/REC (`_MATRIZ §2`). Diagrama de estados de la cita.
