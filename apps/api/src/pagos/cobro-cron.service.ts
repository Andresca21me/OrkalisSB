import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, lt, lte } from 'drizzle-orm';
import { EstadoSuscripcion, PlanSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cobro, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import { MercadoPagoClient, PAGO_APROBADO } from './mercadopago.client';
import { SuscripcionEstadoService } from './suscripcion-estado.service';
import { TransicionInvalidaError } from './suscripcion-estado';

type SuscripcionRow = typeof suscripcion.$inferSelect;

/** Días en gracia antes de la suspensión automática (Plan-Pagos FASE-07). */
const GRACIA_DIAS = 7;

/** Evento de morosidad (seam para notificaciones/FASE-11). */
export const PAGOS_MOROSIDAD = 'pagos.morosidad';
export interface EventoMorosidad {
  negocioId: string;
  evento: 'cobro_fallido' | 'suspendida' | 'reactivada';
  intentos?: number;
}

/** Resumen de un ciclo del cron. */
export interface ResumenCiclo {
  revisados: number;
  cobrados: number;
  fallidos: number;
  omitidos: number;
  suspendidos: number;
  reactivados: number;
}

/**
 * Motor de cobro recurrente mensual (Plan-Pagos FASE-06). Una vez al día revisa
 * las suscripciones `activa` cuyo `proximo_cobro` ya venció y las cobra contra
 * la tarjeta guardada (token desde `card_id`). El monto es siempre
 * `cargoMensual(plan, numEspecialistas)`.
 *
 * - Idempotente por (negocio, período): si ya hay un cobro `pagado` del período,
 *   no recobra.
 * - El aniversario (`proximo_cobro`) se ancla a `dia_cobro` (1..28) para no
 *   derivar con los meses.
 * - Las cuentas `cortesia` quedan fuera (solo se selecciona `activa`).
 * - La morosidad (reintentos, gracia, suspensión) la maneja FASE-07; aquí un
 *   cobro fallido solo deja la cuenta en `en_gracia`.
 *
 * NOTA: el cobro de tarjeta guardada no es verificable en el sandbox de MP
 * ("Card not found"); se prueba con un doble del `MercadoPagoClient` (ver
 * `cobro-cron.spec.ts`) y en producción.
 */
@Injectable()
export class CobroCronService {
  private readonly logger = new Logger('CobroCron');

  constructor(
    private readonly mp: MercadoPagoClient,
    private readonly plans: PlanService,
    private readonly estado: SuscripcionEstadoService,
    private readonly eventos: EventEmitter2,
  ) {}

  /** Tarea diaria (09:00 Bogotá). El ciclo real es `ejecutarCiclo`. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'America/Bogota' })
  async tareaDiaria(): Promise<void> {
    const r = await this.ejecutarCiclo();
    this.logger.log(`Ciclo de cobro: ${JSON.stringify(r)}`);
  }

  /**
   * Ejecuta un ciclo de cobro. `ahora` es inyectable para "viajar en el tiempo"
   * en pruebas. Devuelve un resumen.
   */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<ResumenCiclo> {
    const resumen: ResumenCiclo = {
      revisados: 0,
      cobrados: 0,
      fallidos: 0,
      omitidos: 0,
      suspendidos: 0,
      reactivados: 0,
    };

    // 1. Pruebas vencidas → suspendida (además del corte en caliente de FASE-04).
    const pruebas = await adminDb
      .select()
      .from(suscripcion)
      .where(and(eq(suscripcion.estado, EstadoSuscripcion.Prueba), lte(suscripcion.trialFin, ahora)));
    for (const s of pruebas) {
      await this.transicion(s.negocioId, 'prueba_vence');
      resumen.suspendidos += 1;
    }

    // 2. Cobro de las cuentas activas cuyo aniversario ya venció.
    const activas = await adminDb
      .select()
      .from(suscripcion)
      .where(and(eq(suscripcion.estado, EstadoSuscripcion.Activa), lte(suscripcion.proximoCobro, ahora)));
    resumen.revisados = activas.length;
    for (const s of activas) {
      resumen[await this.cobrarUno(s, ahora)] += 1;
    }

    // 3. Morosidad: reintentar las cuentas en gracia y suspender las agotadas.
    // Se excluyen las que entraron en gracia EN ESTE ciclo (`gracia_inicio < ahora`):
    // su reintento corresponde al siguiente día.
    const enGracia = await adminDb
      .select()
      .from(suscripcion)
      .where(and(eq(suscripcion.estado, EstadoSuscripcion.EnGracia), lt(suscripcion.graciaInicio, ahora)));
    for (const s of enGracia) {
      await this.procesarGracia(s, ahora, resumen);
    }

    return resumen;
  }

  private async cobrarUno(s: SuscripcionRow, ahora: Date): Promise<'cobrados' | 'fallidos' | 'omitidos'> {
    if (!s.mpCardId || !s.mpPayerEmail) {
      this.logger.warn(`Negocio ${s.negocioId} activa sin método de pago; se omite.`);
      return 'omitidos';
    }
    const due = s.proximoCobro ?? ahora;
    const periodo = this.periodo(due);
    const referencia = `cob-${s.negocioId}-${periodo}`;
    const monto = this.plans.calcularCargo(s.plan as PlanSuscripcion, s.numEspecialistas);

    // Cobro del período (idempotente por referencia).
    await adminDb
      .insert(cobro)
      .values({ negocioId: s.negocioId, periodo, monto: monto.toFixed(2), referencia })
      .onConflictDoNothing({ target: cobro.referencia });
    const [c] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);
    if (c.estado === 'pagado') {
      // Ya estaba pagado: solo asegura que el aniversario avance.
      await this.avanzarProximoCobro(s, due);
      return 'omitidos';
    }

    const token = await this.mp.tokenizarTarjetaGuardada(s.mpCardId);
    const pago = await this.mp.crearPago({
      token,
      montoCOP: monto,
      referencia,
      payerEmail: s.mpPayerEmail,
      customerId: s.mpCustomerId ?? undefined,
      descripcion: `Suscripción Orkalis · ${periodo}`,
    });

    if (pago.status === PAGO_APROBADO) {
      await adminDb
        .update(cobro)
        .set({ estado: 'pagado', mpPaymentId: pago.id, pagadoEn: ahora })
        .where(eq(cobro.id, c.id));
      await this.estado.aplicar(s.negocioId, 'pago_ok', {
        ultimoCobroOk: ahora,
        proximoCobro: this.siguienteCobro(due, s.diaCobro ?? due.getUTCDate()),
        intentosFallidos: 0,
        graciaInicio: null,
      });
      return 'cobrados';
    }

    // Rechazado → entra a gracia; la morosidad (reintentos/corte) la sigue FASE-07.
    await adminDb
      .update(cobro)
      .set({ estado: 'fallido', mpPaymentId: pago.id, intento: 1 })
      .where(eq(cobro.id, c.id));
    await this.estado.aplicar(s.negocioId, 'cobro_falla', { graciaInicio: ahora, intentosFallidos: 1 });
    this.eventos.emit(PAGOS_MOROSIDAD, { negocioId: s.negocioId, evento: 'cobro_fallido', intentos: 1 } satisfies EventoMorosidad);
    this.logger.warn(`Cobro fallido negocio ${s.negocioId} (${pago.status}/${pago.statusDetail}).`);
    return 'fallidos';
  }

  /**
   * Procesa una cuenta `en_gracia`: si pasaron ≥ 7 días desde `gracia_inicio`
   * sin éxito, la **suspende**; si no, **reintenta** el cobro pendiente. Un
   * reintento aprobado la devuelve a `activa` y avanza el aniversario.
   */
  private async procesarGracia(s: SuscripcionRow, ahora: Date, r: ResumenCiclo): Promise<void> {
    const inicio = s.graciaInicio ?? ahora;
    if (ahora.getTime() - inicio.getTime() >= GRACIA_DIAS * 86_400_000) {
      await this.transicion(s.negocioId, 'gracia_agotada'); // → suspendida
      this.eventos.emit(PAGOS_MOROSIDAD, { negocioId: s.negocioId, evento: 'suspendida' } satisfies EventoMorosidad);
      this.logger.warn(`Suscripción ${s.negocioId} suspendida por morosidad (gracia agotada).`);
      r.suspendidos += 1;
      return;
    }

    if (!s.mpCardId || !s.mpPayerEmail) return; // sin método; espera a que lo actualicen

    const due = s.proximoCobro ?? ahora;
    const periodo = this.periodo(due);
    const referencia = `cob-${s.negocioId}-${periodo}`;
    const [c] = await adminDb.select().from(cobro).where(eq(cobro.referencia, referencia)).limit(1);
    if (!c) return;

    const reactivar = async () => {
      await this.estado.aplicar(s.negocioId, 'pago_ok', {
        ultimoCobroOk: ahora,
        proximoCobro: this.siguienteCobro(due, s.diaCobro ?? due.getUTCDate()),
        intentosFallidos: 0,
        graciaInicio: null,
      });
      this.eventos.emit(PAGOS_MOROSIDAD, { negocioId: s.negocioId, evento: 'reactivada' } satisfies EventoMorosidad);
      r.reactivados += 1;
    };

    // Pudo haberse pagado por la pantalla de facturación: reactiva sin recobrar.
    if (c.estado === 'pagado') return reactivar();

    const monto = this.plans.calcularCargo(s.plan as PlanSuscripcion, s.numEspecialistas);
    const token = await this.mp.tokenizarTarjetaGuardada(s.mpCardId);
    const pago = await this.mp.crearPago({
      token,
      montoCOP: monto,
      referencia,
      payerEmail: s.mpPayerEmail,
      customerId: s.mpCustomerId ?? undefined,
      descripcion: `Suscripción Orkalis · ${periodo} (reintento)`,
    });

    if (pago.status === PAGO_APROBADO) {
      await adminDb
        .update(cobro)
        .set({ estado: 'pagado', mpPaymentId: pago.id, pagadoEn: ahora })
        .where(eq(cobro.id, c.id));
      return reactivar();
    }

    const intentos = (s.intentosFallidos ?? 0) + 1;
    await adminDb.update(cobro).set({ intento: intentos, mpPaymentId: pago.id }).where(eq(cobro.id, c.id));
    await this.estado.aplicar(s.negocioId, 'cobro_falla', { intentosFallidos: intentos }); // sigue en gracia
    this.eventos.emit(PAGOS_MOROSIDAD, { negocioId: s.negocioId, evento: 'cobro_fallido', intentos } satisfies EventoMorosidad);
    r.fallidos += 1;
  }

  /** Aplica una transición tolerando carreras (transición ya aplicada). */
  private async transicion(negocioId: string, evento: Parameters<SuscripcionEstadoService['aplicar']>[1]): Promise<void> {
    try {
      await this.estado.aplicar(negocioId, evento);
    } catch (e) {
      if (!(e instanceof TransicionInvalidaError)) throw e;
    }
  }

  /** Avanza `proximo_cobro` un mes anclado a `dia_cobro` (sin cobrar). */
  private async avanzarProximoCobro(s: SuscripcionRow, due: Date): Promise<void> {
    await adminDb
      .update(suscripcion)
      .set({ proximoCobro: this.siguienteCobro(due, s.diaCobro ?? due.getUTCDate()), actualizadoEn: new Date() })
      .where(eq(suscripcion.negocioId, s.negocioId));
  }

  private periodo(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** +1 mes anclado al día (1..28). */
  private siguienteCobro(actual: Date, diaCobro: number): Date {
    const dia = Math.min(diaCobro, 28);
    return new Date(Date.UTC(actual.getUTCFullYear(), actual.getUTCMonth() + 1, dia, 12, 0, 0));
  }
}
