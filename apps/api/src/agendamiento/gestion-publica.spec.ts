import { config as loadEnv } from 'dotenv';
loadEnv();

// Mensajería simulada: estas pruebas solo miran el outbox (no envían nada).
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_FROM_NUMBER;

import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { EstadoCita, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cita, disponibilidad, especialista, especialistaSucursal, mensaje, negocio, servicio, sucursal } from '../db/schema';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { DisponibilidadService } from './disponibilidad.service';
import { HorarioService } from './horario.service';
import { ValidadorFactory } from './validators/validador.factory';
import { MAX_CITAS_FUTURAS_POR_TELEFONO, PublicAgendamientoService, telefonoLocal } from './public-agendamiento.service';
import { limitePublico } from './public-agendamiento.controller';
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

/**
 * FASE-01 del piloto (ORK-66): la gestión pública de una cita (ver, cancelar,
 * reagendar) solo se hace con el `token_gestion` secreto de la cita. El celular
 * ya NO sirve para ver la cita: solo dispara un SMS con el enlace al dueño del
 * número. Y hay tope de citas futuras por teléfono.
 */
describe('Gestión pública de citas por token (FASE-01 piloto)', () => {
  const NOMBRE_A = 'Negocio GESTION-PUB A';
  const NOMBRE_B = 'Negocio GESTION-PUB B';
  // Fecha local Bogotá 9 días en el futuro: lejos de cualquier antelación.
  const FECHA = new Date(Date.now() + 9 * 86400_000 - 5 * 3600_000).toISOString().slice(0, 10);

  let negocioA: string;
  let sucursalA: string;
  let espA: string;
  let servA: string;
  let sucursalB: string;
  let pub: PublicAgendamientoService;
  let resolver: ConfigResolverService;

  async function crearNegocio(nombre: string) {
    await adminDb.delete(negocio).where(eq(negocio.nombre, nombre));
    const [neg] = await adminDb.insert(negocio).values({ nombre, perfil: PerfilNegocio.Barberia }).returning();
    const [suc] = await adminDb.insert(sucursal).values({ negocioId: neg.id, nombre: 'Sede' }).returning();
    const [esp] = await adminDb.insert(especialista).values({ negocioId: neg.id, nombre: 'Esp' }).returning();
    await adminDb.insert(especialistaSucursal).values({ especialistaId: esp.id, sucursalId: suc.id });
    const [serv] = await adminDb
      .insert(servicio)
      .values({ negocioId: neg.id, nombre: 'Corte', precio: '25000.00', duracionMin: 30 })
      .returning();
    await adminDb.insert(disponibilidad).values({
      negocioId: neg.id,
      sucursalId: suc.id,
      especialistaId: esp.id,
      fecha: FECHA,
      horaInicio: '08:00:00',
      horaFin: '18:00:00',
    });
    return { negocioId: neg.id, sucursalId: suc.id, espId: esp.id, servId: serv.id };
  }

  /** Reserva pública de 30 min que empieza a la `hora` dada de FECHA (8.5 = 8:30). */
  async function reservar(telefono: string, hora: number) {
    const { retencionId } = await pub.retener(sucursalA, espA, instante(FECHA, hora * 60), instante(FECHA, hora * 60 + 30));
    return pub.confirmar(sucursalA, { retencionId, telefono, servicioIds: [servA] });
  }

  /** Mensajes `enlace_gestion` encolados a un teléfono (el outbox guarda el número local). */
  async function enlacesA(telefono: string) {
    return adminDb
      .select({ id: mensaje.id, cuerpo: mensaje.cuerpo, canal: mensaje.canal, destino: mensaje.destino })
      .from(mensaje)
      .where(and(eq(mensaje.negocioId, negocioA), eq(mensaje.tipo, 'enlace_gestion'), eq(mensaje.destino, telefono)));
  }

  beforeAll(async () => {
    const a = await crearNegocio(NOMBRE_A);
    negocioA = a.negocioId;
    sucursalA = a.sucursalId;
    espA = a.espId;
    servA = a.servId;
    const b = await crearNegocio(NOMBRE_B);
    sucursalB = b.sucursalId;

    const events = new EventEmitter2();
    resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
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
    const horario = new HorarioService();
    pub = new PublicAgendamientoService(
      new DisponibilidadService(horario, resolver),
      resolver,
      new ValidadorFactory(),
      notificaciones,
      metrics,
      horario,
      new AvisosEspecialistaService(notificaciones),
    );
  });

  afterAll(async () => {
    // La cascada del negocio borra citas, clientes y mensajes de estas pruebas.
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_A));
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE_B));
    await adminClient.end();
    await client.end();
  });

  it('confirmar devuelve un token de gestión largo y distinto por cita', async () => {
    const r1 = await reservar('3002220001', 8);
    const r2 = await reservar('3002220001', 9);
    expect(r1.tokenGestion).toMatch(/^[0-9a-f]{64}$/);
    expect(r2.tokenGestion).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.tokenGestion).not.toBe(r2.tokenGestion);
    const [fila] = await adminDb.select({ token: cita.tokenGestion }).from(cita).where(eq(cita.id, r1.citaId));
    expect(fila.token).toBe(r1.tokenGestion);
  });

  it('buscar por celular NO devuelve la cita: solo confirma el envío', async () => {
    await reservar('3002220002', 10);
    const r = await pub.enviarEnlaceGestion(sucursalA, '3002220002');
    expect(r).toEqual({ enviado: true });
    // Ni id, ni hora, ni servicios en la respuesta.
    expect(JSON.stringify(r)).not.toMatch(/inicio|servicios|id/);
  });

  it('buscar encola UN SMS con el enlace de gestión al dueño del número', async () => {
    const { tokenGestion } = await reservar('3002220003', 11);
    await pub.enviarEnlaceGestion(sucursalA, '300 222 0003');
    const enlaces = await enlacesA('3002220003');
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].canal).toBe('sms');
    expect(enlaces[0].cuerpo).toContain(`/reservar/${sucursalA}/gestion/${tokenGestion}`);
  });

  it('buscar repetido antes de 10 min no encola otro SMS, pero responde igual', async () => {
    await reservar('3002220004', 12);
    expect(await pub.enviarEnlaceGestion(sucursalA, '3002220004')).toEqual({ enviado: true });
    expect(await pub.enviarEnlaceGestion(sucursalA, '3002220004')).toEqual({ enviado: true });
    expect(await enlacesA('3002220004')).toHaveLength(1);
  });

  it('buscar un número sin citas responde igual y no encola nada (anti-enumeración)', async () => {
    expect(await pub.enviarEnlaceGestion(sucursalA, '3009999999')).toEqual({ enviado: true });
    expect(await enlacesA('3009999999')).toHaveLength(0);
  });

  it('detalle por token válido devuelve la cita; token inválido → 404', async () => {
    const { tokenGestion, citaId } = await reservar('3002220005', 13);
    const d = await pub.detallePorToken(sucursalA, tokenGestion);
    expect(d.id).toBe(citaId);
    expect(d.estado).toBe(EstadoCita.Confirmada);
    await expect(pub.detallePorToken(sucursalA, 'f'.repeat(64))).rejects.toMatchObject({ status: 404 });
    await expect(pub.detallePorToken(sucursalA, 'corto')).rejects.toMatchObject({ status: 404 });
  });

  it('el token de una cita NO sirve en la ruta de otra sucursal/negocio', async () => {
    const { tokenGestion } = await reservar('3002220006', 14);
    await expect(pub.detallePorToken(sucursalB, tokenGestion)).rejects.toMatchObject({ status: 404 });
    await expect(pub.cancelarPorToken(sucursalB, tokenGestion)).rejects.toMatchObject({ status: 404 });
  });

  it('cancelar por token cancela la cita (respetando la antelación)', async () => {
    const { tokenGestion, citaId } = await reservar('3002220007', 15);
    const r = await pub.cancelarPorToken(sucursalA, tokenGestion);
    expect(r.estado).toBe(EstadoCita.Cancelada);
    const [fila] = await adminDb.select({ estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(fila.estado).toBe(EstadoCita.Cancelada);
  });

  it('cancelar por token dentro de la antelación mínima se rechaza', async () => {
    // Cita creada directo en BD a 1 hora de ahora (la antelación por defecto es mayor).
    const ini = new Date(Date.now() + 3600_000);
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId: negocioA,
        sucursalId: sucursalA,
        especialistaId: espA,
        inicio: ini,
        fin: new Date(ini.getTime() + 30 * 60_000),
        estado: EstadoCita.Confirmada,
        origen: OrigenCita.AgendamientoPublico,
      })
      .returning({ token: cita.tokenGestion });
    // La prueba solo tiene sentido si la antelación supera 1 h (default barbería: 2 h).
    const horas = await resolver.resolverNumero(negocioA, sucursalA, 'agendamiento.antelacion_cancelacion_horas');
    expect(horas).toBeGreaterThan(1);
    await expect(pub.cancelarPorToken(sucursalA, c.token)).rejects.toMatchObject({ status: 400 });
  });

  it(`la cita ${MAX_CITAS_FUTURAS_POR_TELEFONO + 1}.ª futura activa del mismo teléfono se rechaza (409); una cancelada no cuenta`, async () => {
    const tel = '3002220008';
    const hechas = [];
    // Las horas en punto las usan las otras pruebas: aquí van las medias horas.
    for (let i = 0; i < MAX_CITAS_FUTURAS_POR_TELEFONO; i++) hechas.push(await reservar(tel, 8.5 + i));
    await expect(reservar(tel, 16)).rejects.toMatchObject({ status: 409 });
    // Cancelar una libera el cupo (otra franja: la de las 16:00 sigue retenida).
    await pub.cancelarPorToken(sucursalA, hechas[0].tokenGestion);
    await expect(reservar(tel, 16.5)).resolves.toMatchObject({ estado: EstadoCita.Confirmada });
  });

  it('el mismo teléfono con o sin espacios/+57 cuenta como uno solo', async () => {
    expect(telefonoLocal('300 222 0009')).toBe('3002220009');
    expect(telefonoLocal('+57 300 222 0009')).toBe('3002220009');
    expect(telefonoLocal('573002220009')).toBe('3002220009');
    expect(telefonoLocal('3002220009')).toBe('3002220009');
  });

  it('límites por ruta: estrictos por defecto, heredan el global si se subió (E2E/IP compartida)', () => {
    const previo = process.env.THROTTLE_LIMIT;
    try {
      delete process.env.THROTTLE_LIMIT;
      expect(limitePublico(5)()).toBe(5);
      process.env.THROTTLE_LIMIT = '120';
      expect(limitePublico(5)()).toBe(5);
      process.env.THROTTLE_LIMIT = '100000';
      expect(limitePublico(5)()).toBe(100000);
    } finally {
      if (previo === undefined) delete process.env.THROTTLE_LIMIT;
      else process.env.THROTTLE_LIMIT = previo;
    }
  });
});
