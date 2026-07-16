import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { EstadoCita, MetodoPago, OrigenCita, type CitaAgenda } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { cita, citaServicio, cliente, especialista, servicio } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { sucursalScope } from '../common/scope';
import { transicionar, type EventoCita } from './cita-state-machine';
import { ValidadorFactory } from './validators/validador.factory';

const EXCLUSION_VIOLATION = '23P01';

type Cita = typeof cita.$inferSelect;

/** Agenda interna y operación del turno (FASE-08, RF-023/025/028). */
@Injectable()
export class AgendamientoService {
  constructor(private readonly validadores: ValidadorFactory) {}

  /**
   * Agenda filtrable por sucursal/especialista/rango, acotada por alcance.
   * Enriquece cada cita con nombres de cliente/especialista y sus servicios,
   * que es lo que consumen el panel y la agenda del admin (FASE-05).
   */
  async listarAgenda(
    ctx: TenantContext,
    filtros: { sucursalId?: string; especialistaId?: string; desde?: Date; hasta?: Date },
  ): Promise<CitaAgenda[]> {
    return runInTenantTx(ctx, async (tx) => {
      const filas = await tx
        .select({
          id: cita.id,
          sucursalId: cita.sucursalId,
          clienteId: cita.clienteId,
          clienteNombre: cliente.nombre,
          especialistaId: cita.especialistaId,
          especialistaNombre: especialista.nombre,
          inicio: cita.inicio,
          fin: cita.fin,
          estado: cita.estado,
          origen: cita.origen,
          precioEst: cita.precioEst,
        })
        .from(cita)
        .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(
          and(
            sucursalScope(ctx, cita.sucursalId),
            filtros.sucursalId ? eq(cita.sucursalId, filtros.sucursalId) : undefined,
            filtros.especialistaId ? eq(cita.especialistaId, filtros.especialistaId) : undefined,
            filtros.desde ? gte(cita.inicio, filtros.desde) : undefined,
            filtros.hasta ? lte(cita.inicio, filtros.hasta) : undefined,
          ),
        )
        .orderBy(asc(cita.inicio));

      if (filas.length === 0) return [];

      // Servicios de todas las citas listadas, en una sola consulta.
      const ids = filas.map((f) => f.id);
      const servs = await tx
        .select({ citaId: citaServicio.citaId, nombre: servicio.nombre, precio: citaServicio.precioAplicado })
        .from(citaServicio)
        .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
        .where(inArray(citaServicio.citaId, ids));
      const porCita = new Map<string, { nombre: string; precio: string }[]>();
      for (const s of servs) {
        const arr = porCita.get(s.citaId) ?? [];
        arr.push({ nombre: s.nombre, precio: s.precio });
        porCita.set(s.citaId, arr);
      }

      return filas.map((f) => ({
        id: f.id,
        sucursalId: f.sucursalId,
        clienteId: f.clienteId,
        clienteNombre: f.clienteNombre,
        especialistaId: f.especialistaId,
        especialistaNombre: f.especialistaNombre,
        inicio: f.inicio.toISOString(),
        fin: f.fin.toISOString(),
        estado: f.estado as EstadoCita,
        origen: f.origen as OrigenCita,
        precioEst: f.precioEst,
        servicios: porCita.get(f.id) ?? [],
      }));
    });
  }

  /** Crea una cita AGENDADA interna (futura), en estado Confirmada (FASE-05). */
  crearAgendada(
    ctx: TenantContext,
    input: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[]; inicio: Date },
  ): Promise<Cita> {
    return this.crearInterna(ctx, { ...input, estado: EstadoCita.Confirmada });
  }

  /** Aplica una transición de estado validada por la máquina de estados. */
  private async transicion(ctx: TenantContext, citaId: string, evento: EventoCita): Promise<Cita> {
    return runInTenantTx(ctx, async (tx) => {
      const actual = await this.cargar(tx, citaId);
      const nuevoEstado = transicionar(actual.estado as EstadoCita, evento);
      try {
        const [c] = await tx
          .update(cita)
          .set({ estado: nuevoEstado, actualizadoEn: new Date() })
          .where(eq(cita.id, citaId))
          .returning();
        return c;
      } catch (e) {
        if ((e as { code?: string }).code === EXCLUSION_VIOLATION) {
          throw new ConflictException('La franja se solapa con otro turno activo.');
        }
        throw e;
      }
    });
  }

  /**
   * Reasigna una cita a otro especialista (FASE-11, H4). El EXCLUDE anti-solape
   * (`cita_no_solape`) rechaza si el destino ya tiene un turno en esa franja.
   */
  async reasignar(ctx: TenantContext, citaId: string, especialistaId: string): Promise<Cita> {
    return runInTenantTx(ctx, async (tx) => {
      const actual = await this.cargar(tx, citaId);
      if (actual.especialistaId === especialistaId) return actual;

      const [esp] = await tx.select({ id: especialista.id }).from(especialista).where(eq(especialista.id, especialistaId)).limit(1);
      if (!esp) throw new NotFoundException('Especialista no encontrado.');

      try {
        const [c] = await tx
          .update(cita)
          .set({ especialistaId, actualizadoEn: new Date() })
          .where(eq(cita.id, citaId))
          .returning();
        return c;
      } catch (e) {
        if ((e as { code?: string }).code === EXCLUSION_VIOLATION) {
          throw new ConflictException('El especialista destino ya tiene un turno en esa franja.');
        }
        throw e;
      }
    });
  }

  iniciar(ctx: TenantContext, citaId: string): Promise<Cita> {
    return this.transicion(ctx, citaId, 'iniciar');
  }
  cancelar(ctx: TenantContext, citaId: string): Promise<Cita> {
    return this.transicion(ctx, citaId, 'cancelar');
  }
  noAsistio(ctx: TenantContext, citaId: string): Promise<Cita> {
    return this.transicion(ctx, citaId, 'no_asistio');
  }
  aprobar(ctx: TenantContext, citaId: string): Promise<Cita> {
    return this.transicion(ctx, citaId, 'aprobar');
  }

  /** Walk-in EN VIVO: origen interno, entra en `en_progreso` (HU-ESP-006). */
  walkInVivo(
    ctx: TenantContext,
    input: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[] },
  ): Promise<Cita> {
    const inicio = new Date();
    return this.crearInterna(ctx, { ...input, inicio, estado: EstadoCita.EnProgreso });
  }

  /**
   * Walk-in RETROACTIVO: horas en el pasado, entra directo en `completada`
   * (HU-ESP-007, RF-028). Solo chequeos de sanidad; dispara FASE-09 al cerrar.
   */
  walkInRetroactivo(
    ctx: TenantContext,
    input: {
      sucursalId: string;
      especialistaId: string;
      clienteId?: string;
      servicioIds: string[];
      inicio: Date;
      fin: Date;
      metodoPago: MetodoPago;
    },
  ): Promise<Cita> {
    return this.crearInterna(ctx, { ...input, estado: EstadoCita.Completada });
  }

  private async crearInterna(
    ctx: TenantContext,
    input: {
      sucursalId: string;
      especialistaId: string;
      clienteId?: string;
      servicioIds: string[];
      inicio: Date;
      fin?: Date;
      estado: EstadoCita;
    },
  ): Promise<Cita> {
    return runInTenantTx(ctx, async (tx) => {
      const servicios = await tx
        .select({ id: servicio.id, precio: servicio.precio, dur: servicio.duracionMin })
        .from(servicio)
        .where(inArray(servicio.id, input.servicioIds));
      if (servicios.length !== new Set(input.servicioIds).size) {
        throw new NotFoundException('Algún servicio no existe.');
      }
      const duracion = servicios.reduce((s, x) => s + x.dur, 0);
      const fin = input.fin ?? new Date(input.inicio.getTime() + duracion * 60_000);
      const precioEst = servicios.reduce((s, x) => s + Number(x.precio), 0);

      await this.validadores
        .paraOrigen(OrigenCita.CreacionInterna)
        .validar(tx, {
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          especialistaId: input.especialistaId,
          inicio: input.inicio,
          fin,
        });

      let nueva: Cita;
      try {
        [nueva] = await tx
          .insert(cita)
          .values({
            negocioId: ctx.negocioId,
            sucursalId: input.sucursalId,
            clienteId: input.clienteId ?? null,
            especialistaId: input.especialistaId,
            inicio: input.inicio,
            fin,
            estado: input.estado,
            origen: OrigenCita.CreacionInterna,
            precioEst: precioEst.toFixed(2),
          })
          .returning();
      } catch (e) {
        if ((e as { code?: string }).code === EXCLUSION_VIOLATION) {
          throw new ConflictException('El especialista ya tiene un turno activo en esa franja.');
        }
        throw e;
      }

      await tx
        .insert(citaServicio)
        .values(servicios.map((s) => ({ citaId: nueva.id, servicioId: s.id, precioAplicado: s.precio })));
      return nueva;
    });
  }

  private async cargar(tx: DrizzleTx, citaId: string): Promise<Cita> {
    const [c] = await tx.select().from(cita).where(eq(cita.id, citaId)).limit(1);
    if (!c) throw new NotFoundException('Cita no encontrada.');
    return c;
  }
}
