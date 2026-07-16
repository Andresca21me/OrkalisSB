import { config as loadEnv } from 'dotenv';
loadEnv();

import { and, eq } from 'drizzle-orm';
import { EstadoCita, OrigenCita, PerfilNegocio, RolUsuario } from '@orkalis/shared';
import { adminClient, adminDb } from './admin-client';
import { client, db } from './client';
import { runInTenantTx } from './tx';
import type { TenantContext } from './tenant-context';
import { sucursalScope } from '../common/scope';
import { cita, cliente, especialista, negocio, sucursal } from './schema';

/**
 * Pruebas de aislamiento multi-tenant (FASE-04, RNF-010) — NO NEGOCIABLES.
 *
 * Siembran dos negocios A y B con el cliente ADMIN (bypassa RLS) y luego
 * operan con el cliente de APP (rol orkalis_app, RLS forzada) vía
 * `runInTenantTx`. El acceso cruzado debe devolver vacío o fallar, nunca filtrar.
 */
describe('Aislamiento multi-tenant (RLS + scope de sucursal)', () => {
  const NOMBRE_A = 'Negocio AISLAMIENTO A';
  const NOMBRE_B = 'Negocio AISLAMIENTO B';

  let aId: string;
  let bId: string;
  let a1Id: string; // sucursal 1 de A
  let a2Id: string; // sucursal 2 de A
  let espAId: string;

  const ctxA = (sucursalIds: string[] | null): TenantContext => ({
    negocioId: aId,
    sucursalIds,
    rol: RolUsuario.Admin,
  });

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_A));
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_B));

    const [a] = await adminDb
      .insert(negocio)
      .values({ nombre: NOMBRE_A, perfil: PerfilNegocio.Barberia })
      .returning();
    aId = a.id;
    const [b] = await adminDb
      .insert(negocio)
      .values({ nombre: NOMBRE_B, perfil: PerfilNegocio.Salon })
      .returning();
    bId = b.id;

    const sucs = await adminDb
      .insert(sucursal)
      .values([
        { negocioId: aId, nombre: 'A-Sede1' },
        { negocioId: aId, nombre: 'A-Sede2' },
      ])
      .returning();
    a1Id = sucs[0].id;
    a2Id = sucs[1].id;

    const [esp] = await adminDb
      .insert(especialista)
      .values({ negocioId: aId, nombre: 'Esp A' })
      .returning();
    espAId = esp.id;

    // Una cita confirmada en cada sucursal de A (distinta franja → sin choque EXCLUDE).
    await adminDb.insert(cita).values([
      {
        negocioId: aId,
        sucursalId: a1Id,
        especialistaId: espAId,
        inicio: new Date('2031-01-01T09:00:00Z'),
        fin: new Date('2031-01-01T09:30:00Z'),
        estado: EstadoCita.Confirmada,
        origen: OrigenCita.CreacionInterna,
      },
      {
        negocioId: aId,
        sucursalId: a2Id,
        especialistaId: espAId,
        inicio: new Date('2031-01-01T11:00:00Z'),
        fin: new Date('2031-01-01T11:30:00Z'),
        estado: EstadoCita.Confirmada,
        origen: OrigenCita.CreacionInterna,
      },
    ]);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_A));
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_B));
    await adminClient.end();
    await client.end();
  });

  it('lee su propio negocio (control positivo)', async () => {
    const filas = await runInTenantTx(ctxA(null), (tx) =>
      tx.select().from(negocio).where(eq(negocio.id, aId)),
    );
    expect(filas).toHaveLength(1);
  });

  it('NO puede leer una fila de otro negocio por id (RLS la oculta → vacío)', async () => {
    const filas = await runInTenantTx(ctxA(null), (tx) =>
      tx.select().from(negocio).where(eq(negocio.id, bId)),
    );
    expect(filas).toHaveLength(0);
  });

  it('NO puede INSERTAR poniendo el negocio_id de otro (WITH CHECK falla)', async () => {
    await expect(
      runInTenantTx(ctxA(null), (tx) =>
        tx.insert(cliente).values({ negocioId: bId, nombre: 'Intruso', telefono: '300' }),
      ),
    ).rejects.toThrow();
  });

  it('admin consolidado (sucursalIds=null) ve citas de TODAS sus sucursales', async () => {
    const filas = await runInTenantTx(ctxA(null), (tx) =>
      tx.select().from(cita).where(sucursalScope(ctxA(null), cita.sucursalId)),
    );
    expect(filas.length).toBeGreaterThanOrEqual(2);
  });

  it('usuario con alcance solo a sucursal 1 NO ve citas de la sucursal 2', async () => {
    const ctx = ctxA([a1Id]);
    const filas = await runInTenantTx(ctx, (tx) =>
      tx.select().from(cita).where(and(eq(cita.negocioId, aId), sucursalScope(ctx, cita.sucursalId))),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].sucursalId).toBe(a1Id);
  });

  it('alcance vacío (sucursalIds=[]) NO ve nada', async () => {
    const ctx = ctxA([]);
    const filas = await runInTenantTx(ctx, (tx) =>
      tx.select().from(cita).where(sucursalScope(ctx, cita.sucursalId)),
    );
    expect(filas).toHaveLength(0);
  });

  it('SIN fijar la GUC, la app NO ve nada (RLS es la última línea de defensa)', async () => {
    // Transacción del cliente de app SIN set_config('app.current_tenant', ...).
    const filas = await db.transaction((tx) => tx.select().from(negocio));
    expect(filas).toHaveLength(0);
  });
});
