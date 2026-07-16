# FASE-05 · WhatsApp productivo (routing por evento y plan)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.

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

## Trazabilidad
ADR-009 (canales/cupos), RF-047/048, Parte II/V del plan.

## Resultado esperado
WhatsApp operativo en los flujos transaccionales (y marketing donde el plan lo permite), con SMS de respaldo.
