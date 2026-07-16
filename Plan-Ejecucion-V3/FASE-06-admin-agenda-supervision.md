# FASE-06 · Admin · agenda y supervisión (ADM)

## Objetivo
Probar las capacidades de supervisión del administrador: el **panel/dashboard** (KPIs, agenda del día, resumen financiero), la **Agenda** (mini-calendario, leyenda, contadores, archivo por período), y la creación de turnos en **cualquier sucursal** (incluidos walk-ins en vivo o retroactivos), respetando la validez de especialista por sede. Verificar reflejo cruzado (ADM → ESP/REC) y vista consolidada vs por sucursal.

## Prerrequisitos
- FASE-00, FASE-01. Seed barbería multi-sede. (FASE-11 profundiza el consolidado; aquí se prueba desde la agenda admin.)

## Pantallas / rutas bajo prueba
- `AdminApp` → `PanelScreen`, `AgendaScreen`, `agenda-ui` (`apps/web/src/pages/admin/`).

## Casos de prueba

### Panel / dashboard (HU-ADM-012, soporte)
1. **KPIs del día**: el panel muestra los indicadores (nº citas, ticket promedio, etc.) con datos del seed; valores numéricos coherentes (no NaN ni vacíos).
2. **Agenda del día en el panel**: lista los próximos turnos; al crear/confirmar uno (cruzado), aparece tras recargar.
3. **Resumen financiero del panel**: muestra ingresos/indicadores del período; "período sin datos" no rompe (ceros, sin gráficos confusos).
4. **Estados**: carga (skeleton de KPIs), error (5xx → ErrorState con reintento).

### Agenda admin
5. **Mini-calendario y navegación**: cambiar de día actualiza la lista; la leyenda de estados y los contadores corresponden a los turnos visibles.
6. **Filtro por sucursal vs consolidado**: en *Sede Centro* solo se ven sus turnos; en "Todo el negocio" se agregan las sedes.
7. **Archivo por período**: si el módulo de cierre está activo, la sección de archivo muestra los períodos archivados (enlaza con FASE-09).

### Crear turnos en cualquier sucursal (HU-ADM-012, HU-ESP-006/007 desde admin)
8. **Crear turno en sede específica**: desde consolidado, crear un turno en *Sede Norte* con un especialista de esa sede → aparece en la agenda de *Norte* y, tras recargar, en la vista del especialista de Norte.
9. **Especialista no válido para la sede**: al crear en *Norte*, solo se ofrecen especialistas de *Norte*; intentar uno ajeno no se permite.
10. **Walk-in en vivo desde admin**: crear un turno de creación interna e iniciarlo → En progreso.
11. **Atención retroactiva desde admin**: registrar un turno con horas pasadas + cobro → Completado; horas inválidas → rechazado.
12. **Anti-solape**: crear un turno que se solapa con otro del mismo especialista → conflicto controlado (mensaje), sin doble reserva.

### Flujo cruzado (ADM →)
13. **Reflejo en ESP/REC**: el turno creado por admin en una sede aparece, tras recargar, en la agenda del especialista y el tablero de recepción de esa sede.

## Datos de prueba
- Admin barbería; especialistas Carlos (Centro+Norte) y Diana (solo Centro). Clientes/teléfonos únicos.

## Huecos de testabilidad
- KPIs del panel: `data-testid="kpi-{clave}"` (citas-hoy, ticket-promedio, ingresos-dia…).
- Crear turno: `data-testid="agenda-nuevo-turno"`, selector de sucursal `data-testid="turno-sucursal"`, de especialista `data-testid="turno-especialista"`.
- Reutiliza `appt-row-{id}` / `appt-estado` de FASE-03.

## Verificación / Done
- Panel y agenda muestran datos correctos y todos los estados.
- Crear turno en cualquier sede respeta validez de especialista y anti-solape.
- Walk-in/retroactiva desde admin cubiertos.
- Reflejo cruzado ADM→ESP/REC verificado.
- `specs/06-admin-agenda/*` verde y estable.

## Trazabilidad
- HU-ADM-012, HU-ESP-006/007 (vía admin), HU-ADM-002 (parcial, filtro/consolidado). Diagrama de estados.
