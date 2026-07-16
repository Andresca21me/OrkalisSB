# FASE-07 · Negocio, sucursales, equipo y suscripción

## Objetivo
Implementar el **onboarding del negocio** (con perfil salón/barbería y sus defaults), la **gestión de sucursales** (CRUD + activar/desactivar + vista por sucursal vs. consolidada), la **gestión del equipo** (especialistas y su asignación a sucursales), y la base de la **suscripción cobrada por plan + nº de especialistas** (ADR-009).

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
- `PATCH /api/sucursales/:id/estado` — activar/desactivar. **No** afecta el cobro (el cobro depende del plan + nº especialistas, ADR-009); pero crear sucursales adicionales requiere que el **plan** lo permita (Premium = 2 sedes, Empresarial = ilimitado; Básico/Pro = 1). RF-003.
- **Selector de alcance**: endpoints de agenda/reportes/finanzas aceptan `?sucursalId=` (una sede) o ninguno (consolidado = todo el negocio). El repositorio base aplica el filtro según `TenantContext`. RF-004, HU-ADM-002.
- **Garantía:** un negocio de una sola sede = una sucursal (no caso especial).

### 3. Módulo `equipo` (especialistas)
- CRUD de `especialista` (RF de HU-ADM-005).
- Asignar a una o varias sucursales vía `especialista_sucursal`.
- Baja = **borrado lógico** (`activo=false`): deja de aparecer en enlace público y nuevas asignaciones, pero su historial se conserva (HU-ADM-005 escenario 2).
- Regla: al crear/editar citas, solo se permiten especialistas **válidos para esa sucursal** (HU-ADM-012 escenario 2; se aplica en FASE-08).

### 4. Vista consolidada vs. por sucursal
- Asegurar que los listados (agenda, finanzas, reportes) respeten el filtro de sucursal sin filtración entre sedes (apoyado en RLS + repositorio de FASE-04). RF-004.

### 5. Suscripción por plan + nº de especialistas (ADR-009)
- **Catálogo de planes en código** (registry, fuente de verdad de facturación, NO editable por tenant): para cada plan (`basico`|`pro`|`premium`|`empresarial`) define `precio_base`, `especialistas_incluidos`, `costo_especialista_adicional`, cupos de mensajería (base + por especialista extra) y matriz de funciones. Valores canónicos en ADR-009.
- Servicio que calcula el **cargo mensual** = `precio_base + max(0, nº_especialistas_activos − incluidos) × costo_especialista_adicional` (RF-006, HU-PLT-001).
- Al **dar de alta/baja un especialista** o **cambiar de plan**, recalcular y registrar `suscripcion.num_especialistas` / `suscripcion.plan` (el cobro real con Wompi es FASE-12; aquí queda la lógica de cálculo y el estado).
- **Gating por plan:** el nº de sucursales permitidas y las funciones habilitadas (SMS, marketing, reportes, fidelización, multi-sede, API, roles) salen del plan; al crear una sucursal/usar una función, validar que el plan la permita.
- Estado de cuenta: `activa` | `suspendida` (la suspensión real la opera el operador de plataforma en FASE-12; aquí se respeta el campo `negocio.estado_suscripcion` ya usado en el guard de FASE-05).

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna. (El cobro real se conecta en FASE-12.)

---

## Verificación / Done
- Crear un negocio barbería precarga sus módulos/categorías por defecto; cambiar a salón ajusta defaults sin borrar citas/servicios existentes.
- Crear 2 sucursales; filtrar agenda/reportes por una muestra solo sus datos; la vista consolidada agrega ambas sin mezclar otros negocios.
- Asignar un especialista a 2 sucursales lo hace reservable en ambas; darlo de baja lo oculta pero conserva su historial.
- Dar de alta un especialista por encima de los incluidos del plan incrementa el cargo en `costo_especialista_adicional`; darlo de baja lo reduce.
- Cambiar de plan ajusta precio base, cupos y funciones habilitadas sin perder datos.
- Crear una sucursal está permitido solo si el plan lo admite (Básico/Pro = 1 sede).
- Pruebas: aislamiento por sucursal en listados, **cálculo del cargo por plan + nº especialistas**, gating de sucursales/funciones por plan, cambio de perfil no destructivo.

## Trazabilidad
- RF-001, RF-002, RF-003, RF-004, RF-006, HU-ADM-001, HU-ADM-002, HU-ADM-005, HU-ADM-012, HU-PLT-001, ADR-001, ADR-002, **ADR-009**.
