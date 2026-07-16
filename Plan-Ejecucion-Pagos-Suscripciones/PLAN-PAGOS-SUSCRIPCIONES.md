# Plan de Ejecución · Pago de suscripciones con Mercado Pago

> **Objetivo único:** dejar **100 % funcional** el ciclo de vida de la suscripción de un negocio en Orkalis: registro (con **prueba gratis de 15 días** o **pago inmediato**), **cobro recurrente mensual** vía **Mercado Pago**, **morosidad → suspensión automática**, **límites por plan** (módulos + cupo de especialistas), **cambio de plan**, y herramientas del **operador** (cortesía sin cobro). Incluye la **guía paso a paso de lo que debes hacer tú en Mercado Pago**.

---

## 1. Cómo leer este plan

- **`_GUIA-MERCADOPAGO-PASO-A-PASO.md`** — TODO lo que **tú (el USUARIO)** debes hacer en el panel de Mercado Pago (crear cuenta y aplicación, sacar credenciales, configurar el webhook, tarjetas de prueba) con instrucciones literales y dónde pegarme cada dato. **Empieza por aquí en la FASE-02.**
- **`_MODELO-Y-ESTADOS.md`** — el modelo de datos y la **máquina de estados** de la suscripción (la fuente de verdad del comportamiento). Léelo antes de FASE-00.
- **`FASE-00`…`FASE-12`** — los pasos de implementación, en orden. Cada fase dice qué hace el código y, cuando aplique, **qué tienes que hacer o pasarme tú** (marcado con 🧑‍💻 **TÚ**).

Convención de marcas en las fases:
- 🤖 **YO** — lo implemento en el código.
- 🧑‍💻 **TÚ** — acción manual tuya (en Mercado Pago, en un `.env`, decisión de negocio) — te guío literalmente.
- ✅ **Verificación** — cómo comprobamos que quedó bien (prueba automática o manual).

---

## 2. Estado actual del código (punto de partida real)

Ya existe una base; **no partimos de cero**, pero falta lo central del cobro recurrente:

| Pieza | Estado hoy | Qué falta |
|---|---|---|
| `negocio.estadoSuscripcion` | enum **`activa` / `suspendida`** | Agregar `prueba`, `en_gracia` (morosa), `cortesia`, `cancelada` |
| Tabla `suscripcion` | `plan`, `numEspecialistas`, `estado` | Fechas (`trialFin`, `diaCobro`, `proximoCobro`), método de pago (Customer + Card de Mercado Pago), intentos |
| Tabla `cobro` | `periodo`, `monto`, `estado` (pendiente/pagado/fallido), `referencia`, `wompiTransactionId` | Renombrar el id de transacción a `mpPaymentId` y vincular a reintentos / al pago real |
| `plan-registry.ts` | precios, incluidos, cupos, **funciones por plan** | Mapear plan→módulos permitidos y exponer "puede agregar especialista" |
| `plan.service.ts` | `cargoMensual()`, `maxSucursales()`, `cupos()` | `puedeAgregarEspecialista()`, `modulosPermitidos()` |
| `WompiClient` (de la base anterior) | **checkout URL** (redirección) + verificación de firma del webhook | **Reemplazar por `MercadoPagoClient`**: tokenización de tarjeta → Customer+Card guardada → cobro recurrente vía `POST /v1/payments` |
| `equipo.service.crear` | recalcula el cargo al sumar especialista | **No bloquea** si excede el cupo pagado → hay que **limitar** |
| `ModuloGate` | bloquea por **config** (toggle) del negocio | Debe respetar también el **plan** |
| Operador (`PlataformaApp`) | suspender / reactivar / generar cobro | Agregar **cortesía** (asignar plan sin cobro) |
| Registro de negocio | **No existe** (el funnel del sitio es maqueta) | Endpoint público de **alta** + flujo prueba/pago |
| Cobro recurrente | **No existe** | Cron diario + aniversario + reintentos + auto-suspensión |
| `auth` (front) | bloquea login si `estadoSuscripcion === suspendida` | Generalizar a los nuevos estados (prueba vencida, morosa) |

**Dato técnico clave (Mercado Pago):** Mercado Pago **sí** ofrece "Suscripciones" nativas (preapprovals), pero **no las usamos** porque nuestro cobro es de **monto variable** (plan + nº especialistas), con **cuentas de cortesía** sin cobro y una **lógica propia de gracia/suspensión** — más control del que da el preapproval. Implementamos la recurrencia **nosotros**: el front **tokeniza** la tarjeta con el SDK (Public Key); el backend crea un **Customer** y **guarda la tarjeta** (Customer + Card); luego **nuestro** cron genera un **pago** (`POST /v1/payments`) contra esa tarjeta cada mes. A diferencia de Wompi, la **URL del API es la misma en test y producción** (`https://api.mercadopago.com`): el ambiente lo decide la credencial. Todo esto está detallado en `_GUIA-MERCADOPAGO` y FASE-02/05/06.

---

## 3. Reglas de negocio a implementar (lo que pediste, formalizado)

1. **Registro nuevo** → dos caminos, ambos ofrecidos:
   - **Prueba gratis 15 días** sin método de pago. Acceso completo del plan elegido durante 15 días.
   - **Pagar de una vez** → ingresa método de pago y se cobra el primer mes ya.
2. **Fin de la prueba (día 15)** → se **quita el acceso** hasta que ingrese método de pago y se efectúe el primer cobro.
3. **Cobro recurrente mensual** en el **día-aniversario** en que empezó a pagar (`diaCobro`).
4. **Morosidad:** si el cobro automático no se logra, se **reintenta** durante **7 días**; si en una semana no se efectúa → **suspensión automática** hasta que actualice el método de pago o entre el cobro.
5. **Límites por plan, de verdad:**
   - El plan elegido (básico/pro/premium/empresarial) **restringe** funciones/módulos a los de ese nivel.
   - El **cupo de especialistas** pagado **bloquea** la creación de más especialistas si lo excede.
   - Botón para **subir de plan / sumar especialistas** → recobra y **reasigna el límite** nuevo.
6. **Operador — cortesía:** asignar a una cuenta los **beneficios de un plan sin generar cobro** (para que el desarrollador pruebe).
7. **Cobro correcto:** el monto siempre = `cargoMensual(plan, numEspecialistas)` (base + adicionales). Se verifica en cada cobro.

---

## 4. Arquitectura / decisiones (ADR de este plan)

- **ADR-P1 · Recurrencia propia sobre tarjeta guardada de Mercado Pago (Customer + Card), no preapproval nativo.** Guardamos `mpCustomerId` + `mpCardId` por negocio; un cron mensual genera un `POST /v1/payments` contra esa tarjeta (transacción iniciada por el comercio). Se descarta el preapproval nativo porque nuestro monto es variable (plan + especialistas), hay cuentas de cortesía sin cobro y una lógica de gracia/suspensión propia que el preapproval no expone con el mismo control.
- **ADR-P2 · Estado de suscripción como única fuente de acceso.** El acceso a la app se decide por `negocio.estadoSuscripcion` + fechas; `prueba`/`activa`/`en_gracia`/`cortesia` ⇒ acceso, `suspendida`/`cancelada` ⇒ bloqueo. (Ver `_MODELO-Y-ESTADOS`.)
- **ADR-P3 · Límites en el backend, no solo en la UI.** Cada límite (módulo por plan, cupo de especialistas, sucursales) se valida en un **guard/servicio del API**; la UI solo lo refleja. Nunca confiar en el front.
- **ADR-P4 · Idempotencia del cobro y del webhook.** Cada cobro tiene una `referencia` única que viaja como `external_reference` y como `X-Idempotency-Key` del pago; el webhook de Mercado Pago se procesa una sola vez por referencia / `mpPaymentId`.
- **ADR-P5 · Modo prueba primero.** Todo se construye y prueba con las **credenciales de prueba** de Mercado Pago y tarjetas de prueba; el paso a producción es un cambio de credenciales controlado (FASE-12). La URL del API no cambia entre ambientes.
- **ADR-P6 · Cortesía = estado terminal sin cron.** Una cuenta `cortesia` tiene acceso del plan asignado y **no** entra al cobro recurrente.

---

## 5. Mapa de fases

| Fase | Archivo | Qué deja listo | ¿Acción tuya? |
|---|---|---|---|
| 00 | `FASE-00-modelo-y-migracion.md` | Modelo de datos + migración (estados, fechas, método de pago MP, intentos) y máquina de estados | — |
| 01 | `FASE-01-catalogo-y-limites.md` | `plan-registry`/`PlanService`: módulos por plan, `puedeAgregarEspecialista`, cupos | — |
| 02 | `FASE-02-mercadopago-cuenta-y-cliente.md` | **Cuenta/app Mercado Pago (test) + credenciales + webhook** y `MercadoPagoClient` real (Customer+Card, tokens, pago) | 🧑‍💻 **sí (Mercado Pago)** |
| 03 | `FASE-03-registro-negocio.md` | Endpoint público de **alta** + pantallas de registro (sitio) | — |
| 04 | `FASE-04-prueba-15-dias.md` | Estado `prueba`, `trialFin`, expiración → bloqueo | — |
| 05 | `FASE-05-primer-pago-y-metodo.md` | Tokenización + Customer+Card guardada + primer cobro → `activa` | 🧑‍💻 tarjetas de prueba |
| 06 | `FASE-06-cobro-recurrente.md` | Cron mensual por aniversario → genera y cobra | — |
| 07 | `FASE-07-morosidad-y-suspension.md` | Reintentos 7 días (`en_gracia`) → auto-suspensión + avisos | — |
| 08 | `FASE-08-limites-por-plan.md` | Aplicación real de límites (módulos, especialistas, sucursales) en toda la app | — |
| 09 | `FASE-09-cambio-de-plan.md` | Upgrade/downgrade + nº especialistas + prorrateo + reasignar límite | — |
| 10 | `FASE-10-operador-cortesia.md` | Operador: asignar plan/beneficios **sin cobro** + gestión de método de pago | ✅ |
| 11 | `FASE-11-control-de-acceso.md` | Login/banner por estado (prueba, por vencer, morosa, suspendida) + pantalla de facturación | ✅ |
| 12 | `FASE-12-pruebas-y-produccion.md` | Pruebas unitarias + E2E (test/mocks), gate, y **paso a producción de Mercado Pago** | 🧑‍💻 **sí (credenciales prod)** |

---

## 6. Tablero (se marca al avanzar)

- ✅ FASE-00 Modelo y migración
- ✅ FASE-01 Catálogo y límites
- ✅ FASE-02 Mercado Pago: cuenta y cliente (3 credenciales validadas contra el sandbox real; falta solo URL ngrok cuando quieras probar webhooks originados por MP)
- ✅ FASE-03 Registro de negocio
- ✅ FASE-04 Prueba 15 días
- ✅ FASE-05 Primer pago y método (primer pago = cobro directo del token; tarjeta guardada para recurrencia. Cobro de tarjeta guardada NO testeable en sandbox MP → se verifica con mock + producción)
- ✅ FASE-06 Cobro recurrente (cron diario + reloj inyectable + trigger manual del operador; verificado con mock)
- ✅ FASE-07 Morosidad y suspensión (reintentos diarios en gracia → corte a 7 días → suspendida; reactivación; evento de morosidad como seam de avisos)
- ✅ FASE-08 Límites por plan (ModuloGate config∧plan; bloqueo de cupo de especialistas = max(pagados, incluidos); sucursales ya estaba; UI con cupo "X de Y" + candados de módulo. Resuelto el hallazgo: barbería demo → Premium)
- ✅ FASE-09 Cambio de plan — v2 con proceso claro y prorrateo (POST /suscripcion/cambiar/preview clasifica subida/bajada/lateral y calcula montos; POST /suscripcion/cambiar aplica: SUBIDA en cuenta activa cobra el PRORRATEO de la diferencia con tarjeta presente y mantiene la fecha de cobro [si no llega tarjeta → requiere_pago]; BAJADA/lateral aplica de inmediato sin cobro [monto menor al próximo ciclo]; trial/cortesía aplica sin cobro. GET /suscripcion/planes expone el catálogo. UI: comparación de planes con lo que ofrece cada uno + diálogo de confirmación con preview, consecuencias claras y brick de pago al subir. PATCH /suscripcion/plan se mantiene como cambio "crudo" interno. Verificado: 168 tests API [+5 de prorrateo/preview], build web, y smoke en vivo [catálogo, preview, prorrateo 53.333 en cuenta activa, bajada inmediata])
- ✅ FASE-10 Operador · cortesía (POST /plataforma/negocios/:id/cortesia {plan,numEspecialistas} → estado cortesia sin cobro y excluido del cron; /cortesia/quitar → suspendida; vía máquina de estados. Detalle expone método (•••• últimos4) y próximo cobro. Consola: acciones "Dar/Quitar cortesía" + modal plan/nº + badge Cortesía. Verificado E2E en vivo: RBAC 403 no-operador, cortesía Pro da acceso a los 3 módulos avanzados, quitar → suspendida → login 403 SUSCRIPCION_BLOQUEADA)
- ✅ FASE-11 Control de acceso (guard global `SuscripcionAccesoGuard` con `@AccesoFacturacion()` → sesión LIMITADA: login/refresh ya no bloquean, una cuenta sin acceso obtiene token solo para ver/pagar facturación; el resto del panel sigue dando 403 `SUSCRIPCION_BLOQUEADA`. `GET /suscripcion` ampliado con método (últimos4), próximo cobro, historial y bloqueo. Front: `Protegido` redirige a `/recuperar` (pantalla de pago que reusa el brick de FASE-05 → al pagar refresca sesión y entra); banner de `en_gracia`; SuscripcionScreen con facturación + historial + "Pagar ahora". Verificado: 163 tests API (incl. login-bloqueado→sesión limitada, /suscripcion accesible, endpoint normal 403), build web OK, E2E prueba.spec → /recuperar, y smoke en vivo del flujo completo)
- 🟢 FASE-12 Pruebas y gate ✅ / Producción pendiente (🧑‍💻 TÚ): **API Jest 168/168**, tsc+lint limpios, **E2E Playwright 122 passed** (contra API de producción, retries=1; todas las áreas de Pagos en verde). Regresión expuso y se corrigieron 3 bugs de Pagos (suspensión → `/recuperar`; consola: suspender en cortesía; ConfigScreen candado de módulo operativo) + se **robustecieron** 2 E2E cross-role de `05-recepcion` (frágiles al orden, ajenos a Pagos) con esperas de tablero + `test.slow()` + retries → verde reproducible. Mock de MP para CI listo. **Falta solo el paso a producción** (credenciales `APP_USR-…` + webhook de producción + compra real) — ver `_HALLAZGOS-Y-PRODUCCION.md §3`.

---

## 7. Definición de "terminado" (DoD del plan completo)

- Un negocio puede **registrarse** y elegir **prueba 15 días** o **pagar ya**; ambos caminos funcionan.
- Al **día 15** sin pago, **pierde acceso**; al pagar, lo **recupera**.
- El **cobro mensual recurrente** se ejecuta solo, en el **día correcto**, por el **monto correcto** (plan + especialistas).
- Si el pago falla **7 días seguidos**, la cuenta se **suspende sola**; al actualizar el método/pagar, se **reactiva**.
- Los **límites del plan** se respetan de verdad (módulos y **cupo de especialistas bloqueado**); **subir de plan** amplía el límite.
- El **operador** puede dar **cortesía** (beneficios sin cobro) a una cuenta para pruebas.
- Todo verificado con **pruebas en modo test de Mercado Pago** y la suite E2E en verde; documentado el paso a **producción**.
