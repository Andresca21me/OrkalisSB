# FASE-04 · Plantillas de mensaje configurables por negocio

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Implementa **D5**: SMS texto libre + WhatsApp plantillas aprobadas con variables.
>
> **Estado: ✅ la mitad SMS, completa y en uso** (migración `0011`, panel funcional,
> 234 tests verdes). La mitad **WhatsApp queda construida pero inerte** hasta
> **AM-3**: la tabla guarda `whatsapp_content_sid` y el endpoint lo acepta, pero
> sin plantillas aprobadas por Meta no hay Content SIDs que ofrecer. Cuando
> lleguen, solo hay que poblar el selector — no se reescribe nada.

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

## Cómo quedó implementado
- **Tabla `plantilla_mensaje`** (migración `0011`, RLS por tenant), `unique(negocio_id, evento, canal)`. Todas las columnas de contenido son opcionales: la tabla puede estar vacía y todo sigue funcionando con los defaults.
- **`plantillas.render.ts` es un módulo PURO** (sin acceso a BD, mismo criterio que `ciclo.ts`) con `renderizar`, `valoresDe`, `variablesDe` y `textoPorDefecto`. El servicio con estado solo añade lectura/escritura.
- **Resolución al ENCOLAR, no al enviar**: el outbox guarda el texto ya renderizado, así editar una plantilla no reescribe mensajes que ya estaban en cola — el cliente recibe lo que estaba vigente cuando ocurrió el hecho.
- **Fallback blindado**: `cuerpoSms` nunca lanza. Si la plantilla está inactiva, vacía o la consulta falla, cae al default de plataforma; quedarse sin avisar al cliente es peor que avisarle con el texto genérico.
- **Whitelist de variables** validada en el **servidor** (no solo en el navegador): un `{{fehca}}` se rechaza al guardar con un mensaje que lista las disponibles. Una variable sin valor se sustituye por vacío — nunca viaja un `{{…}}` a un cliente real.
- **`{{cliente}}` se hizo real**: se añadió `clienteNombre` a `DatosCita` y se propaga desde la confirmación de reserva y desde el escáner de recordatorios.
- **Contador de segmentos SMS** (`packages/shared/src/sms.ts`, compartido front↔back) con la trampa del español documentada: **`á í ó ú` no existen en GSM-7** (sí `é ñ ü ¿ ¡`), así que una sola de esas tildes fuerza UCS-2 y el segmento cae de 160 a 70 caracteres. El editor lo avisa y señala los caracteres culpables.
- **Panel funcional** en Configuración → Notificaciones: textarea por evento, botones de inserción de variables, vista previa de lo que se enviará (texto propio o default), contador de segmentos y aviso de codificación. Vaciar el campo restablece el default.
- **API**: `GET /notificaciones/plantillas?canal=sms` (devuelve también el `porDefecto` de cada evento) y `PUT /notificaciones/plantillas/:evento/:canal`.

## Trazabilidad
RF-047/048, D5, Parte III/IV del plan; UI `config-cuenta.tsx` (maqueta previa).

## Resultado esperado
Mensajería personalizable por negocio, cumpliendo las reglas de WhatsApp de Meta.
