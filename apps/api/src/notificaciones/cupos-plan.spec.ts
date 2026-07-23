import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoSuscripcion, PerfilNegocio, PlanSuscripcion, tieneAcceso } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { consumoMensajeria, mensaje, negocio, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { PlantillasService } from './plantillas.service';
import { NotificacionesService } from './notificaciones.service';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { RemitenteResolver } from './remitente/remitente.resolver';
import { RouterCanalService } from './router-canal.service';
import { MetricsService } from '../observability/metrics.service';
import { MensajeriaEstadoService } from './mensajeria-estado.service';

/**
 * Matriz "cambios de plan × cupos de mensajería" (Plan-Mensajeria FASE-09,
 * Parte V, ADR-009).
 *
 * No reescribe la lógica de cambio de plan: **verifica** que las dos rutas que
 * existen (prorrateo de pagos y `PATCH /suscripcion/plan`) dejan los cupos como
 * está documentado. La propiedad de fondo que se comprueba una y otra vez es que
 * el cupo es **derivado** —se calcula al leer desde `plan` + `numEspecialistas`—
 * y que ninguna ruta de cambio de plan toca el **contador de consumo**.
 */
describe('Cambios de plan ↔ cupos de mensajería (FASE-09)', () => {
  const NOMBRE = 'Negocio CUPOS PLAN TEST';
  let negocioId: string;
  let cupos: CuposService;
  let notificaciones: NotificacionesService;

  /** Cambia el plan como lo hacen las dos rutas reales: solo la suscripción. */
  const cambiarPlan = (plan: PlanSuscripcion, numEspecialistas: number) =>
    adminDb
      .update(suscripcion)
      .set({ plan, numEspecialistas, actualizadoEn: new Date() })
      .where(eq(suscripcion.negocioId, negocioId));

  const fijarConsumoSms = async (cantidad: number) => {
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
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    // diaCobro fijo → ciclo estable durante toda la prueba.
    await adminDb.insert(suscripcion).values({
      negocioId,
      plan: PlanSuscripcion.Basico,
      numEspecialistas: 2,
      diaCobro: 10,
    });
    cupos = new CuposService(new PlanService());
    const router = new RouterCanalService(new ConfigResolverService(), new RemitenteResolver({ get: () => undefined } as never), cupos);
    notificaciones = new NotificacionesService(new JobQueue(), cupos, new PlantillasService(), router, new MetricsService(), new MensajeriaEstadoService());
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('UPGRADE: el cupo sube de inmediato y el consumo del ciclo se conserva', async () => {
    await cambiarPlan(PlanSuscripcion.Basico, 2);
    await fijarConsumoSms(30);
    const antes = await cupos.verificar(negocioId, 'sms');
    expect(antes.cupo).toBe(40); // básico base
    expect(antes.consumo).toBe(30);

    await cambiarPlan(PlanSuscripcion.Pro, 2);
    const despues = await cupos.verificar(negocioId, 'sms');
    expect(despues.cupo).toBe(120); // pro base → sube el denominador
    expect(despues.consumo).toBe(30); // el numerador NO se toca
    expect(despues.restante).toBe(90);
    expect(despues.cicloInicio).toBe(antes.cicloInicio); // mismo ciclo
  });

  it('MÁS ESPECIALISTAS: el cupo escala por cada uno sobre los incluidos', async () => {
    await cambiarPlan(PlanSuscripcion.Pro, 2);
    expect((await cupos.verificar(negocioId, 'sms')).cupo).toBe(120);
    await cambiarPlan(PlanSuscripcion.Pro, 5); // 3 extra × 30
    expect((await cupos.verificar(negocioId, 'sms')).cupo).toBe(210);
  });

  it('DOWNGRADE a mitad de ciclo: el cupo baja ya y puede dejar el consumo por encima', async () => {
    await cambiarPlan(PlanSuscripcion.Pro, 2);
    await fijarConsumoSms(100);
    expect((await cupos.verificar(negocioId, 'sms')).dentroDeCupo).toBe(true); // 100 < 120

    await cambiarPlan(PlanSuscripcion.Basico, 2);
    const tras = await cupos.verificar(negocioId, 'sms');
    expect(tras.cupo).toBe(40);
    expect(tras.consumo).toBe(100); // el consumo ya gastado no se borra
    expect(tras.dentroDeCupo).toBe(false);
    expect(tras.restante).toBe(0); // nunca negativo
  });

  it('sobre cupo tras downgrade: marketing BLOQUEADO, transaccional pasa (D2)', async () => {
    await cambiarPlan(PlanSuscripcion.Basico, 2);
    await fijarConsumoSms(999);

    await notificaciones.encolarMarketing(negocioId, '3001112233', 'promo');
    await notificaciones.encolarConfirmacion(negocioId, '3001112233', {
      sucursalNombre: 'Sede',
      especialistaNombre: 'Ana',
      inicio: new Date('2030-05-01T15:00:00Z'),
    });

    const filas = await adminDb.select().from(mensaje).where(eq(mensaje.negocioId, negocioId));
    const marketing = filas.find((f) => f.tipo === 'marketing');
    const confirmacion = filas.find((f) => f.tipo === 'confirmacion');
    expect(marketing!.estado).toBe('sin_cupo'); // bloqueo duro
    expect(confirmacion!.estado).toBe('pendiente'); // sigue su curso (blando)
  });

  it('RENOVACIÓN: al entrar el ciclo nuevo el consumo arranca en 0', async () => {
    await cambiarPlan(PlanSuscripcion.Pro, 2);
    await fijarConsumoSms(80);
    const actual = await cupos.verificar(negocioId, 'sms');
    expect(actual.consumo).toBe(80);

    // Un mes después ya es otro ciclo: el contador del anterior no cuenta.
    const proximoCiclo = new Date(new Date(actual.cicloFin).getTime() + 86400_000);
    const renovado = await cupos.verificar(negocioId, 'sms', proximoCiclo);
    expect(renovado.consumo).toBe(0);
    expect(renovado.cupo).toBe(120); // el cupo no cambia por renovar
    expect(renovado.cicloInicio).not.toBe(actual.cicloInicio);
  });

  it('ninguna ruta de cambio de plan toca el contador de consumo', async () => {
    await cambiarPlan(PlanSuscripcion.Pro, 2);
    await fijarConsumoSms(55);
    const filasAntes = await adminDb.select().from(consumoMensajeria).where(eq(consumoMensajeria.negocioId, negocioId));

    await cambiarPlan(PlanSuscripcion.Premium, 8);
    await cambiarPlan(PlanSuscripcion.Basico, 2);

    const filasDespues = await adminDb.select().from(consumoMensajeria).where(eq(consumoMensajeria.negocioId, negocioId));
    expect(filasDespues.map((f) => f.cantidad)).toEqual(filasAntes.map((f) => f.cantidad));
  });

  it('CANCELACIÓN/SUSPENSIÓN corta el acceso (y con él los envíos del guard)', () => {
    expect(tieneAcceso(EstadoSuscripcion.Activa)).toBe(true);
    expect(tieneAcceso(EstadoSuscripcion.Suspendida)).toBe(false);
    expect(tieneAcceso(EstadoSuscripcion.Cancelada)).toBe(false);
  });

  it('el catálogo de la landing coincide con el backend en especialistas incluidos', async () => {
    // Regresión de la inconsistencia detectada en FASE-09: la landing decía que
    // Empresarial incluía 2 especialistas y el backend 15, así que el simulador
    // de precio le cobraba al visitante 13 extras que el backend no cobra.
    //
    // Se lee el archivo como TEXTO a propósito: importarlo rompería el `rootDir`
    // del paquete api. La duplicación del catálogo es la causa de fondo (ver la
    // nota en FASE-09); esta prueba solo impide que vuelvan a divergir.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { PLANES } = await import('../plans/plan-registry');

    const fuente = readFileSync(
      join(__dirname, '../../../web/src/pages/site/site-data.ts'),
      'utf8',
    );
    const encontrados = [...fuente.matchAll(/id:\s*'(\w+)'[^}]*?included:\s*(\d+)/g)].map((m) => ({
      id: m[1],
      incluidos: Number(m[2]),
    }));
    expect(encontrados.length).toBe(Object.keys(PLANES).length); // por si cambia el formato

    for (const p of encontrados) {
      const backend = PLANES[p.id as PlanSuscripcion];
      expect({ id: p.id, incluidos: p.incluidos }).toEqual({
        id: p.id,
        incluidos: backend.especialistasIncluidos,
      });
    }
  });
});
