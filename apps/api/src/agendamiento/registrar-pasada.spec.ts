import { config as loadEnv } from 'dotenv';
loadEnv();

// Mensajería simulada: el registro de una cita pasada no debe enviar nada, y
// estas pruebas no deben depender de claves Twilio del .env del desarrollador.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

import { ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { atencion, atencionPago, cita, especialista, especialistaSucursal, negocio, servicio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { AtencionService } from '../finanzas/atencion.service';
import { ModuloGate } from '../operacion/modulo-gate.service';
import { ValidadorFactory } from './validators/validador.factory';
import { AgendamientoService } from './agendamiento.service';
import { AvisosEspecialistaService } from './avisos-especialista.service';
import { JobQueue } from '../notificaciones/job-queue';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RemitenteResolver } from '../notificaciones/remitente/remitente.resolver';
import { RouterCanalService } from '../notificaciones/router-canal.service';
import { CuposService } from '../notificaciones/cupos.service';
import { PlantillasService } from '../notificaciones/plantillas.service';
import { PlanService } from '../plans/plan.service';
import { MetricsService } from '../observability/metrics.service';
import { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';

/** Instante UTC a partir de fecha local Bogotá (UTC-5) + minutos del día. */
function instante(fechaIso: string, minutos: number): Date {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (minutos + 5 * 60) * 60000);
}

/** Registro de citas ya atendidas desde la agenda (ORK-110). */
describe('Registrar cita pasada (ORK-110)', () => {
  const NOMBRE = 'Negocio CITA PASADA TEST';
  const NOMBRE_OTRO = 'Negocio CITA PASADA OTRO';
  // Hace 2 días, fecha local Bogotá.
  const AYER2 = new Date(Date.now() - 2 * 86400_000 - 5 * 3600_000).toISOString().slice(0, 10);

  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let servId: string;
  let ctxAdmin: TenantContext;
  let agenda: AgendamientoService;

  const citasDelNegocio = () => adminDb.select({ id: cita.id }).from(cita).where(eq(cita.negocioId, negocioId));

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_OTRO));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Esp' }).returning();
    espId = esp.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: espId, sucursalId });
    const [serv] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 })
      .returning();
    servId = serv.id;
    ctxAdmin = { negocioId, sucursalIds: null, rol: 'admin' };

    const resolver = new ConfigResolverService();
    const metrics = new MetricsService();
    const router = new RouterCanalService(resolver, new RemitenteResolver({ get: () => undefined } as never), new CuposService(new PlanService()));
    const notificaciones = new NotificacionesService(
      new JobQueue(),
      new CuposService(new PlanService()),
      new PlantillasService(),
      router,
      metrics,
      new MensajeriaEstadoService(),
    );
    notificaciones.onModuleInit();
    const atencionSvc = new AtencionService(resolver, metrics, new ModuloGate(resolver, new PlanService()));
    agenda = new AgendamientoService(new ValidadorFactory(), new AvisosEspecialistaService(notificaciones), notificaciones, atencionSvc);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_OTRO));
    await adminClient.end();
    await client.end();
  });

  it('cita de un día anterior: queda COMPLETADA, con pago dividido y el cobro fechado al día real', async () => {
    const inicio = instante(AYER2, 15 * 60);
    const { cita: c, advertencia } = await agenda.registrarPasada(ctxAdmin, {
      sucursalId,
      especialistaId: espId,
      servicioIds: [servId],
      inicio,
      pagos: [
        { metodo: MetodoPago.Efectivo, monto: 15000 },
        { metodo: MetodoPago.Nequi, monto: 10000 },
      ],
    });
    expect(advertencia).toBeNull();
    expect(c.estado).toBe(EstadoCita.Completada);
    expect(c.origen).toBe(OrigenCita.CreacionInterna);
    expect(c.inicio.toISOString()).toBe(inicio.toISOString());
    expect(c.fin.getTime() - c.inicio.getTime()).toBe(30 * 60_000);

    const [enDb] = await adminDb.select().from(cita).where(eq(cita.id, c.id));
    expect(enDb.estado).toBe(EstadoCita.Completada);

    const [at] = await adminDb.select().from(atencion).where(eq(atencion.citaId, c.id));
    expect(Number(at.total)).toBe(25000);
    // Entra a finanzas el día de la cita, no hoy.
    expect(at.creadoEn.toISOString()).toBe(c.fin.toISOString());
    const pagos = await adminDb.select().from(atencionPago).where(eq(atencionPago.atencionId, at.id));
    expect(pagos.map((p) => `${p.metodo}:${Number(p.monto)}`).sort()).toEqual(['efectivo:15000', 'nequi:10000']);
  });

  it('cita de HOY sin hora: termina en el momento de registrarla', async () => {
    const antes = Date.now();
    const { cita: c } = await agenda.registrarPasada(ctxAdmin, {
      sucursalId,
      especialistaId: espId,
      servicioIds: [servId],
      pagos: [{ metodo: MetodoPago.Efectivo, monto: 25000 }],
    });
    expect(c.estado).toBe(EstadoCita.Completada);
    expect(c.fin.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(c.fin.getTime()).toBeLessThanOrEqual(Date.now());
    expect(c.fin.getTime() - c.inicio.getTime()).toBe(30 * 60_000);
    const [at] = await adminDb.select().from(atencion).where(eq(atencion.citaId, c.id));
    expect(at).toBeDefined();
  });

  it('rechaza una hora de inicio que todavía no ha pasado', async () => {
    await expect(
      agenda.registrarPasada(ctxAdmin, {
        sucursalId,
        especialistaId: espId,
        servicioIds: [servId],
        inicio: new Date(Date.now() + 3600_000),
        pagos: [{ metodo: MetodoPago.Efectivo, monto: 25000 }],
      }),
    ).rejects.toThrow(/pasado/);
  });

  it('si los pagos no suman el total, no deja ninguna cita a medias', async () => {
    const n0 = (await citasDelNegocio()).length;
    await expect(
      agenda.registrarPasada(ctxAdmin, {
        sucursalId,
        especialistaId: espId,
        servicioIds: [servId],
        inicio: instante(AYER2, 9 * 60),
        pagos: [{ metodo: MetodoPago.Efectivo, monto: 20000 }],
      }),
    ).rejects.toThrow(/no coincide/);
    expect((await citasDelNegocio()).length).toBe(n0);
  });

  it('choca con una cita SIN CERRAR del especialista en esa franja (hay que completar esa)', async () => {
    await adminDb.insert(cita).values({
      negocioId,
      sucursalId,
      especialistaId: espId,
      inicio: instante(AYER2, 11 * 60),
      fin: instante(AYER2, 11 * 60 + 30),
      estado: EstadoCita.Confirmada,
      origen: OrigenCita.CreacionInterna,
    });
    const n0 = (await citasDelNegocio()).length;
    const intento = agenda.registrarPasada(ctxAdmin, {
      sucursalId,
      especialistaId: espId,
      servicioIds: [servId],
      inicio: instante(AYER2, 11 * 60 + 15),
      pagos: [{ metodo: MetodoPago.Efectivo, monto: 25000 }],
    });
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow(/sin cerrar/);
    expect((await citasDelNegocio()).length).toBe(n0);
    const pendientes = await adminDb
      .select({ id: cita.id })
      .from(cita)
      .where(and(eq(cita.negocioId, negocioId), eq(cita.estado, EstadoCita.Confirmada)));
    expect(pendientes).toHaveLength(1);
  });

  it('AISLAMIENTO: otro negocio no puede registrar citas con la sede, especialista o servicios de este', async () => {
    const [otro] = await adminDb.insert(negocio).values({ nombre: NOMBRE_OTRO, perfil: PerfilNegocio.Barberia }).returning();
    const ctxOtro: TenantContext = { negocioId: otro.id, sucursalIds: null, rol: 'admin' };
    const n0 = (await citasDelNegocio()).length;
    await expect(
      agenda.registrarPasada(ctxOtro, {
        sucursalId,
        especialistaId: espId,
        servicioIds: [servId],
        inicio: instante(AYER2, 16 * 60),
        pagos: [{ metodo: MetodoPago.Efectivo, monto: 25000 }],
      }),
    ).rejects.toThrow();
    expect((await citasDelNegocio()).length).toBe(n0);
    const delOtro = await adminDb.select({ id: cita.id }).from(cita).where(eq(cita.negocioId, otro.id));
    expect(delOtro).toHaveLength(0);
  });
});
