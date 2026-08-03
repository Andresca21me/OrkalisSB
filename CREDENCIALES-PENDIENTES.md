# Credenciales pendientes (checklist vivo)

> Este archivo es solo un **recordatorio de qué claves faltan por entregar** y en qué fase se usan.
> **NO contiene valores reales.** Las claves las pondrá EL USUARIO directamente en `apps/api/.env`
> (backend) cuando cada fase lo indique. Claude trabaja con placeholders hasta entonces.
> Nunca pegues claves en el chat ni en el código (RNF-012).

## Dónde van las claves
- Todas las credenciales del backend se cargan en **`apps/api/.env`** (ignorado por git).
- Existirá un `apps/api/.env.example` con las variables vacías como plantilla.

## Checklist por proveedor

### Railway (hosting) — se usa en FASE-14
- [ ] Cuenta creada en railway.app
- [ ] Token / credenciales de despliegue de producción (se entregan en FASE-14)

### Twilio (SMS / WhatsApp / Verify) — Plan-Mensajeria FASE-00+
> **Local: envío real ACTIVADO** (2026-07-21). Con las 3 claves `TWILIO_*` en
> `apps/api/.env`, el backend usa `TwilioAdapter` (no mock). En cuenta **trial**,
> Twilio solo entrega a números **verificados** en el panel. Para volver a mock,
> deja `TWILIO_AUTH_TOKEN` vacío y reinicia la API.
> **Railway/producción: ✅ ACTIVO desde 2026-07-22.** Cuenta Twilio de pago (ya no
> es trial) y las cinco `TWILIO_*` cargadas en el servicio API. Confirmado en el
> log de arranque: `Adaptadores activos: TwilioSmsAdapter, MockAdapter`. **Se
> envían SMS reales y se gasta saldo.**
> **Vuelta atrás:** borrar `TWILIO_AUTH_TOKEN` en Railway y reiniciar → vuelve al
> mock sin desplegar nada.
- [x] `TWILIO_ACCOUNT_SID`
- [x] `TWILIO_AUTH_TOKEN`
- [x] `TWILIO_FROM_NUMBER` (`+1669…`, long code US trial)
- [x] `TWILIO_MESSAGING_SERVICE_SID` (se cablea en FASE-01)
- [x] `TWILIO_VERIFY_SERVICE_SID` (se usa en FASE-06)
- [x] `TWILIO_WHATSAPP_FROM` — sender `+573155909339` registrado y ONLINE en Twilio
  (perfil «Orkalis», WABA propia). ⚠️ En Railway existía como `TWILIO_WHATSAPP_NUMBER`
  (nombre que el código no lee): la variable correcta es `TWILIO_WHATSAPP_FROM`,
  en E.164 SIN el prefijo `whatsapp:`.
- [~] `TWILIO_WA_TPL_*` (AM-3) — las 6 plantillas creadas por Content API y **enviadas a
  aprobación de Meta el 2026-08-03** (`orkalis_confirmacion`, `orkalis_recordatorio`,
  `orkalis_aviso`, `orkalis_aviso_especialista`, `orkalis_marketing`, `orkalis_otp`
  — esta última de categoría AUTHENTICATION: Meta genera su texto, no admite cuerpo
  propio). Los Content SID (no son secretos) se cargan en Railway al aprobarse.
  Nota: `orkalis_otp_v2` (texto libre creada a mano en la consola) no sirve para
  OTP — Meta rechaza códigos en plantillas de texto; se dejó sin enviar.
- [x] `TWILIO_STATUS_CALLBACK_URL` (AM-4) — puesta en Railway:
  `https://api.orkalis.com/api/webhooks/twilio/status`. El endpoint existe y valida la
  firma (responde 403 sin `X-Twilio-Signature` válida). **Falta el lado de Twilio:**
  pegar esa MISMA URL como *Status Callback* del Messaging Service (Messaging →
  Services → Integration). Debe coincidir carácter por carácter, porque la firma se
  calcula sobre la URL exacta.
  > Ojo: producción está en **mock** (sin claves Twilio) hasta FASE-10, así que el
  > callback no recibirá nada real todavía. Y los SMS que salen de **tu entorno local**
  > no los verá este webhook (otra base de datos): para probarlo en local hace falta un
  > túnel (`ngrok http 3000`) apuntando la variable al dominio del túnel.
- [ ] (Opcional, email) `SENDGRID_API_KEY` + `MAIL_FROM`
- Nota: el SDK `twilio` ya está instalado en `apps/api`. `@sendgrid/mail` es opcional
  (instalar antes de activar el envío de email real).

### Wompi (pasarela de suscripción, sandbox) — se usa en FASE-12
> **FASE-12 implementada en modo INACTIVO** (sin claves). El cálculo del cargo,
> el registro de cobros, el webhook firmado y los endpoints del operador YA
> funcionan; solo falta conectar el checkout real. Para activarlo:
> 1. Pegar las 4 variables `WOMPI_*` en `apps/api/.env` y reiniciar la API.
> 2. En el panel de Wompi, apuntar el webhook a `POST /api/pagos/wompi/webhook`
>    (en dev, exponer con un túnel tipo ngrok).
> Sin claves, `crearCheckoutUrl` devuelve un placeholder y se loguea el aviso.
- [ ] `WOMPI_PUBLIC_KEY` (`pub_test_...`)
- [ ] `WOMPI_PRIVATE_KEY` (`prv_test_...`)
- [ ] `WOMPI_EVENTS_SECRET` (secreto de eventos / integridad del webhook)
- [ ] `WOMPI_ENV=sandbox`

---

## Estado de cuentas (confirmación del USUARIO, FASE-00 — 2026-06-15)
- [x] Cuenta Railway creada
- [x] Cuenta Twilio (trial) creada
- [ ] Cuenta Wompi (sandbox) creada — **PENDIENTE** (no bloquea; se necesita en FASE-12)
