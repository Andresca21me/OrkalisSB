import { config as loadEnv } from 'dotenv';
loadEnv();

// Estas pruebas de agendamiento asumen mensajería SIMULADA: usan el `devCode`
// que `enviarOtp` solo expone en modo mock. Se desacoplan del `.env` del
// desarrollador (que ya puede tener claves Twilio reales) forzando aquí el modo
// mock, para que el OTP de prueba siga disponible.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, NivelConfig, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cita, cliente, disponibilidad, especialista, especialistaSucursal, negocio, servicio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { ConfigWriteService } from '../config-module/config-write.service';
import { DisponibilidadService } from './disponibilidad.service';
import { HorarioService } from './horario.service';
import { OtpService } from './otp.service';
import { ValidadorFactory } from './validators/validador.factory';
import { PublicAgendamientoService } from './public-agendamiento.service';
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

describe('Agendamiento (concurrencia, OTP, origen)', () => {
  const NOMBRE = 'Negocio AGENDA TEST';
  // Fecha local Bogotá 7 días en el futuro (formato YYYY-MM-DD).
  const FECHA = new Date(Date.now() + 7 * 86400_000 - 5 * 3600_000).toISOString().slice(0, 10);

  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let servId: string;
  let ctxAdmin: TenantContext;

  let resolver: ConfigResolverService;
  let writer: ConfigWriteService;
  let pub: PublicAgendamientoService;
  let agenda: AgendamientoService;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
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
    // Disponibilidad ese día concreto, 08:00–18:00.
    await adminDb.insert(disponibilidad).values({
      negocioId,
      sucursalId,
      especialistaId: espId,
      fecha: FECHA,
      horaInicio: '08:00:00',
      horaFin: '18:00:00',
    });

    ctxAdmin = { negocioId, sucursalIds: null, rol: 'admin' };

    const events = new EventEmitter2();
    resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    writer = new ConfigWriteService(resolver, events);
    const validadores = new ValidadorFactory();
    const queue = new JobQueue();
    const metrics = new MetricsService();
    const routerRemitente = new RemitenteResolver({ get: () => undefined } as never);
    const routerCupos = new CuposService(new PlanService());
    const router = new RouterCanalService(resolver, routerRemitente, routerCupos);
    const estadoMensajeria = new MensajeriaEstadoService();
    const notificaciones = new NotificacionesService(queue, new CuposService(new PlanService()), new PlantillasService(), router, metrics, estadoMensajeria);
    notificaciones.onModuleInit();
    // El outbox no se drena aquí: estas pruebas solo verifican el dominio de
    // agendamiento, que encola (persiste) sin enviar.
    const horario = new HorarioService();
    const avisos = new AvisosEspecialistaService(notificaciones);
    pub = new PublicAgendamientoService(
      new DisponibilidadService(horario),
      new OtpService(estadoMensajeria),
      resolver,
      validadores,
      notificaciones,
      metrics,
      horario,
      avisos,
      estadoMensajeria,
    );
    agenda = new AgendamientoService(validadores, avisos, notificaciones);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('CONCURRENCIA: N confirmaciones sobre la misma franja → solo 1 cita (EXCLUDE)', async () => {
    const ini = instante(FECHA, 16 * 60);
    const fin = instante(FECHA, 16 * 60 + 30);
    const intento = () =>
      adminDb.insert(cita).values({
        negocioId,
        sucursalId,
        especialistaId: espId,
        inicio: ini,
        fin,
        estado: EstadoCita.Confirmada,
        origen: OrigenCita.CreacionInterna,
      });
    const resultados = await Promise.allSettled([intento(), intento(), intento(), intento(), intento()]);
    const exitos = resultados.filter((r) => r.status === 'fulfilled').length;
    expect(exitos).toBe(1);
  });

  it('disponibilidad devuelve franjas libres del día', async () => {
    const franjas = await pub.franjas(sucursalId, espId, [servId], FECHA);
    expect(franjas.length).toBeGreaterThan(0);
    expect(franjas[0].especialistaId).toBe(espId);
  });

  it('reserva pública con auto-confirmación entra como CONFIRMADA', async () => {
    const ini = instante(FECHA, 14 * 60);
    const fin = instante(FECHA, 14 * 60 + 30);
    const tel = '3001110001';
    const { retencionId } = await pub.retener(sucursalId, espId, ini, fin);
    const { devCode } = await pub.enviarOtp(sucursalId, tel);
    const res = await pub.confirmar(sucursalId, {
      retencionId,
      telefono: tel,
      codigoOtp: devCode!,
      servicioIds: [servId],
    });
    expect(res.estado).toBe(EstadoCita.Confirmada);
  });

  it('reserva repetida: sin código la 2ª vez, y ACTUALIZA el nombre del cliente', async () => {
    const tel = '3001110009';
    // 1ª reserva a nombre de Camilo (franja libre 09:00): teléfono nuevo → pide código.
    const a = await pub.retener(sucursalId, espId, instante(FECHA, 9 * 60), instante(FECHA, 9 * 60 + 30));
    const otpA = await pub.enviarOtp(sucursalId, tel);
    expect(otpA.requerido).toBe(true);
    await pub.confirmar(sucursalId, { retencionId: a.retencionId, telefono: tel, nombre: 'Camilo', codigoOtp: otpA.devCode!, servicioIds: [servId] });
    // 2ª reserva mismo teléfono, ahora a nombre de Pedro (franja libre 10:00):
    // el número ya es cliente → ni se genera código ni hace falta enviarlo.
    const b = await pub.retener(sucursalId, espId, instante(FECHA, 10 * 60), instante(FECHA, 10 * 60 + 30));
    const otpB = await pub.enviarOtp(sucursalId, tel);
    expect(otpB.requerido).toBe(false);
    expect(otpB.devCode).toBeUndefined();
    await pub.confirmar(sucursalId, { retencionId: b.retencionId, telefono: tel, nombre: 'Pedro', servicioIds: [servId] });

    const [c] = await adminDb
      .select({ nombre: cliente.nombre })
      .from(cliente)
      .where(and(eq(cliente.telefono, tel), eq(cliente.negocioId, negocioId)));
    expect(c.nombre).toBe('Pedro'); // antes se quedaba en 'Camilo'
  });

  it('un teléfono DESCONOCIDO no puede confirmar sin código', async () => {
    const tel = '3001110019';
    const r = await pub.retener(sucursalId, espId, instante(FECHA, 16 * 60), instante(FECHA, 16 * 60 + 30));
    await expect(
      pub.confirmar(sucursalId, { retencionId: r.retencionId, telefono: tel, servicioIds: [servId] }),
    ).rejects.toThrow(/código/);
  });

  it('con aprobación manual ON la reserva entra como SOLICITADA', async () => {
    await writer.upsert(ctxAdmin, NivelConfig.Negocio, negocioId, 'agendamiento.aprobacion_manual', true);
    const ini = instante(FECHA, 15 * 60);
    const fin = instante(FECHA, 15 * 60 + 30);
    const tel = '3001110002';
    const { retencionId } = await pub.retener(sucursalId, espId, ini, fin);
    const { devCode } = await pub.enviarOtp(sucursalId, tel);
    const res = await pub.confirmar(sucursalId, {
      retencionId,
      telefono: tel,
      codigoOtp: devCode!,
      servicioIds: [servId],
    });
    expect(res.estado).toBe(EstadoCita.Solicitada);
    // Restablece para no afectar otras pruebas.
    await writer.remove(ctxAdmin, NivelConfig.Negocio, negocioId, 'agendamiento.aprobacion_manual');
  });

  it('OTP incorrecto rechaza la confirmación', async () => {
    const ini = instante(FECHA, 11 * 60);
    const fin = instante(FECHA, 11 * 60 + 30);
    const tel = '3001110003';
    const { retencionId } = await pub.retener(sucursalId, espId, ini, fin);
    await pub.enviarOtp(sucursalId, tel);
    await expect(
      pub.confirmar(sucursalId, { retencionId, telefono: tel, codigoOtp: '000000x', servicioIds: [servId] }),
    ).rejects.toThrow();
  });

  it('reserva pública con hora PASADA es rechazada (validador público)', async () => {
    const ini = new Date(Date.now() - 2 * 3600_000);
    const fin = new Date(ini.getTime() + 30 * 60000);
    const tel = '3001110004';
    const { retencionId } = await pub.retener(sucursalId, espId, ini, fin);
    const { devCode } = await pub.enviarOtp(sucursalId, tel);
    await expect(
      pub.confirmar(sucursalId, { retencionId, telefono: tel, codigoOtp: devCode!, servicioIds: [servId] }),
    ).rejects.toThrow();
  });

  it('walk-in RETROACTIVO (pasado) entra como COMPLETADA', async () => {
    const ini = new Date(Date.now() - 3 * 3600_000);
    const fin = new Date(ini.getTime() + 30 * 60000);
    const c = await agenda.walkInRetroactivo(ctxAdmin, {
      sucursalId,
      especialistaId: espId,
      servicioIds: [servId],
      inicio: ini,
      fin,
      metodoPago: MetodoPago.Efectivo,
    });
    expect(c.estado).toBe(EstadoCita.Completada);
  });

  it('walk-in con fin < inicio es rechazado', async () => {
    const ini = new Date(Date.now() - 3 * 3600_000);
    const fin = new Date(ini.getTime() - 30 * 60000); // antes del inicio
    await expect(
      agenda.walkInRetroactivo(ctxAdmin, {
        sucursalId,
        especialistaId: espId,
        servicioIds: [servId],
        inicio: ini,
        fin,
        metodoPago: MetodoPago.Efectivo,
      }),
    ).rejects.toThrow();
  });

  // El guard de pago y el cierre financiero se prueban en finanzas/atencion.spec.ts (FASE-09).
});
