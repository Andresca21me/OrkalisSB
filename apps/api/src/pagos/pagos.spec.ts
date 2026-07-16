import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoSuscripcion, PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { cobro, negocio, servicio, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import { FirmaWebhook, NotificacionMP, PagoMP } from './mercadopago.client';
import { FacturacionService } from './facturacion.service';
import { PlataformaService } from './plataforma.service';
import { SuscripcionEstadoService } from './suscripcion-estado.service';

/**
 * Doble de `MercadoPagoClient` para las pruebas: no llama a la API real.
 * Permite controlar la validez de la firma y el estado/external_reference que
 * "devolvería" Mercado Pago al consultar el pago del webhook.
 */
class FakeMercadoPago {
  firmaValida = true;
  status = 'approved';
  externalReference = '';
  verificarFirma(_: FirmaWebhook): boolean {
    return this.firmaValida;
  }
  async consultarPago(id: string): Promise<PagoMP> {
    return { id, status: this.status, externalReference: this.externalReference };
  }
}

function noti(paymentId: string): NotificacionMP {
  return { type: 'payment', data: { id: paymentId } };
}
const FIRMA: FirmaWebhook = { xSignature: 'ts=1,v1=x', xRequestId: 'r' };

describe('Pagos / suscripción Mercado Pago (Plan-Pagos FASE-02)', () => {
  const NOMBRE = 'Negocio PAGOS TEST';
  let negocioId: string;
  let mp: FakeMercadoPago;
  let facturacion: FacturacionService;
  let plataforma: PlataformaService;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb
      .insert(negocio)
      .values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia })
      .returning();
    negocioId = neg.id;
    await adminDb
      .insert(suscripcion)
      .values({ negocioId, plan: PlanSuscripcion.Basico, numEspecialistas: 0 });
    await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 });

    const plans = new PlanService();
    mp = new FakeMercadoPago();
    facturacion = new FacturacionService(
      plans,
      mp as unknown as import('./mercadopago.client').MercadoPagoClient,
      new SuscripcionEstadoService(),
    );
    plataforma = new PlataformaService(plans, new SuscripcionEstadoService());
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('genera el cobro del período con el cargo del plan (básico = 80.000)', async () => {
    const c = await facturacion.generarCobro(negocioId);
    expect(c.monto).toBe(80000);
    expect(c.referencia).toContain(negocioId);
    expect(c.estado).toBe('pendiente');
  });

  it('generar dos veces el mismo período es idempotente (no duplica)', async () => {
    await facturacion.generarCobro(negocioId);
    const filas = await adminDb.select().from(cobro).where(eq(cobro.negocioId, negocioId));
    expect(filas).toHaveLength(1);
  });

  it('webhook aprobado marca el cobro pagado y activa la cuenta', async () => {
    const c = await facturacion.generarCobro(negocioId);
    // Cuenta suspendida antes del pago (ambas tablas, para una transición real).
    await adminDb
      .update(negocio)
      .set({ estadoSuscripcion: EstadoSuscripcion.Suspendida })
      .where(eq(negocio.id, negocioId));
    await adminDb
      .update(suscripcion)
      .set({ estado: EstadoSuscripcion.Suspendida })
      .where(eq(suscripcion.negocioId, negocioId));

    mp.firmaValida = true;
    mp.status = 'approved';
    mp.externalReference = c.referencia;
    const res = await facturacion.procesarWebhook(noti('pay_ok_1'), FIRMA);
    expect(res.procesado).toBe(true);

    const [cob] = await adminDb.select().from(cobro).where(eq(cobro.referencia, c.referencia));
    expect(cob.estado).toBe('pagado');
    expect(cob.mpPaymentId).toBe('pay_ok_1');
    const [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Activa);
    const [sus] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId));
    expect(sus.estado).toBe(EstadoSuscripcion.Activa);
  });

  it('webhook con firma inválida es rechazado', async () => {
    mp.firmaValida = false;
    await expect(facturacion.procesarWebhook(noti('pay_x'), FIRMA)).rejects.toThrow();
    mp.firmaValida = true;
  });

  it('webhook re-entregado (mismo pago dos veces) es idempotente: no duplica ni recambia', async () => {
    const c = await facturacion.generarCobro(negocioId);
    mp.firmaValida = true;
    mp.status = 'approved';
    mp.externalReference = c.referencia;

    const r1 = await facturacion.procesarWebhook(noti('pay_idem'), FIRMA);
    expect(r1.procesado).toBe(true);
    const r2 = await facturacion.procesarWebhook(noti('pay_idem'), FIRMA); // reenvío de MP
    expect(r2.procesado).toBe(true);

    // Sigue habiendo UN cobro del período y sigue pagado (no se revierte ni duplica).
    const cobros = await adminDb.select().from(cobro).where(eq(cobro.referencia, c.referencia));
    expect(cobros).toHaveLength(1);
    expect(cobros[0].estado).toBe('pagado');
    const [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Activa);
  });

  it('suspender conserva los datos; reactivar restaura el acceso', async () => {
    await plataforma.suspender(negocioId);
    let [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Suspendida);
    // Los datos operativos siguen intactos (no destructivo, RF-007).
    const servicios = await adminDb.select().from(servicio).where(eq(servicio.negocioId, negocioId));
    expect(servicios.length).toBeGreaterThanOrEqual(1);

    await plataforma.reactivar(negocioId);
    [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Activa);
  });

  it('el listado de plataforma expone suscripción/cargo, no datos operativos', async () => {
    const lista = await plataforma.listarSuscripciones();
    const mio = lista.find((s) => s.negocioId === negocioId);
    expect(mio).toBeDefined();
    expect(mio!.cargoMensual).toBe(80000);
    // El resumen solo expone suscripción/salud (plan, cargo, nº sucursales,
    // último cobro) — nunca datos operativos del negocio (citas/clientes/atenciones).
    expect(Object.keys(mio!).sort()).toEqual(
      [
        'cargoMensual',
        'creadoEn',
        'estadoSuscripcion',
        'negocioId',
        'nombre',
        'numEspecialistas',
        'numSucursales',
        'perfil',
        'plan',
        'ultimoCobro',
      ].sort(),
    );
  });

  // ── Cortesía del operador (Plan-Pagos FASE-10) ─────────────────────────────
  it('dar cortesía Pro fija el plan/cupo, deja la cuenta en cortesía y sin aniversario de cobro', async () => {
    await plataforma.darCortesia(negocioId, { plan: PlanSuscripcion.Pro, numEspecialistas: 3 });

    const [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Cortesia);
    const [sus] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId));
    expect(sus.estado).toBe(EstadoSuscripcion.Cortesia);
    expect(sus.plan).toBe(PlanSuscripcion.Pro);
    expect(sus.numEspecialistas).toBe(3);
    expect(sus.proximoCobro).toBeNull(); // no entra al ciclo de cobro
  });

  it('una cuenta en cortesía queda EXCLUIDA del cron de cobro (por construcción de la query)', async () => {
    // El cron solo selecciona `estado = activa AND proximo_cobro <= ahora`. Una
    // cuenta en cortesía no cumple NINGUNA de las dos condiciones. Lo verificamos
    // sin correr el ciclo global (evita interferir con cobro-cron.spec en paralelo).
    const [sus] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId));
    expect(sus.estado).toBe(EstadoSuscripcion.Cortesia); // no es `activa`
    expect(sus.proximoCobro).toBeNull(); // y no tiene aniversario de cobro

    const candidatas = await adminDb
      .select({ id: suscripcion.negocioId })
      .from(suscripcion)
      .where(eq(suscripcion.estado, EstadoSuscripcion.Activa));
    expect(candidatas.find((c) => c.id === negocioId)).toBeUndefined();
  });

  it('quitar cortesía deja la cuenta suspendida', async () => {
    await plataforma.quitarCortesia(negocioId);
    const [neg] = await adminDb.select().from(negocio).where(eq(negocio.id, negocioId));
    expect(neg.estadoSuscripcion).toBe(EstadoSuscripcion.Suspendida);
    const [sus] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId));
    expect(sus.estado).toBe(EstadoSuscripcion.Suspendida);
  });

  it('dar cortesía sobre una cuenta ya en cortesía es una transición inválida (400)', async () => {
    await plataforma.darCortesia(negocioId, { plan: PlanSuscripcion.Premium, numEspecialistas: 2 });
    await expect(
      plataforma.darCortesia(negocioId, { plan: PlanSuscripcion.Premium, numEspecialistas: 2 }),
    ).rejects.toThrow();
  });
});
