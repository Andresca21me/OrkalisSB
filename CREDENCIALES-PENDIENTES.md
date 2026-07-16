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

### Twilio (SMS para OTP y recordatorios) — se usa en FASE-11
> **FASE-11 implementada con MOCK.** Sin estas claves en `apps/api/.env`, el backend
> usa el `MockAdapter` (loguea el SMS en consola y NO envía). Para envío real:
> pegar las 3 variables `TWILIO_*` y reiniciar la API (el adaptador se elige por entorno).
> En cuenta trial, Twilio solo envía a números **verificados** en su panel.
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_FROM_NUMBER` (número trial)
- [ ] (Opcional, email) `SENDGRID_API_KEY` + `MAIL_FROM`
- Nota: los SDK `twilio` / `@sendgrid/mail` son dependencias opcionales; instalarlas
  (`pnpm --filter api add twilio`) antes de activar el envío real.

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
