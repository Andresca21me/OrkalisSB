import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { EstadoSuscripcion, PlanSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cobro, consumoMensajeria, negocio, sucursal, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import { cicloDeCobro } from '../notificaciones/ciclo';
import type { CuposMensajeria } from '../plans/plan-registry';
import { SuscripcionEstadoService } from './suscripcion-estado.service';
import { TransicionInvalidaError } from './suscripcion-estado';

export interface UltimoCobro {
  periodo: string;
  estado: string;
  monto: number;
}

export interface ResumenPlataforma {
  negocioId: string;
  nombre: string;
  perfil: string;
  estadoSuscripcion: string;
  plan: string;
  numEspecialistas: number;
  numSucursales: number;
  cargoMensual: number;
  creadoEn: Date;
  ultimoCobro: UltimoCobro | null;
}

export interface CobroDetalle {
  id: string;
  periodo: string;
  monto: number;
  estado: string;
  referencia: string;
  creadoEn: Date;
  pagadoEn: Date | null;
}

export interface DetalleNegocio {
  negocio: {
    id: string;
    nombre: string;
    perfil: string;
    estadoSuscripcion: string;
    creadoEn: Date;
  };
  suscripcion: {
    plan: string;
    numEspecialistas: number;
    estado: string;
    cargoMensual: number;
    /** Últimos 4 dígitos de la tarjeta guardada (null si no hay método). */
    metodoUltimos4: string | null;
    /** Próximo cobro programado (null en cortesía/sin método). */
    proximoCobro: Date | null;
  };
  numSucursales: number;
  cobros: CobroDetalle[];
  cupos: {
    /** Mes calendario (compatibilidad con la vista del operador). */
    periodo: string;
    /** Ventana real del ciclo de cobro contra la que se mide el consumo (D1). */
    cicloInicio: Date;
    cicloFin: Date;
    limites: CuposMensajeria;
    consumo: CuposMensajeria;
  };
}

/**
 * Operaciones del OPERADOR DE PLATAFORMA (FASE-12/13, HU-PLT-001/002).
 * Transversal: usa la conexión admin y SOLO toca suscripción/estado y lecturas
 * de salud (cobros, cupos) — nunca datos operativos internos de los negocios →
 * no rompe el aislamiento del ADR-001.
 */
@Injectable()
export class PlataformaService {
  constructor(
    private readonly plans: PlanService,
    private readonly estado: SuscripcionEstadoService,
  ) {}

  private periodo(d = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Lista todos los negocios con su suscripción, nº de sucursales y el último
   * cobro emitido (para la consola del operador).
   */
  async listarSuscripciones(): Promise<ResumenPlataforma[]> {
    const filas = await adminDb
      .select({
        negocioId: negocio.id,
        nombre: negocio.nombre,
        perfil: negocio.perfil,
        estadoSuscripcion: negocio.estadoSuscripcion,
        creadoEn: negocio.creadoEn,
        plan: suscripcion.plan,
        num: suscripcion.numEspecialistas,
      })
      .from(negocio)
      .innerJoin(suscripcion, eq(suscripcion.negocioId, negocio.id))
      .orderBy(negocio.nombre);

    // Sucursales por negocio (una sola consulta agregada).
    const sucRows = await adminDb
      .select({ negocioId: sucursal.negocioId, c: count() })
      .from(sucursal)
      .groupBy(sucursal.negocioId);
    const sucMap = new Map(sucRows.map((r) => [r.negocioId, Number(r.c)]));

    // Último cobro por negocio (recorrido descendente, primero visto = más reciente).
    const cobros = await adminDb
      .select({
        negocioId: cobro.negocioId,
        periodo: cobro.periodo,
        estado: cobro.estado,
        monto: cobro.monto,
      })
      .from(cobro)
      .orderBy(desc(cobro.creadoEn));
    const ultimoMap = new Map<string, UltimoCobro>();
    for (const c of cobros) {
      if (!ultimoMap.has(c.negocioId)) {
        ultimoMap.set(c.negocioId, { periodo: c.periodo, estado: c.estado, monto: Number(c.monto) });
      }
    }

    return filas.map((f) => ({
      negocioId: f.negocioId,
      nombre: f.nombre,
      perfil: f.perfil,
      estadoSuscripcion: f.estadoSuscripcion,
      plan: f.plan,
      numEspecialistas: f.num,
      numSucursales: sucMap.get(f.negocioId) ?? 0,
      cargoMensual: this.plans.calcularCargo(f.plan as PlanSuscripcion, f.num),
      creadoEn: f.creadoEn,
      ultimoCobro: ultimoMap.get(f.negocioId) ?? null,
    }));
  }

  /** Ficha de salud de un tenant: datos, suscripción, cobros y uso de cupos. */
  async detalleNegocio(negocioId: string): Promise<DetalleNegocio> {
    const [neg] = await adminDb
      .select({
        id: negocio.id,
        nombre: negocio.nombre,
        perfil: negocio.perfil,
        estadoSuscripcion: negocio.estadoSuscripcion,
        creadoEn: negocio.creadoEn,
      })
      .from(negocio)
      .where(eq(negocio.id, negocioId))
      .limit(1);
    if (!neg) throw new NotFoundException('Negocio no encontrado.');

    const [sus] = await adminDb
      .select({
        plan: suscripcion.plan,
        num: suscripcion.numEspecialistas,
        estado: suscripcion.estado,
        metodoUltimos4: suscripcion.metodoUltimos4,
        proximoCobro: suscripcion.proximoCobro,
        diaCobro: suscripcion.diaCobro,
        trialFin: suscripcion.trialFin,
        creadoEn: suscripcion.creadoEn,
      })
      .from(suscripcion)
      .where(eq(suscripcion.negocioId, negocioId))
      .limit(1);
    if (!sus) throw new NotFoundException('El negocio no tiene suscripción.');

    const [{ c: numSucursales }] = await adminDb
      .select({ c: count() })
      .from(sucursal)
      .where(eq(sucursal.negocioId, negocioId));

    const cobrosRaw = await adminDb
      .select()
      .from(cobro)
      .where(eq(cobro.negocioId, negocioId))
      .orderBy(desc(cobro.creadoEn));
    const cobros: CobroDetalle[] = cobrosRaw.map((c) => ({
      id: c.id,
      periodo: c.periodo,
      monto: Number(c.monto),
      estado: c.estado,
      referencia: c.referencia,
      creadoEn: c.creadoEn,
      pagadoEn: c.pagadoEn,
    }));

    // Consumo del CICLO DE COBRO vigente (D1). Antes se sumaban todos los
    // períodos históricos, lo que inflaba el consumo mes a mes.
    const ciclo = cicloDeCobro({
      diaCobro: sus.diaCobro,
      proximoCobro: sus.proximoCobro,
      trialFin: sus.trialFin,
      creadoEn: sus.creadoEn,
    });
    const periodo = this.periodo();
    const consumoRows = await adminDb
      .select({ canal: consumoMensajeria.canal, cantidad: consumoMensajeria.cantidad })
      .from(consumoMensajeria)
      .where(
        and(
          eq(consumoMensajeria.negocioId, negocioId),
          eq(consumoMensajeria.cicloInicio, ciclo.inicio),
        ),
      );
    const consumo: CuposMensajeria = { whatsappUtility: 0, whatsappMarketing: 0, sms: 0, email: 0 };
    for (const r of consumoRows) {
      if (r.canal === 'whatsapp_utility') consumo.whatsappUtility += r.cantidad;
      else if (r.canal === 'whatsapp_marketing') consumo.whatsappMarketing += r.cantidad;
      else if (r.canal === 'sms') consumo.sms += r.cantidad;
      else if (r.canal === 'email') consumo.email += r.cantidad;
    }

    const plan = sus.plan as PlanSuscripcion;
    return {
      negocio: neg,
      suscripcion: {
        plan: sus.plan,
        numEspecialistas: sus.num,
        estado: sus.estado,
        cargoMensual: this.plans.calcularCargo(plan, sus.num),
        metodoUltimos4: sus.metodoUltimos4,
        proximoCobro: sus.proximoCobro,
      },
      numSucursales: Number(numSucursales),
      cobros,
      cupos: {
        periodo,
        cicloInicio: ciclo.inicio,
        cicloFin: ciclo.fin,
        limites: this.plans.cuposMensajeria(plan, sus.num),
        consumo,
      },
    };
  }

  /** Suspende la cuenta (conserva los datos íntegros, RF-007). */
  async suspender(negocioId: string): Promise<void> {
    // Suspensión "dura" del operador: válida desde cualquier estado de cobro.
    await adminDb
      .update(suscripcion)
      .set({ estado: EstadoSuscripcion.Suspendida, actualizadoEn: new Date() })
      .where(eq(suscripcion.negocioId, negocioId));
    const filas = await adminDb
      .update(negocio)
      .set({ estadoSuscripcion: EstadoSuscripcion.Suspendida, actualizadoEn: new Date() })
      .where(eq(negocio.id, negocioId))
      .returning({ id: negocio.id });
    if (filas.length === 0) throw new NotFoundException('Negocio no encontrado.');
  }

  /** Reactiva la cuenta manualmente (transición `reactivar` → activa). */
  async reactivar(negocioId: string): Promise<void> {
    await this.transicionar(negocioId, 'reactivar');
  }

  /**
   * Asigna a una cuenta los beneficios de un plan SIN generar cobro (cortesía
   * para pruebas, regla #6). Fija plan/numEspecialistas y limpia el aniversario
   * de cobro: el cron de FASE-06 solo selecciona `activa`, así que `cortesia`
   * queda fuera por construcción.
   */
  async darCortesia(
    negocioId: string,
    { plan, numEspecialistas }: { plan: PlanSuscripcion; numEspecialistas: number },
  ): Promise<void> {
    await this.transicionar(negocioId, 'dar_cortesia', {
      plan,
      numEspecialistas,
      proximoCobro: null,
      graciaInicio: null,
      intentosFallidos: 0,
    });
  }

  /** Retira la cortesía → la cuenta queda `suspendida` (máquina de estados). */
  async quitarCortesia(negocioId: string): Promise<void> {
    await this.transicionar(negocioId, 'quitar_cortesia');
  }

  /** Aplica una transición y mapea la transición inválida a un 400 legible. */
  private async transicionar(
    negocioId: string,
    evento: Parameters<SuscripcionEstadoService['aplicar']>[1],
    campos: Parameters<SuscripcionEstadoService['aplicar']>[2] = {},
  ): Promise<void> {
    try {
      await this.estado.aplicar(negocioId, evento, campos);
    } catch (e) {
      if (e instanceof TransicionInvalidaError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
