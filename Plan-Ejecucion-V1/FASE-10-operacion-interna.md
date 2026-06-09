# FASE-10 · Operación interna (CRM, servicios, inventario, ventas, gastos, liquidaciones, reportes, cierre)

## Objetivo
Implementar la gestión interna heredada y mejorada de NOVA: clientes/CRM, catálogo de servicios, inventario (opcional), ventas, gastos, liquidaciones por especialista, reportes con exportación CSV/PDF, y cierre de período (opcional). Todo respeta módulos on/off del config y el scope de sucursal.

## Prerrequisitos
- FASE-06 (banderas de módulo), FASE-07 (sucursales/equipo), FASE-09 (cálculo financiero para liquidaciones/reportes).

---

## Pasos de Claude

### 1. Clientes / CRM (RF-033, RF-034)
- CRUD de `cliente` con **borrado lógico** (`activo=false`).
- Historial y estadísticas del cliente (citas, gasto acumulado).
- `get_or_create` por teléfono (ya usado en FASE-08): recuperar o crear cliente al reservar/registrar.

### 2. Catálogo de servicios (RF-035, RF-036)
- CRUD de `servicio` con precio, duración, categoría (del perfil), estado.
- Repartición personalizada: `split_type` (`porcentaje`|`valor_fijo`) + `split_valor`, que alimenta el motor financiero (FASE-09).

### 3. Inventario — **módulo opcional** (RF-037, RF-038)
- Si `modulo.inventario` está OFF: ocultar el módulo y **no exigir** productos en los turnos (HU-ADM-003 escenario 1).
- Si ON: CRUD de `producto` (tipo `servicio`/`venta`), `movimiento_inventario` (entrada/salida/ajuste), **alertas de stock bajo** (`cantidad < stock_min` → estado "Stock bajo" + panel de alertas, HU-ADM-007 escenario 1), valoración del inventario.
- Entrada por compra puede **generar un gasto variable** asociado (RF-038, HU-ADM-007 escenario 2).

### 4. Ventas de productos (RF-039)
- `venta_producto` con **comisión configurable** al profesional (cuando aplique) y **descuento de stock**. Se integra con el cierre del turno (FASE-09) o como venta suelta.

### 5. Gastos (RF-040)
- CRUD de `gasto` fijo/variable por categoría, con `frecuencia` para fijos.
- Eliminar = inactivar (`activo=false`): deja de afectar períodos futuros sin alterar históricos (HU-ADM-008 escenario 2).

### 6. Liquidaciones por especialista — depende de partición (RF-043)
- Si `modulo.particion_por_especialista` está OFF: el módulo de liquidación **no está disponible** y se indica claramente (HU-ADM-009 escenario 2).
- Si ON: calcular liquidación mensual por especialista con desglose (servicios + comisiones de venta), aplicando **descuento por transferencia** cuando corresponda (HU-ADM-009 escenario 1). Exportable (ver §8).

### 7. Reportes y finanzas (RF-042, RF-044)
- Ingresos del salón, total de gastos, **ganancia neta**, **margen**, indicador de salud financiera.
- Reportes financieros y operativos con gráficos; **períodos sin datos** muestran ceros, sin errores ni gráficos vacíos confusos (HU-ADM-010 escenario 2).
- Parametrizados por `negocio_id` y opcionalmente `sucursal_id` (consolidado vs. sucursal).

### 8. Exportación CSV/PDF — en workers (RF-045, RNF-002)
- Exportar análisis financiero, resumen diario y liquidaciones en **CSV (UTF-8 con BOM)** y **PDF**.
- La generación pesada corre en **workers/colas**, no en el hilo de la petición (FASE-11/14 proveen la cola). Devolver un job y notificar/permitir descarga al terminar.

### 9. Cierre de período — **módulo opcional** (RF-046)
- Si `modulo.cierre_periodo` OFF: la opción de cierre **no aparece**; la operación sigue acumulada (HU-ADM-011 escenario 2).
- Si ON: cerrar un período (quincenal/mensual) **archivando** servicios, citas y gastos del período y **reiniciando contadores**, conservando el histórico (`cierre_periodo`).

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna.

---

## Verificación / Done
- CRM: crear/editar/desactivar cliente; historial visible; dedupe por teléfono.
- Servicio con valor fijo y con porcentaje funcionan con el motor financiero.
- Con inventario OFF, no se pide producto y el cálculo opera sin productos; con ON, stock baja, alerta de stock bajo aparece, y la compra puede generar gasto.
- Eliminar un gasto fijo no altera históricos.
- Liquidación: no disponible con partición OFF; con ON aplica descuento por transferencia y desglosa.
- Reportes: período sin datos muestra ceros sin romperse; exportación CSV (con BOM) y PDF se generan en worker.
- Cierre: archiva y reinicia con módulo ON; no aparece con OFF.
- Pruebas de los cálculos de reportes y del comportamiento con módulos OFF.

## Trazabilidad
- RF-033 a RF-046, RNF-002, RNF-015. HU-ADM-006..011, HU-REC-002/003. ADR-002 (módulos), ADR-006 (cálculos).
