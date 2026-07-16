# FASE-06 · Cobro recurrente mensual (motor)

## Objetivo
Que el sistema **cobre solo** cada mes, en el **día-aniversario** del cliente, por el **monto correcto**, contra su fuente de pago.

## Prerrequisitos
- FASE-05 (existe tarjeta guardada `mp_customer_id`/`mp_card_id` y `proximo_cobro`).

## Pasos

### 🤖 Backend
1. **Job programado** (`pagos/cobro-cron.service.ts`, NUEVO) con `@Cron` (ScheduleModule ya está): corre **una vez al día** (p. ej. 09:00 Bogotá). Configurable por env para pruebas.
2. **Selección:** suscripciones `activa` con `proximo_cobro ≤ now` (y sin `cobro` `pagado` para el período → idempotencia).
3. **Cobrar:** por cada una, crear `cobro` del período (`monto = cargoMensual(plan, numEspecialistas)`, `referencia` única) → `tokenizarTarjetaGuardada({ cardId })` → `crearPago({ token, montoCOP, referencia, payerEmail, customerId })`.
   - `approved` → `pago_ok`: `cobro` `pagado`, `ultimo_cobro_ok = now`, **`proximo_cobro += 1 mes`** (anclado a `dia_cobro`), `intentos_fallidos = 0`.
   - `rejected` → `cobro_falla`: `en_gracia`, `gracia_inicio = now`, `intentos_fallidos = 1` (la morosidad la maneja FASE-07).
4. **Aniversario robusto:** `proximo_cobro` se calcula siempre desde `dia_cobro` (1..28) para no derivar con los meses.
5. **Cortesía:** las cuentas `cortesia` se **excluyen** del cron (no se cobran).
6. **Testabilidad:** un endpoint interno protegido `POST /admin/cron/ejecutar` (solo dev/operador) que dispara el ciclo manualmente, y/o variables para "viajar en el tiempo" en pruebas (inyectar `now`).

## ✅ Verificación
- E2E/sandbox: cuenta `activa` con `proximo_cobro` vencido → al ejecutar el cron, se genera un `cobro` `pagado` y `proximo_cobro` avanza un mes exacto.
- Monto = `cargoMensual` (verificado contra plan+especialistas).
- Idempotencia: ejecutar el cron dos veces el mismo día no duplica cobros.
- Cuenta `cortesia` → el cron la ignora.

## Trazabilidad
- HU-PLT-001 (cobro por plan+especialistas). `_MODELO §5, §7`. ADR-P1, ADR-P6.
