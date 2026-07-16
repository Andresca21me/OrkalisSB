# FASE-06 · Admin · Clientes (CRM)

## Objetivo
Construir la sección **Clientes** del panel admin tal como el prototipo: listado/tarjetas de clientes, **historial** del cliente, alta/edición y borrado con confirmación. Conectado al CRM existente.

## Prerrequisitos
- FASE-01, FASE-02, FASE-05 (componentes de tabla/modal ya usados en admin).

## Fuente visual (prototipo)
- `admin-screens-clientes.jsx` (`ScreenClientes`, `ClientCard`, `ClientHistoryDialog`, `ClientFormDialog`, `ConfirmDeleteDialog`, `Field`, `TextField`).

## Pasos de Claude

### 1. Listado de clientes
- `pages/admin/ClientesScreen.tsx`: búsqueda + lista de `ClientCard` (nombre, teléfono, nº de visitas, último servicio, total gastado). `GET /clientes` con búsqueda/paginación. Estados cargando (skeleton de tarjetas), vacío ("Aún no tienes clientes…"), error.

### 2. Historial del cliente
- `ClientHistoryDialog`: al abrir un cliente, `GET /clientes/:id/historial` → citas/atenciones pasadas, servicios, montos, especialistas. Línea de tiempo o tabla con bordes horizontales (estilo DS).

### 3. Alta / edición
- `ClientFormDialog`: formulario (nombre, teléfono, notas, etiquetas si aplica) con validación. `POST /clientes` y `PATCH /clientes/:id`. Toast de éxito.

### 4. Borrado
- `ConfirmDeleteDialog`: confirmación destructiva (patrón `DangerConfirm`). `DELETE /clientes/:id`. Manejar el caso de cliente con historial (soft-delete/anonimizar según backend; no romper integridad).

### 5. Datos
- Hook `useClientes` (lista, detalle, mutaciones) sobre `lib/api.ts`, scope por sucursal/negocio.

## Backend: huecos a cubrir
- Confirmar **búsqueda y paginación** en `GET /clientes` (por nombre/teléfono). Ampliar query params si faltan.
- Confirmar que `DELETE /clientes/:id` respeta integridad (no borra duro si hay historial). Si el prototipo muestra "no se puede borrar con citas", reflejar la regla del backend.

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna.

## Verificación / Done
- Lista, búsqueda, alta, edición, historial y borrado funcionan contra la API, fieles al prototipo.
- Todos los estados presentes; borrado pide confirmación y respeta integridad.

## Trazabilidad
- RF-036..RF-038 (CRM clientes, historial), ADR-001 (scope), RNF-005.
