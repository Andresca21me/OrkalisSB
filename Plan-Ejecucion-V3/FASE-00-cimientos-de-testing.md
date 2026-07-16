# FASE-00 · Cimientos de testing E2E

## Objetivo
Dejar el **andamiaje de pruebas** listo para que todas las fases siguientes solo escriban casos, no infraestructura: estructura de carpetas, fixtures (login por rol, cliente API oráculo, datos únicos), Page Objects base, helper multi-rol para flujos cruzados, y el refactor de los specs heredados de la v2. Sin este cimiento, las demás fases duplicarían código y serían frágiles.

## Prerrequisitos
- v2-FASE-14 cerrada: `playwright.config.ts`, `apps/web/e2e/{helpers,auth,booking,isolation}` existen.
- Entorno operativo: DB + seed + API en `:3000` (ver `_DATOS-Y-CREDENCIALES`).

## Pantallas / rutas bajo prueba
- Ninguna nueva: esta fase valida el **harness** corriendo los specs migrados.

## Pasos de Claude
1. Crear la estructura `e2e/{fixtures,pages,specs}` (ver `_ESTRATEGIA-Y-CONVENCIONES §3`).
2. **fixtures/roles.ts** — absorbe `helpers.ts` v2: `USERS`, `PASSWORD`, `loginUI(page,email)`, `loginAPI(request,email)`.
3. **fixtures/api.ts** — oráculo: `tokenDe(rol)`, `sucursalesDe(rol)`, `serviciosDe(suc)`, `franjaLibre(suc,serv)`, `crearReservaRapida(...)` (atajo API para sembrar una cita cuando la prueba observa, no agenda).
4. **fixtures/data.ts** — `telefonoUnico()`, `nombreUnico()`, `hoyISO()` (Bogotá), `fechaMasDias(n)`.
5. **fixtures/auth.fixture.ts** — fixture de Playwright que entrega páginas ya logueadas: `adminPage`, `espPage`, `recepcionPage`, `operadorPage`; y `abrirRoles([...])` que devuelve un contexto+página por rol para flujos cruzados (cada rol en su propio `BrowserContext`).
6. **pages/** — Page Objects mínimos para Login y para las pantallas que ya se prueban (booking). Los demás se crean en su fase.
7. **Migrar specs v2**: mover `auth.spec.ts`→`specs/01-auth/`, `booking.spec.ts`→`specs/02-reserva/`, `isolation.spec.ts`→`specs/11-multitenant/`, adaptándolos a fixtures/Page Objects. Mantener verde.
8. Crear `e2e/README.md` apuntando a este plan.
9. Verificar que `pnpm --filter web e2e` descubre y corre todo desde la nueva estructura.

## Casos de prueba (de humo del harness)
1. **Smoke de fixtures**: `adminPage` abre logueada en `/admin`; `abrirRoles(['especialista','admin'])` entrega dos sesiones independientes (tokens distintos, sin pisarse).
2. **Smoke del oráculo**: `sucursalesDe('adminBarberia')` devuelve *Sede Centro* y *Sede Norte*; `franjaLibre(...)` halla una franja en ≤10 días.
3. **Specs migrados verdes**: los 10 casos de la v2 (auth×5, booking×3, isolation×2) pasan desde `specs/`.

## Datos de prueba
- Solo lectura del seed para el oráculo; sin mutaciones destructivas.

## Huecos de testabilidad (proponer y aplicar mínimos)
- Evaluar `data-testid` base que se reutilizarán mucho: en `Shell` el contenedor de nav ya es `<nav>` (rol navigation) — suficiente. Marcar como pendientes los de **agenda** (`appt-row-{id}`, `appt-estado`) y **KPIs** (`kpi-{clave}`), que se añadirán en su fase.
- Confirmar que `playwright.config.ts` apunta a `testDir: './e2e'` y descubre `specs/**`. Ajustar `testMatch` si hace falta.

## Verificación / Done
- Estructura `e2e/{fixtures,pages,specs}` creada y documentada.
- Fixtures de login, oráculo, datos y multi-rol funcionando.
- Specs v2 migrados y **verdes** desde la nueva estructura.
- `pnpm --filter web e2e` corre todo; CI sigue verde (sin tocar el workflow).

## Trazabilidad
- Habilita todas las HU (cimiento). RNF-016 (pruebas como gate). Reutiliza v2-FASE-14.
