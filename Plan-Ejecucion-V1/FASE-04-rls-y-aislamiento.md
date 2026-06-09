# FASE-04 · RLS y aislamiento multi-tenant (NO NEGOCIABLE)

## Objetivo
Activar la **defensa en profundidad** del aislamiento: (1) **Row-Level Security (RLS)** en Postgres como red de seguridad independiente del código, y (2) un **repositorio base** que obliga el scope de tenant/sucursal en cada consulta. Más las **pruebas automatizadas de aislamiento** que deben fallar ante accesos cruzados (RNF-010). Esta es la promesa de robustez de la v1; no se omite ni se simplifica.

## Prerrequisitos
- FASE-03 completa (todas las tablas con `negocio_id`/`sucursal_id`).
- FASE-02 (`runInTenantTx` con la GUC `app.current_tenant`).

---

## Pasos de Claude

### 1. Política RLS por tabla (migración)
Para **cada tabla** que tenga `negocio_id`, crear en una migración:
```sql
ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY;  -- aplica incluso al dueño de la tabla
CREATE POLICY <tabla>_tenant_isolation ON <tabla>
  USING (negocio_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (negocio_id = current_setting('app.current_tenant', true)::uuid);
```
- `USING` filtra lo que se puede LEER; `WITH CHECK` impide INSERT/UPDATE que pongan otro `negocio_id`.
- `current_setting('app.current_tenant', true)` devuelve NULL si no está fijada → la política no deja ver nada (seguro por defecto).
- El **rol de aplicación** con el que se conecta la API **no** debe ser superusuario ni `BYPASSRLS` (si lo fuera, RLS no aplica). Crear un rol dedicado `orkalis_app` con privilegios normales y usarlo en `DATABASE_URL` de la app.

### 2. Scope de sucursal (segundo nivel)
Para tablas **operativas** (con `sucursal_id`), el aislamiento por negocio lo da RLS; el **acotamiento por sucursal** se aplica en la **capa de aplicación** (repositorio base), porque un admin con alcance consolidado SÍ puede ver todas las sucursales de su negocio. No metas el filtro de sucursal en la política RLS de negocio; hazlo en el repositorio según el `TenantContext.sucursalIds`.
- (Opcional avanzado) Si se quiere RLS también por sucursal, usar otra GUC `app.current_sucursales` y una política adicional; pero para v1 basta RLS por negocio + filtro de sucursal en repositorio. Documentar la decisión.

### 3. Repositorio base con scope obligatorio
Crear `apps/api/src/common/base-repository.ts` (o un patrón equivalente con servicios):
- Toda operación recibe el `tx` de `runInTenantTx` (que ya fijó la GUC).
- Para tablas operativas, el repositorio **inyecta automáticamente** el filtro `sucursal_id IN (ctx.sucursalIds)` cuando `sucursalIds !== null`; si es `null` (consolidado), no filtra por sucursal pero RLS sigue acotando al negocio.
- Prohibir el acceso directo a `db`/`tx` sin pasar por este patrón en módulos de dominio (convención + revisión).

### 4. Middleware/Interceptor que arma el `TenantContext`
- Un interceptor de NestJS toma el usuario autenticado (de FASE-05) y construye el `TenantContext` (`negocioId`, `rol`, `sucursalIds`, `sucursalActivaId`).
- Cada handler que toca BD usa `runInTenantTx(ctx, ...)`.
- **Por ahora** (antes de FASE-05) usa un stub que lee el tenant de un header de desarrollo (`x-dev-negocio-id`) para poder probar RLS. Se reemplaza por el JWT en FASE-05.

### 5. Pruebas de aislamiento (OBLIGATORIAS — RNF-010)
Crear pruebas e2e/integración que prueben que **el acceso cruzado falla**:
- Sembrar dos negocios A y B con datos.
- Con `TenantContext` de A, intentar leer una fila de B por su id → **debe devolver vacío** (no error de permiso, simplemente RLS la oculta).
- Con `TenantContext` de A, intentar INSERT/UPDATE poniendo `negocio_id` de B → **debe fallar** por `WITH CHECK`.
- Probar lo mismo a nivel de sucursal vía el repositorio: un usuario con alcance solo a sucursal X no ve citas de sucursal Y del mismo negocio.
- Estas pruebas deben quedar en el pipeline como **gate** (FASE-14).

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna. (Si el rol `orkalis_app` debe crearse en una BD que el USUARIO administra, Claude le da el SQL exacto.)

---

## Verificación / Done
- Todas las tablas tienen RLS habilitada y forzada con su política.
- La app se conecta con un rol **sin** `BYPASSRLS`.
- Las pruebas de aislamiento (negocio y sucursal) pasan: los accesos cruzados devuelven vacío o fallan, nunca filtran datos.
- Quitar la línea `set_config('app.current_tenant', ...)` deja a la app **sin ver nada** (confirma que RLS, no el código, es la última línea de defensa).

## Trazabilidad
- ADR-001 (aislamiento en dos capas, scope obligatorio), ADR-004 (GUC por transacción), RF-005, RF-014, RNF-010. Atributo de calidad "0 fugas / pruebas de acceso cruzado deben fallar".
