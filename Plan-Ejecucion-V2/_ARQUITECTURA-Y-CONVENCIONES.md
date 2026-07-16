# _ARQUITECTURA-Y-CONVENCIONES · Cimientos de `apps/web` v2 (FASE-00)

> Contrato de arquitectura del frontend para TODAS las fases. Decidido en FASE-00; las fases de UI
> lo siguen sin re-discutirlo. Reglas globales en `PLAN-V2.md` §6.

## 1. Estructura de carpetas de `apps/web/src/`

```
apps/web/src/
├── main.tsx                  # bootstrap (QueryClientProvider + AuthProvider + Router)  [conservar/ajustar]
├── App.tsx                   # mapa de rutas por rol                                     [reescribir layout, conservar lógica de roles]
├── ui/                       # primitivos del Design System (FASE-01)
│   ├── Button.tsx Input.tsx Select.tsx Checkbox.tsx Switch.tsx
│   ├── Badge.tsx Tag.tsx Avatar.tsx Card.tsx KpiCard.tsx Tabs.tsx
│   ├── Alert.tsx Tooltip.tsx Dialog.tsx Toast.tsx Skeleton.tsx
│   ├── EmptyState.tsx ErrorState.tsx
│   ├── Chart.tsx             # wrappers recharts del DS (FASE-01, decisión #4)
│   ├── icons.ts              # re-export Lucide                                          [conservar/ampliar]
│   ├── Shell.tsx             # layout admin/recepción (sidebar navy 240px + topbar)      [FASE-02]
│   ├── Sidebar.tsx Topbar.tsx
│   └── index.ts              # barrel de primitivos
├── pages/                    # una carpeta por app/rol
│   ├── public/               # reserva del cliente (móvil-first)      [FASE-03]
│   ├── onboarding/           # onboarding del negocio                 [FASE-04]
│   ├── admin/                # panel, agenda, clientes, gestión, finanzas, config [05–09]
│   ├── spec/                 # app del especialista (responsive)      [FASE-10]
│   ├── recepcion/            # recepción                              [FASE-11]
│   ├── site/                 # sitio marketing (solo visual)          [FASE-12]
│   └── plataforma/           # panel del operador                     [FASE-13]
└── lib/
    ├── api.ts                # cliente HTTP central                   [CONSERVAR]
    ├── auth.tsx              # AuthProvider + useAuth                  [CONSERVAR]
    ├── format.ts             # COP/es-CO, fechas                       [CONSERVAR/ampliar]
    ├── localizacion.ts       # textos/locale es-CO (nuevo)
    ├── queryClient.ts        # config de @tanstack/react-query (nuevo)
    └── hooks de datos:       # un hook por recurso, tipado con @orkalis/shared
        useCitas.ts useClientes.ts useServicios.ts useInventario.ts
        useGastos.ts useReportes.ts useConfig.ts useEquipo.ts
        useSucursales.ts useSuscripcion.ts usePublicBooking.ts
        usePlataforma.ts useLiquidaciones.ts useCierres.ts
```

## 2. Capa de datos

- **Librería:** `@tanstack/react-query` sobre `lib/api.ts`. Instalar en FASE-01:
  `pnpm --filter web add @tanstack/react-query`. Montar `QueryClientProvider` en `main.tsx`.
  (El hook `lib/useApi.ts` actual es un fetch+estado mínimo; se **reemplaza** por react-query; puede
  conservarse temporalmente para pantallas aún no migradas, pero el objetivo es retirarlo.)
- **Regla:** nada de `fetch` suelto en componentes; nada de `localStorage` para datos de dominio
  (el "puente" `orkalis_public_booking` del prototipo se reemplaza por los endpoints `public/*`).
- **Convención de hook por recurso:** cada `useXxx.ts` expone queries (`useCitas(filtros)`) y
  mutations (`useAprobarCita()`), invalida los query keys afectados, y tipa entrada/salida con
  `@orkalis/shared`. Query keys namespaced: `['citas', filtros]`, `['clientes']`, etc.
- **Estados obligatorios** en cada lista/pantalla: **datos · cargando (Skeleton) · vacío
  (EmptyState) · error (ErrorState con reintento)**. La reserva añade **conflicto** (409 de
  retener/confirmar). Feedback de acciones por **Toast**.

## 3. Tipos compartidos (`packages/shared`)

- `enums.ts` ya completo (fuente de verdad). `dtos.ts` es **placeholder** (`export {}`): cada fase
  que cablee un endpoint añade aquí su DTO de request/response (no se duplican tipos en el front).
- Prioridad de DTOs nuevos según huecos: `DashboardResumen` (H2), `GananciasEspecialista` (H3),
  `CuposMensajeria` (H5), `UsuarioInterno` (H6).

## 4. Mapa de rutas definitivo (rol → ruta base)

Partiendo del `App.tsx` actual (ya correcto en su lógica de roles; se conserva y se le añaden las
rutas públicas del sitio y onboarding):

| Ruta base | Acceso | App | Fase |
|---|---|---|---|
| `/reservar/:sucursalId` | público (sin sesión) | reserva del cliente | 03 |
| `/login` | público | login + estados suspendida/bloqueada | 02 |
| `/onboarding/*` | admin recién creado | onboarding del negocio | 04 |
| `/admin/*` | `admin` | panel, agenda, clientes, gestión, finanzas, config | 05–09 |
| `/especialista/*` | `especialista` | app del especialista | 10 |
| `/recepcion/*` | `recepcionista` | recepción | 11 |
| `/plataforma/*` | `operador_plataforma` | panel del operador | 13 |
| `/` (marketing) | público | sitio web (solo visual) | 12 |
| `*` | — | redirección por rol (`Inicio`) | — |

> Nota: el sitio marketing (`/`) y el panel interno comparten dominio. El `Inicio` por rol actual se
> mantiene como fallback autenticado; el landing público vive en `/` solo cuando no hay sesión (a
> resolver en FASE-12 sin romper el redirect por rol).

## 5. Plan de retiro del andamiaje viejo

**CONSERVAR (no reescribir):**
- `lib/api.ts` — cliente HTTP con refresh/rotación.
- `lib/auth.tsx` — `AuthProvider`/`useAuth`.
- `lib/format.ts` — formateo COP/es-CO (ampliar si falta).
- `styles/*` — tokens del DS ya copiados (colors, typography, spacing, radius-elevation, fonts,
  base, ds-styles, index).
- `App.tsx` — **lógica** de routing por rol (`Protegido`, `Inicio`); se le sustituye el layout.
- `ui/icons.ts` — re-export de Lucide (ampliar).

**REESCRIBIR (todo lo visual, sobre el DS del prototipo):**
- `ui/ui.tsx` → se descompone en primitivos individuales en `ui/` (FASE-01).
- `ui/Shell.tsx` → shell fiel al prototipo (sidebar navy 240px + topbar) (FASE-02).
- `pages/LoginPage.tsx` (FASE-02).
- `pages/public/BookingPage.tsx` → reserva end-to-end real (FASE-03).
- `pages/admin/AdminApp.tsx`, `pages/admin/screens.tsx`, `pages/admin/SuscripcionScreen.tsx`,
  `pages/admin/PlataformaApp.tsx` → se reparten en `pages/admin/*` y `pages/plataforma/*` (05–09, 13).
- `pages/spec/SpecApp.tsx` (FASE-10).
- `pages/recepcion/RecepcionApp.tsx` (FASE-11).

**ELIMINAR cuando su reemplazo esté listo:** `lib/useApi.ts` (tras migrar a react-query).

**NO portar del prototipo (andamiaje):** `ios-frame.jsx`, `tweaks-panel.jsx`, bloques
`EDITMODE-*`, y todos los `*-data.js` / `localStorage` (los reemplaza la API real alimentada por el
seed).

## 6. Decisiones de alcance vigentes (de PLAN-V2 §7)
1. Sitio + alta Wompi (FASE-12): **solo visual**.
2. App del especialista (FASE-10): **web responsive**, no nativa.
3. **Seed** barbería + salón para validar contra API real (ver `apps/api/src/db/seed.ts` y
   `_CREDENCIALES-SEED.md`).
4. Gráficas: **recharts** (wrappers del DS en FASE-01).
</content>
