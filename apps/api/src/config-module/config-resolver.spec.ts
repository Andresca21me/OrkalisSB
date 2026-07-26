import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { NivelConfig, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { negocio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CLAVES } from './registry';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from './config-resolver.service';
import { ConfigWriteService } from './config-write.service';

/**
 * Integración del sistema de configuración (FASE-06): cascada, procedencia,
 * aislamiento por sucursal, validación cruzada, clonado y caché/invalidación.
 * Requiere Postgres local + migraciones. Negocio de perfil BARBERÍA.
 */
describe('Configuración (ConfigResolver + escritura)', () => {
  const NOMBRE = 'Negocio CONFIG TEST';
  let negocioId: string;
  let s1: string;
  let s2: string;
  let resolver: ConfigResolverService;
  let writer: ConfigWriteService;
  let ctx: TenantContext;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb
      .insert(negocio)
      .values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia })
      .returning();
    negocioId = neg.id;
    const sucs = await adminDb
      .insert(sucursal)
      .values([
        { negocioId, nombre: 'C-Sede1' },
        { negocioId, nombre: 'C-Sede2' },
      ])
      .returning();
    s1 = sucs[0].id;
    s2 = sucs[1].id;

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };

    // Cableado del evento de invalidación (lo que en runtime hace @OnEvent).
    const events = new EventEmitter2();
    resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    writer = new ConfigWriteService(resolver, events);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('sin overrides devuelve el default del vertical con procedencia=sistema', async () => {
    const r = await resolver.resolver(negocioId, null, 'modulo.inventario');
    expect(r.valor).toBe(false); // barbería: inventario OFF por defecto
    expect(r.procedencia).toBe(NivelConfig.Sistema);
  });

  it('override de negocio gana sobre el default (procedencia=negocio) e invalida caché', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.inventario', true);
    const r = await resolver.resolver(negocioId, null, 'modulo.inventario');
    expect(r.valor).toBe(true);
    expect(r.procedencia).toBe(NivelConfig.Negocio);
  });

  it('override de sucursal gana sobre el de negocio y NO afecta a otra sucursal', async () => {
    await writer.upsert(ctx, NivelConfig.Sucursal, s1, 'modulo.inventario', false);
    const enS1 = await resolver.resolver(negocioId, s1, 'modulo.inventario');
    const enS2 = await resolver.resolver(negocioId, s2, 'modulo.inventario');
    expect(enS1.valor).toBe(false);
    expect(enS1.procedencia).toBe(NivelConfig.Sucursal);
    expect(enS2.valor).toBe(true); // hereda del negocio
    expect(enS2.procedencia).toBe(NivelConfig.Negocio);
  });

  it('rechaza un override de repartición que rompe el 100%', async () => {
    await expect(
      writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.reparticion_profesional', 70),
    ).rejects.toThrow();
  });

  it('setReparticion atómico (70/30) se acepta y resuelve correctamente', async () => {
    await writer.setReparticion(ctx, NivelConfig.Negocio, negocioId, 70, 30);
    const prof = await resolver.resolver(negocioId, null, 'finanzas.reparticion_profesional');
    const salon = await resolver.resolver(negocioId, null, 'finanzas.reparticion_salon');
    expect(prof.valor).toBe(70);
    expect(salon.valor).toBe(30);
  });

  it('clonar copia los overrides de una sucursal (instantánea, no enlace vivo)', async () => {
    await writer.upsert(ctx, NivelConfig.Sucursal, s1, 'agendamiento.antelacion_cancelacion_horas', 48);
    await writer.clonar(ctx, s1, s2);
    expect((await resolver.resolver(negocioId, s2, 'agendamiento.antelacion_cancelacion_horas')).valor).toBe(48);

    // Cambiar el origen DESPUÉS no afecta al destino (es instantánea).
    await writer.upsert(ctx, NivelConfig.Sucursal, s1, 'agendamiento.antelacion_cancelacion_horas', 12);
    expect((await resolver.resolver(negocioId, s2, 'agendamiento.antelacion_cancelacion_horas')).valor).toBe(48);
    expect((await resolver.resolver(negocioId, s1, 'agendamiento.antelacion_cancelacion_horas')).valor).toBe(12);
  });

  it('borrar un override vuelve a heredar', async () => {
    await writer.remove(ctx, NivelConfig.Sucursal, s1, 'modulo.inventario');
    const r = await resolver.resolver(negocioId, s1, 'modulo.inventario');
    expect(r.procedencia).toBe(NivelConfig.Negocio); // ya no hay override de sucursal
    expect(r.valor).toBe(true);
  });

  it('getEfectivos devuelve todas las claves del registry con su procedencia', async () => {
    const efectivos = await resolver.getEfectivos(negocioId, s2);
    expect(efectivos).toHaveLength(CLAVES.length);
    for (const e of efectivos) {
      expect([NivelConfig.Sistema, NivelConfig.Negocio, NivelConfig.Sucursal]).toContain(e.procedencia);
    }
  });
});
