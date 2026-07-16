# FASE-01 · Catálogo de planes y servicio de límites

## Objetivo
Convertir el catálogo de planes en la **fuente de verdad de los límites**: qué módulos/funciones permite cada plan, cuántos especialistas y sucursales, y exponer funciones que el resto de la app usa para **permitir o bloquear**. (Aún no se aplican en las pantallas — eso es FASE-08; aquí se construye la lógica.)

## Prerrequisitos
- FASE-00.

## Pasos

### 🤖 Backend
1. **Mapear plan → módulos permitidos** en `plans/plan-registry.ts`: agregar a `FuncionesPlan` (o a un mapa nuevo) qué **módulos** habilita cada plan, p. ej.:
   - `basico`: agenda, reservas, clientes/CRM básico. (sin inventario, sin partición/liquidaciones, sin cierre, sin reportes).
   - `pro`: + inventario, + partición/liquidaciones, + reportes básicos.
   - `premium`: + 2 sucursales, + reportes avanzados, + parámetros financieros por sucursal.
   - `empresarial`: todo + sucursales ilimitadas + roles avanzados + API.
   > Ajustar la matriz exacta contigo (decisión de producto); dejar un único objeto `MODULOS_POR_PLAN` claro.
2. **`PlanService`** (`plans/plan.service.ts`): agregar
   - `moduloPermitido(plan, claveModulo): boolean`.
   - `puedeAgregarEspecialista(plan, numActuales, numPagados): boolean` → `numActuales < numPagados` (el cupo lo manda la **suscripción pagada**, no el plan en sí).
   - `limiteEspecialistas(suscripcion): number` → `suscripcion.num_especialistas`.
   - reutilizar `cargoMensual`, `maxSucursales`, `cupos` ya existentes.
3. **Exponer límites al front:** extender `GET /suscripcion` (o `/auth/me`) para incluir `{ plan, estado, numEspecialistas, limites: { maxSucursales, modulos:[...], especialistas }, uso: { especialistas, sucursales } }`, para que la UI muestre "X de Y especialistas".

## ✅ Verificación
- Unit tests de `moduloPermitido` y `puedeAgregarEspecialista` por plan.
- `GET /suscripcion` devuelve límites y uso coherentes con el seed.

## Trazabilidad
- `_MODELO §6`. ADR-009 (catálogo en código), ADR-P3.
