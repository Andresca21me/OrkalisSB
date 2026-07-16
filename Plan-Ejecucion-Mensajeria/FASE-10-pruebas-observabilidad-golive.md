# FASE-10 · Pruebas E2E, observabilidad y go-live

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.

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

## Trazabilidad
Todas las RF/RNF de mensajería, ADR-007/009, Parte VI/IX del plan, `Plan-Ejecucion-V1/FASE-14`.

## Resultado esperado
Sistema de mensajería **en producción**, auditable, con límites y alertas — objetivo del plan cumplido.
