import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { EstadoSuscripcion, PlanSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cobro, especialista, sucursal, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import { MercadoPagoClient, PAGO_APROBADO } from './mercadopago.client';
import { SuscripcionEstadoService } from './suscripcion-estado.service';
import { prorratearDiferencia } from './prorrateo';

/** Tipo de cambio según el efecto en el cargo mensual. */
export type TipoCambio = 'upgrade' | 'downgrade' | 'lateral';

/** Previsualización de un cambio de plan/cupo (sin aplicar). */
export interface PreviewCambio {
  tipo: TipoCambio;
  estado: string;
  plan: PlanSuscripcion;
  numEspecialistas: number;
  montoActual: number;
  montoNuevo: number;
  /** Lo que se cobra HOY (prorrateo de la subida); 0 si no se cobra ahora. */
  montoAhora: number;
  /** `true` si aplicar requiere datos de tarjeta (subida en cuenta activa). */
  requierePago: boolean;
  proximoCobro: Date | null;
}

/** Resultado de aplicar un cambio. */
export interface ResultadoCambio {
  resultado: 'aplicado' | 'requiere_pago';
  tipo: TipoCambio;
  cobrado: boolean;
  montoAhora: number;
  montoNuevo: number;
  proximoCobro: Date | null;
}

/**
 * Primer pago y registro del método de pago (Plan-Pagos FASE-05).
 *
 * - `registrarMetodo`: guarda la tarjeta (Customer + Card de Mercado Pago) para
 *   la recurrencia, sin cobrar — p. ej. un usuario en prueba que deja su método.
 * - `pagar`: PRIMER pago con la tarjeta presente (cobro directo del token, que
 *   funciona en sandbox y producción). Al aprobarse, guarda el `card.id` que MP
 *   devuelve (para que la recurrencia de FASE-06 cobre esa tarjeta) y deja la
 *   cuenta `activa`, fijando el día-aniversario de cobro.
 */
@Injectable()
export class PagoSuscripcionService {
  private readonly logger = new Logger('PagoSuscripcion');

  constructor(
    private readonly mp: MercadoPagoClient,
    private readonly plans: PlanService,
    private readonly estado: SuscripcionEstadoService,
  ) {}

  private periodo(d = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Próximo cobro: +1 mes anclado al día (1..28) para no derivar con los meses. */
  private proximoCobro(diaCobro: number, desde = new Date()): Date {
    return new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, diaCobro, 12, 0, 0));
  }

  private async cargarSuscripcion(negocioId: string) {
    const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId)).limit(1);
    if (!s) throw new BadRequestException('El negocio no tiene suscripción.');
    return s;
  }

  /** Guarda el método de pago (Customer + Card) sin cobrar. */
  async registrarMetodo(
    negocioId: string,
    datos: { cardToken: string; payerEmail: string },
  ): Promise<{ metodoUltimos4: string }> {
    const s = await this.cargarSuscripcion(negocioId);
    const customerId = s.mpCustomerId ?? (await this.mp.crearCustomer(datos.payerEmail));
    const tarjeta = await this.mp.guardarTarjeta(customerId, datos.cardToken);
    const metodoUltimos4 = `**** ${tarjeta.ultimos4}`;

    await adminDb
      .update(suscripcion)
      .set({
        mpCustomerId: customerId,
        mpCardId: tarjeta.id,
        mpPayerEmail: datos.payerEmail,
        metodoUltimos4,
        actualizadoEn: new Date(),
      })
      .where(eq(suscripcion.negocioId, negocioId));

    return { metodoUltimos4 };
  }

  /**
   * Primer pago (tarjeta presente). Cobra el token directamente, registra el
   * método para la recurrencia y deja la cuenta `activa`.
   */
  async pagar(
    negocioId: string,
    datos: { cardToken: string; payerEmail: string; paymentMethodId?: string },
  ): Promise<{ estado: string; metodoUltimos4: string | null }> {
    const s = await this.cargarSuscripcion(negocioId);
    const plan = s.plan as PlanSuscripcion;
    const monto = this.plans.calcularCargo(plan, s.numEspecialistas);
    const periodo = this.periodo();
    const referencia = `cob-${negocioId}-${periodo}`;
    const customerId = s.mpCustomerId ?? (await this.mp.crearCustomer(datos.payerEmail));

    // Cobro del período (idempotente por negocio+período).
    await adminDb
      .insert(cobro)
      .values({ negocioId, periodo, monto: monto.toFixed(2), referencia })
      .onConflictDoNothing({ target: cobro.referencia });
    const [c] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);
    if (c.estado === 'pagado') {
      return { estado: 'activa', metodoUltimos4: s.metodoUltimos4 ?? null };
    }

    const pago = await this.mp.crearPago({
      token: datos.cardToken,
      montoCOP: monto,
      referencia,
      payerEmail: datos.payerEmail,
      customerId,
      paymentMethodId: datos.paymentMethodId,
      descripcion: `Suscripción Orkalis · ${periodo}`,
    });

    if (pago.status !== PAGO_APROBADO) {
      await adminDb.update(cobro).set({ estado: 'fallido', mpPaymentId: pago.id }).where(eq(cobro.id, c.id));
      this.logger.warn(`Primer pago no aprobado (${pago.status}/${pago.statusDetail}) negocio ${negocioId}.`);
      throw new BadRequestException(this.mensajeRechazo(pago.statusDetail));
    }

    // Aprobado: marca el cobro, guarda el método y activa la cuenta.
    await adminDb
      .update(cobro)
      .set({ estado: 'pagado', mpPaymentId: pago.id, pagadoEn: new Date() })
      .where(eq(cobro.id, c.id));

    const metodoUltimos4 = pago.ultimos4 ? `**** ${pago.ultimos4}` : s.metodoUltimos4 ?? null;
    const ahora = new Date();
    const diaCobro = Math.min(ahora.getUTCDate(), 28);

    await this.estado.aplicar(negocioId, 'pago_ok', {
      mpCustomerId: customerId,
      mpCardId: pago.cardId ?? s.mpCardId ?? null,
      mpPayerEmail: datos.payerEmail,
      metodoUltimos4,
      diaCobro,
      proximoCobro: this.proximoCobro(diaCobro, ahora),
      ultimoCobroOk: ahora,
      intentosFallidos: 0,
    });

    return { estado: 'activa', metodoUltimos4 };
  }

  // ── Cambio de plan / cupo con prorrateo (Plan-Pagos FASE-09 v2) ────────────

  /** Previsualiza el cambio: clasifica (subida/bajada/lateral) y calcula montos. */
  async previewCambio(
    negocioId: string,
    plan?: PlanSuscripcion,
    numEspecialistas?: number,
  ): Promise<PreviewCambio> {
    const c = await this.clasificar(negocioId, plan, numEspecialistas);
    return {
      tipo: c.tipo,
      estado: c.estado,
      plan: c.plan,
      numEspecialistas: c.num,
      montoActual: c.montoActual,
      montoNuevo: c.montoNuevo,
      montoAhora: c.montoAhora,
      requierePago: c.requierePago,
      proximoCobro: c.proximoCobro,
    };
  }

  /**
   * Aplica el cambio de plan/cupo:
   *  - prueba/cortesía, bajada o cambio lateral → aplica de inmediato SIN cobro
   *    (el monto nuevo —menor o igual— se cobra en el próximo ciclo);
   *  - SUBIDA en cuenta activa → cobra el PRORRATEO de la diferencia con tarjeta
   *    presente y aplica; el próximo cobro mantiene su fecha, ya al nuevo monto.
   *    Si no llegan datos de tarjeta, responde `requiere_pago` con el monto.
   */
  async cambiar(
    negocioId: string,
    dto: {
      plan?: PlanSuscripcion;
      numEspecialistas?: number;
      cardToken?: string;
      payerEmail?: string;
      paymentMethodId?: string;
    },
  ): Promise<ResultadoCambio> {
    const c = await this.clasificar(negocioId, dto.plan, dto.numEspecialistas);

    // Aplicación directa (sin cobro): trial/cortesía, bajada o lateral.
    if (!c.requierePago) {
      await adminDb
        .update(suscripcion)
        .set({ plan: c.plan, numEspecialistas: c.num, actualizadoEn: new Date() })
        .where(eq(suscripcion.negocioId, negocioId));
      return { resultado: 'aplicado', tipo: c.tipo, cobrado: false, montoAhora: 0, montoNuevo: c.montoNuevo, proximoCobro: c.proximoCobro };
    }

    // Subida en cuenta activa: hay que cobrar el prorrateo con tarjeta presente.
    if (!dto.cardToken || !dto.payerEmail) {
      return { resultado: 'requiere_pago', tipo: c.tipo, cobrado: false, montoAhora: c.montoAhora, montoNuevo: c.montoNuevo, proximoCobro: c.proximoCobro };
    }

    const s = c.s;
    const periodo = this.periodo();
    const referencia = `cob-${negocioId}-${periodo}-up-${Date.now()}`;
    const customerId = s.mpCustomerId ?? (await this.mp.crearCustomer(dto.payerEmail));

    await adminDb.insert(cobro).values({ negocioId, periodo, monto: c.montoAhora.toFixed(2), referencia });
    const [cob] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);

    const pago = await this.mp.crearPago({
      token: dto.cardToken,
      montoCOP: c.montoAhora,
      referencia,
      payerEmail: dto.payerEmail,
      customerId,
      paymentMethodId: dto.paymentMethodId,
      descripcion: `Orkalis · ajuste de plan (${periodo})`,
    });

    if (pago.status !== PAGO_APROBADO) {
      await adminDb.update(cobro).set({ estado: 'fallido', mpPaymentId: pago.id }).where(eq(cobro.id, cob.id));
      this.logger.warn(`Cobro de ajuste no aprobado (${pago.status}/${pago.statusDetail}) negocio ${negocioId}.`);
      throw new BadRequestException(this.mensajeRechazo(pago.statusDetail));
    }

    await adminDb
      .update(cobro)
      .set({ estado: 'pagado', mpPaymentId: pago.id, pagadoEn: new Date() })
      .where(eq(cobro.id, cob.id));

    // Aplica el plan/cupo y guarda el método. NO cambia `proximoCobro`: el ciclo
    // mantiene su fecha y el próximo cobro será al nuevo monto completo.
    const metodoUltimos4 = pago.ultimos4 ? `**** ${pago.ultimos4}` : s.metodoUltimos4 ?? null;
    await adminDb
      .update(suscripcion)
      .set({
        plan: c.plan,
        numEspecialistas: c.num,
        mpCustomerId: customerId,
        mpCardId: pago.cardId ?? s.mpCardId ?? null,
        mpPayerEmail: dto.payerEmail,
        metodoUltimos4,
        actualizadoEn: new Date(),
      })
      .where(eq(suscripcion.negocioId, negocioId));

    return { resultado: 'aplicado', tipo: c.tipo, cobrado: true, montoAhora: c.montoAhora, montoNuevo: c.montoNuevo, proximoCobro: c.proximoCobro };
  }

  /** Valida el cambio y clasifica subida/bajada/lateral con sus montos. */
  private async clasificar(negocioId: string, planNuevo?: PlanSuscripcion, numNuevo?: number) {
    const s = await this.cargarSuscripcion(negocioId);
    const plan = planNuevo ?? (s.plan as PlanSuscripcion);
    const num = numNuevo ?? s.numEspecialistas;

    const [{ c: nSuc }] = await adminDb
      .select({ c: count() })
      .from(sucursal)
      .where(eq(sucursal.negocioId, negocioId));
    if (!this.plans.permiteSucursales(plan, Number(nSuc))) {
      throw new BadRequestException(
        `El plan ${plan} admite hasta ${this.plans.maxSucursales(plan)} sucursal(es); el negocio tiene ${nSuc}. Desactiva alguna primero.`,
      );
    }

    const [{ c: activos }] = await adminDb
      .select({ c: count() })
      .from(especialista)
      .where(and(eq(especialista.negocioId, negocioId), eq(especialista.activo, true)));
    const cupo = this.plans.cupoEspecialistas(plan, num);
    if (cupo < Number(activos)) {
      throw new BadRequestException(
        `No puedes bajar a ${cupo} especialistas: tienes ${activos} activos. Desactiva algunos primero.`,
      );
    }

    const montoActual = this.plans.calcularCargo(s.plan as PlanSuscripcion, s.numEspecialistas);
    const montoNuevo = this.plans.calcularCargo(plan, num);
    const tipo: TipoCambio = montoNuevo > montoActual ? 'upgrade' : montoNuevo < montoActual ? 'downgrade' : 'lateral';

    const activa = s.estado === EstadoSuscripcion.Activa || s.estado === EstadoSuscripcion.EnGracia;
    const montoAhora =
      tipo === 'upgrade' && activa
        ? prorratearDiferencia(montoNuevo - montoActual, s.proximoCobro, new Date())
        : 0;

    return { s, plan, num, tipo, estado: s.estado, montoActual, montoNuevo, montoAhora, requierePago: montoAhora > 0, proximoCobro: s.proximoCobro };
  }

  /** Traduce el `status_detail` de Mercado Pago a un mensaje claro. */
  private mensajeRechazo(detalle?: string): string {
    const mapa: Record<string, string> = {
      cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
      cc_rejected_bad_filled_security_code: 'El código de seguridad (CVV) es incorrecto.',
      cc_rejected_bad_filled_date: 'La fecha de vencimiento es incorrecta.',
      cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Prueba con otra tarjeta.',
      cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu banco.',
    };
    return (detalle && mapa[detalle]) ?? 'No pudimos procesar el pago. Verifica los datos o usa otra tarjeta.';
  }
}
