# FASE-05 · WhatsApp productivo (routing por evento y plan)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
>
> **Estado: ✅ el motor de routing está completo y en producción; WhatsApp sigue
> inactivo hasta AM-3.** Hoy el enrutador manda todo por SMS **por la vía del
> fallback** —exactamente el mismo camino que se usará cuando WhatsApp esté
> disponible—, así que la ruta degradada está probada en producción desde el
> primer día. Cuando lleguen los Content SID aprobados por Meta no hay que tocar
> el dominio: basta con que existan el sender y la plantilla.

## Objetivo
Enrutar cada evento de negocio al **canal correcto** (SMS / WhatsApp / Email) según la configuración del negocio y su plan, con **gating de marketing** por plan. Hasta ahora todo salía por SMS; aquí WhatsApp entra en producción para confirmaciones/recordatorios/avisos.

## Prerrequisitos / Dependencias
- FASE-03 (cupos por canal + política), FASE-04 (plantillas por negocio).

## Cambios técnicos (Pasos de Claude)
1. **Matriz evento→canal por negocio:** flags de canal preferido por evento (confirmación, recordatorio, aviso, aviso_especialista, marketing) en el `config-module/registry.ts` (config por negocio/sucursal, con herencia). Default sensato: transaccionales por WhatsApp si hay sender+plantilla y cupo, si no SMS.
2. **Gating de marketing:** `whatsapp_marketing` solo si `PLANES[plan].funciones.marketing` lo permite; si no, no se ofrece.
3. **Fallback de canal:** si el canal preferido no tiene cupo/plantilla, caer al alternativo definido (p. ej. WhatsApp→SMS para transaccional). Registrar el fallback en `mensaje`.
4. **`whatsapp_utility` = transaccional; `whatsapp_marketing` = marketing** a efectos de política (D2) y cupo.
5. Ajustar `notificaciones.service.ts` para elegir canal antes de construir `MensajeSalida`.

## Archivos afectados
- `apps/api/src/notificaciones/notificaciones.service.ts` (routing)
- `apps/api/src/config-module/registry.ts` (flags de canal por evento)
- `apps/api/src/plans/*` (lectura de `funciones.marketing`)
- `apps/web/src/pages/admin/config-cuenta.tsx` (selector de canal por evento, opcional)

## ⚠️ Acción requerida del desarrollador
- Confirmar que las plantillas WhatsApp de FASE-00/04 están aprobadas (si no, el routing cae a SMS).

## Riesgos y mitigaciones
- **Costo/consumo de WhatsApp** → respetar cupos por canal (FASE-03); avisar sobreconsumo.
- **Opt-in del destinatario** → WhatsApp requiere que el cliente haya aceptado; para transaccionales de servicio esto suele cubrirse, documentar.
- **Fuera de ventana 24h** → usar siempre plantilla aprobada (ya garantizado por D5).

## Criterios de aceptación (Done)
- Confirmaciones/recordatorios salen por **WhatsApp** cuando el negocio lo elige y hay cupo/plantilla.
- Marketing por WhatsApp solo en planes habilitados.
- Fallback a SMS cuando corresponde, registrado en `mensaje`.
- El consumo se imputa al canal correcto.

## Pruebas
- Routing por evento (config del negocio) y gating por plan.
- Fallback cuando no hay cupo/plantilla.
- Consumo por canal correcto en cada caso.

## Cómo quedó implementado
- **`notificaciones/router-canal.service.ts`**: decide el canal de cada evento antes de construir el `MensajeSalida`. Regla de fondo: **degradar antes que fallar**. Comprueba en orden (1) preferencia del negocio, (2) gating de marketing por plan, (3) sender de WhatsApp, (4) plantilla aprobada, (5) cupo del canal; si falla cualquiera, SMS con el motivo anotado. No lanza nunca.
- **Config por evento con herencia** negocio/sucursal: `mensajeria.canal_{confirmacion,recordatorio,aviso,aviso_especialista,marketing}`, tipo `enum` con valores `auto | sms | whatsapp` (default `auto`). `auto` = WhatsApp si es viable, si no SMS.
- **El fallback queda auditado** en el outbox: columnas nuevas `canal_preferido` y `motivo_fallback` (migración `0014`), visibles en el Registro de mensajes. Así se puede responder "¿por qué esto salió por SMS?" sin mirar logs.
- **`whatsapp_utility` vs `whatsapp_marketing`** se imputan como cupos distintos según `transaccional`, que es lo que hace que la política D2 siga aplicando por canal.
- **Marketing gateado por plan**: si `PLANES[plan].funciones.marketing` es false, ni se ofrece WhatsApp marketing.
- Al enrutar por WhatsApp se adjuntan las **variables** de la plantilla (`valoresDe`), que es lo que Meta espera en lugar de texto libre.

**Lo que falta de AM-3** (y solo eso): dar de alta el sender de WhatsApp (`TWILIO_WHATSAPP_FROM`) y cargar el **Content SID** de cada plantilla aprobada en `plantilla_mensaje` (`canal='whatsapp'`). En cuanto existan, el routing empieza a usarlos solo.

## Trazabilidad
ADR-009 (canales/cupos), RF-047/048, Parte II/V del plan.

## Resultado esperado
WhatsApp operativo en los flujos transaccionales (y marketing donde el plan lo permite), con SMS de respaldo.
