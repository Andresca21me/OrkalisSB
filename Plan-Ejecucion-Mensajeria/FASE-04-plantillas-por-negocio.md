# FASE-04 · Plantillas de mensaje configurables por negocio

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Implementa **D5**: SMS texto libre + WhatsApp plantillas aprobadas con variables.

## Objetivo
Hacer real el panel "Plantillas de mensaje" (hoy maqueta deshabilitada en `config-cuenta.tsx`): cada negocio define el texto de sus mensajes por evento y canal, con fallback a los defaults de plataforma.

## Prerrequisitos / Dependencias
- FASE-01 (adaptador WhatsApp), FASE-00 (Content SIDs de plantillas aprobadas).

## Cambios técnicos (Pasos de Claude)
1. **Tabla `plantilla_mensaje`** (Parte III.5): `negocio_id, evento(confirmacion|recordatorio|aviso|aviso_especialista|marketing), canal(sms|whatsapp), contenido_sms?, whatsapp_content_sid?, whatsapp_variables jsonb?, activo, actualizado_en`, `unique(negocio_id, evento, canal)`. Migración.
2. **`PlantillasService` + controller CRUD** (`@Roles(Admin)`): `GET /notificaciones/plantillas`, `PUT /notificaciones/plantillas/:evento/:canal`. Validar variables permitidas (`{{cliente}} {{fecha}} {{sucursal}} {{especialista}}`).
3. **Resolución en el dispatcher:** al construir `MensajeSalida`, resolver plantilla del negocio:
   - SMS → renderizar `contenido_sms` con variables → `cuerpo`.
   - WhatsApp → `plantillaContentSid = whatsapp_content_sid` + `variables` mapeadas.
   - Sin plantilla del negocio → **fallback** a `templates.ts` (defaults de plataforma).
4. **`templates.ts`** pasa a ser el conjunto de **defaults** (no se borra).
5. **Frontend `config-cuenta.tsx`:** panel funcional. SMS = textarea editable con inserción de variables y previsualización; WhatsApp = selector de plantilla aprobada + campos de variables. Guardar vía `usePlantillas.ts`.

## Archivos afectados
- `apps/api/src/db/schema/*` (nueva tabla), `apps/api/drizzle/*`
- `apps/api/src/notificaciones/plantillas.service.ts` + `plantillas.controller.ts` (nuevos)
- `apps/api/src/notificaciones/notificaciones.service.ts` (resolución)
- `apps/api/src/notificaciones/templates.ts` (defaults/fallback)
- `apps/web/src/pages/admin/config-cuenta.tsx`
- `apps/web/src/lib/usePlantillas.ts` (nuevo)

## ⚠️ Acción requerida del desarrollador
- **AM-3 (continuación):** crear/aprobar en Meta las plantillas WhatsApp y entregar sus **Content SID** para poblar el selector (`TWILIO_WA_TPL_*` o catálogo en BD).

## Riesgos y mitigaciones
- **Variables inválidas / inyección** → whitelist de variables; escapar; validar longitud SMS.
- **Desalineación plantilla↔ContentSID** → validar que el SID exista antes de guardar; mostrar estado de aprobación.
- **SMS demasiado largo (segmentos)** → advertir en UI el nº de segmentos.

## Criterios de aceptación (Done)
- Un negocio edita su SMS y elige plantilla WhatsApp; el envío usa lo configurado.
- Sin configuración, se usa el default de plataforma (comportamiento actual).
- Variables se renderizan correctamente.

## Pruebas
- Unit de render de plantillas con variables (SMS) y mapeo (WhatsApp).
- Validación de variables no permitidas.
- E2E del panel: guardar y ver reflejado el cambio en un envío.

## Trazabilidad
RF-047/048, D5, Parte III/IV del plan; UI `config-cuenta.tsx` (maqueta previa).

## Resultado esperado
Mensajería personalizable por negocio, cumpliendo las reglas de WhatsApp de Meta.
