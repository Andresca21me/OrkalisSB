# FASE-11 · Track ISV: marca propia por salón (D6)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> **Prioridad P-futuro. NO bloquea v1.** v1 (fases 00–10) sale con el **perfil plataforma**. Esta fase activa que cada salón envíe bajo **su propia marca**. Implementa **D6**.

## Objetivo
Permitir que un `negocio` envíe SMS y WhatsApp bajo **su propia identidad** (número/Messaging Service y sender de WhatsApp propios), aislado en su **subcuenta Twilio**, como **feature premium**. Todo apoyado en la costura ya construida en v1 (`mensajeria_remitente` + `RemitenteResolver` + adaptadores por perfil): **no se reescribe dominio ni adaptadores**, solo se puebla el perfil `modo='propio'` y se automatiza el onboarding.

## Prerrequisitos / Dependencias
- **FASE-01** (`RemitenteResolver` + `PerfilRemitente` + adaptadores que reciben perfil).
- **FASE-02** (el outbox worker ya resuelve el remitente antes de enviar).
- **FASE-05** (WhatsApp productivo por evento/plan).
- **AM-7** (Twilio ISV/Reseller + Meta Tech Provider + verificación de negocio Meta).

## Cambios técnicos (Pasos de Claude)
1. **Provisión de subcuenta por negocio** `remitente/subcuenta.service.ts`: crear subcuenta Twilio vía REST (`api.accounts.create({ friendlyName })`), guardar `subcuenta_sid` y `auth_token` **cifrado en reposo** en `mensajeria_remitente`. Geo-permissions → **solo Colombia**.
2. **WhatsApp Embedded Signup** en el frontend admin: flujo de login con Facebook embebido para que el salón onboardee su **WABA/número** propio; al completar, se guardan `whatsapp_from`/`waba_id` y `onboarding_estado='listo'`.
3. **`RemitenteResolver` completo:** deja de devolver siempre plataforma; lee `mensajeria_remitente` por `negocio_id` y devuelve `modo='propio'` cuando el perfil está `listo`, con **fallback a plataforma** si no. Invalida caché al cambiar el perfil.
4. **Webhook multi-cuenta:** correlacionar por `AccountSid` del payload; validar `X-Twilio-Signature` con el auth token de la cuenta correspondiente (madre o subcuenta).
5. **Gating por plan:** "marca propia" como flag premium (`plan-registry`/`funciones`); panel admin "Marca propia" que muestra el estado de onboarding (no iniciado / Meta pendiente / número pendiente / listo).
6. **Multi-Tenancy de Twilio:** habilitar el reparto justo de throughput entre subcuentas.
7. **Migración de plantillas:** las plantillas WhatsApp (FASE-04) deben existir/aprobarse en el WABA del salón; mapear sus Content SID por negocio.

## Archivos afectados
- `apps/api/src/notificaciones/remitente/remitente.resolver.ts` (completar), `remitente/subcuenta.service.ts` (nuevo), `remitente/embedded-signup.controller.ts` (nuevo)
- `apps/api/src/db/schema/notificaciones.ts` (`mensajeria_remitente`), `apps/api/drizzle/*`
- `apps/api/src/notificaciones/webhooks.controller.ts` (multi-cuenta)
- `apps/api/src/plans/*` (flag premium)
- `apps/web/src/pages/admin/*` (panel "Marca propia" + Embedded Signup)

## ⚠️ Acción requerida del desarrollador
- **AM-7 · ISV / Meta Tech Provider:** (a) Twilio Trust Hub → reclasificar a **ISV/Reseller**, habilitar subcuentas + Multi-Tenancy; (b) crear **app de Meta**, registrarse como **WhatsApp Tech Provider**, pasar **verificación de negocio con Meta** para habilitar **Embedded Signup**. ⚠️ La verificación de Meta puede tardar **semanas** → iniciar temprano si se piensa vender marca propia.
- Por cada salón: la subcuenta se provisiona por código; el onboarding de su WABA es self-service vía Embedded Signup.

## Riesgos y mitigaciones
- **Verificación Meta lenta** → iniciar AM-7 en paralelo desde FASE-00; v1 no depende de esto.
- **Credenciales de subcuenta** → cifrado en reposo, nunca en logs ni en el cliente; rotación soportada.
- **Cumplimiento por subcuenta** → geo-permissions Colombia, opt-in/opt-out por cliente; una suspensión afecta solo a esa subcuenta.
- **Coste operativo** → subcuenta = feature premium; gating por plan evita provisionar sin necesidad.
- **Entregabilidad del nuevo sender** → warm-up y monitoreo de reputación por subcuenta.

## Criterios de aceptación (Done)
- Un salón piloto envía SMS y WhatsApp **bajo su propia marca**; el resto sigue en plataforma sin cambios.
- El tráfico y la facturación del salón quedan **aislados en su subcuenta**.
- `RemitenteResolver` devuelve el perfil correcto (propio vs plataforma) y el outbox lo usa sin tocar dominio.
- El webhook actualiza estados correctamente para mensajes de subcuentas.

## Pruebas
- Provisión de subcuenta con el API de Twilio **mockeado**.
- Resolución de perfil: propio (listo) vs fallback a plataforma (no iniciado).
- Envío por subcuenta (SMS y WhatsApp) con perfil propio.
- Webhook multi-cuenta: firma válida por cuenta correcta; idempotencia.
- Aislamiento: suspender una subcuenta no afecta envíos de otros negocios.

## Trazabilidad
D6, ADR-007/009, Parte II.4 / III.8 / IV.5 del plan, AM-7.

## Resultado esperado
"Marca propia por salón" disponible como feature premium: cada negocio puede enviar bajo su identidad, aislado y facturable por separado, **sin reescritura** gracias a la costura ISV-ready de v1.
