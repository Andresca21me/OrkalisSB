# Hallazgos del módulo de pagos + Checklist de producción (FASE-12)

> Cierre del plan de Pagos/Suscripciones. Resume las decisiones no obvias del
> módulo y deja el paso a producción de Mercado Pago como una lista accionable.

## 1. Hallazgos / decisiones no obvias

### Pasarela
- **Mercado Pago** (no Wompi). API base `https://api.mercadopago.com` — la **misma URL** en test y producción; lo que cambia el entorno es la **credencial** (`TEST-…` vs `APP_USR-…`).
- **Limitación de sandbox (verificada):** cobrar una **tarjeta guardada** (`card_id` → token → `POST /v1/payments`) devuelve **"Card not found"** en sandbox; funciona en producción. Por eso:
  - **Primer pago / recuperación / prorrateo de subida** = cobro directo del **token con tarjeta presente** (brick `cardPayment`), que sí funciona en sandbox.
  - **Recurrencia** (cron mensual) = cobro de la **tarjeta guardada**; se valida con **mock** en CI y con el modo real en producción.
- **Tarjetas de prueba** se fuerzan por el **nombre del titular**: `APRO`=aprobada, `OTHE`/`FUND`=rechazada.
- **Webhook**: firma `x-signature` HMAC-SHA256 sobre el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. El **secreto NO cambia** al rotar el túnel (ngrok); solo cambia la URL → usar un **dominio estático**.

### Acceso y suscripción
- **Sesión limitada (FASE-11):** una cuenta sin acceso (prueba vencida / suspendida) **sí** obtiene token en el login, pero el `SuscripcionAccesoGuard` bloquea todo (403 `SUSCRIPCION_BLOQUEADA`) salvo los endpoints `@AccesoFacturacion()` (ver/pagar facturación). El front la enruta a `/recuperar`.
- **Cupo de especialistas:** `num_especialistas` es el cupo **pagado**, no se auto-cuenta; cupo efectivo = `max(pagados, incluidos)`.
- **Cambio de plan (FASE-09 v2):**
  - **Subida** en cuenta activa → cobra el **prorrateo** de la diferencia por los días que faltan del ciclo (tarjeta presente); la **fecha de cobro no cambia** y el próximo ciclo va al nuevo monto.
  - **Bajada / lateral** → aplica de inmediato **sin cobro**; el monto menor se cobra el próximo ciclo.
  - **Prueba / cortesía** → aplica sin cobro.
- **Cortesía (operador):** asigna beneficios de un plan **sin cobro** y queda **fuera del cron** (el cron solo selecciona `activa`).
- **Morosidad:** cobro rechazado → `en_gracia`; reintentos diarios; a los **7 días** sin éxito → `suspendida`.

### Gotchas técnicos
- **Jest en paralelo:** los specs que corren el `ejecutarCiclo` **global** del cron no pueden convivir en archivos paralelos que comparten BD. Mantener esa prueba en **un solo archivo** (cobro-cron.spec) y verificar exclusiones por **query**, no corriendo el ciclo global desde otro spec.
- **Migración drizzle-kit** con prompts interactivos (rename/create): no acepta pipes; se condujo con un driver PTY.

## 2. Estado de las pruebas (gate FASE-12)
- **API (Jest) ✅ 168/168**: unitarias [máquina de estados (todas las transiciones + inválidas), `calcularCargo`, `cupoEspecialistas`, `puedeAgregarEspecialista`, `moduloPermitido`, firma del webhook HMAC, aniversario `proximo_cobro` (+1 mes anclado a 1..28), corte de gracia ≥ 7 días] + integración [registro prueba → bloqueo → sesión limitada; pagar → activa; cobro recurrente; morosidad → gracia → suspensión → reactivación; límites por plan; cortesía; webhook idempotente; aislamiento entre tenants; **prorrateo de subida**].
- **tsc + lint ✅** (un warning preexistente en `seed.ts`).
- **E2E Playwright (mock MP)**: **122 passed** contra API de producción (build) con `retries=1`. Todas las áreas de Pagos en verde: `01-auth` (cuenta suspendida → `/recuperar`), `10-config/suscripcion`, `13-plataforma` (cortesía + suspender/reactivar), `15-suscripcion` (prueba → `/recuperar`).
- **Mock de Mercado Pago para CI**: doble del `MercadoPagoClient` (aprueba/rechaza sin llamar a la API real).

### Regresiones de Pagos detectadas en la regresión E2E y corregidas
1. **`01-auth/cuenta-suspendida`** y **`13-plataforma/suspension`**: el flujo cambió en FASE-11 (login bloqueado → **sesión limitada → `/recuperar`**, no se queda en `/login`). Specs actualizados + `reseed()` para evitar fuga del estado del salón.
2. **Consola del operador (`PlataformaApp`)**: el menú mostraba "Reactivar" para una cuenta en **cortesía** (la lógica era `activa ? Suspender : Reactivar`). Corregido a `bloqueada(suspendida/cancelada) ? Reactivar : Suspender` → se puede **suspender** cualquier cuenta con acceso.
3. **`ConfigScreen` candado de módulos**: `agendamiento.aprobacion_manual` (módulo **operativo**, disponible en todos los planes) aparecía bloqueado con candado "Plan Pro". Corregido: solo los **3 módulos avanzados** (`inventario`, `particion_por_especialista`, `cierre_periodo`) se gatean por plan.

### Robustez de E2E cross-role (NO relacionado con Pagos) — corregido
- `05-recepcion/reasignar` y `walkin-cobro` (flujos cruzados que abren 2–3 contextos de navegador) eran **frágiles al orden** en la corrida secuencial larga: el **timeout del test (default 30 s)** se agotaba porque, tras ~40 tests + reseeds, el API dev y Chromium se degradan y la agenda no termina de reflejar a tiempo (pasaban en aislamiento/carpeta). **Causa**: contención de recursos del harness, no lógica.
- **Mitigación aplicada** (page objects + specs): `RecepcionPage.listo()` espera el tablero interactivo antes de actuar (`loginUI` solo esperaba el cambio de URL); `refrescar()` y `SpecAgendaPage.abrirAgenda()` esperan render/`networkidle`; `test.slow()` (budget ×3) y `test.describe.configure({ retries: 2 })` en esos flujos pesados. Resultado: **verde reproducible** (el reintento corre con contexto fresco y reseed; un fallo de lógica real fallaría las 3 veces). En el gate sobre API de producción basta 1 retry.

## 3. Checklist de paso a producción (🧑‍💻 TÚ)

> **Guía detallada paso a paso: [`_GUIA-GO-LIVE-MERCADOPAGO.md`](_GUIA-GO-LIVE-MERCADOPAGO.md)** (dónde sacar cada credencial, variables exactas, webhook, ngrok, validación y rollback). Resumen abajo.
>
> La URL del API **no cambia** entre test y producción.

- [ ] **Homologación/activación** de la app en el panel de Mercado Pago (datos legales + cuenta bancaria para retiros + certificación de calidad de la integración, si MP la exige).
- [ ] Copiar las **credenciales de producción** (`APP_USR-…`):
  - `apps/api/.env`: `MP_PUBLIC_KEY=APP_USR-…`, `MP_ACCESS_TOKEN=APP_USR-…`, `MP_WEBHOOK_SECRET=…`, `MP_ENV=production`.
  - `apps/web/.env`: `VITE_MP_PUBLIC_KEY=APP_USR-…`.
- [ ] **Webhook de producción** apuntando al **dominio real** (`POST /api/pagos/webhook`); copiar su **clave secreta** a `MP_WEBHOOK_SECRET`.
- [ ] **Compra real pequeña** de prueba → verificar: cobro aprobado, acreditación/retiro y notificación (webhook) en producción.
- [ ] (Recomendado) **Monitoreo/alertas** de cobros fallidos y de la corrida diaria del cron.

> Tras pegar las claves, **reiniciar la API**. Sin `MP_ACCESS_TOKEN`, el cliente queda en **modo inactivo** (no cobra) — útil para entornos sin pasarela.
