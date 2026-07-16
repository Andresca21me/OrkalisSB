import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cobro, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import {
  FirmaWebhook,
  MercadoPagoClient,
  NotificacionMP,
  PAGO_APROBADO,
} from './mercadopago.client';
import { SuscripcionEstadoService } from './suscripcion-estado.service';
import { TransicionInvalidaError } from './suscripcion-estado';

@Injectable()
export class FacturacionService {
  private readonly logger = new Logger('Facturacion');

  constructor(
    private readonly plans: PlanService,
    private readonly mp: MercadoPagoClient,
    private readonly estado: SuscripcionEstadoService,
  ) {}

  private periodo(d = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Genera (idempotente) el cobro PENDIENTE del período de un negocio. El cobro
   * real contra la tarjeta guardada llega en FASE-05/06; aquí solo se registra
   * el cargo del mes. Cross-tenant (operador de plataforma) → conexión admin.
   */
  async generarCobro(negocioId: string): Promise<{
    cobroId: string;
    referencia: string;
    monto: number;
    periodo: string;
    estado: string;
  }> {
    const [sus] = await adminDb
      .select({ plan: suscripcion.plan, num: suscripcion.numEspecialistas })
      .from(suscripcion)
      .where(eq(suscripcion.negocioId, negocioId))
      .limit(1);
    if (!sus) throw new BadRequestException('El negocio no tiene suscripción.');

    const periodo = this.periodo();
    const monto = this.plans.calcularCargo(sus.plan as PlanSuscripcion, sus.num);
    const referencia = `cob-${negocioId}-${periodo}`;

    // Idempotente por (negocio, período): no duplica el cobro del mes.
    await adminDb
      .insert(cobro)
      .values({ negocioId, periodo, monto: monto.toFixed(2), referencia })
      .onConflictDoNothing({ target: cobro.referencia });

    const [c] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);
    return { cobroId: c.id, referencia, monto: Number(c.monto), periodo, estado: c.estado };
  }

  /**
   * Procesa una notificación de webhook de Mercado Pago: verifica la firma,
   * consulta el pago real, localiza el cobro por su `external_reference` y
   * actualiza el cobro + el estado de la suscripción. Idempotente por referencia.
   */
  async procesarWebhook(noti: NotificacionMP, firma: FirmaWebhook): Promise<{ procesado: boolean }> {
    const dataId = noti?.data?.id;
    if (!this.mp.verificarFirma({ ...firma, dataId })) {
      throw new BadRequestException('Firma de webhook inválida.');
    }
    // Solo nos interesan las notificaciones de pago.
    const tipo = noti.type ?? noti.action?.split('.')[0];
    if (tipo !== 'payment' || dataId == null) return { procesado: false };

    const pago = await this.mp.consultarPago(String(dataId));
    const referencia = pago.externalReference;
    if (!referencia) {
      this.logger.warn(`Pago ${pago.id} sin external_reference; se ignora.`);
      return { procesado: false };
    }

    const [c] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);
    if (!c) {
      this.logger.warn(`Webhook sin cobro asociado: ${referencia}`);
      return { procesado: false };
    }
    if (c.estado === 'pagado') return { procesado: true }; // idempotencia

    if (pago.status === PAGO_APROBADO) {
      await adminDb
        .update(cobro)
        .set({ estado: 'pagado', mpPaymentId: pago.id, pagadoEn: new Date() })
        .where(eq(cobro.id, c.id));
      // Pago al día → cuenta activa (vía máquina de estados; sincroniza ambas tablas).
      try {
        await this.estado.aplicar(c.negocioId, 'pago_ok', { ultimoCobroOk: new Date() });
      } catch (e) {
        if (e instanceof TransicionInvalidaError) this.logger.warn(e.message);
        else throw e;
      }
    } else {
      // El paso a gracia/suspensión (morosidad) lo maneja el cron en FASE-06/07.
      await adminDb.update(cobro).set({ estado: 'fallido', mpPaymentId: pago.id }).where(eq(cobro.id, c.id));
      this.logger.warn(`Pago no aprobado (${pago.status}) para negocio ${c.negocioId}.`);
    }
    return { procesado: true };
  }
}
