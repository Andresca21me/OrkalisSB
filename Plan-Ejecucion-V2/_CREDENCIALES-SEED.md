# _CREDENCIALES-SEED · Usuarios sembrados (SOLO DESARROLLO)

> ⚠️ **Solo para entornos de desarrollo.** Estas credenciales las crea el script de seed
> (`apps/api/src/db/seed.ts`), que **se niega a correr con `NODE_ENV=production`**. No usar en
> ningún entorno real. La contraseña va en claro aquí a propósito porque es un fixture de dev.

## Cómo sembrar

```bash
# 1) Base de datos arriba (docker compose up -d) y migraciones aplicadas:
pnpm --filter api db:migrate
# 2) Sembrar (idempotente: borra y reinserta los tenants de demo):
pnpm --filter api db:seed
```

El seed crea **dos tenants** (barbería + salón) con datos realistas + un negocio "plataforma".
Es idempotente: cada corrida deja el mismo estado.

## Contraseña común (todos los usuarios)

```
Orkalis2026!
```

## Usuarios

| Rol | Nombre | Email (login) | Tenant |
|---|---|---|---|
| Operador de plataforma | Operador Plataforma | `operador@orkalis.demo` | Plataforma Orkalis |
| **Admin** | Admin Barbería | `admin@orkalis.demo` | Barbería Orkalis Demo |
| Recepcionista | Recepción Barbería | `recepcion@barberia.orkalis.demo` | Barbería Orkalis Demo |
| Especialista | Carlos Barbero | `carlos@barberia.orkalis.demo` | Barbería Orkalis Demo |
| **Admin** | Admin Salón | `admin@salon.orkalis.demo` | Salón Orkalis Demo |
| Recepcionista | Recepción Salón | `recepcion@salon.orkalis.demo` | Salón Orkalis Demo |
| Especialista | Valentina Ríos | `valentina@salon.orkalis.demo` | Salón Orkalis Demo |

> El email es **único global** entre usuarios internos (login solo con email, sin id de negocio).
> Los especialistas Diana (barbería) y Sara (salón) existen como recurso de agenda **sin login**.

## Qué datos trae cada tenant

**Barbería Orkalis Demo** (perfil `barberia`, plan `pro`):
- 2 sucursales: *Sede Centro*, *Sede Norte*.
- 2 especialistas (Carlos en ambas sedes con login; Diana solo Centro).
- 4 servicios con repartición (% y valor fijo): Corte, Barba, Corte+barba, Tinte.
- 4 clientes.
- 3 productos de inventario (incl. **Shampoo profesional en stock bajo** → dispara alerta).
- 3 gastos (arriendo, servicios públicos, insumos).
- 11 citas: 6 de hoy (solicitada, confirmada, en progreso, otra confirmada, cancelada, no asistió)
  + 5 completadas con atención (1 hoy + 4 en la quincena anterior → **período liquidable**).

**Salón Orkalis Demo** (perfil `salon`, plan `premium`):
- 1 sucursal: *Salón Principal*.
- 2 especialistas (Valentina con login; Sara sin login).
- 4 servicios: Corte y peinado, Manicure, Tinte y mechas, Tratamiento capilar.
- 3 clientes.
- 3 productos (incl. **Tinte profesional 60ml en stock bajo** → alerta).
- 2 gastos (arriendo, productos).
- Mismo patrón de citas/atenciones que la barbería (incl. quincena liquidable).

**Plataforma Orkalis** (negocio técnico): solo el operador transversal, plan `empresarial`.

## Para probar flujos

- **Reserva pública** (sin sesión): `GET /sucursales` no aplica; usa el `sucursalId` de *Sede Centro*
  o *Salón Principal* en la ruta `/reservar/:sucursalId` o `GET /public/:sucursalId/info`.
  Para obtener los ids: `SELECT id, nombre FROM sucursal;`.
- **Liquidación**: las atenciones de hace ~11–12 días forman un período quincenal cerrable
  (`POST /liquidaciones/generar`).
- **Alerta de inventario**: `GET /inventario/alertas` devuelve el producto en stock bajo de cada tenant.
</content>
