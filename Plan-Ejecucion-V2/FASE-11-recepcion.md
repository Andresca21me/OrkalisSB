# FASE-11 · Recepción

## Objetivo
Construir la **vista de Recepción** tal como el prototipo: un **tablero por especialista** (columnas) con las citas del día, reasignación de citas entre especialistas, registro de **walk-ins** y cobro al final, más resumen diario exportable. Pensada para tablet/escritorio en mostrador.

## Prerrequisitos
- FASE-01, FASE-02, FASE-05 (modales/acciones de cita reutilizables).

## Fuente visual (prototipo)
- `recepcion-app.jsx` (`RecepcionApp`, `RecepHeader`, `BoardCard`, `SpecialistColumn`, `ReassignDialog`).
- `admin-data-recepcion.js` (referencia de datos/layout).

## Pasos de Claude

### 1. Tablero del día
- `pages/recepcion/RecepcionApp.tsx`: cabecera (`RecepHeader`) con fecha y sucursal; **columnas por especialista** (`SpecialistColumn`) con tarjetas de cita (`BoardCard`: hora, cliente, servicio, estado). `GET /citas?fecha=hoy&sucursalId` agrupado por especialista. Refresco frecuente (la recepción es tiempo real).

### 2. Acciones sobre la cita
- Desde cada `BoardCard`: ver/editar, iniciar/completar/cancelar/no-asistió (reusar acciones de FASE-05), y **cobro** al completar (modal de cobro con guard de pago).

### 3. Reasignar
- `ReassignDialog`: mover una cita a otro especialista (drag o selección). Cablear a la transición/edición de cita que el backend ofrezca (ver hueco). Validar disponibilidad del destino (sin solapamiento — `EXCLUDE`).

### 4. Walk-in desde recepción
- Botón de **walk-in**: crear turno sin reserva asignado a un especialista (`POST /citas/walk-in` / `walk-in/retroactivo`), entra al tablero.

### 5. Resumen diario
- Exportar **resumen diario** del mostrador (PDF) — vía worker (RNF-002). Botón con feedback.

### 6. Datos
- Hook `useTableroRecepcion` (citas del día por especialista) con refresco.

## Backend: huecos a cubrir
- **Reasignar cita:** confirmar si existe transición de reasignación o se modela como edición de `especialistaId` de la cita; validar que respeta el `EXCLUDE` (no solapar). Si no hay endpoint limpio, añadirlo (FASE-11).
- **Resumen diario PDF** de recepción: si no existe, reusar el generador de reportes (worker) acotado al día/sucursal.

## ⚠️ ACCIÓN DEL USUARIO
- Proveer login de recepcionista de prueba.

## Verificación / Done
- Tablero por especialista del día se ve como el prototipo y refresca.
- Reasignar funciona y no permite solapamientos; walk-in entra al tablero.
- Cobro al completar aplica guard de pago; resumen diario exporta.
- Todos los estados; scope por sucursal.

## Trazabilidad
- RF-025..RF-035 (turnos, walk-in, reasignación), RF-042..RF-045 (resumen/export), ADR-005 (no solapamiento), ADR-006 (cobro), RNF-002 (PDF en worker), RNF-005.
