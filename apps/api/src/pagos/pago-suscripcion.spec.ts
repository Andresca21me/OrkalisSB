import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoSuscripcion, PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cobro, negocio, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import type { MercadoPagoClient, PagoMP } from './mercadopago.client';
import { PagoSuscripcionService } from './pago-suscripcion.service';
import { SuscripcionEstadoService } from './suscripcion-estado.service';

/** Doble del cliente MP: controla aprobar/rechazar sin llamar a la API real. */
class FakeMercadoPago {
  aprobar = true;
  async crearCustomer(): Promise<string> {
    return 'cus_test';
  }
  async guardarTarjeta(): Promise<{ id: string; ultimos4: string }> {
    return { id: 'card_test', ultimos4: '0604' };
  }
  async crearPago(): Promise<PagoMP> {
    return this.aprobar
      ? { id: 'pay_ok', status: 'approved', cardId: 'card_from_pay', ultimos4: '0604' }
      : { id: 'pay_no', status: 'rejected', statusDetail: 'cc_rejected_insufficient_amount' };
  }
}

async function crearNegocio(nombre: string): Promise<string> {
  await adminDb.delete(negocio).where(eq(negocio.nombre, nombre));
  const [n] = await adminDb
    .insert(negocio)
    .values({ nombre, perfil: PerfilNegocio.Barberia, estadoSuscripcion: EstadoSuscripcion.Prueba })
    .returning();
  await adminDb.insert(suscripcion).values({
    negocioId: n.id,
    plan: PlanSuscripcion.Basico,
    numEspecialistas: 0,
    estado: EstadoSuscripcion.Prueba,
  });
  return n.id;
}

describe('PagoSuscripcionService (Plan-Pagos FASE-05)', () => {
  const A = 'PAGO TEST A';
  const B = 'PAGO TEST B';
  let svc: PagoSuscripcionService;
  let mp: FakeMercadoPago;
  let idA: string;
  let idB: string;

  beforeAll(async () => {
    mp = new FakeMercadoPago();
    svc = new PagoSuscripcionService(
      mp as unknown as MercadoPagoClient,
      new PlanService(),
      new SuscripcionEstadoService(),
    );
    idA = await crearNegocio(A);
    idB = await crearNegocio(B);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, A));
    await adminDb.delete(negocio).where(eq(negocio.nombre, B));
    await adminClient.end();
    await client.end();
  });

  it('registrarMetodo guarda la tarjeta (Customer + Card) sin cobrar', async () => {
    const r = await svc.registrarMetodo(idA, { cardToken: 'tok', payerEmail: 'a@b.com' });
    expect(r.metodoUltimos4).toBe('**** 0604');
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.mpCustomerId).toBe('cus_test');
    expect(s.mpCardId).toBe('card_test');
    expect(s.estado).toBe(EstadoSuscripcion.Prueba); // no cobró → sigue en prueba
  });

  it('pagar rechazado: lanza, marca el cobro fallido y NO activa', async () => {
    mp.aprobar = false;
    await expect(svc.pagar(idB, { cardToken: 'tok', payerEmail: 'b@b.com' })).rejects.toThrow(/fondos/i);
    const [c] = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idB));
    expect(c.estado).toBe('fallido');
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idB));
    expect(s.estado).toBe(EstadoSuscripcion.Prueba);
  });

  it('pagar aprobado: cobro pagado, cuenta activa y aniversario de cobro fijado', async () => {
    mp.aprobar = true;
    const r = await svc.pagar(idA, { cardToken: 'tok2', payerEmail: 'a@b.com' });
    expect(r.estado).toBe('activa');

    const [c] = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idA));
    expect(c.estado).toBe('pagado');
    expect(c.mpPaymentId).toBe('pay_ok');

    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.estado).toBe(EstadoSuscripcion.Activa);
    expect(s.mpCardId).toBe('card_from_pay'); // card.id que devuelve el pago (recurrencia)
    expect(s.diaCobro).toBeGreaterThanOrEqual(1);
    expect(s.diaCobro).toBeLessThanOrEqual(28);
    expect(s.proximoCobro).toBeTruthy();

    const [n] = await adminDb.select().from(negocio).where(eq(negocio.id, idA));
    expect(n.estadoSuscripcion).toBe(EstadoSuscripcion.Activa);
  });

  // ── Cambio de plan con prorrateo (FASE-09 v2) ──────────────────────────────
  // idA quedó ACTIVA (Básico, 80.000) con próximo cobro fijado tras el pago.

  it('preview de SUBIDA (Básico→Pro) clasifica upgrade y cobra prorrateo > 0', async () => {
    const p = await svc.previewCambio(idA, PlanSuscripcion.Pro);
    expect(p.tipo).toBe('upgrade');
    expect(p.montoActual).toBe(80000);
    expect(p.montoNuevo).toBe(130000);
    expect(p.requierePago).toBe(true);
    expect(p.montoAhora).toBeGreaterThan(0);
    expect(p.montoAhora).toBeLessThanOrEqual(50000); // ≤ diferencia mensual completa
  });

  it('SUBIDA sin tarjeta responde requiere_pago y NO aplica todavía', async () => {
    const r = await svc.cambiar(idA, { plan: PlanSuscripcion.Pro });
    expect(r.resultado).toBe('requiere_pago');
    expect(r.montoAhora).toBeGreaterThan(0);
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.plan).toBe(PlanSuscripcion.Basico); // sigue en el plan anterior
  });

  it('SUBIDA con tarjeta cobra el prorrateo, aplica el plan y NO mueve la fecha de cobro', async () => {
    mp.aprobar = true;
    const [antes] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    const r = await svc.cambiar(idA, { plan: PlanSuscripcion.Pro, cardToken: 'tok', payerEmail: 'a@b.com' });
    expect(r.resultado).toBe('aplicado');
    expect(r.cobrado).toBe(true);

    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.plan).toBe(PlanSuscripcion.Pro);
    expect(s.proximoCobro?.getTime()).toBe(antes.proximoCobro?.getTime()); // misma fecha
    // Existe un cobro de ajuste pagado por el monto prorrateado.
    const cobros = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idA));
    const ajuste = cobros.find((c) => c.referencia.includes('-up-'));
    expect(ajuste?.estado).toBe('pagado');
    expect(Number(ajuste?.monto)).toBe(r.montoAhora);
  });

  it('BAJADA (Pro→Básico) aplica de inmediato SIN cobro', async () => {
    const r = await svc.cambiar(idA, { plan: PlanSuscripcion.Basico });
    expect(r.resultado).toBe('aplicado');
    expect(r.cobrado).toBe(false);
    expect(r.tipo).toBe('downgrade');
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.plan).toBe(PlanSuscripcion.Basico);
  });

  it('en PRUEBA, una subida aplica directo sin cobro (aún no paga)', async () => {
    // idB sigue en prueba; subir a Pro no cobra.
    const r = await svc.cambiar(idB, { plan: PlanSuscripcion.Pro });
    expect(r.resultado).toBe('aplicado');
    expect(r.cobrado).toBe(false);
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idB));
    expect(s.plan).toBe(PlanSuscripcion.Pro);
    expect(s.estado).toBe(EstadoSuscripcion.Prueba);
  });

  // ── B3 · profundización: seguridad de dinero en el cambio ──────────────────

  it('cambio LATERAL (mismo plan/cupo) aplica sin cobro', async () => {
    // idA está en Básico/activa: pedir Básico de nuevo no cambia el cargo.
    const r = await svc.cambiar(idA, { plan: PlanSuscripcion.Basico });
    expect(r.resultado).toBe('aplicado');
    expect(r.tipo).toBe('lateral');
    expect(r.cobrado).toBe(false);
    expect(r.montoAhora).toBe(0);
  });

  it('en_gracia se trata como activa: una subida también cobra prorrateo', async () => {
    await adminDb.update(suscripcion).set({ estado: EstadoSuscripcion.EnGracia }).where(eq(suscripcion.negocioId, idA));
    const p = await svc.previewCambio(idA, PlanSuscripcion.Pro);
    expect(p.tipo).toBe('upgrade');
    expect(p.requierePago).toBe(true);
    expect(p.montoAhora).toBeGreaterThan(0);
    await adminDb.update(suscripcion).set({ estado: EstadoSuscripcion.Activa }).where(eq(suscripcion.negocioId, idA));
  });

  it('SUBIDA con tarjeta RECHAZADA: lanza, NO aplica el plan y deja el cobro fallido', async () => {
    mp.aprobar = false;
    await expect(
      svc.cambiar(idA, { plan: PlanSuscripcion.Premium, cardToken: 'tok', payerEmail: 'a@b.com' }),
    ).rejects.toThrow();
    mp.aprobar = true;

    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, idA));
    expect(s.plan).toBe(PlanSuscripcion.Basico); // el plan NO cambió pese al intento
    const cobros = await adminDb.select().from(cobro).where(eq(cobro.negocioId, idA));
    expect(cobros.some((c) => c.referencia.includes('-up-') && c.estado === 'fallido')).toBe(true);
  });
});
