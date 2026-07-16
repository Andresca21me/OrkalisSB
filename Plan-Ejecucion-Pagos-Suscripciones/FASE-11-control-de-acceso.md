# FASE-11 · Control de acceso y experiencia por estado

## Objetivo
Que la app se comporte correctamente según el estado de la suscripción en **todos** los puntos de entrada: login, guard de rutas, banners, y una **pantalla de facturación** donde el cliente paga / actualiza su método. Unifica el comportamiento de prueba, morosa y suspendida.

## Prerrequisitos
- FASE-00 (`tieneAcceso`), FASE-04/05/07 (estados).

## Pasos

### 🤖 Backend
1. **Guard de acceso** global (NestJS): para roles de tenant (admin/recepción/especialista), si `!tieneAcceso(estado)` → 402/403 con un código claro (`SUSCRIPCION_BLOQUEADA`) y el motivo (`prueba_vencida` | `morosa` | `suspendida`). El operador no se ve afectado.
2. **`GET /suscripcion`**: estado, plan, límites, uso, `trialDiasRestantes`, `metodoUltimos4`, `proximoCobro`, último cobro y motivo de bloqueo si aplica.

### 🤖 Frontend
3. **`auth.tsx`**: generalizar `cuentaSuspendida` → `accesoBloqueado` usando `tieneAcceso(estado)`; el login muestra el aviso según el motivo:
   - `prueba_vencida`: "Tu prueba terminó — agrega un método de pago".
   - `morosa`/`suspendida`: "Tu cuenta está suspendida por falta de pago — actualiza tu método".
   - Con CTA a la **pantalla de facturación**.
4. **`Protegido`**: si `accesoBloqueado` → redirige a una **pantalla pública de facturación/checkout** (no al panel), donde puede pagar y recuperar acceso (reusa FASE-05).
5. **Pantalla de facturación** (admin, sección Suscripción ampliada): muestra plan, estado, próximo cobro, **método de pago** (últimos 4 + "cambiar tarjeta"), historial de cobros, botones **"Pagar ahora"**, **"Actualizar método"**, **"Cambiar plan"** (FASE-09).
6. **Banners** por estado: prueba (días restantes), `en_gracia` ("no pudimos cobrar, reintentaremos / paga ahora").

## ✅ Verificación
- E2E: cada estado produce la experiencia correcta — `prueba` (entra + banner), `en_gracia` (entra + aviso), `suspendida`/`prueba_vencida` (no entra, ve checkout), `cortesia` (entra normal).
- E2E: una cuenta suspendida por morosidad **paga** en la pantalla de facturación → recupera acceso (vuelve a `activa`).
- El operador nunca se bloquea por estos guards.

## Trazabilidad
- Reglas #2, #4. `_MODELO §1` (acceso). Generaliza HU-PLT-002 (aviso suspendida).
