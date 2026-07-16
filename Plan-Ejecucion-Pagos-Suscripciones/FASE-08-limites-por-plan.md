# FASE-08 · Aplicación real de los límites por plan

## Objetivo
Que el plan contratado **restrinja de verdad** lo que el negocio puede hacer: módulos del nivel, **cupo de especialistas bloqueado**, y máximo de sucursales. Todo validado en el **backend**.

## Prerrequisitos
- FASE-01 (`PlanService` con `moduloPermitido`, `puedeAgregarEspecialista`).

## Pasos

### 🤖 Backend (los límites, donde importan)
1. **Módulos por plan en `ModuloGate`:** el gate hoy mira la **config**; ahora valida **config ∧ `PlanService.moduloPermitido(plan, clave)`**. Si el plan no lo incluye → 403 con mensaje "Tu plan no incluye este módulo".
2. **Cupo de especialistas en `equipo.service.crear`:** antes de crear, contar especialistas **activos** y validar `puedeAgregarEspecialista(numActuales, suscripcion.num_especialistas)`. Si se excede → `ForbiddenException` "Alcanzaste el cupo de N especialistas de tu plan. Sube tu plan para agregar más." (en vez de solo recalcular el cargo, como hoy).
3. **Sucursales:** conectar `puedeAgregarSucursal` al endpoint de crear sucursal → bloquear sobre el `maxSucursales` del plan.
4. **Funciones premium** (reportes avanzados, marketing, roles, API): gatear sus endpoints según `plan.funciones`.

### 🤖 Frontend (reflejo + CTA, sin ser la barrera)
5. **Config de módulos:** los toggles de módulos **no permitidos** por el plan se muestran **deshabilitados** con un candado y "Disponible en plan Pro/Premium".
6. **Equipo:** mostrar "X de Y especialistas". Al llegar al cupo, el botón "Nuevo especialista" lleva a **"Sube tu plan"** (FASE-09) en vez de fallar.
7. **Banner de uso** cuando se acerca al cupo.

## ✅ Verificación
- E2E: tenant en `basico` → la API **rechaza** activar/usar inventario; la UI lo muestra bloqueado.
- E2E: tenant con cupo 2 y 2 especialistas activos → crear el 3.º **falla en el backend** (403) y la UI ofrece subir de plan.
- E2E: `basico` (maxSucursales 1) → crear 2.ª sucursal bloqueada.
- Cortesía/operador: una cuenta con plan asignado por cortesía respeta los **límites de ese plan**.

## Trazabilidad
- Reglas de negocio #5. `_MODELO §6`. ADR-P3 (límites en backend). Refuerza HU-ADM-003/005/012.
