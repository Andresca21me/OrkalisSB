import { config as loadEnv } from 'dotenv';
loadEnv();

import { and, desc, eq } from 'drizzle-orm';
import { EstadoCita, NivelConfig, OrigenCita, PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { alertaAdmin, cita, citaRecordatorio, cliente, consumoMensajeria, especialista, especialistaSucursal, mensaje, negocio, sucursal, suscripcion } from '../db/schema';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { PlanService } from '../plans/plan.service';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { PlantillasService } from './plantillas.service';
import { AlertasService } from './alertas.service';
import { MockAdapter } from './adapters/mock.adapter';
import { RemitenteResolver } from './remitente/remitente.resolver';
import { NotificacionesService } from './notificaciones.service';
import { RouterCanalService } from './router-canal.service';
import { ConfigWriteService } from '../config-module/config-write.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxWorker, esTransitorio } from './outbox.worker';
import { RecordatoriosScheduler } from './recordatorios.scheduler';
import { AvisosEspecialistaService } from '../agendamiento/avisos-especialista.service';
import { plantillas } from './templates';
import { MetricsService } from '../observability/metrics.service';
import { MensajesService } from './mensajes.service';
import type { Canal, MensajeSalida, NotificationSender, ResultadoEnvio } from './notification-sender.port';
import type { PerfilRemitente } from './remitente/perfil-remitente';

/** Adaptador que falla a voluntad, para probar reintentos y errores permanentes. */
class FallaAdapter implements NotificationSender {
  readonly proveedor = 'falso';
  intentos = 0;
  constructor(private readonly error: Error) {}
  soporta(_canal: Canal): boolean {
    return true;
  }
  async enviar(_m: MensajeSalida, _p: PerfilRemitente): Promise<ResultadoEnvio> {
    this.intentos++;
    throw this.error;
  }
}

describe('Notificaciones · outbox y cupos por ciclo (FASE-02/03)', () => {
  const NOMBRE = 'Negocio NOTIF TEST';
  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let cliId: string;

  let mock: MockAdapter;
  let cupos: CuposService;
  let alertas: AlertasService;
  let plantillasSvc: PlantillasService;
  let remitente: RemitenteResolver;
  let notificaciones: NotificacionesService;
  let outbox: OutboxWorker;
  let scheduler: RecordatoriosScheduler;

  /** Última fila del outbox de este negocio (para inspeccionar el ciclo de vida). */
  const ultimoMensaje = async () => {
    const [m] = await adminDb
      .select()
      .from(mensaje)
      .where(eq(mensaje.negocioId, negocioId))
      .orderBy(desc(mensaje.creadoEn))
      .limit(1);
    return m;
  };

  /** Último mensaje de un tipo concreto (hay varios en vuelo por prueba). */
  const ultimoMensajeDe = async (tipo: string) => {
    const [m] = await adminDb
      .select()
      .from(mensaje)
      .where(and(eq(mensaje.negocioId, negocioId), eq(mensaje.tipo, tipo)))
      .orderBy(desc(mensaje.creadoEn))
      .limit(1);
    return m;
  };

  /** Fija el consumo de SMS del ciclo vigente (para probar umbrales y bloqueo). */
  const forzarConsumo = async (cantidad: number) => {
    const ciclo = await cupos.cicloActual(negocioId);
    await adminDb
      .insert(consumoMensajeria)
      .values({ negocioId, canal: 'sms', cicloInicio: ciclo.inicio, cicloFin: ciclo.fin, cantidad })
      .onConflictDoUpdate({
        target: [consumoMensajeria.negocioId, consumoMensajeria.canal, consumoMensajeria.cicloInicio],
        set: { cantidad },
      });
  };

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Basico, numEspecialistas: 0 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Carlos' }).returning();
    espId = esp.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: espId, sucursalId });
    const [cli] = await adminDb.insert(cliente).values({ negocioId, nombre: 'Ana', telefono: '3001234567' }).returning();
    cliId = cli.id;

    mock = new MockAdapter();
    cupos = new CuposService(new PlanService());
    // Resolver con config vacío → perfil 'plataforma' con campos undefined (el
    // MockAdapter ignora el perfil, así que basta para las pruebas de dominio).
    const config = { get: () => undefined } as unknown as ConstructorParameters<typeof RemitenteResolver>[0];
    remitente = new RemitenteResolver(config);
    plantillasSvc = new PlantillasService();
    const router = new RouterCanalService(new ConfigResolverService(), remitente, cupos);
    notificaciones = new NotificacionesService(new JobQueue(), cupos, plantillasSvc, router, new MetricsService());
    notificaciones.onModuleInit();
    alertas = new AlertasService(notificaciones, cupos);
    outbox = new OutboxWorker([mock], remitente, cupos, alertas, new MetricsService());
    const resolver = new ConfigResolverService();
    scheduler = new RecordatoriosScheduler(resolver, notificaciones);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('plantilla de confirmación en español incluye los datos del turno', () => {
    const msg = plantillas.confirmacion({
      sucursalNombre: 'Sede Centro',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-10T19:00:00Z'),
    });
    expect(msg).toContain('Carlos');
    expect(msg).toContain('Sede Centro');
  });

  it('encolar persiste en el outbox sin enviar; el worker lo despacha después', async () => {
    await notificaciones.encolarConfirmacion(
      negocioId,
      '3001234567',
      { sucursalNombre: 'Sede', especialistaNombre: 'Carlos', inicio: new Date('2030-03-10T19:00:00Z') },
      { sucursalId },
    );

    // Encolar NO habla con el proveedor: la fila queda pendiente.
    const pendiente = await ultimoMensaje();
    expect(pendiente.estado).toBe('pendiente');
    expect(pendiente.cuerpo).toContain('Carlos');
    expect(mock.enviados).toHaveLength(0);

    await outbox.drain();

    expect(mock.enviados.length).toBeGreaterThanOrEqual(1);
    expect(mock.enviados.at(-1)!.contenido).toContain('Carlos');
    const enviado = await ultimoMensaje();
    expect(enviado.estado).toBe('enviado');
    expect(enviado.proveedor).toBe('mock');
    expect(enviado.proveedorId).toBeTruthy();
    expect(enviado.enviadoEn).not.toBeNull();
  });

  it('DURABILIDAD: un pendiente escrito antes de "reiniciar" se envía al arrancar el worker', async () => {
    // Simula el crash: la fila quedó en el outbox y el proceso murió.
    const [fila] = await adminDb
      .insert(mensaje)
      .values({ negocioId, sucursalId, canal: 'sms', cupoCanal: 'sms', tipo: 'aviso', destino: '3009998888', cuerpo: 'Sobrevivo al reinicio' })
      .returning({ id: mensaje.id });

    // Worker nuevo (proceso reiniciado): retoma lo pendiente sin ayuda de nadie.
    const otroWorker = new OutboxWorker([mock], new RemitenteResolver({ get: () => undefined } as never), cupos, alertas, new MetricsService());
    await otroWorker.drain();

    const [m] = await adminDb.select().from(mensaje).where(eq(mensaje.id, fila.id));
    expect(m.estado).toBe('enviado');
    expect(mock.enviados.at(-1)!.contenido).toBe('Sobrevivo al reinicio');
  });

  it('webhook: aplica la entrega real y es idempotente (mismo evento dos veces)', async () => {
    const enviado = await ultimoMensaje();
    const sid = enviado.proveedorId!;

    expect(await outbox.aplicarEstadoProveedor(sid, 'entregado')).toBe('aplicado');
    const [tras] = await adminDb.select().from(mensaje).where(eq(mensaje.id, enviado.id));
    expect(tras.estado).toBe('entregado');
    expect(tras.entregadoEn).not.toBeNull();

    // Reentrega del mismo evento → no cambia nada.
    expect(await outbox.aplicarEstadoProveedor(sid, 'entregado')).toBe('ignorado');
    // Un 'sent' tardío NO puede retroceder el ciclo de vida.
    expect(await outbox.aplicarEstadoProveedor(sid, 'enviado')).toBe('ignorado');
    const [final] = await adminDb.select().from(mensaje).where(eq(mensaje.id, enviado.id));
    expect(final.estado).toBe('entregado');
    expect(final.entregadoEn).toEqual(tras.entregadoEn);

    // Un SID desconocido no rompe nada.
    expect(await outbox.aplicarEstadoProveedor('SM-inexistente', 'entregado')).toBe('desconocido');
  });

  it('clasificación de errores: 429/5xx/red son transitorios; 400 no', () => {
    expect(esTransitorio({ status: 429 })).toBe(true);
    expect(esTransitorio({ status: 503 })).toBe(true);
    expect(esTransitorio({ code: 'ETIMEDOUT' })).toBe(true);
    expect(esTransitorio({ status: 400, code: 21211 })).toBe(false); // número inválido
  });

  it('fallo transitorio reprograma con backoff; permanente marca fallido sin reintentar', async () => {
    const transitorio = new FallaAdapter(Object.assign(new Error('rate limited'), { status: 429 }));
    const wTrans = new OutboxWorker([transitorio], new RemitenteResolver({ get: () => undefined } as never), cupos, alertas, new MetricsService());
    const [t] = await adminDb
      .insert(mensaje)
      .values({ negocioId, canal: 'sms', cupoCanal: 'sms', tipo: 'aviso', destino: '3001112222', cuerpo: 'reintenta' })
      .returning({ id: mensaje.id });
    await wTrans.drain();
    const [mt] = await adminDb.select().from(mensaje).where(eq(mensaje.id, t.id));
    expect(transitorio.intentos).toBe(1); // el backoff impide reintentar en el acto
    expect(mt.estado).toBe('pendiente');
    expect(mt.intento).toBe(1);
    expect(mt.proximoIntentoEn.getTime()).toBeGreaterThan(Date.now());

    const permanente = new FallaAdapter(Object.assign(new Error('The To number is not valid'), { status: 400 }));
    const wPerm = new OutboxWorker([permanente], new RemitenteResolver({ get: () => undefined } as never), cupos, alertas, new MetricsService());
    const [p] = await adminDb
      .insert(mensaje)
      .values({ negocioId, canal: 'sms', cupoCanal: 'sms', tipo: 'aviso', destino: 'no-valido', cuerpo: 'no reintenta' })
      .returning({ id: mensaje.id });
    await wPerm.drain();
    const [mp] = await adminDb.select().from(mensaje).where(eq(mensaje.id, p.id));
    expect(permanente.intentos).toBe(1);
    expect(mp.estado).toBe('fallido');
    expect(mp.error).toContain('not valid');
  });

  it('cupos: registrar incrementa el consumo del canal/período', async () => {
    const antes = await cupos.verificar(negocioId, 'sms');
    await cupos.registrar(negocioId, 'sms');
    const despues = await cupos.verificar(negocioId, 'sms');
    expect(despues.consumo).toBe(antes.consumo + 1);
  });

  it('alerta al cruzar el 80 %: se crea UNA sola vez por umbral y ciclo', async () => {
    // 32 de 40 SMS del plan básico = 80 %.
    await forzarConsumo(31);
    await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-12T19:00:00Z'),
    });
    await outbox.drain();

    const ciclo = await cupos.cicloActual(negocioId);
    const clave = `cupo:sms:80:${ciclo.inicio.toISOString().slice(0, 10)}`;
    const [a] = await adminDb.select().from(alertaAdmin).where(eq(alertaAdmin.clave, clave));
    expect(a.severidad).toBe('aviso');
    expect(a.titulo).toContain('SMS');

    // Otro envío en el mismo ciclo NO duplica el aviso (anti-spam por clave).
    await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-13T19:00:00Z'),
    });
    await outbox.drain();
    const todas = await adminDb.select().from(alertaAdmin).where(eq(alertaAdmin.clave, clave));
    expect(todas).toHaveLength(1);
  });

  it('cupo agotado (D2): el marketing NI SIQUIERA se encola; lo transaccional sale con sobre_cupo', async () => {
    await forzarConsumo(9999);
    expect((await cupos.verificar(negocioId, 'sms')).dentroDeCupo).toBe(false);

    // Marketing: se persiste como 'sin_cupo' desde el encolado (bloqueo duro).
    await notificaciones.encolarMarketing(negocioId, '3004445555', 'promo');
    const [mk] = await adminDb
      .select()
      .from(mensaje)
      .where(and(eq(mensaje.negocioId, negocioId), eq(mensaje.tipo, 'marketing')));
    expect(mk.estado).toBe('sin_cupo');

    // Transaccional: se envía igual y queda marcado (bloqueo blando).
    const antes = mock.enviados.length;
    await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-11T19:00:00Z'),
    });
    await outbox.drain();
    expect(mock.enviados.length).toBe(antes + 1);
    const enviado = await ultimoMensajeDe('confirmacion');
    expect(enviado.estado).toBe('enviado');
    expect(enviado.sobreCupo).toBe(true);

    // Y quedó la alerta crítica del 100 %.
    const ciclo = await cupos.cicloActual(negocioId);
    const [critica] = await adminDb
      .select()
      .from(alertaAdmin)
      .where(eq(alertaAdmin.clave, `cupo:sms:100:${ciclo.inicio.toISOString().slice(0, 10)}`));
    expect(critica.severidad).toBe('critico');
  });

  it('plantilla del negocio: el mensaje encolado usa su texto y sus variables', async () => {
    const ctx = { negocioId, sucursalIds: null, rol: 'admin' as const };
    await plantillasSvc.guardar(ctx, 'confirmacion', 'sms', {
      contenidoSms: 'Hola {{cliente}}! Te esperamos en {{sucursal}} a las {{hora}} con {{especialista}}.',
    });

    await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      clienteNombre: 'Pedro',
      inicio: new Date('2030-04-01T19:00:00Z'),
    });

    const m = await ultimoMensajeDe('confirmacion');
    expect(m.cuerpo).toContain('Hola Pedro!');
    expect(m.cuerpo).toContain('Sede');
    expect(m.cuerpo).toContain('Carlos');
    expect(m.cuerpo).not.toContain('{{');
  });

  it('variable no permitida se rechaza al guardar (no llega a un cliente real)', async () => {
    const ctx = { negocioId, sucursalIds: null, rol: 'admin' as const };
    await expect(
      plantillasSvc.guardar(ctx, 'recordatorio', 'sms', { contenidoSms: 'Hola {{fehca}}' }),
    ).rejects.toThrow(/no permitidas/i);
  });

  it('sin plantilla (o vaciándola) vuelve el texto por defecto de plataforma', async () => {
    const ctx = { negocioId, sucursalIds: null, rol: 'admin' as const };
    await plantillasSvc.guardar(ctx, 'confirmacion', 'sms', { contenidoSms: '' });

    await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-04-02T19:00:00Z'),
    });
    const m = await ultimoMensajeDe('confirmacion');
    expect(m.cuerpo).toContain('¡Reserva confirmada!');
  });

  describe('avisos al especialista (FASE-07, D4)', () => {
    let avisos: AvisosEspecialistaService;
    let citaId: string;
    const ctx = () => ({ negocioId, sucursalIds: null, rol: 'admin' as const });

    beforeAll(async () => {
      avisos = new AvisosEspecialistaService(notificaciones);
      const inicio = new Date(Date.now() + 30 * 86400_000);
      const [c] = await adminDb
        .insert(cita)
        .values({
          negocioId,
          sucursalId,
          clienteId: cliId,
          especialistaId: espId,
          inicio,
          fin: new Date(inicio.getTime() + 30 * 60000),
          estado: EstadoCita.Confirmada,
          origen: OrigenCita.CreacionInterna,
        })
        .returning({ id: cita.id });
      citaId = c.id;
    });

    it('sin celular verificado se omite el aviso y la operación NO falla', async () => {
      // El especialista de estas pruebas se creó sin teléfono (altas anteriores).
      await expect(avisos.avisar(ctx(), citaId, 'Nueva cita en tu agenda')).resolves.toBeUndefined();
      const m = await ultimoMensajeDe('aviso_especialista');
      expect(m).toBeUndefined();
    });

    it('con celular verificado se encola el aviso con el motivo y el cliente', async () => {
      await adminDb
        .update(especialista)
        .set({ telefono: '+573009998877', telefonoVerificadoEn: new Date() })
        .where(eq(especialista.id, espId));

      await avisos.avisar(ctx(), citaId, 'Cita cancelada');

      const m = await ultimoMensajeDe('aviso_especialista');
      expect(m.destino).toBe('+573009998877');
      expect(m.cuerpo).toContain('Cita cancelada');
      expect(m.cuerpo).toContain('Ana'); // nombre del cliente
      expect(m.citaId).toBe(citaId);
      expect(m.transaccional).toBe(true); // no se corta por cupo
    });

    it('una cita inexistente no rompe nada (el aviso nunca tumba la operación)', async () => {
      await expect(
        avisos.avisar(ctx(), '00000000-0000-4000-8000-000000000000', 'X'),
      ).resolves.toBeUndefined();
    });
  });

  describe('routing de canal por evento (FASE-05)', () => {
    it('sin sender de WhatsApp, todo cae a SMS y queda anotado el motivo', async () => {
      // El perfil de estas pruebas no tiene whatsappFrom (AM-3 pendiente).
      const router = new RouterCanalService(new ConfigResolverService(), remitente, cupos);
      const ruta = await router.resolver(negocioId, sucursalId, 'confirmacion', true);
      expect(ruta.canal).toBe('sms');
      expect(ruta.cupoCanal).toBe('sms');
      expect(ruta.canalPreferido).toBe('whatsapp'); // se quería WhatsApp
      expect(ruta.motivoFallback).toMatch(/sender de WhatsApp/i);
    });

    it('el mensaje encolado registra el fallback (auditoría del routing)', async () => {
      await notificaciones.encolarConfirmacion(negocioId, '3001234567', {
        sucursalNombre: 'Sede',
        especialistaNombre: 'Carlos',
        inicio: new Date('2030-06-01T15:00:00Z'),
      }, { sucursalId });
      const m = await ultimoMensajeDe('confirmacion');
      expect(m.canal).toBe('sms');
      expect(m.canalPreferido).toBe('whatsapp');
      expect(m.motivoFallback).toBeTruthy();
    });

    it('con el canal forzado a SMS no se anota fallback (no se intentó WhatsApp)', async () => {
      const resolver = new ConfigResolverService();
      // Igual que en producción: al guardar config se emite CONFIG_UPDATED y el
      // resolver invalida su caché. Sin este cableado leería el valor viejo.
      const events = new EventEmitter2();
      events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
      const escritor = new ConfigWriteService(resolver, events);
      const ctxAdmin = { negocioId, sucursalIds: null, rol: 'admin' as const };
      await escritor.upsert(ctxAdmin, NivelConfig.Negocio, negocioId, 'mensajeria.canal_aviso', 'sms');

      const router = new RouterCanalService(resolver, remitente, cupos);
      const ruta = await router.resolver(negocioId, sucursalId, 'aviso', true);
      expect(ruta.canal).toBe('sms');
      expect(ruta.canalPreferido).toBeUndefined();
      expect(ruta.motivoFallback).toBeUndefined();
    });
  });

  describe('registro de mensajes para el admin (FASE-10)', () => {
    const svc = new MensajesService();
    const ctx = () => ({ negocioId, sucursalIds: null, rol: 'admin' as const });

    it('lista los mensajes del negocio, del más reciente al más antiguo', async () => {
      const r = await svc.listar(ctx(), {});
      expect(r.total).toBeGreaterThan(0);
      expect(r.mensajes.length).toBeGreaterThan(0);
      const fechas = r.mensajes.map((m) => new Date(m.creadoEn).getTime());
      expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
    });

    it('filtra por estado y por canal', async () => {
      const enviados = await svc.listar(ctx(), { estado: 'enviado' });
      expect(enviados.mensajes.every((m) => m.estado === 'enviado')).toBe(true);
      const sms = await svc.listar(ctx(), { canal: 'sms' });
      expect(sms.mensajes.every((m) => m.canal === 'sms')).toBe(true);
    });

    it('el resumen cuenta por estado y calcula la tasa de fallo', async () => {
      const r = await svc.resumen(ctx());
      const suma = Object.values(r.porEstado).reduce((a, b) => a + b, 0);
      expect(suma).toBe(r.total);
      expect(r.tasaFallo).toBeGreaterThanOrEqual(0);
      expect(r.tasaFallo).toBeLessThanOrEqual(1);
    });

    it('NO expone mensajes de otro negocio (RLS + filtro explícito)', async () => {
      const otro = { negocioId: '00000000-0000-4000-8000-000000000001', sucursalIds: null, rol: 'admin' as const };
      const r = await svc.listar(otro, {});
      expect(r.total).toBe(0);
    });
  });

  describe('recordatorios multiventana (FASE-08)', () => {
    const crearCita = async (enHoras: number) => {
      const inicio = new Date(Date.now() + enHoras * 3600_000);
      const [c] = await adminDb
        .insert(cita)
        .values({
          negocioId,
          sucursalId,
          clienteId: cliId,
          especialistaId: espId,
          inicio,
          fin: new Date(inicio.getTime() + 30 * 60000),
          estado: EstadoCita.Confirmada,
          origen: OrigenCita.AgendamientoPublico,
        })
        .returning({ id: cita.id });
      return c.id;
    };
    // Orden fijo (24 h → 2 h → config) para que las aserciones se lean como el
    // paso del tiempo; ordenar por texto pondría "h24" antes que "h2".
    const ORDEN = ['h24', 'h2', 'config'];
    /** Recordatorios encolados PARA ESTA cita (el escaneo recorre todas). */
    const recordatoriosDe = async (citaId: string) =>
      (await adminDb
        .select()
        .from(mensaje)
        .where(and(eq(mensaje.citaId, citaId), eq(mensaje.tipo, 'recordatorio')))).length;
    const ventanasDe = async (citaId: string) =>
      (await adminDb.select().from(citaRecordatorio).where(eq(citaRecordatorio.citaId, citaId)))
        .sort((a, b) => ORDEN.indexOf(a.ventana) - ORDEN.indexOf(b.ventana))
        .map((r) => `${r.ventana}:${r.enviadoEn ? 'enviado' : 'omitido'}`);

    it('una cita lejana (>24 h) todavía no dispara ninguna ventana', async () => {
      const id = await crearCita(100 * 24);
      await scheduler.escanearRecordatorios();
      expect(await ventanasDe(id)).toEqual([]);
    });

    it('a 23 h envía SOLO la ventana de 24 h; la de 2 h sigue pendiente', async () => {
      const id = await crearCita(23);
      await scheduler.escanearRecordatorios();
      expect(await ventanasDe(id)).toEqual(['h24:enviado']);
    });

    it('al llegar a 1 h envía la de 2 h, sin repetir la de 24 h', async () => {
      const id = await crearCita(22);
      await scheduler.escanearRecordatorios(); // dispara h24
      // Se simula el paso del tiempo adelantando el reloj del escaneo.
      await scheduler.escanearRecordatorios(new Date(Date.now() + 21 * 3600_000));
      expect(await ventanasDe(id)).toEqual(['h24:enviado', 'h2:enviado']);
    });

    it('reserva creada con 1 h de antelación: un solo aviso, no dos', async () => {
      const id = await crearCita(1);
      await scheduler.escanearRecordatorios();
      await outbox.drain();

      // La de 2 h se envía; la de 24 h se registra como omitida (ya inalcanzable).
      expect(await ventanasDe(id)).toEqual(['h24:omitido', 'h2:enviado']);
      expect(await recordatoriosDe(id)).toBe(1); // UN solo aviso, no dos
    });

    it('reescanear (o reiniciar el proceso) NO duplica recordatorios', async () => {
      const id = await crearCita(21);
      await scheduler.escanearRecordatorios();
      await scheduler.escanearRecordatorios();
      await scheduler.escanearRecordatorios();
      await outbox.drain();
      expect(await ventanasDe(id)).toEqual(['h24:enviado']);
      expect(await recordatoriosDe(id)).toBe(1); // los reescaneos no repiten
    });
  });
});
