# FASE-13 · Panel del Operador de Plataforma

## Objetivo
Construir el panel del **Operador de Plataforma** (rol `OperadorPlataforma`): la consola interna de Orkalis para administrar **tenants (negocios)**, sus **suscripciones**, y ejecutar **suspensión/reactivación**. El prototipo no trae una pantalla dedicada a este rol, así que se construye **con el design system** (mismos primitivos y Shell que admin), tomando la forma de un panel de gestión denso (estilo Linear/Retool) y cableándolo al backend `plataforma` existente.

## Prerrequisitos
- FASE-01, FASE-02 (Shell + rol `plataforma` en routing).
- Backend `plataforma` (operador) y `suscripcion` de v1.

## Fuente visual (prototipo)
- No hay pantalla específica en el prototipo. Usar **el design system** (`_ds`, `admin-ui.jsx`) y los patrones de tabla/KPI/Badge ya construidos en FASE-01/05 para mantener coherencia total. Confirmar layout con el USUARIO si hay dudas (no inventar identidad nueva).

## Pasos de Claude

### 1. Lista de tenants
- `pages/plataforma/PlataformaApp.tsx`: tabla densa de negocios (nombre, plan, nº especialistas, estado de suscripción `EstadoSuscripcion`, próximo cobro, sucursales). Filtros y búsqueda. `GET /plataforma/...` (negocios/suscripciones).

### 2. Detalle del tenant
- Ficha del negocio: datos, suscripción, historial de pagos (Wompi), uso de cupos de mensajería. KpiCards de salud del tenant.

### 3. Acciones del operador
- **Suspender / reactivar** suscripción (cuando hay impago o a pedido) → endpoints de `plataforma`/`suscripcion`. Confirmación destructiva (`DangerConfirm`). El efecto se refleja en el login del tenant (cuenta suspendida — FASE-02).
- Cambios de plan/forzar estado si el backend lo permite.

### 4. Datos
- Hook `usePlataforma`. Scope global de operador (no tenant-scoped); cuidar permisos (solo rol operador).

## Backend: huecos a cubrir
- Confirmar endpoints de `plataforma`: listar negocios con su suscripción, ver detalle, **suspender/reactivar**, ver pagos/cupos. Ampliar lo que falte respetando que este rol **no** está limitado por `negocio_id` (acceso de plataforma) pero sí auditado.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar el layout/alcance de este panel (al no estar en el prototipo) y proveer login de operador de prueba.

## Verificación / Done
- Operador lista y filtra tenants, ve su detalle y suscripción.
- Suspender/reactivar funciona y se refleja en el acceso del tenant.
- Coherente con el DS (mismos primitivos que admin), sin identidad inventada.
- Permisos: solo el rol operador accede.

## Trazabilidad
- RF de operador de plataforma y suspensión/reactivación (FASE-12 v1), ADR-009 (planes/suscripción), ADR-003 (RBAC), RNF-005 (coherencia DS).
