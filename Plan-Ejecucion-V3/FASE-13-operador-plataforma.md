# FASE-13 · Operador de plataforma (PLT)

## Objetivo
Probar la consola del Operador de Plataforma y su **efecto cruzado** sobre los tenants: listar/filtrar negocios con su suscripción, ver el **detalle** (suscripción, cobros, cupos), **generar cobro**, y **suspender/reactivar** una cuenta — verificando que la suspensión se refleja en el **login** de los usuarios de ese tenant (HU-PLT-002) y que la reactivación restaura el acceso con datos intactos.

## Prerrequisitos
- FASE-00, FASE-01. Operador del seed. ⚠️ Destructiva (suspende tenants): **reactivar** o re-sembrar al final; correr al final del plan.

## Pantallas / rutas bajo prueba
- `PlataformaApp` (`/plataforma`) — `apps/web/src/pages/plataforma/PlataformaApp.tsx` + `usePlataforma`.
- Cruce: `LoginPage` de un usuario del tenant suspendido.

## Casos de prueba

### Lista y detalle (HU-PLT-001)
1. **Listar tenants**: el operador ve los negocios con plan, nº especialistas, sucursales, cargo mensual, estado y último cobro; KPIs de plataforma (total, MRR, activas, suspendidas) coherentes.
2. **Buscar/filtrar**: filtrar por estado (todos/activas/suspendidas) y buscar por nombre reduce la lista.
3. **Detalle del tenant**: abrir la ficha muestra suscripción, nº sucursales, **historial de cobros** y **uso de cupos** (límite del plan vs consumo del período).
4. **Estados**: carga/vacío/error de la consola.

### Cobro (HU-PLT-001)
5. **Generar cobro**: generar el cobro de un tenant → aparece en su historial con monto/período/estado "pendiente"; el "último cobro" de la lista se actualiza (tras recargar).

### Suspender / reactivar (HU-PLT-002) — flujo cruzado
6. **Suspender (con confirmación)**: suspender la **Barbería** (confirmación destructiva) → su estado pasa a "suspendida" en la lista y el detalle.
7. **Efecto en el login del tenant**: un usuario de la barbería (admin/recepción/especialista) intenta iniciar sesión → ve el **aviso de cuenta suspendida** y **no** accede al panel; sus datos se conservan.
8. **Reactivar**: reactivar la cuenta → estado "activa"; el mismo usuario ahora **sí** entra a su panel con los datos intactos.
9. **Aislamiento del efecto**: suspender la barbería **no** afecta el login del salón (sus usuarios siguen entrando).

### Permisos
10. **Solo el operador accede**: un admin de tenant no puede entrar a `/plataforma` (refuerzo RBAC, ya en FASE-01) y no ve la consola.

## Datos de prueba
- Operador del seed. Suspender/reactivar la **Barbería** dentro de la misma prueba (suspender → verificar login bloqueado → reactivar → verificar login OK) para dejar el entorno limpio. Re-sembrar si algo queda inconsistente.

## Huecos de testabilidad
- Lista: `data-testid="tenant-row-{id}"`, `tenant-estado`, KPIs `kpi-mrr|kpi-activas|kpi-suspendidas`.
- Acciones: `data-testid="tenant-suspender|tenant-reactivar|tenant-cobrar"`, confirmación `confirm-suspender`.
- Detalle: `data-testid="tenant-detalle"`, cupos `cupo-{canal}`, cobro `cobro-row-{i}`.
- Aviso de login suspendido: `data-testid="cuenta-suspendida"` (compartido con FASE-01).

## Verificación / Done
- Lista/detalle/cobro/suspensión/reactivación funcionan en la UI.
- La suspensión bloquea el login del tenant y la reactivación lo restaura (cruzado), aislado por tenant.
- Solo el operador accede a la consola.
- `specs/13-plataforma/*` verde; tenants reactivados/re-sembrados al final.

## Trazabilidad
- HU-PLT-001, HU-PLT-002; flujo cruzado PLT→login del tenant (`_MATRIZ §2`). ADR-009 (planes), ADR-003 (RBAC). Construido sobre v2-FASE-13.
