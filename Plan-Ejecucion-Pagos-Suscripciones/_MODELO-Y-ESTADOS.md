# Modelo de datos y máquina de estados de la suscripción

> Fuente de verdad del comportamiento. Define los **estados**, las **transiciones**, las **fechas** y las **reglas de acceso**. Todo el plan se apoya aquí.

---

## 1. Estados de la suscripción (`estado_suscripcion`)

Hoy el enum tiene solo `activa` / `suspendida`. Se **amplía** a:

| Estado | Significado | ¿Tiene acceso a la app? | ¿Entra al cobro recurrente? |
|---|---|---|---|
| `prueba` | Prueba gratis de 15 días, sin método de pago | **Sí** (completo, del plan elegido) | No |
| `activa` | Pago al día | **Sí** | Sí |
| `en_gracia` | Un cobro falló; en ventana de reintentos (≤ 7 días) | **Sí** (con aviso de pago pendiente) | Sí (reintentos diarios) |
| `suspendida` | Sin acceso: prueba vencida sin pago **o** gracia agotada **o** suspensión del operador | **No** (login muestra aviso) | No (hasta reactivar) |
| `cortesia` | El operador asignó beneficios de un plan **sin cobro** (para pruebas) | **Sí** (del plan asignado) | **No** |
| `cancelada` | El cliente canceló (opcional, terminal) | **No** | No |

> **Regla de acceso (ADR-P2):** `prueba | activa | en_gracia | cortesia` ⇒ **acceso**; `suspendida | cancelada` ⇒ **bloqueo** (login muestra el aviso correspondiente). El front (`auth.tsx`) y el backend (guard) usan exactamente esta regla.

`negocio.estadoSuscripcion` se mantiene **sincronizado** con `suscripcion.estado` (el `negocio` es lo que lee `auth/me`). Se actualizan juntos en cada transición.

---

## 2. Campos nuevos en `suscripcion`

```
plan                  plan_suscripcion   (ya existe)
num_especialistas     integer            (ya existe)
estado                estado_suscripcion (ampliado)
trial_fin             timestamptz null   -- fin de la prueba (creado_en + 15 días)
dia_cobro             integer null       -- día del mes ancla (1..28) del cobro recurrente
proximo_cobro         timestamptz null   -- fecha del próximo intento de cobro
ultimo_cobro_ok       timestamptz null   -- último cobro exitoso
mp_customer_id        text null          -- id del Customer de Mercado Pago
mp_card_id            text null          -- id de la tarjeta guardada (Card) del Customer
mp_payer_email        text null          -- email del pagador usado en Mercado Pago
metodo_ultimos4       text null          -- "**** 4242" para mostrar en la UI
intentos_fallidos     integer default 0  -- contador de reintentos de la morosidad
gracia_inicio         timestamptz null   -- cuándo empezó la ventana de gracia (para el corte a 7 días)
```

> `dia_cobro` se fija **1..28** para evitar problemas con meses cortos (si alguien empieza el 31, ancla en 28). Se calcula al **primer pago exitoso**.

---

## 3. Campos en `cobro` (ya existe, se usa tal cual + 1 campo)

```
periodo               'YYYY-MM'          (ya existe)
monto                 numeric            (ya existe)
estado                pendiente|pagado|fallido (ya existe)
referencia            text unique        (ya existe; idempotencia del webhook / external_reference)
mp_payment_id         text null          (renombrar el `wompi_transaction_id` existente al id de pago de Mercado Pago)
intento               integer default 1  -- nº de intento dentro del período (nuevo)
```

---

## 4. Diagrama de transiciones

```
                 ┌──────────── registro: "pagar ya" ─────────────┐
                 v                                                │
[nuevo] ──"prueba"──▶ (prueba) ──trialFin vence, sin pago──▶ (suspendida)
                         │                                         ▲
                         │ agrega método + primer pago OK          │ gracia agotada (7 días)
                         v                                         │
                      (activa) ◀──pago OK── (en_gracia) ──┐        │
                         │  ▲                  ▲           │        │
       cobro mensual ────┘  │                  │ cobro     │ reintento falla 7 días
       OK (renueva)         │ pago OK          │ falla     │
                            │                  │           └────────┘
            reactiva (paga) │                  │
       (suspendida) ────────┘          (activa) ──cobro falla──▶ (en_gracia)

       Operador:  cualquier estado ──"dar cortesía"──▶ (cortesia)
                  (cortesia) ──"quitar cortesía"──▶ (suspendida | el estado previo)
```

### Transiciones, en palabras
- **Registro · prueba:** `nuevo → prueba`. `trial_fin = now + 15 días`. Sin método de pago.
- **Registro · pagar ya:** `nuevo → (ingresa método) → primer cobro OK → activa`. `dia_cobro = day(now)`, `proximo_cobro = +1 mes`.
- **Fin de prueba sin pago:** cron detecta `prueba` con `trial_fin < now` → `suspendida`.
- **Prueba → pago:** el cliente agrega método y paga → `activa` (igual que "pagar ya").
- **Cobro mensual OK (`activa`):** registra `cobro` pagado, `ultimo_cobro_ok = now`, `proximo_cobro = +1 mes`, `intentos_fallidos = 0`.
- **Cobro falla (`activa` → `en_gracia`):** `gracia_inicio = now`, `intentos_fallidos = 1`; se reintenta **a diario**.
- **Reintento OK (`en_gracia` → `activa`):** limpia gracia, renueva período.
- **Gracia agotada (`en_gracia` → `suspendida`):** si pasaron **≥ 7 días** desde `gracia_inicio` sin éxito → suspende.
- **Reactivar (`suspendida` → `activa`):** el cliente actualiza método y paga (o el operador lo reactiva).
- **Cortesía (operador):** `* → cortesia` (sin cobro). Quitar cortesía → vuelve a `suspendida` (o re-evalúa).

---

## 5. Reglas de cobro (monto)

- **Monto** de cada cobro = `PlanService.cargoMensual(plan, num_especialistas)` = `precioBase + max(0, num_especialistas − incluidos) × costoEspecialistaAdicional`.
- En **cambio de plan / nº especialistas** (FASE-09): el nuevo monto aplica desde el **siguiente** período; opcionalmente se hace **prorrateo** del período en curso (se decide en FASE-09; por defecto: sin prorrateo, cambio al próximo ciclo, pero el **límite** de acceso se aplica de inmediato).

---

## 6. Reglas de límite por plan (lo que "restringe el acceso")

1. **Módulos por plan:** cada plan permite un set de módulos/funciones (de `plan-registry.funciones`). Un módulo activado en config **solo surte efecto** si el plan lo permite. El `ModuloGate` valida **config ∧ plan**.
2. **Cupo de especialistas:** no se puede tener **más especialistas activos** que `suscripcion.num_especialistas`. `equipo.crear` valida el cupo y **bloquea** con mensaje + CTA "sube tu plan".
3. **Sucursales:** `num activas ≤ plan.maxSucursales` (ya hay `puedeAgregarSucursal`; se conecta al guard).
4. **Reportes/marketing/roles/api:** las pantallas/acciones premium se ocultan o bloquean según `plan.funciones`.

> Todo límite se valida en el **backend** (ADR-P3). La UI solo muestra el estado y el CTA de upgrade.

---

## 7. El cron (resumen; detalle en FASE-06/07)

Un **job diario** (ScheduleModule ya está en `app.module`) hace, en orden:
1. **Prueba vencida:** `prueba` con `trial_fin < now` → `suspendida`.
2. **Cobro del día:** `activa` con `proximo_cobro ≤ now` → intenta cobrar la **tarjeta guardada** (Customer + Card de Mercado Pago).
3. **Reintentos:** `en_gracia` → reintenta; si OK → `activa`; si `now − gracia_inicio ≥ 7 días` → `suspendida`.

Idempotente: si ya hay un `cobro` `pagado` para el período, no recobra.
