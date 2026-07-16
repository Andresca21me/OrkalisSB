# FASE-05 · Admin · Panel (Dashboard) y Agenda

## Objetivo
Construir las dos primeras secciones del panel admin tal como el prototipo: el **Panel** (dashboard con KPIs, agenda del día y resumen financiero) y la **Agenda** (mini-calendario, leyenda de especialistas, contadores del día, citas por hora y archivo por período). Con acciones de cita reales (aprobar/iniciar/completar/cancelar/no-asistió) y selector sucursal/consolidado.

## Prerrequisitos
- FASE-01, FASE-02 cerradas (primitivos + Shell con selector de sucursal/consolidado).
- Gráficos base de FASE-01.

## Fuente visual (prototipo)
- `admin-screens-dashboard.jsx` (`ScreenDashboard`, `DashHeader`, `AppointmentRow`, `ApptActionsMenu`, `FinanceSummary`).
- `admin-screens-agenda.jsx` (`ScreenAgenda`, `MiniCalendar`, `SpecialistLegend`, `DayCounters`, `PeriodSection`, `ArchiveTable`, `Alert`).
- `admin-app.jsx` (manejo de `appts`, `applyStatus`, modales de cita/estado, toasts).
- `admin-ui.jsx` (componentes de cabecera/tabla del admin).

## Pasos de Claude

### 1. Panel (Dashboard)
- `pages/admin/PanelScreen.tsx`: cabecera con saludo/fecha (`DashHeader`), fila de **KpiCards** (ingresos del día, nº de citas, ticket promedio, ocupación…), con **deltas** vs. período anterior (teal positivo).
- **Agenda del día**: lista de `AppointmentRow` ordenada por hora (cliente, servicio, especialista, hora, estado en `Badge`) con menú de acciones `ApptActionsMenu` por cita.
- **Resumen financiero** (`FinanceSummary`): mini-gráfico + totales del día/período. Oculta detalle de partición si el módulo está OFF.
- Respeta **selector de sucursal/consolidado**: en consolidado agrega todas las sucursales.

### 2. Acciones de cita (reales)
- Cablear `applyStatus` a los endpoints de citas: `POST /citas/:id/aprobar | iniciar | completar | revertir | cancelar | no-asistio`.
- **Completar** abre el modal de cobro (servicios reales + método de pago) — **guard de pago** del backend (ADR-006); al éxito, toast "Ganancias calculadas".
- Estados de cita y transiciones respetan la máquina de estados (origen interno/público).

### 3. Agenda
- `pages/admin/AgendaScreen.tsx`: **mini-calendario** (`MiniCalendar`) para elegir día, **leyenda de especialistas** (color por especialista), **contadores del día** (`DayCounters`: confirmadas, en progreso, completadas, canceladas/no-asistió).
- Lista de citas del día seleccionado por hora; crear/editar cita (modal del prototipo) y reasignar especialista.
- **Archivo por período** (`PeriodSection` + `ArchiveTable`): histórico de citas agrupado, con `Alert` para avisos (p. ej. citas pasadas sin cerrar).

### 4. Modales de cita
- Modal alta/edición de cita (servicios, cliente, especialista, fecha/hora) usando `Dialog` del DS; modal de cambio de estado/cobro. Reusables por Recepción (FASE-11).

### 5. Datos
- Hook `useCitas` sobre `GET /citas` con filtros de **fecha/rango**, **sucursal** y agrupación. Sustituir cualquier `AdminData`/mock por la API.

## Backend: huecos a cubrir
- **KPIs del Panel:** si `GET /reportes/financiero` no entrega directamente los KPIs del dashboard (ingresos del día, ticket promedio, deltas vs. período anterior, ocupación), añadir un endpoint de **resumen de panel** (`GET /reportes/panel?sucursalId&fecha`) o ampliar el existente.
- **`GET /citas`:** confirmar soporte de `?desde&hasta&sucursalId&especialistaId` y modo **consolidado** (todas las sucursales del negocio). Ampliar query si falta.
- Archivo por período: confirmar paginación/filtros del histórico.

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna (datos de prueba ya sembrados en FASE-02/03). Opcional: validar que los KPIs cuadran con datos conocidos.

## Verificación / Done
- Panel muestra KPIs reales con deltas, agenda del día y resumen financiero, fiel al prototipo.
- Acciones de cita ejecutan transiciones reales; completar aplica el guard de pago y recalcula ganancias.
- Agenda: mini-calendario, leyenda, contadores y archivo por período funcionan; crear/editar/reasignar cita opera contra la API.
- Selector sucursal/consolidado afecta correctamente todas las cifras y listas.
- Todos los estados (datos/cargando/vacío/error) presentes.

## Trazabilidad
- RF-025..RF-035 (agendamiento interno, máquina de estados, walk-in via agenda), RF-042..RF-045 (reportes/KPIs), ADR-005 (estados), ADR-006 (motor financiero / guard de pago), ADR-001 (scope sucursal/consolidado), RNF-005.
