# FASE-02 · PostgreSQL local y Drizzle ORM

## Objetivo
Levantar PostgreSQL local con Docker y conectar **Drizzle ORM** al backend, implementando desde el principio el **patrón de transacción por petición que fija la GUC de tenant** (`SET LOCAL app.current_tenant`), que es la base del aislamiento RLS (ADR-004).

## Prerrequisitos
- FASE-01 completa (monorepo, `apps/api` con NestJS).

---

## Pasos de Claude

### 1. Postgres local con Docker
Crear `docker-compose.yml` en la raíz:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: orkalis
      POSTGRES_PASSWORD: orkalis
      POSTGRES_DB: orkalis
    ports:
      - "5432:5432"
    volumes:
      - orkalis_pgdata:/var/lib/postgresql/data
volumes:
  orkalis_pgdata:
```
> Postgres 16 incluye `btree_gist` (necesario en FASE-03 para el `EXCLUDE`). Levantar con `docker compose up -d`.

### 2. Instalar Drizzle en `apps/api`
- Dependencias: `drizzle-orm`, `postgres` (driver `postgres.js`) y dev `drizzle-kit`.
- Crear `apps/api/drizzle.config.ts` apuntando a `./src/db/schema/*` para el esquema y `./drizzle` para las migraciones, usando `DATABASE_URL`.

### 3. Estructura de la capa de datos
```
apps/api/src/db/
├─ schema/            (un archivo por grupo de tablas — se llena en FASE-03)
│  └─ index.ts        (reexporta todo el esquema)
├─ client.ts          (crea el pool postgres.js + instancia drizzle)
├─ tenant-context.ts  (define el tipo TenantContext)
└─ tx.ts              (helper de transacción que fija la GUC)
```

### 4. `client.ts`
- Crear el cliente `postgres.js` con `DATABASE_URL` y la instancia `db = drizzle(client, { schema })`.
- Exportar ambos.

### 5. `tenant-context.ts`
Definir el tipo que viajará por petición (lo poblará Auth en FASE-05):
```ts
export interface TenantContext {
  negocioId: string;
  // alcance: las sucursales a las que el usuario tiene acceso. null = todas (admin consolidado)
  sucursalIds: string[] | null;
  // sucursal activa seleccionada para la operación actual (opcional)
  sucursalActivaId?: string | null;
  rol: string; // RolUsuario de @orkalis/shared
  usuarioId?: string;
}
```

### 6. `tx.ts` — patrón CLAVE de aislamiento (ADR-004)
Implementar un helper que **abre una transacción y fija la variable de sesión de tenant ANTES de cualquier consulta**, para que RLS (FASE-04) actúe:
```ts
// Pseudocódigo guía — ejecuta SET LOCAL dentro de la transacción
export async function runInTenantTx<T>(
  ctx: TenantContext,
  fn: (tx: DrizzleTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // fija el tenant para RLS (usar parámetro, NO interpolar string a mano)
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${ctx.negocioId}, true)`);
    // (opcional) fija alcance de sucursal si se usa en políticas RLS
    return fn(tx);
  });
}
```
> `set_config(..., true)` = `SET LOCAL`: solo vive dentro de la transacción. Nunca uses interpolación de strings para el `negocioId` (riesgo de inyección); usa parámetros.

### 7. Primera migración (esquema mínimo + extensiones)
Crear una migración inicial que:
- Habilite extensiones: `CREATE EXTENSION IF NOT EXISTS btree_gist;` y `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` (o usar `gen_random_uuid()` de `pgcrypto`/core).
- (Las tablas reales se crean en FASE-03; aquí basta con dejar el pipeline de migraciones funcionando con las extensiones).
- Generar la migración con `drizzle-kit generate` y aplicarla con `drizzle-kit migrate` (o un script `db:migrate`).

### 8. Scripts en `apps/api/package.json`
- `db:generate` → `drizzle-kit generate`
- `db:migrate` → aplica migraciones
- `db:studio` → `drizzle-kit studio` (opcional, inspección visual)

### 9. Módulo de base de datos en NestJS
- Crear `DbModule` (global) que provea `db` y un provider para construir el `TenantContext` por request (de momento un stub; se conecta a Auth en FASE-05).

---

## ⚠️ ACCIÓN DEL USUARIO
- Asegurar que Docker está corriendo. Si Claude no puede ejecutar `docker compose up -d`, el USUARIO lo ejecuta.

---

## Verificación / Done
- `docker compose up -d` levanta Postgres y `docker ps` lo muestra sano.
- `pnpm --filter api db:migrate` aplica la migración inicial sin error.
- Conectando a la BD (`db:studio` o `psql`), las extensiones `btree_gist` y la de UUID están instaladas.
- Un test mínimo o un endpoint de healthcheck confirma que `runInTenantTx` ejecuta una query simple (`SELECT 1`) dentro de la transacción con la GUC fijada (consultar `current_setting('app.current_tenant')` devuelve el valor pasado).

## Trazabilidad
- ADR-004 (Drizzle + patrón GUC/transacción + migraciones versionadas), ADR-000 (PostgreSQL), prepara ADR-001 (RLS).
