# FASE-07 · Admin · clientes (CRM)

## Objetivo
Probar el CRM de clientes: alta, edición, **baja lógica** (no borra histórico) y reactivación, búsqueda/filtrado, y el **historial** que debe reflejar las atenciones completadas y las métricas del cliente (nº servicios, gasto acumulado). El flujo cruzado clave: completar un turno de un cliente aparece luego en su **historial**.

## Prerrequisitos
- FASE-00, FASE-01. Seed barbería (4 clientes con historial). Idealmente FASE-04 (para generar una atención nueva) — o usar el oráculo/seed.

## Pantallas / rutas bajo prueba
- `ClientesScreen` (`apps/web/src/pages/admin/ClientesScreen.tsx`), nav admin "Clientes".

## Casos de prueba

### Listado y búsqueda
1. **Listado con datos**: la pantalla lista los clientes del tenant con sus métricas; estados de carga/vacío/error.
2. **Búsqueda**: filtrar por nombre/teléfono reduce la lista; sin coincidencias muestra el vacío adecuado.
3. **Aislamiento**: el admin barbería ve "Juan Pérez" y NO "Laura Castro" (refuerzo puntual; el grueso en FASE-11).

### Alta / edición
4. **Crear cliente**: alta con nombre + teléfono → aparece en el directorio.
5. **Validación**: nombre demasiado corto/ inválido → el formulario lo impide.
6. **Editar cliente**: cambiar datos de contacto se persiste y se ve al reabrir.

### Baja lógica (borrado lógico)
7. **Marcar inactivo**: dar de baja un cliente lo retira del directorio activo **pero conserva su historial** (verificable: su gasto/servicios siguen existiendo).
8. **Reactivar**: si aplica, reactivar lo devuelve al directorio con su historial intacto.

### Historial y métricas (flujo cruzado: atención → CRM)
9. **Historial refleja atenciones**: abrir el historial de un cliente con atenciones del seed muestra fecha, servicio, especialista, método de pago y monto.
10. **Nueva atención se refleja**: completar un turno de un cliente (vía FASE-04 o recepción) y luego abrir su historial → la nueva visita aparece y el **gasto acumulado / nº de servicios** se incrementa.
11. **Cliente sin servicios**: un cliente recién creado muestra historial vacío con su empty state.

## Datos de prueba
- Clientes del seed (Juan Pérez con historial). Cliente nuevo con nombre/teléfono únicos para alta/edición/baja sin afectar a otros.

## Huecos de testabilidad
- Fila/tarjeta de cliente: `data-testid="cliente-row-{id}"`, métricas `data-testid="cliente-gasto"`, `data-testid="cliente-servicios"`.
- Diálogo de historial: `data-testid="historial-visita-{i}"`.
- Acciones: `data-testid="cliente-nuevo|editar|inactivar"`.

## Verificación / Done
- Alta/edición/baja lógica/reactivación funcionan; la baja conserva histórico.
- Búsqueda y aislamiento cubiertos.
- El historial refleja atenciones existentes y nuevas, con métricas correctas.
- `specs/07-clientes/*` verde y estable.

## Trazabilidad
- HU-ADM-005 (baja lógica conserva histórico, análogo), reglas CRM; flujo cruzado atención→historial (`_MATRIZ §2`). ADR-001 (aislamiento).
