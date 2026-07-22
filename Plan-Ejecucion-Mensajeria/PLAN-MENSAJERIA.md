# PLAN-MENSAJERIA · Sistema de mensajería productivo (Twilio) — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Diseña e implementa el **sistema de mensajería completo de Orkalis en producción** (SMS + WhatsApp + Email vía Twilio/SendGrid), con **límites por plan**, **auditoría**, **plantillas configurables por negocio**, **avisos al especialista** y **verificación de especialistas por código**.
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** La implementación es **fase por fase**; no se avanza de fase si su verificación no pasa. Si algo choca con `/Documentacion`, **gana la documentación** y se avisa.
>
> **Estado del análisis:** completo. Este plan se basa en el código real (`apps/api`, `apps/web`, `packages/shared`), en los ADRs (007, 009, 003, 005), el SRS (RF-021, RF-047, RF-048, RF-006, RNF-011) y los planes existentes (`Plan-Ejecucion-V1/FASE-11`, `Plan-Ejecucion-Pagos-Suscripciones/FASE-01/08/09`).

---

## 0. Decisiones de producto ya aprobadas por EL USUARIO

Estas cinco decisiones son la base del diseño (no se re-litigan):

| # | Decisión | Resolución aprobada |
|---|----------|---------------------|
| D1 | Reinicio de cupos | **Alinear al ciclo de cobro** (aniversario `diaCobro`/`proximoCobro`), no al mes calendario. |
| D2 | Al agotar el cupo de un canal | **Marketing: bloqueo duro.** **Transaccional (OTP, confirmación, verificación de especialista, recordatorio): bloqueo blando** → se envía igual, se marca `sobreCupo` y se alerta al admin. |
| D3 | Motor de códigos de verificación | **Twilio Verify** para el especialista (SMS/WhatsApp gestionado). **OTP propio** (tabla `otp_codigo`, argon2) para el cliente de la reserva (ya funciona; no se rompe). |
| D4 | Avisos por mensajería al especialista | Sí, en **cita confirmada/asignada**, **cancelada** y **reagendada**. (No: recordatorio de jornada.) |
| D5 | Plantillas configurables por negocio | **SMS: texto libre** editable. **WhatsApp: plantillas pre-aprobadas por Meta con variables** que el negocio personaliza. |
| D6 | Identidad del remitente (multi-tenant / ISV) | **Modelo objetivo = marca propia por salón.** La arquitectura se diseña ISV-ready desde el día 1 (resolución de remitente por `negocio_id`, subcuentas/Messaging Services como primitivo). **v1 arranca con el "perfil plataforma" por defecto** (todos envían bajo la marca de Orkalis; el cuerpo nombra al salón). El **onboarding productivo de marca propia** (subcuenta Twilio + WhatsApp Embedded Signup + verificación Meta Tech Provider) es un **track ISV separado (FASE-11) que NO bloquea v1**; cada salón se migra cuando pasa por ese track premium. |

> **Nota de reconciliación D6:** EL USUARIO pidió "marca propia desde el inicio" (modelo objetivo) y a la vez "feature premium futura, track aparte" (no bloquea v1). Se resuelve así: **la costura (tabla de remitente + adaptadores que reciben un perfil resuelto) entra al núcleo ya** (no se reescribe nada después); el **trámite con Meta y el alta real de cada marca** viven en el track ISV (FASE-11), fuera del camino crítico de v1.

---

# PARTE I — DIAGNÓSTICO DEL ESTADO ACTUAL

Stack: **NestJS 10 + Drizzle ORM + PostgreSQL** (backend, `apps/api`), **React 18 + Vite** (frontend, `apps/web`), **@orkalis/shared** (tipos/enums duales CJS+ESM). Multi-tenant por **RLS de Postgres** vía `runInTenantTx({ negocioId, sucursalIds, rol })`. Prefijo global `/api`.

## 1.1 Qué YA EXISTE y FUNCIONA

La arquitectura de notificaciones **ya está construida y es buena** (patrón hexagonal, FASE-11). No hay que reescribirla: hay que **completarla y endurecerla**.

- **Puerto hexagonal** `notificaciones/notification-sender.port.ts` — interfaz `NotificationSender { enviarSms(); enviarEmail?() }`, token `NOTIFICATION_SENDER`. El dominio no conoce el proveedor.
- **Orquestador** `notificaciones/notificaciones.service.ts` — API de encolado (`encolarOtp/Confirmacion/Recordatorio/Aviso`), handlers de worker y política de cupos.
- **Cola en proceso** `notificaciones/job-queue.ts` — `enqueue()` no bloqueante (microtask), `drain()` para tests.
- **Cupos por plan/canal** `notificaciones/cupos.service.ts` + tabla `consumo_mensajeria` — verificar/registrar consumo por `(negocioId, canal, periodo)`.
- **Adaptador Twilio SMS** `notificaciones/adapters/twilio.adapter.ts` — real (carga perezosa del SDK), `client.messages.create()`.
- **Adaptador Mock** `notificaciones/adapters/mock.adapter.ts` — loguea y guarda para tests; es el que corre HOY.
- **Adaptador SendGrid** `notificaciones/adapters/sendgrid.adapter.ts` — existe pero **NO está cableado** en el factory.
- **Scheduler** `notificaciones/recordatorios.scheduler.ts` — `@Interval(60s)` escanea citas confirmadas dentro de `ventana_recordatorio_horas` y encola recordatorio; limpia retenciones expiradas.
- **Plantillas** `notificaciones/templates.ts` — textos es-CO para otp/confirmación/recordatorio/aviso (hardcodeados en código).
- **OTP del cliente** `agendamiento/otp.service.ts` + tabla `otp_codigo` — 6 dígitos, argon2, TTL 5 min, máx. 5 intentos. Cableado en la reserva pública (`public-agendamiento.service.ts`: `enviarOtp`, `confirmar`, `cancelarDesdeEnlace`).
- **Catálogo de planes con cupos** `plans/plan-registry.ts` + `plans/plan.service.ts` — `cuposMensajeria(plan, numEsp) = base + max(0, num−incluidos) × porEspecialista`. Valores (base): Básico `{waUtil:600, waMkt:80, sms:40, email:3000}`, Pro `{1500,250,120,8000}`, Premium `{3500,400,300,20000}`, Empresarial `{14000,1800,1200,60000}`.
- **Endpoint de cupos** `GET /api/notificaciones/cupos` (Admin) → `EstadoCupo[]`.
- **Frontend cupos (REAL)** `pages/admin/config-cuenta.tsx` (`ConfigNotif`) — barra consumo/cupo por canal, hook `lib/useCupos.ts`. También en `SuscripcionScreen.tsx`.
- **Reserva pública del cliente (REAL)** `pages/public/BookingPage.tsx` — captura celular (+57, 10 dígitos), envía OTP, verifica, confirma. Todo funciona (en mock).

## 1.2 Qué está INCOMPLETO

1. **Twilio no está activo.** El paquete `twilio` no está instalado (dependencia opcional) y faltan las claves `TWILIO_*` → corre `MockAdapter`. Nada real se envía.
2. **WhatsApp no se envía.** Existe como cupo/enum (`whatsapp_utility`, `whatsapp_marketing`) pero **no hay adaptador ni método** de envío. El puerto solo tiene `enviarSms`.
3. **Email no se usa.** `sendgrid.adapter.ts` existe pero no está en el factory del módulo y `enviarEmail` no se invoca en ningún flujo.
4. **Todo se cobra al canal `sms`.** `hOtp`/`hCita` siempre llaman `enviarSms(..., 'sms', ...)`. Los cupos de WhatsApp/Email nunca se consumen por envíos reales.
5. **Plantillas del negocio: solo maqueta.** La UI "Plantillas de mensaje — próximamente" (`config-cuenta.tsx`) está deshabilitada; los textos viven hardcodeados en `templates.ts`.
6. **Un solo recordatorio.** `cita.recordatorioEnviado` es un booleano único y `ventana_recordatorio_horas` una sola ventana → no soporta 24h + 2h.
7. **El especialista no tiene teléfono.** La tabla `especialista` **no tiene** campo de celular ni de verificación; el modal de alta (`EquipoScreen.tsx`) **no pide** celular (el prototipo sí lo tenía; se perdió). `usuario` tampoco tiene teléfono. → Imposible notificarle hoy.

## 1.3 Qué está MAL DISEÑADO / con deuda

1. **Cola no durable.** `JobQueue` es memoria del proceso: **sin persistencia, sin reintentos, se pierde al reiniciar** (fire-and-forget con `catch` que solo loguea). Riesgo de perder OTPs/confirmaciones.
2. **Sin log de auditoría por mensaje.** Solo existe el contador `consumo_mensajeria`. No hay tabla de mensajes enviados con estado, `sid` del proveedor, error, ni estado de entrega (delivered/failed). No hay trazabilidad.
3. **Período de cupos ≠ ciclo de cobro.** `consumo_mensajeria.periodo` es mes calendario `YYYY-MM`; el cobro se ancla a `diaCobro` (aniversario). Se reinician en fechas distintas (contradice lo que paga el cliente). → **D1**.
4. **Consulta de consumo sin `negocioId` explícito.** `cupos.verificar` filtra por `canal`+`periodo` y depende solo del RLS. Frágil; hay que blindarlo.
5. **Vista de plataforma suma TODOS los períodos.** `pagos/plataforma.service.ts` (`detalleNegocio`) suma el consumo de todos los períodos pero lo etiqueta como el período actual → dato inexacto.
6. **Sin registro/alerta de sobreconsumo.** Al enviar transaccional sin cupo solo se hace `logger.warn`; no se registra ni se alerta al admin. → **D2**.
7. **Verificación de especialistas inexistente.** El alta crea el especialista de inmediato, sin celular ni verificación. → hay que rediseñar el flujo.
8. **Inconsistencia menor de catálogo.** Empresarial: 15 incluidos en backend vs 2 en `site-data.ts` (marketing). Corregir de paso.

## 1.4 Qué se ELIMINA / REEMPLAZA vs qué se CONSTRUYE

- **Se CONSERVA y EXTIENDE:** puerto hexagonal, orquestador, `CuposService`, `plan-registry`, `OtpService` del cliente, scheduler, adaptador Twilio SMS, UI de cupos, flujo OTP de reserva.
- **Se REEMPLAZA:** el puerto `NotificationSender` (SMS-only) → puerto **multicanal**; la `JobQueue` fire-and-forget → **outbox persistente con reintentos** (misma interfaz de encolado; el dominio no cambia); el `periodo` de cupos calendario → **período por ciclo de cobro**; el booleano `recordatorioEnviado` → **tabla de recordatorios por ventana**; los textos hardcodeados → **plantillas resueltas por negocio**.
- **Se ELIMINA:** nada de dominio. Solo se descartan supuestos (canal fijo `sms`, cola efímera).
- **Se CONSTRUYE NUEVO:** adaptadores WhatsApp y Verify de Twilio; wiring de Email; tabla de auditoría `mensaje`; webhook de estado de Twilio; tabla y CRUD de plantillas por negocio; panel real de plantillas; alertas de sobreconsumo; campos de celular/verificación en `especialista`; tabla y flujo de **verificación de especialistas**; avisos al especialista; recordatorios 24h/2h.

---

# PARTE II — ARQUITECTURA OBJETIVO

## 2.1 Puerto multicanal

Se generaliza el puerto para que el dominio pida **enviar por un canal lógico**, no "un SMS":

```
// notification-sender.port.ts (objetivo)
export type Canal = 'sms' | 'whatsapp' | 'email';
export interface MensajeSalida {
  canal: Canal;
  to: string;                 // E.164 (+57...) o email
  cuerpo?: string;            // SMS/email: texto resuelto
  plantillaContentSid?: string; // WhatsApp: Content SID aprobado
  variables?: Record<string,string>; // WhatsApp: variables de la plantilla
  asunto?: string;            // email
}
export interface NotificationSender {
  enviar(m: MensajeSalida): Promise<{ proveedorId: string }>;
  soporta(canal: Canal): boolean;
}
```

Adaptadores concretos (uno por proveedor/canal), seleccionados por un **dispatcher** según el canal:
- `adapters/twilio-sms.adapter.ts` — `messages.create({ to, from, body, statusCallback })`.
- `adapters/twilio-whatsapp.adapter.ts` — `messages.create({ to: 'whatsapp:+..', from: 'whatsapp:+..', contentSid, contentVariables })`.
- `adapters/sendgrid-email.adapter.ts` — cableado real.
- `adapters/mock.adapter.ts` — sigue siendo el fallback sin claves.
- **Verify** es aparte (no es "enviar un mensaje"): `verify/twilio-verify.adapter.ts` con `startVerification(to, canal)` y `checkVerification(to, codigo)`.

## 2.2 Flujo de un envío (objetivo)

```
Dominio (reserva/cita/especialista)
   │  encolar<Tipo>(negocioId, destino, datos)   ← MISMA API que hoy
   ▼
NotificacionesService.dispatch(evento)
   │ 1. Resuelve canal(es) del evento según config del negocio (D5) y plan.
   │ 2. Resuelve plantilla (SMS texto / WhatsApp contentSid+vars) del negocio.
   │ 3. Verifica CUPO del canal en el CICLO actual (D1).
   │      - marketing sin cupo → NO envía, estado 'sin_cupo' (D2, bloqueo duro).
   │      - transaccional sin cupo → envía, marca sobreCupo=true, alerta admin (D2).
   │ 4. Inserta fila en OUTBOX `mensaje` (estado 'pendiente').  ← AUDITORÍA
   ▼
OutboxWorker (poll/tick)
   │ 5. Resuelve el PERFIL DE REMITENTE del negocio (D6): plataforma o propio.
   │ 6. Toma pendientes, llama al adaptador del canal con ese perfil, guarda proveedorId.
   │ 7. Éxito → estado 'enviado'; incrementa consumo del canal real.
   │    Fallo → reintenta con backoff (máx N; 429/5xx transitorios); agotado → 'fallido'.
   ▼
Webhook Twilio  POST /api/webhooks/twilio/status
   │ 8. Actualiza estado de entrega: 'entregado' | 'fallido' (delivered/undelivered).
```

El **outbox** (tabla `mensaje`) es a la vez cola durable, log de auditoría y fuente de métricas. Sustituye la `JobQueue` efímera manteniendo la misma API de encolado del dominio (cero cambios en `public-agendamiento.service.ts`, etc.). En el futuro se puede poner BullMQ delante sin tocar el dominio (ADR-007).

## 2.3 Escalabilidad a nuevos canales

Un canal nuevo (push, Telegram, RCS…) requiere solo: (a) añadir el valor al enum `Canal`/`canal_mensajeria`, (b) un adaptador que implemente `NotificationSender`, (c) su cupo en `plan-registry`, (d) su resolución en el dispatcher. El dominio y la auditoría no cambian.

## 2.4 Identidad del remitente por tenant (ISV-ready, D6)

El puerto multicanal abstrae el **canal**; falta abstraer **quién envía**. Un SaaS multi-cliente real no puede tener un `TWILIO_FROM_NUMBER` global cableado en el adaptador: cada `negocio` puede, con el tiempo, enviar bajo su propia marca (subcuenta Twilio, su número SMS, su sender de WhatsApp/WABA). Por eso se introduce un **resolutor de remitente** entre el dispatch y el adaptador:

```
// remitente resuelto que recibe el adaptador (NO lee del env global)
export interface PerfilRemitente {
  negocioId: string;
  modo: 'plataforma' | 'propio';       // 'plataforma' = marca Orkalis (default v1)
  subcuentaSid?: string;               // Twilio subaccount del negocio (ISV)
  authToken?: string;                  // credencial de la subcuenta (secreto)
  messagingServiceSid?: string;        // SMS: Messaging Service (pooling/deliverability)
  smsFrom?: string;                    // SMS: número/sender ID si no hay Messaging Service
  whatsappFrom?: string;               // WhatsApp: sender aprobado del negocio
  wabaId?: string;                     // WhatsApp Business Account del negocio
  verifyServiceSid?: string;           // Verify propio si aplica
}
export interface RemitenteResolver {
  resolver(negocioId: string): Promise<PerfilRemitente>;
}
```

- **v1 (todos los negocios):** `resolver()` devuelve el **perfil plataforma** (credenciales globales `TWILIO_*` de FASE-00, en modo `plataforma`). Funciona out-of-the-box; el cliente final ve la marca Orkalis y el cuerpo nombra al salón.
- **Track ISV (FASE-11), por negocio:** cuando un salón completa el onboarding de marca propia, su fila en `mensajeria_remitente` pasa a `modo='propio'` con su `subcuentaSid`/`messagingServiceSid`/`whatsappFrom`. **Sin tocar dominio ni adaptadores** — solo cambia lo que el resolver devuelve.
- **Adaptadores:** `messages.create()` usa `PerfilRemitente` para elegir cliente Twilio (cuenta madre vs subcuenta), `from`/`messagingServiceSid` y sender de WhatsApp. El `statusCallback` sigue apuntando a nuestro webhook central (Parte IV.4).
- **Regla de por qué subcuentas y no un solo pool:** aísla datos y cumplimiento (si un salón envía tráfico no conforme, Twilio suspende su subcuenta, no la de todos) y permite costear por cliente (la facturación de Twilio es por cuenta). Es la recomendación de Twilio para ISVs.

> Impacto en el resto del plan: los adaptadores (FASE-01) reciben `PerfilRemitente` en vez de leer `env`; el outbox (FASE-02) resuelve el remitente antes de enviar; la tabla `mensajeria_remitente` (Parte III.8) se crea ya con la fila plataforma; el alta real de marcas propias es FASE-11.

---

# PARTE III — MODELO DE DATOS PROPUESTO

Todas las tablas cuelgan de `negocio` (RLS por `negocio_id`). Migraciones Drizzle nuevas en `apps/api/drizzle/`.

## 3.1 `especialista` — añadir celular y verificación
```
+ telefono            text          -- E.164 +57..., NOT NULL para altas nuevas
+ telefono_verificado_en timestamptz -- null si no verificado
+ apellidos           text          -- opcional (hoy solo hay 'nombre')
```
> `activo` sigue existiendo; un especialista solo se crea `activo=true` tras verificar (ver Parte VII).

## 3.2 `verificacion_especialista` — flujo de alta con código (NUEVA)
```
id                uuid pk
negocio_id        uuid → negocio (cascade)
telefono          text NOT NULL          -- destino del código
datos_borrador    jsonb NOT NULL         -- {nombre, apellidos, especialidad, sucursalIds, credenciales?}
verify_sid        text                   -- SID de la verificación de Twilio Verify
estado            enum(pendiente|verificado|expirado|cancelado) default 'pendiente'
intentos          int default 0
reenvios          int default 0
expira_en         timestamptz NOT NULL
creado_en         timestamptz default now()
```
> El especialista **NO se crea** hasta que `estado='verificado'`. El borrador vive aquí. Límites: máx. 5 intentos, máx. 3 reenvíos, TTL 10 min.

## 3.3 `mensaje` — outbox + auditoría (NUEVA, corazón de la trazabilidad)
```
id              uuid pk
negocio_id      uuid → negocio (cascade)
sucursal_id     uuid → sucursal (null si no aplica)
canal           canal_mensajeria        -- sms | whatsapp_* | email
tipo            enum(otp|verificacion_especialista|confirmacion|recordatorio|aviso|marketing|aviso_especialista)
transaccional   boolean NOT NULL
destino         text NOT NULL           -- teléfono/email (se puede enmascarar en UI)
plantilla_clave text                    -- evento/plantilla usada
cuerpo          text                    -- SMS/email resuelto (WhatsApp: refª de plantilla+vars)
estado          enum(pendiente|enviando|enviado|entregado|fallido|sin_cupo) default 'pendiente'
sobre_cupo      boolean default false   -- D2: se envió excediendo el cupo
proveedor       text                    -- 'twilio' | 'sendgrid' | 'mock'
proveedor_id    text                    -- Message SID / x-message-id
error           text
intento         int default 0
cita_id         uuid → cita (null)      -- correlación con la cita si aplica
creado_en       timestamptz default now()
enviado_en      timestamptz
entregado_en    timestamptz
```
Índices: `(negocio_id, creado_en)`, `(estado)` para el worker, `(proveedor_id)` para el webhook.

## 3.4 `consumo_mensajeria` — reindexar por ciclo de cobro (D1)
```
- periodo text 'YYYY-MM'
+ ciclo_inicio  timestamptz NOT NULL   -- inicio del ciclo de cobro vigente
+ ciclo_fin     timestamptz NOT NULL   -- fin (próximo aniversario)
unique(negocio_id, canal, ciclo_inicio)
```
> El "período" pasa a ser el ciclo `[cicloInicio, cicloFin)` derivado de `diaCobro`/`proximoCobro`. `CuposService` calcula el ciclo actual desde la suscripción. Migración: recomputar filas vivas al ciclo vigente (o arrancar contadores nuevos; el histórico viejo se archiva).

## 3.5 `plantilla_mensaje` — plantillas por negocio (NUEVA, D5)
```
id            uuid pk
negocio_id    uuid → negocio (cascade)
evento        enum(confirmacion|recordatorio|aviso|aviso_especialista|marketing)
canal         enum(sms|whatsapp)
-- SMS: texto libre con variables {{cliente}} {{fecha}} {{sucursal}} {{especialista}}
contenido_sms text
-- WhatsApp: plantilla aprobada + mapeo de variables
whatsapp_content_sid text
whatsapp_variables   jsonb   -- mapeo posición→variable de dominio
activo        boolean default true
actualizado_en timestamptz
unique(negocio_id, evento, canal)
```
> Si un negocio no define plantilla, se usa el **default de plataforma** (los textos de `templates.ts`, que pasan a ser fallback).

## 3.6 `cita` — múltiples recordatorios (reemplaza el booleano)
Opción elegida: tabla puente (más limpia y auditable que dos booleanos).
```
cita_recordatorio (NUEVA)
  cita_id   uuid → cita (cascade)
  ventana   enum(h24|h2|config)
  enviado_en timestamptz
  pk(cita_id, ventana)
```
> Se deja `cita.recordatorio_enviado` deprecado (o se elimina en su migración). El scheduler consulta esta tabla para no duplicar por ventana.

## 3.7 Enum `canal_mensajeria`
Se mantiene (`whatsapp_utility`, `whatsapp_marketing`, `sms`, `email`). El adaptador de WhatsApp mapea utility/marketing al mismo transporte; la distinción es de **cupo** y de **política** (marketing = duro, utility = transaccional).

## 3.8 `mensajeria_remitente` — perfil de remitente por tenant (NUEVA, D6)
```
id                    uuid pk
negocio_id            uuid → negocio (cascade)   -- null = perfil PLATAFORMA (default global)
modo                  enum(plataforma|propio) default 'plataforma'
subcuenta_sid         text                  -- Twilio subaccount del negocio (ISV)
auth_token_cifrado    text                  -- credencial de la subcuenta, cifrada en reposo
messaging_service_sid text                  -- SMS: Messaging Service (pooling/deliverability)
sms_from              text                  -- SMS: número/sender ID si no hay Messaging Service
whatsapp_from         text                  -- WhatsApp: sender aprobado del negocio
waba_id               text                  -- WhatsApp Business Account del negocio
verify_service_sid    text                  -- Verify propio del negocio (opcional)
estado                enum(activo|pendiente|suspendido) default 'activo'
onboarding_estado     enum(no_iniciado|meta_pendiente|numero_pendiente|listo) default 'no_iniciado'
creado_en             timestamptz default now()
actualizado_en        timestamptz
unique(negocio_id)     -- un perfil por negocio; la fila negocio_id=null es el default plataforma
```
> **v1:** solo existe la fila **plataforma** (`negocio_id=null`, `modo='plataforma'`), poblada desde las `TWILIO_*` de FASE-00. Todos los negocios resuelven a ella (`RemitenteResolver`). **Track ISV (FASE-11):** cada salón con marca propia gana su fila `modo='propio'`. El `auth_token` de subcuenta se guarda **cifrado** (nunca en claro). El resolver cachea por `negocio_id` con invalidación al cambiar el perfil.

---

# PARTE IV — INTEGRACIÓN CON TWILIO

## 4.1 SMS
- **Arquitectura:** adaptador `twilio-sms.adapter.ts` → `messages.create({ to, messagingServiceSid | from, body, statusCallback: TWILIO_STATUS_CALLBACK_URL })`, tomando `messagingServiceSid`/`from` y el cliente Twilio (cuenta madre o subcuenta) del **`PerfilRemitente`** resuelto (D6), no del env directamente.
- **Preferir Messaging Service** sobre número suelto ya en v1: da pooling, mejor entregabilidad y es el primitivo ISV-ready (un Messaging Service por caso de uso/cliente en el track FASE-11).
- **Config:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` (recomendado) o `TWILIO_FROM_NUMBER`. En el perfil plataforma salen del env; en perfiles propios, de `mensajeria_remitente`.
- **Errores:** capturar `code` de Twilio (21211 número inválido, 21610 opt-out, 30xxx entrega). Mapear a `estado='fallido'` + `error`.
- **Reintentos:** solo errores transitorios (5xx / timeouts). Backoff exponencial, máx. 3, en el outbox worker. Errores permanentes (número inválido) no se reintentan.
- **Logs/Auditoría:** fila en `mensaje` con `proveedor='twilio'`, `proveedor_id=SID`; estado de entrega vía webhook.

## 4.2 WhatsApp
- **Arquitectura:** adaptador `twilio-whatsapp.adapter.ts` → `messages.create({ to: 'whatsapp:'+to, from: 'whatsapp:'+perfil.whatsappFrom, contentSid, contentVariables })`, con `whatsappFrom`/cliente Twilio del **`PerfilRemitente`** (D6).
- **Config:** `TWILIO_WHATSAPP_FROM` del perfil plataforma (env); en perfiles propios, el `whatsapp_from`/`waba_id` de `mensajeria_remitente`.
- **Límite estructural (WABA):** Twilio permite **1 WABA por cuenta Twilio**. Por eso la marca propia de WhatsApp **exige subcuenta por negocio** + **WhatsApp Tech Provider + Embedded Signup** (cada salón onboardea su propio WABA/número). Eso es FASE-11 (semanas de verificación Meta); en v1 el WhatsApp sale del WABA de plataforma.
- **Plantillas (Meta):** los mensajes iniciados por el negocio **requieren plantilla aprobada** (Content Template API). Se definen plantillas para: confirmación, recordatorio, aviso de cancelación, aviso al especialista, marketing. El negocio personaliza **variables**, no la estructura (D5).
- **Restricciones:** ventana de servicio de 24h; opt-in del destinatario; categorías utility vs marketing (afecta cupo y costo). Marketing solo en planes que lo habilitan (`funciones.marketing`).
- **Errores/Reintentos/Logs:** igual que SMS; además error 63016 (fuera de ventana sin plantilla) → no reintentar, marcar y alertar.

## 4.3 Verify (códigos del especialista — D3)
- **Arquitectura:** `twilio-verify.adapter.ts` → `verify.v2.services(VERIFY_SID).verifications.create({ to, channel })` y `.verificationChecks.create({ to, code })`.
- **Config:** `TWILIO_VERIFY_SERVICE_SID`.
- **Canal:** SMS por defecto; WhatsApp si el negocio/plan lo prefiere.
- **Ventaja:** Twilio gestiona generación, reenvío, expiración y rate-limit del código. No guardamos el código; solo el `verify_sid` y el estado en `verificacion_especialista`.
- **El OTP del cliente NO cambia** (sigue con `otp_codigo`/argon2).

## 4.4 Webhook de estado
- `POST /api/webhooks/twilio/status` (público, **validando firma `X-Twilio-Signature`**). Actualiza `mensaje.estado` por `proveedor_id` (queued→sent→delivered/undelivered/failed). Idempotente.
- **Multi-cuenta:** con subcuentas, el `AccountSid` llega en el payload → se puede correlacionar el mensaje con su `negocio_id`/perfil. La firma se valida con el auth token de la cuenta que corresponde.

## 4.5 Consideraciones ISV / multi-tenant (soporte a D6)
- **Subcuentas (una por negocio con marca propia):** creadas vía REST API (`api.accounts.create`). Aíslan datos, aíslan cumplimiento (una suspensión no afecta a los demás) y permiten costear por cliente. Pedir a Twilio (Trust Hub) reclasificar el perfil de "Direct Customer" a **ISV/Reseller**.
- **Cumplimiento (A2P):** **A2P 10DLC es solo EE.UU.** Para **Colombia** aplican las guidelines locales de Twilio (registro de sender ID, reglas de opt-in/opt-out). En WhatsApp, las plantillas **marketing** exigen **opt-in explícito** del destinatario. → gestionar opt-out (STOP) y consentimiento (afecta también a v1 plataforma).
- **Rate limits:** son por cuenta/subcuenta. El outbox worker maneja **429 con backoff exponencial** (ya contemplado en 2.2) y respeta el throughput del Messaging Service (long code ≈ 1 msg/s → usar Messaging Service con pool).
- **Geo-permissions:** restringir cada subcuenta (y la plataforma) a **Colombia** para evitar envíos/costos a países no aprobados.
- **Multi-Tenancy de Twilio:** reparte capacidad de envío entre subcuentas de forma justa (un salón con pico no consume la capacidad de los demás). Se habilita en el track FASE-11.

---

# PARTE V — DISEÑO DE LÍMITES POR SUSCRIPCIÓN

- **Almacenamiento del límite:** en código (`plan-registry.ts`), derivado por `PlanService.cuposMensajeria(plan, numEspecialistas)`. No se toca la fuente de verdad.
- **Almacenamiento del consumo:** tabla `consumo_mensajeria`, contador atómico `+1` por canal y **ciclo de cobro** (D1).
- **Reinicio del consumo:** implícito por cambio de clave de ciclo. `CuposService.cicloActual(suscripcion)` calcula `[cicloInicio, cicloFin)` desde `diaCobro`/`proximoCobro`. Al renovar (aniversario) el contador arranca en 0 automáticamente (nueva clave). Un job opcional archiva/limpia ciclos viejos.
- **Disponibilidad restante:** `cupo − consumo` por canal, expuesto en `GET /notificaciones/cupos` (ya existe; se recalcula por ciclo).
- **Evitar sobreconsumo:** verificación **antes** de encolar el envío + incremento **después** del envío exitoso (no antes, para no descontar fallos). Contador atómico evita carreras.
- **Bloqueo al alcanzar el límite (D2):**
  - **marketing** (`whatsapp_marketing`): duro. `estado='sin_cupo'`, no se envía.
  - **transaccional** (otp, verificación, confirmación, recordatorio, aviso): blando. Se envía, `sobre_cupo=true`, y se **alerta al admin** (in-app + email) al cruzar 100% y al 80% (aviso preventivo).
- **Independencia por canal:** SMS / WhatsApp (utility+marketing) / Email tienen cupos y contadores separados; el ejemplo del enunciado (Básico 100 SMS/0 WhatsApp, etc.) se modela cambiando `plan-registry` — hoy los valores son otros pero la mecánica ya soporta "0" (bloquea todo ese canal).
- **Nuevos tipos de mensaje:** añadir un canal es un valor de enum + adaptador + cupo (Parte II.3).

**Cambios de plan (interacción con cupos):**
| Caso | Cupo | Consumo acumulado | Efecto |
|------|------|-------------------|--------|
| **Upgrade** | Sube de inmediato (denominador mayor) | Se conserva | Más disponibilidad el mismo ciclo. Prorrateo de cobro ya existe (`pago-suscripcion.service`). |
| **Downgrade** | Baja de inmediato | Se conserva | Si consumo ≥ nuevo cupo: marketing bloqueado, transaccional blando+alerta. Aplica al ciclo actual. |
| **Cambio nº especialistas** | Recalcula (base + extra×porEsp) | Se conserva | Igual que upgrade/downgrade parcial. |
| **Renovación (aniversario)** | Igual | **Se reinicia a 0** (nueva clave de ciclo) | Cupos frescos. |
| **Cancelación/Suspensión** | — | — | `tieneAcceso()=false` bloquea el acceso; los envíos transaccionales dependientes de acceso se cortan por el guard existente. |

> Nota: hoy conviven dos rutas de cambio de plan (`PATCH /suscripcion/plan` simple y `POST /suscripcion/cambiar` con prorrateo, la que usa el frontend). Ambas recalculan el cupo on-the-fly; **ninguna toca el consumo**, que es lo correcto. Se documenta y se añaden pruebas.

---

# PARTE VI — AUDITORÍA Y TRAZABILIDAD

- **Fuente única:** tabla `mensaje` (Parte III.3). Cada intento de envío deja fila con ciclo de vida completo (pendiente→enviando→enviado→entregado/fallido/sin_cupo), `proveedor_id`, `error`, `sobre_cupo`, correlación `cita_id`.
- **Estado de entrega real:** webhook de Twilio (Parte IV.4).
- **Métricas:** extender `observability/metrics.service.ts` con contadores por `canal` y `estado` (`mensajes_enviados`, `mensajes_fallidos`, `mensajes_sin_cupo`, `sobre_cupo`).
- **UI admin:** nueva vista "Registro de mensajes" (log filtrable por canal/estado/fecha) + dashboard de cupos por ciclo (extiende `config-cuenta.tsx`).
- **Vista operador plataforma:** corregir el bug de suma de todos los períodos (`plataforma.service.ts`) para reportar consumo por ciclo vigente.
- **Alertas de sobreconsumo:** al 80% y 100% por canal → notificación in-app al admin + email (usa el propio canal email si hay cupo, si no in-app).

---

# PARTE VII — FLUJO DE VERIFICACIÓN DE ESPECIALISTAS

Rediseño del alta (hoy crea el especialista sin celular ni verificación).

**Backend (nuevos endpoints, `equipo.controller.ts` / servicio nuevo `verificacion-especialista.service.ts`):**
1. `POST /especialistas/verificacion/iniciar` — body: `{nombre, apellidos, celular, especialidad?, sucursalIds, email?, password?}`.
   - Valida cupo de especialistas (igual que hoy), formato de celular (+57, 10 dígitos), unicidad.
   - Crea fila `verificacion_especialista` (borrador en `datos_borrador`), llama **Twilio Verify** `start(celular, 'sms')`, guarda `verify_sid`. Devuelve `verificacionId`. **Rate-limited** (throttler).
2. `POST /especialistas/verificacion/confirmar` — body: `{verificacionId, codigo}`.
   - `verify.check(celular, codigo)`. Si OK → **crea el especialista** (con `telefono`, `telefono_verificado_en=now`, `activo=true`), sus sucursales, disponibilidad por defecto y login opcional (reusa `EquipoService.crear`). Marca verificación `verificado`.
   - Si falla → `intentos++`; a los 5 intentos → `cancelado`, obliga a reiniciar.
3. `POST /especialistas/verificacion/reenviar` — body: `{verificacionId}`. Cooldown 30s, máx. 3 reenvíos.

**Frontend (`EquipoScreen.tsx` → `SpecialistModal` de 2 pasos):**
- **Paso 1 (datos):** añade **Celular** obligatorio (+57, 10 dígitos) + Apellidos; mantiene nombre/especialidad/sucursales/login opcional. Botón "Enviar código".
- **Paso 2 (código):** input de 6 dígitos, reenvío con contador, botón "Verificar y crear". Errores claros (código incorrecto, expirado, intentos agotados).
- Hook `lib/useEquipo.ts`: `iniciarVerificacion`, `confirmarVerificacion`, `reenviarCodigo`.

**Seguridad:** throttling por IP/negocio, máx. intentos y reenvíos, TTL, scoping por tenant (RLS), no se expone el código, borrador no crea especialista hasta verificar, el celular verificado queda inmutable salvo re-verificación.

---

# PARTE VIII — ROADMAP POR FASES

> Convención (igual que `PLAN-V1`): cada fase → su archivo `FASE-XX-*.md` con **Objetivo · Cambios técnicos · Archivos afectados · Riesgos · Dependencias · Criterios de aceptación · Pruebas · Intervención manual · Resultado esperado**. Aquí va el resumen; el detalle está en cada archivo de fase.

### Índice y progreso de fases

Marca ✅ al terminar cada fase (no avances si su verificación no pasa).

| Fase | Archivo | Prioridad | Depende de | Requiere acción manual | Estado |
|------|---------|-----------|------------|------------------------|--------|
| 00 | `FASE-00-prerrequisitos-twilio.md` | P0 | — | AM-1, AM-2, AM-3, AM-5 | ✅ (WhatsApp AM-3 pend.) |
| 01 | `FASE-01-cimientos-multicanal.md` | P0 | 00* | — | ✅ |
| 02 | `FASE-02-outbox-auditoria-webhook.md` | P0 | 01 | AM-4 | ✅ (URL webhook pend.) |
| 03 | `FASE-03-limites-por-ciclo.md` | P1 | 02 | — | ✅ |
| 04 | `FASE-04-plantillas-por-negocio.md` | P1 | 01, 00 | AM-3 | ✅ SMS (WhatsApp pend. AM-3) |
| 05 | `FASE-05-whatsapp-productivo.md` | P1 | 03, 04 | — | ⬜ |
| 06 | `FASE-06-verificacion-especialistas.md` | P1 | 01, 00 | AM-2 | ✅ |
| 07 | `FASE-07-avisos-especialista.md` | P2 | 06, 03, 05 | AM-3 (si WhatsApp) | ✅ (sin reagendamiento: no existe el flujo) |
| 08 | `FASE-08-recordatorios-multiventana.md` | P2 | 02, 03 | — | ✅ |
| 09 | `FASE-09-cambios-plan-cupos.md` | P2 | 03 | — | ⬜ |
| 10 | `FASE-10-pruebas-observabilidad-golive.md` | P3 | 00–09 | AM-4, AM-6 | ⬜ |
| 11 | `FASE-11-track-isv-marca-propia.md` | P-futuro | 01, 02, 05 | AM-7 | ⬜ |

\* FASE-01 avanza en **mock** sin las claves de FASE-00; solo necesita FASE-00 para envío real.

> **FASE-11 es el track ISV (marca propia por salón, D6) y NO bloquea v1.** v1 (fases 00–10) sale con el perfil plataforma. La costura que lo hace posible sin reescritura (tabla `mensajeria_remitente` + `RemitenteResolver` + adaptadores por perfil) **sí entra en v1** (FASE-01/02). FASE-11 solo añade el alta real de marcas propias (subcuentas + Embedded Signup + Tech Provider Meta).

**Orden recomendado de ejecución:** 00 (arrancar aprobación WhatsApp ya) → 01 → 02 → 03 → 06 → 04 → 05 → 07 → 08 → 09 → 10. Las fases 04/06 pueden ir en paralelo tras 01-03. **FASE-11 cuando el negocio quiera vender "marca propia"** (idealmente iniciar el trámite Meta Tech Provider en paralelo, es lento).

### FASE-00 — Prerrequisitos y cuentas Twilio *(casi todo manual)*
- **Objetivo:** dejar Twilio listo (SMS, WhatsApp, Verify) y las claves disponibles.
- **Cambios técnicos:** ninguno de código; documentar variables en `env.validation.ts` y `.env.example` (ya existen las de SMS).
- **Riesgos:** aprobación de WhatsApp por Meta puede tardar días.
- **Dependencias:** ninguna.
- **Criterios de aceptación:** claves en `.env`/Railway; número SMS activo; Verify Service creado; sender WhatsApp y ≥1 plantilla aprobada.
- **Pruebas:** envío manual de prueba desde consola Twilio.
- **Intervención manual:** ✅ (ver Parte IX, casi toda esta fase).

### FASE-01 — Cimientos: SDK, puerto multicanal y adaptadores reales
- **Objetivo:** instalar `twilio`/`@sendgrid/mail`; puerto multicanal; adaptadores SMS+WhatsApp+Email+Verify+Mock; factory por entorno; **`RemitenteResolver` + perfil plataforma (D6)**.
- **Cambios técnicos:** nuevo `notification-sender.port.ts`; adaptadores que reciben `PerfilRemitente`; `RemitenteResolver` que en v1 devuelve el perfil plataforma; dispatcher por canal; wiring de SendGrid; el dominio sigue llamando `encolar*`.
- **Archivos:** `notificaciones/notification-sender.port.ts`, `notificaciones/adapters/*`, `notificaciones/verify/*`, `notificaciones/notificaciones.module.ts`, `notificaciones/notificaciones.service.ts`, `package.json`.
- **Riesgos:** import perezoso del SDK; cambio de interfaz del puerto (afecta mock/tests).
- **Dependencias:** FASE-00 (para probar real; en mock avanza sin claves).
- **Aceptación:** con claves, un envío SMS/WhatsApp real sale; sin claves, mock. Tests verdes.
- **Pruebas:** unit de adaptadores (mock del SDK), `notificaciones.spec.ts` actualizado.
- **Manual:** ninguna (usa claves de FASE-00).

### FASE-02 — Outbox persistente + auditoría + webhook
- **Objetivo:** reemplazar la cola efímera por outbox durable con reintentos y trazabilidad.
- **Cambios técnicos:** tabla `mensaje` + migración; `OutboxWorker` (scheduler); `NotificacionesService` inserta en outbox y el worker envía; webhook `POST /api/webhooks/twilio/status` con validación de firma; métricas.
- **Archivos:** `db/schema/notificaciones.ts`, `db/schema/index.ts`, `drizzle/*`, `notificaciones/job-queue.ts`→`notificaciones/outbox.worker.ts`, `notificaciones/notificaciones.service.ts`, nuevo `notificaciones/webhooks.controller.ts`, `observability/metrics.service.ts`.
- **Riesgos:** doble envío si worker no es idempotente; firma del webhook.
- **Dependencias:** FASE-01.
- **Aceptación:** reiniciar el proceso no pierde mensajes pendientes; estados de entrega llegan por webhook; cada envío deja fila.
- **Pruebas:** integración outbox (crash/restart), idempotencia webhook, reintentos.
- **Manual:** publicar la URL del webhook (Parte IX).

### FASE-03 — Límites por ciclo de cobro + política de bloqueo + alertas
- **Objetivo:** cupos alineados al ciclo (D1); contabilizar por canal real; bloqueo marketing duro/transaccional blando (D2); alertas 80/100%; fixes de consumo.
- **Cambios técnicos:** `consumo_mensajeria` reindexada por ciclo; `CuposService.cicloActual`; consumo por canal real (no fijo `sms`); registro de `sobre_cupo`; alertas; fix `negocioId` en query y fix suma-todos-los-períodos en `plataforma.service`.
- **Archivos:** `db/schema/notificaciones.ts`, `drizzle/*`, `notificaciones/cupos.service.ts`, `notificaciones/notificaciones.service.ts`, `pagos/plataforma.service.ts`, `notificaciones.controller.ts`.
- **Riesgos:** migración de datos de consumo; definir bien el ciclo cuando aún no hay `proximoCobro` (prueba).
- **Dependencias:** FASE-02.
- **Aceptación:** el consumo se reinicia en el aniversario; marketing sin cupo no envía; transaccional sí y alerta; UI de cupos muestra el ciclo correcto.
- **Pruebas:** unit de `cicloActual`, enforcement por canal, sobreconsumo, migración.
- **Manual:** ninguna.

### FASE-04 — Plantillas configurables por negocio (D5)
- **Objetivo:** panel real de plantillas; SMS libre + WhatsApp con plantillas aprobadas y variables.
- **Cambios técnicos:** tabla `plantilla_mensaje` + CRUD; resolución en el dispatcher con fallback a `templates.ts`; panel `config-cuenta.tsx` funcional.
- **Archivos:** `db/schema/*`, `drizzle/*`, nuevo `notificaciones/plantillas.service.ts` + controller, `notificaciones/templates.ts` (fallback), `apps/web/src/pages/admin/config-cuenta.tsx`, hook `lib/usePlantillas.ts`.
- **Riesgos:** variables inválidas; mapear plantilla WhatsApp↔Content SID.
- **Dependencias:** FASE-01 (WhatsApp), FASE-00 (Content SIDs).
- **Aceptación:** un negocio edita su SMS y elige plantilla WhatsApp; el envío usa lo configurado; sin config usa el default.
- **Pruebas:** render de plantillas con variables, validación, e2e del panel.
- **Manual:** crear/aprobar las plantillas WhatsApp y pegar sus Content SIDs (Parte IX).

### FASE-05 — WhatsApp productivo (routing por evento y plan)
- **Objetivo:** enrutar cada evento al canal correcto según config del negocio y plan; gating de marketing.
- **Cambios técnicos:** matriz evento→canal por negocio; `funciones.marketing` gatea marketing; utility como transaccional.
- **Archivos:** `notificaciones/notificaciones.service.ts`, `plans/*`, `config-module/registry.ts` (flags de canal por evento).
- **Riesgos:** costo/consumo de WhatsApp; opt-in.
- **Dependencias:** FASE-03, FASE-04.
- **Aceptación:** confirmaciones/recordatorios salen por WhatsApp cuando el negocio lo elige y hay cupo; marketing solo en planes habilitados.
- **Pruebas:** routing por evento, gating por plan, consumo por canal correcto.
- **Manual:** ninguna.

### FASE-06 — Verificación de especialistas (D3)
- **Objetivo:** nuevo flujo de alta con celular obligatorio + código Twilio Verify.
- **Cambios técnicos:** campos en `especialista`; tabla `verificacion_especialista`; `verificacion-especialista.service.ts`; endpoints iniciar/confirmar/reenviar; modal 2 pasos en frontend.
- **Archivos:** `db/schema/team.ts`, nuevo `db/schema` para verificación, `drizzle/*`, `negocio/equipo.controller.ts`, `negocio/equipo.service.ts`, nuevo servicio, `negocio/dto/negocio.dto.ts`, `notificaciones/verify/*`, `apps/web/src/pages/admin/EquipoScreen.tsx`, `apps/web/src/lib/useEquipo.ts`.
- **Riesgos:** costo de Verify; abuso (rate limit); especialistas existentes sin teléfono (backfill/migración tolerante).
- **Dependencias:** FASE-01 (Verify), FASE-00 (Verify SID).
- **Aceptación:** no se crea especialista sin código correcto; reenvío e intentos limitados; celular queda verificado.
- **Pruebas:** unit del servicio (Verify mockeado), e2e del modal, límites de intentos/reenvíos.
- **Manual:** Verify Service SID (Parte IX).

### FASE-07 — Avisos por mensajería al especialista (D4)
- **Objetivo:** notificar al especialista en cita confirmada/asignada, cancelada y reagendada.
- **Cambios técnicos:** productores en el flujo de citas (`agendamiento.service`, `public-agendamiento.service`, transiciones) que encolan `aviso_especialista` al teléfono verificado; plantilla propia.
- **Archivos:** `agendamiento/*`, `notificaciones/notificaciones.service.ts`, `notificaciones/templates.ts` / `plantilla_mensaje`.
- **Riesgos:** consumo extra de cupo; especialista sin teléfono verificado (se omite y se loguea).
- **Dependencias:** FASE-06 (teléfono verificado).
- **Aceptación:** al confirmar/cancelar/reagendar una cita, el especialista con teléfono recibe el aviso; se registra en `mensaje`.
- **Pruebas:** e2e de los tres eventos, omisión si no hay teléfono.
- **Manual:** ninguna.

### FASE-08 — Recordatorios 24h + 2h configurables
- **Objetivo:** múltiples ventanas de recordatorio sin duplicados.
- **Cambios técnicos:** tabla `cita_recordatorio`; scheduler con ventanas 24h/2h + configurable; deprecación del booleano.
- **Archivos:** `db/schema/appointments.ts` (o nueva), `drizzle/*`, `notificaciones/recordatorios.scheduler.ts`, `config-module/registry.ts` (ventanas).
- **Riesgos:** citas creadas dentro de la ventana; duplicados; zona horaria.
- **Dependencias:** FASE-02, FASE-03.
- **Aceptación:** una cita a >24h recibe recordatorio a 24h y a 2h, sin repetir; respeta config.
- **Pruebas:** unit del scanner por ventana, no-duplicado, TZ America/Bogota.
- **Manual:** ninguna.

### FASE-09 — Cambios de plan ↔ cupos (endurecer y documentar)
- **Objetivo:** garantizar upgrade/downgrade/renovación/cancelación correctos sobre cupos.
- **Cambios técnicos:** pruebas y ajustes en `pago-suscripcion.service` y `cupos.service`; corregir inconsistencia Empresarial en `site-data.ts`.
- **Archivos:** `pagos/pago-suscripcion.service.ts`, `negocio/suscripcion.service.ts`, `notificaciones/cupos.service.ts`, `apps/web/src/pages/site/site-data.ts`.
- **Riesgos:** casos límite de ciclo en downgrade.
- **Dependencias:** FASE-03.
- **Aceptación:** cada caso de la tabla de Parte V se comporta como está descrito, con pruebas.
- **Pruebas:** matriz de cambios de plan × cupos.
- **Manual:** ninguna.

### FASE-10 — Pruebas E2E, observabilidad y go-live
- **Objetivo:** validación integral y paso a producción real.
- **Cambios técnicos:** suite E2E de mensajería, dashboards/alertas, checklist de producción, números y plantillas reales.
- **Archivos:** tests e2e (`apps/api/**/*.e2e.spec.ts`, `apps/web` e2e), `DEPLOY.md`, `CREDENCIALES-PENDIENTES.md`.
- **Riesgos:** costos reales; entregabilidad.
- **Dependencias:** todas.
- **Aceptación:** flujos reales end-to-end en staging con Twilio real; métricas y alertas operativas.
- **Pruebas:** E2E completos + prueba de humo en producción con un número propio.
- **Manual:** claves de producción, verificación final de plantillas, activar webhook público (Parte IX).

### FASE-11 — Track ISV: marca propia por salón (D6) *(P-futuro, no bloquea v1)*
- **Objetivo:** permitir que un salón envíe bajo **su propia marca** (número SMS/Messaging Service y sender WhatsApp propios), aislado en su subcuenta Twilio.
- **Cambios técnicos:** provisión de **subcuenta Twilio por negocio** (REST API) con token cifrado en `mensajeria_remitente`; **WhatsApp Embedded Signup** (login Meta dentro de la app → el salón onboardea su WABA/número); `RemitenteResolver` pasa el perfil a `modo='propio'`; geo-permissions Colombia por subcuenta; Multi-Tenancy de Twilio para reparto justo de throughput; panel de "marca propia" en admin (estado de onboarding); gating por plan (feature premium).
- **Archivos:** `notificaciones/remitente/*` (resolver + provisión de subcuentas), `db/schema` (`mensajeria_remitente`), `apps/web` (panel onboarding marca propia), `plans/*` (flag premium).
- **Riesgos:** verificación de negocio con Meta (semanas); gestión segura de credenciales de subcuenta; cumplimiento por subcuenta.
- **Dependencias:** FASE-01 (resolver + perfil), FASE-02 (outbox resuelve remitente), FASE-05 (WhatsApp productivo).
- **Aceptación:** un salón piloto envía SMS y WhatsApp bajo su propia marca; su tráfico y su facturación quedan aislados en su subcuenta; el resto sigue en plataforma.
- **Pruebas:** provisión de subcuenta (mock del API), resolución de perfil propio vs plataforma, envío por subcuenta, aislamiento de cumplimiento.
- **Manual:** convertirse en **Meta Tech Provider** + app Meta + verificación de negocio (AM-7).

---

# PARTE IX — INTERVENCIONES MANUALES DEL DESARROLLADOR

> Cada bloque es una **Acción requerida del desarrollador**: qué hacer, dónde, qué datos entregar y en qué fase.

### AM-1 · Crear/confirmar cuenta Twilio y comprar número SMS  *(FASE-00)*
- **Qué:** cuenta Twilio (ya existe trial 2026-06-15), comprar/activar un número con SMS habilitado para Colombia.
- **Dónde:** consola Twilio → Phone Numbers.
- **Datos a entregar:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` → pégalos en `.env` (local) y en Railway (prod). Actualiza `CREDENCIALES-PENDIENTES.md`.

### AM-2 · Crear Twilio Verify Service  *(FASE-00, usado en FASE-06)*
- **Qué:** crear un Verify Service.
- **Dónde:** consola Twilio → Verify → Services.
- **Datos a entregar:** `TWILIO_VERIFY_SERVICE_SID`.

### AM-3 · Registrar sender de WhatsApp y aprobar plantillas  *(FASE-00, usado en FASE-04/05)*
- **Qué:** registrar el WhatsApp Business sender (Meta) y crear + enviar a aprobación las plantillas: confirmación, recordatorio, aviso de cancelación, aviso al especialista, marketing.
- **Dónde:** Twilio → Messaging → WhatsApp senders / Content Template Builder (aprobación por Meta, puede tardar días).
- **Datos a entregar:** `TWILIO_WHATSAPP_FROM` y el **Content SID** de cada plantilla aprobada.

### AM-4 · Publicar la URL del webhook de estado  *(FASE-02)*
- **Qué:** exponer `https://<tu-dominio>/api/webhooks/twilio/status` y configurarla como Status Callback en el número/Messaging Service.
- **Dónde:** Railway (dominio) + consola Twilio.
- **Datos a entregar:** `TWILIO_STATUS_CALLBACK_URL` (o confirmar el dominio de prod).

### AM-5 · (Opcional) SendGrid para email  *(FASE-01)*
- **Qué:** cuenta SendGrid + remitente verificado si quieres email real.
- **Datos a entregar:** `SENDGRID_API_KEY`, `MAIL_FROM`.

### AM-6 · Claves de producción y go-live  *(FASE-10)*
- **Qué:** mover de trial a cuenta paga, verificar límites de envío, confirmar plantillas aprobadas, cargar todas las variables en Railway prod.
- **Datos a entregar:** confirmación de que todas las `TWILIO_*`/`SENDGRID_*` de producción están cargadas.

### AM-7 · Convertirse en ISV / Meta Tech Provider  *(FASE-11 — solo para marca propia, no bloquea v1)*
- **Qué:** (a) pedir a Twilio (Trust Hub) reclasificar el perfil a **ISV/Reseller** y habilitar creación de subcuentas + Multi-Tenancy; (b) crear la **app de Meta**, registrarse como **WhatsApp Tech Provider** y pasar la **verificación de negocio con Meta** para habilitar **Embedded Signup** (onboarding de WABA por cliente). ⚠️ La verificación de Meta puede tardar **semanas**: si se piensa vender "marca propia", **iniciar el trámite temprano** aunque el código de FASE-11 venga después.
- **Dónde:** consola Twilio (Trust Hub) + Meta for Developers / Business Manager.
- **Datos a entregar:** confirmación de Tech Provider aprobado + IDs de la app Meta; luego, por cada salón, su onboarding vía Embedded Signup queda automatizado en la app.

---

# PARTE X — LISTA DE TAREAS TÉCNICAS PRIORIZADAS

**P0 (bloquean todo lo real):**
1. Instalar SDK `twilio` y cablear claves (FASE-00/01).
2. Puerto multicanal + adaptadores SMS/WhatsApp/Verify/Email (FASE-01).
3. Outbox `mensaje` + worker durable + webhook de estado (FASE-02).

**P1 (núcleo del requerimiento):**
4. Cupos por ciclo de cobro + política de bloqueo + alertas (FASE-03).
5. Verificación de especialistas (schema + backend + frontend) (FASE-06).
6. Plantillas por negocio (D5) (FASE-04).
7. WhatsApp productivo por evento/plan (FASE-05).

**P2 (completar experiencia):**
8. Avisos al especialista (FASE-07).
9. Recordatorios 24h/2h (FASE-08).
10. Cambios de plan ↔ cupos endurecidos + fix `site-data` (FASE-09).

**P3 (calidad/operación):**
11. Registro de mensajes en UI admin + dashboard por ciclo (FASE-06/10).
12. Fix consumo por período en vista de plataforma (FASE-03).
13. E2E, observabilidad y go-live (FASE-10).

---

# PARTE XI — RESULTADO ESPERADO AL FINALIZAR

- Mensajes **reales** por SMS y WhatsApp (y email opcional) vía Twilio/SendGrid.
- **Límites por plan respetados** por canal, alineados al ciclo de cobro, con bloqueo marketing/transaccional según D2 y alertas de sobreconsumo.
- **Cambios de plan** que actualizan cupos correctamente (upgrade/downgrade/renovación/cancelación).
- **Todos los flujos de negocio** que dependen de mensajes funcionando: OTP de reserva, confirmación al cliente, recordatorios 24h/2h, avisos de cancelación/reagendamiento al cliente y **al especialista**, verificación de especialistas.
- **Auditoría y trazabilidad** completas (tabla `mensaje` + webhook + métricas + UI).
- **Plantillas configurables** por negocio (SMS libre + WhatsApp aprobadas).
- Arquitectura **escalable** a nuevos canales sin tocar el dominio.
- **ISV-ready (D6):** v1 envía bajo marca plataforma, pero la costura de remitente por tenant (`mensajeria_remitente` + `RemitenteResolver` + adaptadores por perfil) permite activar **marca propia por salón** (subcuenta + WhatsApp propio) como feature premium (FASE-11) **sin reescribir** dominio ni adaptadores.
```
