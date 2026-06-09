# FASE-09 · Motor de cálculo financiero

## Objetivo
Implementar el **motor de cálculo financiero** como **servicio de dominio puro** que corre **al completar el turno** sobre los servicios/productos **reales**, lee los parámetros efectivos del `ConfigResolver`, **persiste un snapshot** de lo aplicado (auditable) y permite **reversión transaccional** (ADR-006). El **pago es el guard** para `completada` (RF-026/041).

## Prerrequisitos
- FASE-06 (parámetros efectivos: repartición, deducción, comisión, tarifa).
- FASE-08 (transición a `completada` y reversión disparan este motor).
- FASE-03 (`atencion`, `atencion_producto`, `snapshot_param`).

---

## Pasos de Claude

### 1. Funciones de dominio puras (`finanzas/calculo.ts`)
- Entrada: lista de servicios realmente realizados (con su `split_type`/`split_valor`), productos vendidos/consumidos, método de pago, y los **parámetros efectivos** (repartición prof/salón, deducción administrativa, comisión bancaria, tarifa cliente profesional).
- Salida: `total`, `gan_prof`, `gan_salon`, comisiones por venta de producto, deducciones, y el **snapshot** de todos los parámetros usados.
- **Reglas:**
  - Si un servicio tiene `split_type=valor_fijo`: el profesional recibe el valor fijo y el resto va al salón (HU-ADM-006 escenario 1).
  - Si `split_type=porcentaje` o no tiene override: aplica la repartición estándar de la sucursal (HU-ADM-006 escenario 2).
  - Comisión bancaria / descuento por transferencia aplica según método de pago (p. ej. 2% transferencia, HU-ADM-009).
  - Si `modulo.particion_por_especialista` está **OFF**: no se calcula ganancia individual del especialista (las vistas de ganancias del especialista lo reflejan, HU-ESP-009 / HU-ADM-009 escenario 2).
  - Si `modulo.inventario` está **OFF**: el cálculo opera sin componente de productos (HU-ADM-003 escenario 1).
- **Dinero en enteros/`numeric`**, redondeo definido y consistente (es-CO, COP).
- Funciones **puras** y **unit-testeables** (sin tocar BD).

### 2. Completar turno (guard de pago) — transaccional (RNF-009)
- En `POST /api/citas/:id/completar`:
  - Exigir **método de pago** + **servicios realmente realizados** (si faltan → rechazar, RF-026, HU-ESP-004 escenario 2).
  - Dentro de **una transacción**: persistir `cita_servicio` finales, crear `atencion` con `total/gan_prof/gan_salon/metodo_pago/snapshot_param`, registrar `atencion_producto`, **descontar stock** (si inventario activo) y **registrar venta de producto** (si aplica), y transicionar la cita a `completada`.
  - El cálculo corre sobre el **cierre real**, NO sobre `precio_est` (RF-041, Definición §8 nota 7).

### 3. Reversión transaccional (HU-ESP-005 escenario 2, RNF-009)
- Revertir una cita `completada`: dentro de una transacción, **deshacer** ganancias (anular/inversar la `atencion`), **reponer stock**, anular ventas asociadas, y devolver la cita a un estado consistente o `cancelada`. Nunca dejar datos a medias.

### 4. Snapshot e idempotencia
- El `snapshot_param` guarda los porcentajes/valores **vigentes al momento de completar**: si luego cambian los parámetros, las liquidaciones pasadas **no** cambian (auditabilidad, ADR-006).
- Completar dos veces el mismo turno no duplica `atencion`.

---

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar valores por defecto si Claude duda (p. ej. % de descuento por transferencia). Si no responde, usar los que aparecen en la documentación (2% transferencia) como default y dejarlo configurable.

---

## Verificación / Done
- Completar un turno con 2 servicios + 1 producto calcula `gan_prof`/`gan_salon` correctos y coincide con un cálculo a mano.
- Servicio con valor fijo: el profesional recibe exactamente el valor fijo; el resto al salón.
- Intentar completar **sin** método de pago → rechazado.
- Revertir una atención completada repone stock y deshace ganancias dentro de una transacción (probar que un fallo a mitad **no** deja estado inconsistente).
- Cambiar parámetros después de completar **no** altera el snapshot de atenciones previas.
- Con `particion_por_especialista` OFF, no se calculan ganancias individuales.
- Pruebas unitarias del cálculo puro (varios escenarios) + e2e de completar/revertir transaccional.

## Trazabilidad
- ADR-006 completo, ADR-002 (parámetros), ADR-004 (transacciones). RF-026, RF-041, RF-036, RNF-009. HU-ESP-004, HU-ESP-005, HU-ADM-006.
