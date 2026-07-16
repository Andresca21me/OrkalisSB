# Cierre V2 — QA, paridad y deudas (FASE-14)

Resultado del gate final de la v2. Acompaña al tablero de `PLAN-V2.md`.

## 1. Checklist de paridad por pantalla

Leyenda: ✅ fiel al prototipo · 🎨 construida con el DS (sin pantalla en el
prototipo) · 🟡 maqueta sin funcionalidad (alcance v2).

| Área | Pantalla | Estado |
|---|---|---|
| Público | Reserva (`/reservar/:sucursalId`) — servicios, disponibilidad, OTP, confirmación | ✅ |
| Auth | Login | ✅ |
| Onboarding | Alta de negocio (admin) | ✅ |
| Admin | Panel / dashboard (KPIs, accesos rápidos) | ✅ |
| Admin | Agenda | ✅ |
| Admin | Clientes (CRM, historial) | ✅ |
| Admin | Gestión (equipo, servicios, inventario) | ✅ |
| Admin | Finanzas (análisis, control quincenal, reportes) | ✅ |
| Admin | Configuración (cuenta, módulos, suscripción) | ✅ |
| Especialista | App móvil (agenda, iniciar/cobrar/completar, walk-in) | ✅ |
| Recepción | Tablero (estilo Agenda admin, reasignar, walk-in, cobro) | ✅ |
| Plataforma | Consola del operador (tenants, suscripciones, cupos, suspensión) | 🎨 |
| Sitio | Landing / Precios / Comparativa / Calculadora | ✅ |
| Sitio | Alta self-service + Checkout Wompi | 🟡 (Wompi diferido) |

## 2. Accesibilidad (FASE-14 §3)

- Foco visible global 2px `#1A73E8` (`base.css :focus-visible`, tokens
  `--focus-ring`/`--focus-width`).
- Diálogos (`Dialog`, `Modal`, `Sheet`): `role="dialog"` + `aria-modal` +
  `aria-labelledby`, **focus-trap**, foco inicial, restauración al cerrar, cierre
  con `Esc` y bloqueo de scroll de fondo — vía hook único `lib/useDialogA11y.ts`.
- `prefers-reduced-motion`: red de seguridad global en `base.css` + manejo propio
  en `AnimatedBackground`, `Reveal` y el botón primario.
- Estados de lista: cargando / vacío / error con copy del DS (sin stack traces);
  401→refresh automático (`lib/api.ts`), 409 (conflicto) en reserva y reasignación.

## 3. Rendimiento (FASE-14 §6)

Code-splitting por ruta/rol (`App.tsx` con `React.lazy` + `Suspense`):

| Antes | Después |
|---|---|
| `index` monolítico **937 kB** | `index` base **242 kB** + un chunk por app (admin 118, site 62, spec 41, booking 31, onboarding 19, plataforma 13, recepción 8 kB) |
| recharts cargaba al entrar a admin | **recharts (384 kB) diferido**: solo carga al abrir Finanzas → Análisis/Reportes |

Iconos Lucide tree-shaken; shader del hero en chunk lazy de 5.4 kB.

## 4. Pruebas E2E (FASE-14 §5)

`apps/web/e2e/` (Playwright, gate en CI). Contra la **API real** + seed:

- `auth.spec.ts` — login y enrutado por rol (admin, operador, recepción,
  especialista) + credenciales inválidas.
- `booking.spec.ts` — render de la reserva pública + **reserva completa con OTP** +
  **concurrencia** (la misma franja no se reserva dos veces — garantía EXCLUDE).
- `isolation.spec.ts` — **aislamiento multi-tenant** desde el front (barbería no ve
  clientes del salón y viceversa).

Correr en local: DB arriba + `pnpm --filter api db:seed` + `pnpm --filter api start`,
luego `pnpm --filter web e2e`.

## 5. Deudas conocidas (candidatas a v2.1)

- **Wompi / alta self-service**: el sitio es solo visual en v2 (decisión de alcance
  #1). Falta cablear creación de transacción, checkout y el alta pública del negocio.
- **Panel de plataforma**: construido con el DS (no había prototipo). Cubre tenants,
  suscripción, cupos, cobro y suspensión; faltarían auditoría de acciones del
  operador y métricas agregadas de plataforma.
- **Reportes PDF**: exportación diferida.
- **E2E**: faltan los flujos internos completos por UI (admin crear→cobrar→reporte;
  especialista iniciar→cobrar; recepción reasignar→walk-in) — hoy cubiertos por las
  pruebas de API. Ampliarlos por UI en v2.1.
- **Bundle**: el chunk base (242 kB) podría afinarse más (router/vendor split).

## 6. Acción del USUARIO (bloqueante para deploy)

- Proveer entornos `staging`/`prod`: `VITE_API_URL`, `CORS_ORIGIN`, llaves Wompi
  prod, dominio/TLS (ver `DEPLOY.md`).
- Aprobar la auditoría visual final contra el prototipo.
- Claude deja todo listo pero **no** ejecuta el primer deploy a `prod`.
