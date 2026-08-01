import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoCita, NivelConfig, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import {
  cita,
  configuracion,
  especialista,
  especialistaSucursal,
  negocio,
  servicio,
  sucursal,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { DisponibilidadService } from './disponibilidad.service';
import { HorarioService } from './horario.service';

/**
 * Plan-Franjas, integración: el intervalo configurado y el re-anclaje al fin
 * de cada cita atraviesan config → disponibilidad → franjas ofrecidas.
 */
describe('Franjas configurables y ancladas a citas (Plan-Franjas)', () => {
  const NOMBRE = 'Negocio FRANJAS TEST';

  /** Próximo día `weekday` (0=dom…6=sáb) a al menos 2 días vista, hora Bogotá. */
  const proximo = (weekday: number): string => {
    const hoy = new Date(Date.now() - 5 * 3600_000);
    let delta = (weekday - hoy.getUTCDay() + 7) % 7 || 7;
    if (delta < 2) delta += 7; // lejos del "ahora" para que la antelación no interfiera
    return new Date(hoy.getTime() + delta * 86400_000).toISOString().slice(0, 10);
  };
  const MIERCOLES = proximo(3);
  const JUEVES = proximo(4);
  /** Mañana (hora Bogotá): el único día donde la antelación de 24 h muerde. */
  const MANANA = new Date(Date.now() - 5 * 3600_000 + 86400_000).toISOString().slice(0, 10);

  let negocioId: string;
  let sucursalId: string;
  let servicioId: string; // 30 min
  let espId: string;
  let ctx: TenantContext;
  let resolver: ConfigResolverService;
  let dispo: DisponibilidadService;

  const minutosDe = (iso: string): number => {
    const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  const instante = (fechaIso: string, hhmm: string): Date => {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const [h, min] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (h * 60 + min + 5 * 60) * 60000);
  };
  const min = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const franjasDe = async (fechaIso: string) =>
    (await dispo.franjasPublicas(ctx, sucursalId, espId, [servicioId], fechaIso)).map((f) =>
      minutosDe(f.inicio),
    );

  /** Fija un override de negocio y purga la caché del resolver. */
  const setClave = async (clave: string, valor: unknown) => {
    await adminDb
      .insert(configuracion)
      .values({ negocioId, nivel: NivelConfig.Negocio, ambitoId: negocioId, clave, valor: valor as object })
      .onConflictDoUpdate({
        target: [configuracion.negocioId, configuracion.nivel, configuracion.ambitoId, configuracion.clave],
        set: { valor: valor as object },
      });
    resolver.invalidar(negocioId);
  };

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [srv] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 })
      .returning();
    servicioId = srv.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Barbero' }).returning();
    espId = esp.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: espId, sucursalId });

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    resolver = new ConfigResolverService();
    dispo = new DisponibilidadService(new HorarioService(), resolver);

    // Sede 09:00–12:00: pocas franjas y fáciles de enumerar.
    await new HorarioService().setHorario(ctx, sucursalId, {
      base: { apertura: '09:00', cierre: '12:00' },
      dias: [null, null, null, null, null, null, null],
    });
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('con los defaults, la rejilla es la de siempre: cada 15 desde la apertura', async () => {
    expect(await franjasDe(MIERCOLES)).toEqual([
      min('09:00'), min('09:15'), min('09:30'), min('09:45'), min('10:00'), min('10:15'),
      min('10:30'), min('10:45'), min('11:00'), min('11:15'), min('11:30'),
    ]);
  });

  it('una cita de duración no múltiplo re-ancla las franjas a su fin exacto', async () => {
    // 09:45–10:20 (35 min): antes se perdían 10 min hasta las 10:30.
    await adminDb.insert(cita).values({
      negocioId, sucursalId, especialistaId: espId,
      inicio: instante(MIERCOLES, '09:45'), fin: instante(MIERCOLES, '10:20'),
      estado: EstadoCita.Confirmada, origen: OrigenCita.CreacionInterna,
    });
    expect(await franjasDe(MIERCOLES)).toEqual([
      min('09:00'), min('09:15'),                      // encaje de cola: 09:15+30 = 09:45 justo
      min('10:20'), min('10:35'), min('10:50'), min('11:05'), min('11:20'), min('11:30'),
    ]);
  });

  it('el intervalo configurado cambia la rejilla (20 min) y sigue re-anclando', async () => {
    await setClave('agendamiento.intervalo_franjas', '20');
    expect(await franjasDe(JUEVES)).toEqual([
      min('09:00'), min('09:20'), min('09:40'), min('10:00'), min('10:20'),
      min('10:40'), min('11:00'), min('11:20'), min('11:30'), // 11:30 = encaje de cola al cierre
    ]);
    // El día de la cita, el tramo posterior arranca en su fin y avanza de 20 en 20.
    const conCita = await franjasDe(MIERCOLES);
    expect(conCita).toContain(min('10:20'));
    expect(conCita).toContain(min('10:40'));
    expect(conCita).not.toContain(min('10:30'));
  });

  it('el buffer separa las franjas de las citas por ambos lados', async () => {
    await setClave('agendamiento.intervalo_franjas', '15');
    await setClave('agendamiento.buffer_min', 10);
    const r = await franjasDe(MIERCOLES); // cita 09:45–10:20 → bloqueado 09:35–10:30
    expect(r).toEqual([
      min('09:00'), min('09:05'),   // 09:05+30 = 09:35: única cola que respeta el margen
      min('10:30'), min('10:45'), min('11:00'), min('11:15'), min('11:30'),
    ]);
    await setClave('agendamiento.buffer_min', 0);
  });

  it('la antelación mínima descarta los inicios demasiado próximos', async () => {
    await setClave('agendamiento.antelacion_reserva_min', 1440);
    const corte = Date.now() + 1440 * 60000;
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, espId, [servicioId], MANANA);
    for (const f of franjas) expect(new Date(f.inicio).getTime()).toBeGreaterThan(corte);
    await setClave('agendamiento.antelacion_reserva_min', 0);
    // Sin antelación nunca hay MENOS franjas.
    const sin = await franjasDe(MANANA);
    expect(sin.length).toBeGreaterThanOrEqual(franjas.length);
  });
});
