# FASE-07 · Admin · Gestión (Equipo, Servicios, Inventario)

## Objetivo
Construir la sección **Gestión** del panel admin con sus tres sub-pestañas tal como el prototipo: **Equipo** (especialistas + liquidación), **Servicios** (catálogo + editor de repartición/comisión), e **Inventario** (productos, movimientos, alertas de stock). Todo conectado a los módulos de equipo, servicios e inventario del backend.

## Prerrequisitos
- FASE-01, FASE-02, FASE-05 (modales/tablas admin).
- Conocer el estado del **módulo inventario** (puede estar OFF por config → ocultar sub-pestaña, FASE-09).

## Fuente visual (prototipo)
- `admin-screens-gestion.jsx` (contenedor de sub-pestañas).
- `admin-screens-gestion-equipo.jsx` (`ScreenEquipo`, `SpecialistCard`, `SpecialistModal`, `LiquidationPanel`).
- `admin-screens-gestion-servicios.jsx` (`ScreenServicios`, `ServiceCard`, `SplitEditor`, `ServiceModal`, `RegistroTable`).
- `admin-screens-gestion-inventario.jsx` (`ScreenInventario`, `ProductTable`, `ProductModal`, `MovementModal`, `LowStockPanel`).
- `admin-gestion-ui.jsx`, `admin-data-gestion.js` (referencia de layout/datos).

## Pasos de Claude

### 1. Contenedor de Gestión
- `pages/admin/GestionScreen.tsx`: tabs Equipo / Servicios / Inventario (con deep-link de FASE-02). Inventario solo visible si el módulo está activo.

### 2. Equipo
- `SpecialistCard` (avatar, nombre, rol, sucursales, estado activo/inactivo). `GET /especialistas`.
- `SpecialistModal`: alta/edición (nombre, rol, **repartición/comisión**, asignación a sucursales). `POST /especialistas`, `PATCH /especialistas/:id`, `PATCH /especialistas/:id/estado`, `PUT /especialistas/:id/sucursales`.
- `LiquidationPanel`: resumen de liquidación del especialista (ganancias/comisiones del período) — datos de `reportes`/`liquidaciones`; generar/descargar (enlaza con FASE-08).

### 3. Servicios
- `ServiceCard` (nombre, categoría, precio COP, duración, repartición). `GET /servicios`.
- `ServiceModal` + `SplitEditor`: editor de **repartición** profesional/salón con validación **suma = 100%** (`SplitType` de `@orkalis/shared`). `POST /servicios`, `PATCH /servicios/:id`, `DELETE /servicios/:id`.
- `RegistroTable`: tabla de servicios con bordes horizontales/zebra del DS.

### 4. Inventario (si módulo ON)
- `ProductTable` (producto, stock, costo, precio, valoración). `GET /inventario/productos`, `GET /inventario/valoracion`.
- `ProductModal`: alta/edición de producto. `POST /inventario/productos`.
- `MovementModal`: entradas/salidas/ajustes. `POST /inventario/movimientos`.
- `LowStockPanel`: alertas de stock bajo. `GET /inventario/alertas`.
- (Ventas de producto se registran también desde Finanzas/POS — FASE-08 — vía `POST /inventario/ventas`.)

### 5. Datos
- Hooks `useEspecialistas`, `useServicios`, `useInventario`. Validación de dominio en cliente + confianza en validación de backend (repartición 100%, porcentajes 0–100).

## Backend: huecos a cubrir
- Confirmar que `liquidaciones`/`reportes` exponen el **resumen por especialista** que el `LiquidationPanel` necesita; si no, endpoint de resumen por especialista (coordinar con FASE-10 Ganancias para reusar).
- Confirmar que `servicios` incluye **categoría** y datos de repartición que el `SplitEditor` edita; ampliar DTO si falta.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar reglas de repartición por defecto del negocio (si difieren de lo sembrado).

## Verificación / Done
- Equipo: alta/edición/estado/asignación de sucursales y panel de liquidación funcionan.
- Servicios: CRUD + editor de repartición con validación 100% real contra backend.
- Inventario: productos, movimientos y alertas funcionan; la sub-pestaña se oculta si el módulo está OFF.
- Todos los estados; fiel al prototipo.

## Trazabilidad
- RF-005..RF-007 (equipo), RF-039..RF-041 (servicios/inventario), ADR-006 (repartición/finanzas), ADR-002 (módulos config), RNF-005.
