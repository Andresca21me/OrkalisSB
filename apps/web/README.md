# apps/web — Frontend Orkalis (FASE-13)

App **Vite + React + TypeScript** que integra el **design system del prototipo**
(`Prototipo Interfaz Orkalis/_ds` — tokens, tipografías, estilo Linear/Ramp) y se
conecta a la API por los cuatro frentes: **admin**, **especialista**, **recepción**,
**enlace público de reservas**, más el **operador de plataforma**.

## Ejecutar

```bash
# 1) Backend en :3000 (ver apps/api)
pnpm --filter api start
# 2) Frontend en :5173 (proxy /api → :3000)
pnpm --filter web dev
```

- Localización **es-CO / COP** centralizada en `src/lib/format.ts`.
- Cliente HTTP con **access token + refresh automático** en `src/lib/api.ts`.
- Auth + enrutamiento por rol en `src/lib/auth.tsx` y `src/App.tsx`.
- Design system portado a TS en `src/ui/` (tokens en `src/styles/`).

## Rutas

| Ruta | Quién |
|---|---|
| `/login` | usuarios internos |
| `/admin` | administrador (reportes, agenda, clientes, servicios, equipo, sucursales, gastos, configuración, suscripción) |
| `/especialista` | especialista (agenda del día + flujo de turno con guard de pago) |
| `/recepcion` | recepción (agenda del día, walk-ins, cobro) |
| `/plataforma` | operador de plataforma (suscripciones, suspender/reactivar, cobro) |
| `/reservar/:sucursalId` | **público sin login** (reserva con OTP) |

> Credenciales de demo (seed): `admin@orkalis.demo`, `operador@orkalis.demo` · clave `Admin1234!`.
> Enlace público de prueba: `/reservar/<id-de-sucursal>`.
