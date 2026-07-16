import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { EstadoSuscripcion, PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cobro, negocio, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import type { MercadoPagoClient, PagoMP } from './mercadopago.client';
import { CobroCronService } from './cobro-cron.service';
import { SuscripcionEstadoService } from './suscripcion-estado.service';

class FakeMercadoPago {
  aprobar = true;
  async tokenizarTarjetaGuardada(): Promise<string> {
    return 'tok_recurrente';
  }
  async crearPago(): Promise<PagoMP> {
    return this.aprobar
      ? { id: 'pay_rec_ok', status: 'approved' }
      : { id: 'pay_rec_no', status: 'rejected', statusDetail: 'cc_rejected_insufficient_amount' };
  }
}

const AHORA = new Date(Date.UTC(2026, 5, 26, 12, 0, 0)); // 26-jun-2026
const VENCIDO = new Date(Date.UTC(2026, 5, 20, 12, 0, 0)); // 20-jun-2026 (pasado)

async function crearNegocio(
  nombre: string,
  estado: EstadoSuscripcion,
  conMetodo = true,
): Promise<string> {
  await adminDb.delete(negocio).where(eq(negocio.nombre, nombre));
  const [n] = await adminDb
    .insert(negocio)
    .values({ nombre, perfil: PerfilNegocio.Barberia, estadoSuscripcion: estado })
    .returning();
  await adminDb.insert(suscripcion).values({
    negocioId: n.id,
    plan: PlanSuscripcion.Basico,
    numEspecialistas: 0,
    estado,
    diaCobro: 20,
    proximoCobro: VENCIDO,
    ...(conMetodo
      ? { mpCustomerId: 'cus_x', mpCardId: 'card_x', mpPayerEmail: 'pagador@test.com' }
      : {}),
  });
  return n.id;
}

const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);

/** Crea una cuenta `en_gracia` con su cobro fallido pendiente del período. */
async function crearEnGracia(nombre: string, graciaInicio: Date): Promise<string> {
  await adminDb.delete(negocio).where(eq(negocio.nombre, nombre));
  const [n] = await adminDb
    .insert(negocio)
    .values({ nombre, perfil: PerfilNegocio.Barberia, estadoSuscripcion: EstadoSuscripcion.EnGracia })
    .returning();
  await adminDb.insert(suscripcion).values({
    negocioId: n.id,
    plan: PlanSuscripcion.Basico,
    numEspecialistas: 0,
    estado: EstadoSuscripcion.EnGracia,
    diaCobro: 20,
    proximoCobro: VENCIDO,
    mpCustomerId: 'cus_x',
    mpCardId: 'card_x',
    mpPayerEmail: 'pagador@test.com',
    graciaInicio,
    intentosFallidos: 1,
  });
  await adminDb.insert(cobro).values({
    negocioId: n.id,
    periodo: '2026-06',
    monto: '80000.00',
    estado: 'fallido',
    referencia: `cob-${n.id}-2026-06`,
    intento: 1,
  });
  return n.id;
}

describe('CobroCronService · cobro recurrente y morosidad (Plan-Pagos FASE-06/07)', () => {
  const OK = 'CRON TEST OK';
  const CORTESIA = 'CRON TEST CORTESIA';
  const RECHAZO = 'CRON TEST RECHAZO';
  const MORA_OK = 'CRON TEST MORA OK';
  const MORA_FAIL = 'CRON TEST MORA FAIL';
  const MORA_CORTE = 'CRON TEST MORA CORTE';
  let svc: CobroCronService;
  let mp: FakeMercadoPago;
  let idOk: string;
  let idCortesia: string;

  beforeAll(async () => {
    mp = new FakeMercadoPago();
    svc = new CobroCronService(
      mp as unknown as MercadoPagoClient,
      new PlanService(),
      new SuscripcionEstadoService(),
      new EventEmitter2(),
    );
    idOk = await crearNegocio(OK, EstadoSuscripcion.Activa);
    idCortesia = await crearNegocio(CORTESIA, EstadoSuscripcion.Cortesia);
  });

  afterAll(async () => {
    for (const n of [OK, CORTESIA, RECHAZO, MORA_OK, MORA_FAIL, MORA_CORTE]) {
      await adminDb.delete(negocio).where(eq(negocio.nombre, n));
    }
    await adminClient.end();
    await client.end();
  });

  it('cobra la cuenta activa vencida y avanza el aniversario un mes', async () => {
    mp.aprobar = true;
    const r = await svc.ejecutarCiclo(AHORA);
    expect(r.cobrados).toBeGreaterThanOrEqual(1);

    const [c] = await adminDb
      .select()
      .from(cobro)
      .where(and(eq(cobro.negocioId, idOk), eq(cobro.estado, 'pagado')));
    expect(c).toBeTruthy();
    expect(c.periodo).toBe('2026-06');

    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idOk));
    expect(s.estado).toBe(EstadoSuscripcion.Activa);
    expect(s.ultimoCobroOk).toBeTruthy();
    // proximo_cobro avanzó a julio, anclado al día 20.
    expect(s.proximoCobro?.getUTCMonth()).toBe(6); // julio (0-index)
    expect(s.proximoCobro?.getUTCDate()).toBe(20);
  });

  it('la cuenta de cortesía se ignora (no genera cobro)', async () => {
    const cobros = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idCortesia));
    expect(cobros).toHaveLength(0);
  });

  it('es idempotente: re-ejecutar no duplica ni recobra', async () => {
    const r = await svc.ejecutarCiclo(AHORA);
    // La cuenta OK ya avanzó su proximo_cobro a julio → no se vuelve a seleccionar.
    const cobros = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idOk));
    expect(cobros).toHaveLength(1);
    expect(r.cobrados).toBe(0);
  });

  it('un cobro rechazado deja la cuenta en gracia (la morosidad es FASE-07)', async () => {
    // Se crea aquí para que no entre en los ciclos anteriores (OK ya avanzó).
    const idRechazo = await crearNegocio(RECHAZO, EstadoSuscripcion.Activa);
    mp.aprobar = false;
    await svc.ejecutarCiclo(AHORA); // solo RECHAZO sigue vencido
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idRechazo));
    expect(s.estado).toBe(EstadoSuscripcion.EnGracia);
    expect(s.intentosFallidos).toBe(1);
    expect(s.graciaInicio).toBeTruthy();
    const [c] = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idRechazo));
    expect(c.estado).toBe('fallido');
  });

  // ── Morosidad (FASE-07) ─────────────────────────────────────────────────────
  it('morosidad: reintento exitoso dentro de la ventana → vuelve a activa', async () => {
    const id = await crearEnGracia(MORA_OK, dias(2));
    mp.aprobar = true;
    const r = await svc.ejecutarCiclo(AHORA);
    expect(r.reactivados).toBeGreaterThanOrEqual(1);

    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, id));
    expect(s.estado).toBe(EstadoSuscripcion.Activa);
    expect(s.graciaInicio).toBeNull();
    expect(s.intentosFallidos).toBe(0);
    expect(s.proximoCobro?.getUTCMonth()).toBe(6); // julio
  });

  it('morosidad: reintento fallido → sigue en gracia y sube el contador', async () => {
    const id = await crearEnGracia(MORA_FAIL, dias(1));
    mp.aprobar = false;
    await svc.ejecutarCiclo(AHORA);
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, id));
    expect(s.estado).toBe(EstadoSuscripcion.EnGracia);
    expect(s.intentosFallidos).toBe(2);
  });

  it('morosidad: gracia agotada (≥ 7 días) → suspensión automática', async () => {
    const id = await crearEnGracia(MORA_CORTE, dias(8));
    await svc.ejecutarCiclo(AHORA);
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, id));
    expect(s.estado).toBe(EstadoSuscripcion.Suspendida);
    const [n] = await adminDb.select().from(negocio).where(eq(negocio.id, id));
    expect(n.estadoSuscripcion).toBe(EstadoSuscripcion.Suspendida); // sincronizado
  });
});
