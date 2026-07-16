# FASE-04 · Prueba gratis de 15 días

## Objetivo
Que un negocio en `prueba` opere con **acceso completo de su plan** durante 15 días sin método de pago, y que al **vencer** pierda el acceso hasta pagar.

## Prerrequisitos
- FASE-00 (estado `prueba`, `trial_fin`), FASE-03 (registro lo crea).

## Pasos

### 🤖 Backend
1. **Acceso durante la prueba:** `tieneAcceso('prueba')` = true (ya en FASE-00). La app funciona normal, con los **límites del plan elegido** (FASE-08).
2. **Expiración:** el cron diario (FASE-06) hace el corte real, pero además un **guard de acceso** verifica en cada request: si `estado='prueba'` y `trial_fin < now` → trata la cuenta como **sin acceso** (no esperar al cron). Al detectarlo, transiciona a `suspendida` (idempotente).
3. **Días restantes:** `GET /suscripcion` devuelve `trialDiasRestantes` para el banner.

### 🤖 Frontend
4. **Banner de prueba** (en el panel admin): "Te quedan N días de prueba — agrega tu método de pago" con CTA a la pantalla de facturación (FASE-11). Cambia de tono al acercarse a 0.
5. **Prueba vencida:** al expirar, el login/guard muestra el aviso "Tu prueba terminó — agrega un método de pago para continuar" con CTA a pagar (FASE-05). (Reutiliza el patrón del aviso "Cuenta suspendida".)

## ✅ Verificación
- E2E: cuenta en `prueba` con `trial_fin` futuro → entra y opera; banner muestra días restantes.
- E2E: cuenta en `prueba` con `trial_fin` pasado (sembrada) → **no** entra; ve el aviso de prueba vencida.
- El corte no depende solo del cron (el guard lo aplica en caliente).

## Trazabilidad
- HU-ADM-001 (prueba). `_MODELO §1, §4`.
