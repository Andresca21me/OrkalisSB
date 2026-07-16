import { sql } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';

loadEnv();

// Importes diferidos: client.ts exige DATABASE_URL al cargarse.
import { runInTenantTx } from './tx';
import { client } from './client';
import type { TenantContext } from './tenant-context';

/**
 * Test de integración (FASE-02, Verificación):
 * confirma que runInTenantTx fija la GUC `app.current_tenant` y ejecuta una
 * query simple dentro de la transacción. Requiere Postgres local levantado.
 */
describe('runInTenantTx', () => {
  afterAll(async () => {
    await client.end();
  });

  const ctx: TenantContext = {
    negocioId: '11111111-1111-1111-1111-111111111111',
    sucursalIds: null,
    rol: 'admin',
  };

  it('ejecuta SELECT 1 dentro de la transacción', async () => {
    const result = await runInTenantTx(ctx, async (tx) => {
      const rows = await tx.execute(sql`SELECT 1 AS uno`);
      return rows;
    });
    expect(result[0]).toEqual({ uno: 1 });
  });

  it('fija app.current_tenant con el negocioId pasado', async () => {
    const tenant = await runInTenantTx(ctx, async (tx) => {
      const rows = await tx.execute<{ tenant: string }>(
        sql`SELECT current_setting('app.current_tenant', true) AS tenant`,
      );
      return rows[0]?.tenant;
    });
    expect(tenant).toBe(ctx.negocioId);
  });

  it('la GUC es local: fuera de la tx no persiste', async () => {
    await runInTenantTx(ctx, async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });
    const rows = await client`SELECT current_setting('app.current_tenant', true) AS tenant`;
    // SET LOCAL no debe filtrarse a una nueva consulta fuera de la transacción.
    expect(rows[0]?.tenant === null || rows[0]?.tenant === '').toBe(true);
  });
});
