# FASE-07 · Morosidad, reintentos y suspensión automática

## Objetivo
Que, si el cobro automático **falla**, el sistema **reintente durante 7 días** y, si en esa semana no se logra, **dé de baja** (suspenda) la cuenta automáticamente — hasta que actualice el método de pago o entre el cobro.

## Prerrequisitos
- FASE-06 (un cobro fallido deja la cuenta en `en_gracia`).

## Pasos

### 🤖 Backend (en el mismo cron diario)
1. **Reintento diario:** suscripciones `en_gracia` → reintentar el cobro de la tarjeta guardada (`crearPago`) del período pendiente.
   - `approved` → `pago_ok`: vuelve a `activa`, limpia `gracia_inicio`/`intentos_fallidos`, avanza `proximo_cobro`.
   - `rejected` → `intentos_fallidos += 1`, registra el intento en `cobro.intento`.
2. **Corte a 7 días:** si `now − gracia_inicio ≥ 7 días` (configurable) sin éxito → transición `gracia_agotada` → **`suspendida`** (sincroniza `negocio.estadoSuscripcion`). La cuenta pierde acceso (FASE-11).
3. **Reactivación:** cuando una cuenta `suspendida` por morosidad **actualiza el método** y paga (FASE-05/11), o un reintento entra → `activa`.
4. **Avisos (notificaciones):** al fallar el primer cobro y en cada reintento clave, enviar aviso al admin (email/in-app: "no pudimos cobrar, actualiza tu método"). Reusar el módulo de notificaciones existente.

## ✅ Verificación
- E2E/sandbox: forzar cobro fallido (tarjeta rechazada) → `en_gracia`; el cliente **sigue entrando** con aviso de pago pendiente.
- Simular el paso de 7 días (now inyectado / `gracia_inicio` sembrado) → el cron **suspende** la cuenta; el login muestra el aviso.
- Reintento exitoso dentro de la ventana → vuelve a `activa` sin intervención.
- El aviso al admin se dispara.

## Trazabilidad
- Regla de negocio #4 del plan. `_MODELO §1, §4, §7`.
