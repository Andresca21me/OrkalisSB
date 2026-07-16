# FASE-09 · Cambio de plan y de nº de especialistas

## Objetivo
Que el cliente pueda **subir/bajar de plan** o **cambiar el nº de especialistas** que paga, que el **límite de acceso** se reasigne de inmediato y que el **cobro** refleje el nuevo monto.

## Prerrequisitos
- FASE-05/06 (cobro), FASE-08 (límites aplicados).

## Pasos

### 🤖 Backend
1. **`PATCH /suscripcion/plan`** (admin): `{ plan?, numEspecialistas? }`.
   - Validar: el nuevo `numEspecialistas` **no puede ser menor** que los especialistas activos actuales (o exigir desactivar primero); plan válido.
   - Actualizar `suscripcion` (plan, numEspecialistas). **El límite nuevo aplica de inmediato** (FASE-08 ya lo lee de la suscripción).
   - **Cobro del cambio (política, decidir contigo):**
     - **Por defecto (simple):** el nuevo monto aplica desde el **próximo** `proximo_cobro`; sin cobro inmediato. El acceso/límite sí cambia ya.
     - **Opción prorrateo (avanzada):** cobrar/abonar la diferencia del período en curso al instante contra la **tarjeta guardada** (Customer + Card de Mercado Pago). (Marcar como mejora si no la quieres ahora.)
   - Recalcular `cupos` de mensajería (FASE-01) con el nuevo plan/nº.
2. **Upgrade desde "cupo lleno":** el flujo de FASE-08 (botón "Sube tu plan") llega aquí: sube `numEspecialistas` (o de plan) → puede crear el especialista que faltaba.

### 🤖 Frontend
3. **Pantalla "Cambiar plan"** (en facturación/suscripción del admin): comparar planes, mover el nº de especialistas con el monto en vivo (reusa la lógica de la calculadora del sitio), confirmar.
4. Tras confirmar, refrescar `auth/me`/`suscripcion` para que los límites nuevos surtan efecto en la sesión.

## ✅ Verificación
- E2E: `basico`→`pro` → la API ya permite inventario; el monto del próximo cobro = `cargoMensual(pro, n)`.
- E2E: subir `numEspecialistas` de 2→3 → ahora **sí** se puede crear el 3.er especialista; el próximo cobro sube por el adicional.
- E2E: intentar bajar el nº por debajo de los activos → rechazo claro.

## Trazabilidad
- Reglas de negocio #5 (upgrade). HU-PLT-001 (monto). `_MODELO §5`.
