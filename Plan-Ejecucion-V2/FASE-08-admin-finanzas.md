# FASE-08 · Admin · Finanzas (Quincenal, Reportes, Análisis)

## Objetivo
Construir la sección **Finanzas** del panel admin tal como el prototipo: liquidación **Quincenal**, **Reportes** (con exportación) y **Análisis** (KPIs financieros con desglose por período), más el registro de **ventas y gastos**. Conectado al motor financiero, liquidaciones, gastos, reportes y cierres existentes.

## Prerrequisitos
- FASE-01, FASE-02, FASE-05, FASE-07 (servicios/equipo para repartición).
- Gráficos base de FASE-01.

## Fuente visual (prototipo)
- `admin-screens-finanzas.jsx` (contenedor).
- `admin-screens-finanzas-quincenal.jsx` (`ScreenQuincenal`).
- `admin-screens-finanzas-reportes.jsx` (`ScreenReportes`).
- `admin-screens-finanzas-analisis.jsx` (`ScreenAnalisis`, `PeriodSwitch`, `FinTile`, `BreakdownBlock`, `AnalisisHeader`).
- `admin-modals-ventas.jsx` (registrar venta/gasto), `admin-finanzas-ui.jsx`, `admin-data-finanzas.js`.

## Pasos de Claude

### 1. Contenedor de Finanzas
- `pages/admin/FinanzasScreen.tsx`: tabs Quincenal / Reportes / Análisis. Selector de período y de sucursal/consolidado.

### 2. Quincenal (liquidaciones)
- `ScreenQuincenal`: liquidación del período por especialista (ganancias, comisiones, repartición, neto). `POST /liquidaciones/generar` para el período; descargar CSV con `POST /liquidaciones/csv`. Mostrar estado de **cierre de período** (`GET /cierres`, `POST /cierres`) — bloquear edición de un período cerrado.

### 3. Reportes
- `ScreenReportes`: reporte financiero (`GET /reportes/financiero?desde&hasta&sucursalId`) con tablas/gráficos. **Exportar CSV/PDF** (PDF se genera en worker — no en el hilo de petición, RNF-002). Botones de export con feedback.

### 4. Análisis
- `ScreenAnalisis`: KPIs financieros (`FinTile`) con **PeriodSwitch** (día/semana/quincena/mes) y `BreakdownBlock` (desglose por servicio, especialista, método de pago, sucursal). Gráficos de la librería de FASE-01. Deltas vs. período anterior.

### 5. Registrar venta / gasto
- `admin-modals-ventas.jsx`: modal de **venta** (servicios/productos + método de pago `MetodoPago`) → `POST /inventario/ventas` y/o registro de atención según el flujo; modal de **gasto** (`TipoGasto`) → `POST /gastos`. Listado de gastos (`GET /gastos`, `DELETE /gastos/:id`).

### 6. Datos
- Hooks `useReportes`, `useLiquidaciones`, `useGastos`, `useCierres`. Formato COP/es-CO en todas las cifras (mono + `tnum`).

## Backend: huecos a cubrir
- Confirmar que **export PDF** existe (worker/cola) y devuelve URL/descarga; si solo hay CSV, añadir generación PDF asíncrona (RNF-002) o acordar diferirlo.
- Confirmar que `reportes/financiero` soporta los **desgloses** que pide Análisis (por servicio/especialista/método/sucursal) y `PeriodSwitch`; ampliar query si falta.
- Confirmar guard de **período cerrado** (no liquidar/editar tras cierre) expuesto al front.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar la periodicidad de liquidación real del negocio (quincenal por defecto, según prototipo) y la política de cierre.

## Verificación / Done
- Quincenal genera liquidaciones reales y exporta CSV; respeta períodos cerrados.
- Reportes muestran datos reales y exportan CSV/PDF (o PDF diferido acordado).
- Análisis muestra KPIs y desgloses por período con gráficos del DS.
- Registrar venta y gasto persiste y recalcula; listado de gastos opera.
- Todo en COP/es-CO; todos los estados; fiel al prototipo.

## Trazabilidad
- RF-042..RF-045 (reportes/export), RF-039..RF-041 (ventas/gastos/liquidaciones), ADR-006 (motor financiero, snapshot, reversión), RNF-002 (tareas pesadas en worker), RNF-004 (COP/es-CO), RNF-005.
