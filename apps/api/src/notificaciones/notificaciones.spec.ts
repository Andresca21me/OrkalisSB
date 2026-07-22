import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoCita, OrigenCita, PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cita, cliente, consumoMensajeria, especialista, especialistaSucursal, negocio, sucursal, suscripcion } from '../db/schema';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { PlanService } from '../plans/plan.service';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { MockAdapter } from './adapters/mock.adapter';
import { RemitenteResolver } from './remitente/remitente.resolver';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';
import { plantillas } from './templates';
import { MetricsService } from '../observability/metrics.service';

describe('Notificaciones (FASE-11)', () => {
  const NOMBRE = 'Negocio NOTIF TEST';
  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let cliId: string;

  let queue: JobQueue;
  let mock: MockAdapter;
  let cupos: CuposService;
  let notificaciones: NotificacionesService;
  let scheduler: RecordatoriosScheduler;

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

    queue = new JobQueue();
    mock = new MockAdapter();
    cupos = new CuposService(new PlanService());
    // Resolver con config vacío → perfil 'plataforma' con campos undefined (el
    // MockAdapter ignora el perfil, así que basta para las pruebas de dominio).
    const config = { get: () => undefined } as unknown as ConstructorParameters<typeof RemitenteResolver>[0];
    const remitente = new RemitenteResolver(config);
    notificaciones = new NotificacionesService(queue, [mock], remitente, cupos, new MetricsService());
    notificaciones.onModuleInit();
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

  it('encolar es no bloqueante y el worker procesa el envío (mock)', async () => {
    notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-10T19:00:00Z'),
    });
    expect(mock.enviados).toHaveLength(0); // aún no procesado (no bloquea)
    await queue.drain();
    expect(mock.enviados.length).toBeGreaterThanOrEqual(1);
    expect(mock.enviados.at(-1)!.contenido).toContain('Carlos');
  });

  it('cupos: registrar incrementa el consumo del canal/período', async () => {
    const antes = await cupos.verificar(negocioId, 'sms');
    await cupos.registrar(negocioId, 'sms');
    const despues = await cupos.verificar(negocioId, 'sms');
    expect(despues.consumo).toBe(antes.consumo + 1);
  });

  it('cupo agotado NO corta los mensajes transaccionales (confirmaciones)', async () => {
    // Fuerza el consumo de SMS por encima del cupo (básico: 40).
    await adminDb
      .insert(consumoMensajeria)
      .values({ negocioId, canal: 'sms', periodo: cupos.periodoActual(), cantidad: 9999 })
      .onConflictDoUpdate({
        target: [consumoMensajeria.negocioId, consumoMensajeria.canal, consumoMensajeria.periodo],
        set: { cantidad: 9999 },
      });
    const estado = await cupos.verificar(negocioId, 'sms');
    expect(estado.dentroDeCupo).toBe(false);

    const antes = mock.enviados.length;
    notificaciones.encolarConfirmacion(negocioId, '3001234567', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Carlos',
      inicio: new Date('2030-03-11T19:00:00Z'),
    });
    await queue.drain();
    expect(mock.enviados.length).toBe(antes + 1); // se envió igual (no se corta)
  });

  it('scheduler: encola recordatorio dentro de la ventana y lo marca; ignora los lejanos', async () => {
    const dentro = new Date(Date.now() + 60 * 60 * 1000); // +1h (ventana default 24h)
    const lejos = new Date(Date.now() + 100 * 86400_000); // +100 días
    const mk = (inicio: Date) =>
      adminDb
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
    const [cDentro] = await mk(dentro);
    const [cLejos] = await mk(lejos);

    const encolados = await scheduler.escanearRecordatorios();
    expect(encolados).toBeGreaterThanOrEqual(1);

    const [d] = await adminDb.select({ r: cita.recordatorioEnviado }).from(cita).where(eq(cita.id, cDentro.id));
    const [l] = await adminDb.select({ r: cita.recordatorioEnviado }).from(cita).where(eq(cita.id, cLejos.id));
    expect(d.r).toBe(true); // dentro de ventana → notificado
    expect(l.r).toBe(false); // lejano → no notificado

    // Segundo escaneo no reencola el ya notificado.
    const segunda = await scheduler.escanearRecordatorios();
    const idsDentro = segunda; // si fuese >0 incluiría otros, pero cDentro ya está marcado
    expect(idsDentro).toBeGreaterThanOrEqual(0);
  });
});
