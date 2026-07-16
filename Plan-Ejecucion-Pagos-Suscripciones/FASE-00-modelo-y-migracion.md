# FASE-00 · Modelo de datos y migración

## Objetivo
Dejar la base de datos y los enums listos para todo el ciclo de suscripción: nuevos **estados**, **fechas**, **método de pago** e **intentos**, más una **máquina de estados** central en código. Sin esto, ninguna fase siguiente funciona.

## Prerrequisitos
- Leer `_MODELO-Y-ESTADOS.md`.

## Pasos

### 🤖 Backend
1. **Ampliar enums** (`packages/shared/src/enums.ts` + `db/schema/_shared.ts`):
   - `EstadoSuscripcion`: agregar `Prueba='prueba'`, `EnGracia='en_gracia'`, `Cortesia='cortesia'`, `Cancelada='cancelada'` (mantener `activa`, `suspendida`).
   - Migración del enum Postgres (`ALTER TYPE ... ADD VALUE`).
2. **Migración de `suscripcion`** (`db/schema/tenant.ts`): agregar `trialFin`, `diaCobro`, `proximoCobro`, `ultimoCobroOk`, `mpCustomerId`, `mpCardId`, `mpPayerEmail`, `metodoUltimos4`, `intentosFallidos` (default 0), `graciaInicio` (ver `_MODELO §2`).
3. **Migración de `cobro`**: agregar `intento` (default 1) y **renombrar** `wompiTransactionId` → `mpPaymentId` (text null).
4. **Generar y aplicar la migración** con drizzle-kit (`db:generate` + `db:migrate`).
5. **Máquina de estados** (`pagos/suscripcion-estado.ts`, NUEVO): función pura `transicionar(estadoActual, evento)` con los eventos: `iniciar_prueba`, `pago_ok`, `cobro_falla`, `prueba_vence`, `gracia_agotada`, `reactivar`, `dar_cortesia`, `quitar_cortesia`, `cancelar`. Lanza si la transición es inválida. **Unit-testeable**.
6. **Helper de acceso** (`pagos/acceso.ts`, NUEVO): `tieneAcceso(estado): boolean` = `['prueba','activa','en_gracia','cortesia'].includes(estado)`. Es la **única** regla de acceso; la usan el front y el guard.
7. **Sincronización negocio↔suscripcion:** un servicio `SuscripcionEstadoService.aplicar(negocioId, nuevoEstado, campos)` que actualiza **ambas** tablas en una transacción.
8. **Seed:** dejar los tenants de demo en `cortesia` (así el desarrollador entra sin cobro) salvo uno en `prueba` para probar el flujo.

## ✅ Verificación
- Unit tests de `transicionar` (todas las transiciones válidas e inválidas) y de `tieneAcceso`.
- Migración aplica en limpio (`db:migrate` sobre BD vacía) y el seed corre sin error.
- `GET /auth/me` devuelve el nuevo `estadoSuscripcion` sin romper el front.

## Trazabilidad
- `_MODELO-Y-ESTADOS §1, §2, §4`. ADR-P2.
