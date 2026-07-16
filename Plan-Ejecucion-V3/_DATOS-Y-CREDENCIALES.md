# _DATOS-Y-CREDENCIALES · Datos del seed para las pruebas

Documento de apoyo. Resume qué hay en el seed y cómo lo consumen las pruebas. Fuente: `apps/api/src/db/seed.ts` (y `Plan-Ejecucion-V2/_CREDENCIALES-SEED.md`).

> ⚠️ Solo desarrollo. El seed se niega a correr con `NODE_ENV=production`. Contraseña común: **`Orkalis2026!`**.

## 1. Usuarios (login)

| Rol | Email | Tenant | Uso típico en pruebas |
|---|---|---|---|
| Operador plataforma | `operador@orkalis.demo` | Plataforma | FASE-13 |
| **Admin** barbería | `admin@orkalis.demo` | Barbería | ADM + oráculo (ids) |
| Recepción barbería | `recepcion@barberia.orkalis.demo` | Barbería | REC |
| Especialista barbería | `carlos@barberia.orkalis.demo` (Carlos) | Barbería | ESP |
| **Admin** salón | `admin@salon.orkalis.demo` | Salón | aislamiento / 2º tenant |
| Recepción salón | `recepcion@salon.orkalis.demo` | Salón | aislamiento |
| Especialista salón | `valentina@salon.orkalis.demo` | Salón | aislamiento |

Especialistas **sin login** (recurso de agenda): Diana (barbería, solo *Sede Centro*), Sara (salón). Útiles para probar reasignación y disponibilidad.

Centralizar en `e2e/fixtures/roles.ts` (hereda de `helpers.ts` v2).

## 2. Tenants y su forma

**Barbería Orkalis Demo** — perfil `barberia`, plan `pro`:
- Sucursales: **Sede Centro**, **Sede Norte** (multi-sede → prueba de filtro/consolidado y especialista en 2 sedes).
- Especialistas: Carlos (ambas sedes, con login), Diana (solo Centro, sin login).
- Servicios: Corte, Barba, Corte+barba, Tinte (repartición % y valor fijo → prueba de payout).
- 4 clientes (incl. **Juan Pérez** → usado en aislamiento).
- Inventario: 3 productos, **Shampoo profesional en stock bajo** → alerta.
- Gastos: arriendo, servicios públicos, insumos.
- Citas: **6 de hoy** cubriendo todos los estados (solicitada, confirmada, en progreso, confirmada, cancelada, no asistió) + **5 completadas** (1 hoy + 4 en la quincena anterior → **período liquidable**).

**Salón Orkalis Demo** — perfil `salon`, plan `premium`:
- 1 sucursal: **Salón Principal**.
- Especialistas: Valentina (login), Sara (sin login).
- Servicios: Corte y peinado, Manicure, Tinte y mechas, Tratamiento capilar.
- 3 clientes (incl. **Laura Castro** → aislamiento), 3 productos (**Tinte 60ml en stock bajo**), 2 gastos.
- Mismo patrón de citas/atenciones (incl. quincena liquidable).

**Plataforma Orkalis** — negocio técnico, plan `empresarial`, solo el operador.

## 3. Cómo obtener ids en las pruebas (oráculo API)

Nunca hardcodear UUIDs. Resolverlos en runtime:

```ts
const token = await loginAPI(request, USERS.adminBarberia);
const h = { Authorization: `Bearer ${token}` };
const sucursales = await (await request.get('/api/sucursales', { headers: h })).json();
const centro = sucursales.find(s => s.nombre.includes('Centro'));
const servicios = await (await request.get(`/api/public/${centro.id}/servicios`)).json();
```

Endpoints útiles como oráculo (lectura/siembra):
- `GET /api/sucursales` — ids de sede por tenant.
- `GET /api/public/:suc/servicios` · `/especialistas` · `/info` — catálogo público (sin token).
- `GET /api/public/:suc/disponibilidad?especialista=any&servicios=:id&fecha=YYYY-MM-DD` — franjas libres.
- `GET /api/inventario/alertas` — producto en stock bajo (FASE-08).
- `GET /api/citas?...`, `GET /api/clientes`, `GET /api/equipo`, `GET /api/suscripcion` — estado para aserciones de apoyo.
- `GET /api/plataforma/suscripciones` · `GET /api/plataforma/negocios/:id` — operador (FASE-13).

> El oráculo se usa para **preparar** (obtener un id, sembrar una cita rápida) o como **doble verificación**, pero la aserción principal del flujo es siempre sobre la **UI**.

## 4. OTP en pruebas (reserva del cliente)

`POST /api/public/:suc/otp/enviar { telefono }` devuelve `{ devCode }` cuando `NODE_ENV ≠ production`. En la prueba de UI:
- Opción A (preferida, E2E real): interceptar la respuesta de `otp/enviar` con `page.waitForResponse` y leer `devCode`, luego teclearlo en el campo OTP de la pantalla.
- Opción B (atajo API para el camino feliz no-UI): completar vía `request` (como en el `booking.spec.ts` v2).

## 5. Datos únicos por prueba

- Teléfono cliente: `'30' + Date.now().toString().slice(-8)` (o sufijo aleatorio).
- Nombre: `'E2E ' + Math.random().toString(36).slice(2,8)`.
- Para concurrencia, dos teléfonos distintos sobre la **misma** franja.

## 6. Fechas y disponibilidad

- Zona **America/Bogotá** (UTC-5). El helper `hoyISO()` de `apps/web/src/lib/format.ts` da el día local; replicar en `fixtures/data.ts`.
- La disponibilidad depende de los horarios sembrados: buscar franja recorriendo **hoy..+10 días** hasta encontrar una libre (patrón ya usado en `booking.spec.ts` v2).
- La **quincena liquidable** son atenciones de ~11–12 días atrás: usarlas para FASE-09 (liquidaciones/cierre) sin tener que crearlas.

## 7. Re-siembra para fases destructivas

Las fases que cierran período (FASE-09), suspenden tenants (FASE-13) o desactivan módulos (FASE-10) pueden dejar el seed en un estado no idempotente para otras pruebas. Convención: estas fases corren **al final** o re-siembran en `test.beforeAll` con:

```bash
pnpm --filter api db:seed   # idempotente: reinstala el estado base
```

Documentar en cada fase si requiere re-siembra y por qué.
