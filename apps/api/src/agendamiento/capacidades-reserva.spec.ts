import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import {
  disponibilidad,
  especialista,
  especialistaServicio,
  especialistaSucursal,
  negocio,
  servicio,
  sucursal,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { DisponibilidadService } from './disponibilidad.service';
import { HorarioService } from './horario.service';
import { validarEntidades } from './validators/validador-cita.port';
import { runInTenantTx } from '../db/tx';

/**
 * El mapeo servicio↔especialista visto desde la reserva: a quién se ofrece y a
 * quién se deja entrar. Lo que se protege es que el cliente nunca pueda llegar a
 * reservar con alguien que no realiza lo que eligió —ni por la vía de las franjas
 * ni saltándose el front—, y que un servicio sin nadie capaz quede sin oferta.
 */
describe('Filtrado servicio↔especialista en la reserva', () => {
  const NOMBRE = 'Negocio CAPACIDADES RESERVA';
  const FECHA = new Date(Date.now() + 7 * 86400_000 - 5 * 3600_000).toISOString().slice(0, 10);

  let negocioId: string;
  let sucursalId: string;
  let corteId: string;
  let tinteId: string;
  let barbero: string; // solo Corte
  let colorista: string; // solo Tinte
  let comodin: string; // sin restricción → todo
  let ctx: TenantContext;
  let dispo: DisponibilidadService;

  async function nuevoEsp(nombre: string, servicioIds?: string[]): Promise<string> {
    const [e] = await adminDb.insert(especialista).values({ negocioId, nombre }).returning();
    await adminDb.insert(especialistaSucursal).values({ especialistaId: e.id, sucursalId });
    await adminDb.insert(disponibilidad).values({
      negocioId, sucursalId, especialistaId: e.id, fecha: FECHA, horaInicio: '08:00:00', horaFin: '18:00:00',
    });
    if (servicioIds?.length) {
      await adminDb.insert(especialistaServicio).values(servicioIds.map((s) => ({ especialistaId: e.id, servicioId: s })));
    }
    return e.id;
  }

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [c] = await adminDb.insert(servicio).values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 }).returning();
    corteId = c.id;
    const [t] = await adminDb.insert(servicio).values({ negocioId, nombre: 'Tinte', precio: '60000.00', duracionMin: 60 }).returning();
    tinteId = t.id;

    barbero = await nuevoEsp('Barbero', [corteId]);
    colorista = await nuevoEsp('Colorista', [tinteId]);
    comodin = await nuevoEsp('Comodín');

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    const events = new EventEmitter2();
    const resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    dispo = new DisponibilidadService(new HorarioService(), resolver);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  // ── Franjas ofrecidas ──────────────────────────────────────────────────────

  it('"cualquiera" solo ofrece franjas de quien realiza el servicio', async () => {
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, 'any', [tinteId], FECHA);
    expect(franjas.length).toBeGreaterThan(0);
    const asignados = new Set(franjas.map((f) => f.especialistaId));
    expect(asignados.has(barbero)).toBe(false); // no hace Tinte
    // El colorista y el comodín sí pueden; ambos son respuestas válidas.
    for (const id of asignados) expect([colorista, comodin]).toContain(id);
  });

  it('un especialista concreto que no realiza el servicio no tiene franjas', async () => {
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, barbero, [tinteId], FECHA);
    expect(franjas).toEqual([]);
  });

  it('el especialista sin restricción sigue ofreciendo franjas de cualquier servicio', async () => {
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, comodin, [tinteId], FECHA);
    expect(franjas.length).toBeGreaterThan(0);
  });

  it('un combo solo lo ofrece quien realiza TODOS los servicios', async () => {
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, 'any', [corteId, tinteId], FECHA);
    // Ni el barbero ni el colorista pueden con el combo: solo el comodín.
    const asignados = new Set(franjas.map((f) => f.especialistaId));
    expect([...asignados]).toEqual([comodin]);
  });

  it('si nadie realiza el combo, no hay franjas (no se ofrece una cita imposible)', async () => {
    // Se restringe al comodín para que ya nadie cubra los dos servicios juntos.
    await adminDb.insert(especialistaServicio).values({ especialistaId: comodin, servicioId: corteId });
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, 'any', [corteId, tinteId], FECHA);
    expect(franjas).toEqual([]);
    await adminDb.delete(especialistaServicio).where(eq(especialistaServicio.especialistaId, comodin));
  });

  // ── La puerta del servidor ─────────────────────────────────────────────────

  it('el servidor rechaza la cita aunque se salte el front', async () => {
    await runInTenantTx(ctx, async (tx) => {
      await expect(
        validarEntidades(tx, {
          negocioId,
          sucursalId,
          especialistaId: barbero,
          inicio: new Date(Date.now() + 86400_000),
          fin: new Date(Date.now() + 86400_000 + 3600_000),
          servicioIds: [tinteId],
        }),
      ).rejects.toThrow(/no realiza/i);
    });
  });

  it('con el servicio que sí realiza, la validación pasa', async () => {
    await runInTenantTx(ctx, async (tx) => {
      await expect(
        validarEntidades(tx, {
          negocioId, sucursalId, especialistaId: barbero,
          inicio: new Date(Date.now() + 86400_000),
          fin: new Date(Date.now() + 86400_000 + 1800_000),
          servicioIds: [corteId],
        }),
      ).resolves.toBeUndefined();
    });
  });

  it('el walk-in retroactivo NO se bloquea: registra algo que ya ocurrió', async () => {
    await runInTenantTx(ctx, async (tx) => {
      await expect(
        validarEntidades(tx, {
          negocioId, sucursalId, especialistaId: barbero,
          inicio: new Date(Date.now() - 7200_000),
          fin: new Date(Date.now() - 3600_000),
          servicioIds: [tinteId],
          validarServicios: false,
        }),
      ).resolves.toBeUndefined();
    });
  });

  it('un especialista dado de baja no recibe franjas aunque realice el servicio', async () => {
    await adminDb.update(especialista).set({ activo: false }).where(eq(especialista.id, colorista));
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, 'any', [tinteId], FECHA);
    expect(new Set(franjas.map((f) => f.especialistaId)).has(colorista)).toBe(false);
    await adminDb.update(especialista).set({ activo: true }).where(eq(especialista.id, colorista));
  });

  it('un especialista marcado como ocupado tampoco aparece', async () => {
    await adminDb.update(especialista).set({ disponible: false }).where(eq(especialista.id, colorista));
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, 'any', [tinteId], FECHA);
    expect(new Set(franjas.map((f) => f.especialistaId)).has(colorista)).toBe(false);
    await adminDb.update(especialista).set({ disponible: true }).where(eq(especialista.id, colorista));
  });
});
