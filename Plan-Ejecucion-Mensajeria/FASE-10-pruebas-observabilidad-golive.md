# FASE-10 · Pruebas E2E, observabilidad y go-live

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
>
> **Estado: código ✅ / go-live ✅ (2026-07-22).** Las cinco `TWILIO_*` están
> cargadas en el servicio API de Railway y el mock quedó apagado (verificado en
> el log de arranque). Falta solo la **prueba de humo con un número real**, que
> es manual. Lo de abajo se conserva como referencia del procedimiento.
>
> **Nota histórica:** Los pasos 1–3 y 5 están hechos (263 tests
> verdes). El **go-live (AM-6) NO está aplicado**: producción sigue en mock a
> propósito, porque activar las claves reales manda SMS a clientes reales y gasta
> saldo. El checklist de abajo es lo que falta.

## Objetivo
Validar todo el sistema de mensajería end-to-end, añadir la **UI de registro de mensajes** y dashboards, y pasar a **producción real** con Twilio (SMS + WhatsApp + Verify) y, opcionalmente, SendGrid.

## Prerrequisitos / Dependencias
- Todas las fases anteriores (00–09).

## Cambios técnicos (Pasos de Claude)
1. **UI "Registro de mensajes" (admin):** vista filtrable (canal/estado/fecha/tipo) sobre la tabla `mensaje`, con estado de entrega y correlación a cita. Endpoint `GET /notificaciones/mensajes` paginado.
2. **Dashboard de cupos por ciclo:** extender `config-cuenta.tsx`/`SuscripcionScreen.tsx` con consumo por canal del ciclo vigente y alertas.
3. **Observabilidad:** métricas por canal/estado en `/metrics`; alertas de tasa de fallo y de sobreconsumo.
4. **Suite E2E de mensajería:** OTP de reserva, confirmación, recordatorios 24h/2h, avisos cliente/especialista, verificación de especialista, límites (bloqueo marketing/blando transaccional), webhook de estado.
5. **Checklist de producción:** actualizar `DEPLOY.md` y `CREDENCIALES-PENDIENTES.md`.

## Archivos afectados
- `apps/api/src/notificaciones/notificaciones.controller.ts` (endpoint mensajes)
- `apps/web/src/pages/admin/*` (registro de mensajes, dashboard)
- Tests `apps/api/**/*.e2e.spec.ts`, e2e de `apps/web`
- `DEPLOY.md`, `CREDENCIALES-PENDIENTES.md`

## ⚠️ Acción requerida del desarrollador
- **AM-6 · Go-live:** pasar Twilio de trial a cuenta paga; verificar límites de envío; confirmar plantillas WhatsApp aprobadas; cargar todas las `TWILIO_*`/`SENDGRID_*` de producción en Railway.
- **AM-4:** confirmar la URL pública del webhook en producción.
- Prueba de humo real: enviarte a ti mismo un SMS/WhatsApp/OTP desde el entorno productivo.

## Checklist de go-live (AM-6) — pendiente

**Antes de tocar nada, tres comprobaciones en el panel de Twilio:**

1. **Geo Permissions.** *Messaging → Settings → Geo Permissions*: **Colombia debe estar habilitada**. Si no lo está, cada envío falla con el error **21408** y el outbox los marcará `fallido` sin que se entienda por qué. Es el fallo más común al salir de trial.
2. **Ruta del remitente.** El número cargado es un **long code de EE. UU.** (`+1669…`). Enviar EE. UU. → Colombia funciona, pero es **caro** (≈0,05–0,09 USD por SMS, frente a ≈0,0079 USD dentro de EE. UU.) y los operadores colombianos filtran más el tráfico internacional. Con 20 USD de saldo eso son **~220–400 SMS**, no miles. Si el volumen va a crecer, conviene un remitente local o alfanumérico.
3. **Saldo y alertas.** Configurar un aviso de saldo bajo en Twilio: si se agota a mitad de día, los OTP dejan de llegar y los clientes no pueden reservar.

**Aplicar las claves (servicio API en Railway):**

| Variable | Valor |
|---|---|
| `TWILIO_ACCOUNT_SID` | el de producción |
| `TWILIO_AUTH_TOKEN` | el de producción |
| `TWILIO_FROM_NUMBER` | `+1669…` (o el remitente definitivo) |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG…` (preferido sobre el número suelto) |
| `TWILIO_VERIFY_SERVICE_SID` | `VA…` (alta de especialistas) |
| `TWILIO_STATUS_CALLBACK_URL` | ya puesta: `https://api.orkalis.com/api/webhooks/twilio/status` |

En cuanto existan `ACCOUNT_SID` + `AUTH_TOKEN` + remitente, **el modo mock se apaga solo** (`twilioConfigurado()`), el `devCode` del OTP deja de exponerse y el webhook de estado empieza a validar firma de verdad. No hay ningún flag adicional que tocar.

**Prueba de humo, en este orden:**
1. Reserva pública con **tu** número → debe llegar el OTP por SMS y **ya no** verse en pantalla.
2. Confirmar la reserva → llega la confirmación.
3. Configuración → **Registro de mensajes**: la fila pasa de `enviado` a `entregado` (eso valida el webhook de AM-4 de punta a punta).
4. Alta de un especialista → el código de Verify llega al celular (el `123456` del mock deja de funcionar).

**Vuelta atrás:** borrar `TWILIO_AUTH_TOKEN` en Railway y reiniciar. Vuelve al mock sin desplegar nada.

## Riesgos y mitigaciones
- **Costos reales** → monitoreo de consumo + alertas de sobreconsumo (FASE-03).
- **Entregabilidad** → revisar tasas de fallo por número/plantilla; sender WhatsApp con buena reputación.
- **Trial que no envía a números no verificados** → verificar destinos o cuenta paga antes de la demo.

## Criterios de aceptación (Done)
- Flujos reales end-to-end funcionan en staging con Twilio real.
- Registro de mensajes y dashboards operativos.
- Métricas y alertas activas.
- Checklist de producción completo.

## Pruebas
- E2E completos de todos los flujos.
- Prueba de humo en producción con un número propio.
- Verificación de webhook de estado en prod.

## Qué quedó hecho (pasos 1–3 y 5)
- **Registro de mensajes** (paso 1): `GET /notificaciones/mensajes` paginado con filtros de canal/estado/tipo/fecha y `GET /notificaciones/mensajes/resumen` (conteo por estado + tasa de fallo). Pantalla nueva en **Configuración → Registro de mensajes**, con el error del proveedor visible en la fila que falló y marca de `sobre cupo`.
- **Dashboard de cupos** (paso 2): ya cubierto en FASE-03 — Configuración → Notificaciones muestra consumo/cupo por canal del **ciclo vigente** con sus fechas, y los avisos de 80 %/100 % como banners descartables.
- **Observabilidad** (paso 3): métricas `mensajes_encolados|enviados|entregados|fallidos|sin_cupo|reintentados`, cada una con desglose por canal (`_sms`, `_whatsapp`, `_email`) en `/api/metrics`; la tasa de fallo también se expone por API para la UI.
- **Checklist de producción** (paso 5): el de arriba, más la nota de estado en `CREDENCIALES-PENDIENTES.md`.

**Sobre el paso 4 (suite E2E):** los flujos de mensajería están cubiertos por pruebas de integración contra Postgres real repartidas por fase —OTP y reserva (`agendamiento.spec`), outbox y webhook (`notificaciones.spec`), plantillas, cupos por ciclo y bloqueo D2 (`cupos-plan.spec`), recordatorios multiventana, verificación de especialista (`verificacion-especialista.spec`)— y no se duplicaron como una suite E2E aparte. Lo que **no** se puede probar automáticamente es la entrega real del operador: eso es la prueba de humo del checklist.

## Trazabilidad
Todas las RF/RNF de mensajería, ADR-007/009, Parte VI/IX del plan, `Plan-Ejecucion-V1/FASE-14`.

## Resultado esperado
Sistema de mensajería **en producción**, auditable, con límites y alertas — objetivo del plan cumplido.
