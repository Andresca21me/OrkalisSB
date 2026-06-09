# FASE-07 · Negocio, sucursales, equipo y suscripción

## Objetivo
Implementar el **onboarding del negocio** (con perfil salón/barbería y sus defaults), la **gestión de sucursales** (CRUD + activar/desactivar + vista por sucursal vs. consolidada), la **gestión del equipo** (especialistas y su asignación a sucursales), y la base de la **suscripción cobrada por nº de sucursales activas**.

## Prerrequisitos
- FASE-05 (auth/RBAC) y FASE-06 (config, para precargar defaults del perfil).

---

## Pasos de Claude

### 1. Módulo `negocio` (onboarding)
- `POST /api/negocios` (alta) — crea negocio con `perfil` (`salon`|`barberia`), su `usuario` admin inicial, y **precarga**: terminología/categorías y **módulos por defecto del perfil** (vía registry de FASE-06). RF-001, HU-ADM-001.
- `PATCH /api/negocios/:id/perfil` — cambia el perfil ajustando defaults **sin borrar datos operativos** (RF-002, HU-ADM-001 escenario 2).
- Crea automáticamente una `suscripcion` inicial y al menos una `sucursal`.

### 2. Módulo `sucursal`
- `POST /api/sucursales` (admin) — crea sucursal; opción "heredar del negocio" (sin overrides) o "clonar de la sucursal X" (FASE-06, RF-011).
- `PATCH /api/sucursales/:id` — editar.
- `PATCH /api/sucursales/:id/estado` — activar/desactivar (afecta el cobro, ver §5). RF-003.
- **Selector de alcance**: endpoints de agenda/reportes/finanzas aceptan `?sucursalId=` (una sede) o ninguno (consolidado = todo el negocio). El repositorio base aplica el filtro según `TenantContext`. RF-004, HU-ADM-002.
- **Garantía:** un negocio de una sola sede = una sucursal (no caso especial).

### 3. Módulo `equipo` (especialistas)
- CRUD de `especialista` (RF de HU-ADM-005).
- Asignar a una o varias sucursales vía `especialista_sucursal`.
- Baja = **borrado lógico** (`activo=false`): deja de aparecer en enlace público y nuevas asignaciones, pero su historial se conserva (HU-ADM-005 escenario 2).
- Regla: al crear/editar citas, solo se permiten especialistas **válidos para esa sucursal** (HU-ADM-012 escenario 2; se aplica en FASE-08).

### 4. Vista consolidada vs. por sucursal
- Asegurar que los listados (agenda, finanzas, reportes) respeten el filtro de sucursal sin filtración entre sedes (apoyado en RLS + repositorio de FASE-04). RF-004.

### 5. Suscripción por nº de sucursales activas
- Servicio que calcula el cobro a partir del **conteo de sucursales activas** del negocio (RF-006, HU-PLT-001).
- Al activar/desactivar una sucursal, **recalcular** `suscripcion.num_sucursales` y dejar registrado el cambio (el cobro real con Wompi es FASE-12; aquí queda la lógica de conteo y el estado).
- Estado de cuenta: `activa` | `suspendida` (la suspensión real la opera el operador de plataforma en FASE-12; aquí se respeta el campo `negocio.estado_suscripcion` ya usado en el guard de FASE-05).

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna. (El cobro real se conecta en FASE-12.)

---

## Verificación / Done
- Crear un negocio barbería precarga sus módulos/categorías por defecto; cambiar a salón ajusta defaults sin borrar citas/servicios existentes.
- Crear 2 sucursales; filtrar agenda/reportes por una muestra solo sus datos; la vista consolidada agrega ambas sin mezclar otros negocios.
- Asignar un especialista a 2 sucursales lo hace reservable en ambas; darlo de baja lo oculta pero conserva su historial.
- Activar/desactivar una sucursal cambia `num_sucursales` de la suscripción.
- Pruebas: aislamiento por sucursal en listados, conteo de sucursales activas, cambio de perfil no destructivo.

## Trazabilidad
- RF-001, RF-002, RF-003, RF-004, RF-006, HU-ADM-001, HU-ADM-002, HU-ADM-005, HU-ADM-012, HU-PLT-001, ADR-001, ADR-002.
