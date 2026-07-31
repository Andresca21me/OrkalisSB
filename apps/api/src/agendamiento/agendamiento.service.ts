import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { EstadoCita, MetodoPago, OrigenCita, RolUsuario, type CitaAgenda, type CobroCita } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { atencion, atencionPago, atencionProducto, cita, citaServicio, cliente, especialista, servicio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { sucursalScope } from '../common/scope';
import { transicionar, type EventoCita } from './cita-state-machine';
import { ValidadorFactory } from './validators/validador.factory';
import { validarEntidades } from './validators/validador-cita.port';
import { AvisosEspecialistaService } from './avisos-especialista.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AtencionService } from '../finanzas/atencion.service';

const EXCLUSION_VIOLATION = '23P01';

type Cita = typeof cita.$inferSelect;

/** Agenda interna y operación del turno (FASE-08, RF-023/025/028). */
@Injectable()
export class AgendamientoService {
  constructor(
    private readonly validadores: ValidadorFactory,
    private readonly avisos: AvisosEspecialistaService,
    private readonly notificaciones: NotificacionesService,
    private readonly atencionService: AtencionService,
  ) {}

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

      // Cobro real de las completadas (Plan-Finanzas F2): ticket, productos y
      // métodos. `miGanancia` solo viaja para el admin y el PROPIO especialista
      // (D2): recepción ve tickets, nunca reparto.
      const idsCompletadas = filas.filter((f) => f.estado === EstadoCita.Completada).map((f) => f.id);
      const cobros = new Map<string, CobroCita>();
      if (idsCompletadas.length) {
        const ats = await tx
          .select({
            citaId: atencion.citaId,
            atencionId: atencion.id,
            total: atencion.total,
            ganProf: atencion.ganProf,
            snapshot: atencion.snapshotParam,
          })
          .from(atencion)
          .where(inArray(atencion.citaId, idsCompletadas));
        const atIds = ats.map((a) => a.atencionId);
        const numProd = new Map<string, number>();
        const metodos = new Map<string, MetodoPago[]>();
        if (atIds.length) {
          const prods = await tx
            .select({ atencionId: atencionProducto.atencionId, n: sql<number>`sum(${atencionProducto.cantidad})`.mapWith(Number) })
            .from(atencionProducto)
            .where(inArray(atencionProducto.atencionId, atIds))
            .groupBy(atencionProducto.atencionId);
          for (const p of prods) numProd.set(p.atencionId, p.n);
          const pagos = await tx
            .select({ atencionId: atencionPago.atencionId, metodo: atencionPago.metodo, monto: atencionPago.monto })
            .from(atencionPago)
            .where(inArray(atencionPago.atencionId, atIds))
            .orderBy(desc(atencionPago.monto));
          for (const p of pagos) {
            const arr = metodos.get(p.atencionId) ?? [];
            if (!arr.includes(p.metodo as MetodoPago)) arr.push(p.metodo as MetodoPago);
            metodos.set(p.atencionId, arr);
          }
        }
        const miEspecialistaId = ctx.rol === RolUsuario.Especialista && ctx.usuarioId ? await this.especialistaDe(tx, ctx.usuarioId) : null;
        const filaDe = new Map(filas.map((f) => [f.id, f]));
        for (const a of ats) {
          const snap = (a.snapshot ?? {}) as { totalServicios?: number; totalProductos?: number };
          const duenio = filaDe.get(a.citaId)?.especialistaId;
          const veGanancia = ctx.rol === RolUsuario.Admin || (miEspecialistaId !== null && duenio === miEspecialistaId);
          cobros.set(a.citaId, {
            atencionId: a.atencionId,
            total: Number(a.total),
            totalServicios: Number(snap.totalServicios ?? 0),
            totalProductos: Number(snap.totalProductos ?? 0),
            numProductos: numProd.get(a.atencionId) ?? 0,
            metodos: metodos.get(a.atencionId) ?? [],
            miGanancia: veGanancia ? Number(a.ganProf) : null,
          });
        }
      }
      const servs = await tx
        .select({
          citaId: citaServicio.citaId,
          servicioId: citaServicio.servicioId,
          nombre: servicio.nombre,
          precio: citaServicio.precioAplicado,
        })
        .from(citaServicio)
        .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
        .where(inArray(citaServicio.citaId, ids));
      const porCita = new Map<string, { nombre: string; precio: string }[]>();
      const idsPorCita = new Map<string, string[]>();
      for (const s of servs) {
        const arr = porCita.get(s.citaId) ?? [];
        arr.push({ nombre: s.nombre, precio: s.precio });
        porCita.set(s.citaId, arr);
        const idArr = idsPorCita.get(s.citaId) ?? [];
        idArr.push(s.servicioId);
        idsPorCita.set(s.citaId, idArr);
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
        servicioIds: idsPorCita.get(f.id) ?? [],
        cobro: cobros.get(f.id) ?? null,
      }));
    });
  }

  /** Crea una cita AGENDADA interna (futura), en estado Confirmada (FASE-05). */
  async crearAgendada(
    ctx: TenantContext,
    input: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[]; inicio: Date },
  ): Promise<Cita> {
    const c = await this.crearInterna(ctx, { ...input, estado: EstadoCita.Confirmada });
    await this.avisos.avisar(ctx, c.id, 'Nueva cita en tu agenda');
    return c;
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
    const reasignada = await runInTenantTx(ctx, async (tx) => {
      const actual = await this.cargar(tx, citaId);
      if (actual.especialistaId === especialistaId) return actual;

      const [esp] = await tx.select({ id: especialista.id }).from(especialista).where(eq(especialista.id, especialistaId)).limit(1);
      if (!esp) throw new NotFoundException('Especialista no encontrado.');

      // Hasta aquí solo se comprobaba que el destino EXISTIERA: se podía reasignar
      // a alguien dado de baja, de otra sede o que no realiza el servicio. Se
      // reutiliza el validador común para que la reasignación exija lo mismo que
      // la creación (activo + sucursal + capacidades).
      const servs = await tx
        .select({ id: citaServicio.servicioId })
        .from(citaServicio)
        .where(eq(citaServicio.citaId, citaId));
      await validarEntidades(tx, {
        negocioId: ctx.negocioId,
        sucursalId: actual.sucursalId,
        especialistaId,
        inicio: actual.inicio,
        fin: actual.fin,
        servicioIds: servs.map((s) => s.id),
      });

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
    // Post-commit: el nuevo responsable se entera de que le asignaron el turno.
    await this.avisos.avisar(ctx, citaId, 'Te asignaron esta cita');
    return reasignada;
  }

  iniciar(ctx: TenantContext, citaId: string): Promise<Cita> {
    return this.transicion(ctx, citaId, 'iniciar');
  }
  async cancelar(ctx: TenantContext, citaId: string): Promise<Cita> {
    const c = await this.transicion(ctx, citaId, 'cancelar');
    await this.avisos.avisar(ctx, citaId, 'Cita cancelada');
    // Y al CLIENTE: hasta ahora una cancelación hecha desde el panel solo se le
    // avisaba al especialista, así que el cliente se presentaba a una cita que ya
    // no existía. La cancelación pública sí avisaba; esto iguala ambos caminos.
    await this.avisarClienteCancelacion(ctx, citaId);
    return c;
  }

  /** Aviso de cancelación al cliente. Best-effort: la cita ya quedó cancelada. */
  private async avisarClienteCancelacion(ctx: TenantContext, citaId: string): Promise<void> {
    try {
      const [d] = await runInTenantTx(ctx, (tx) =>
        tx
          .select({
            inicio: cita.inicio,
            sucursalId: cita.sucursalId,
            telefono: cliente.telefono,
            sucursalNombre: sucursal.nombre,
            especialistaNombre: especialista.nombre,
          })
          .from(cita)
          .innerJoin(sucursal, eq(sucursal.id, cita.sucursalId))
          .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
          .leftJoin(cliente, eq(cliente.id, cita.clienteId))
          .where(eq(cita.id, citaId))
          .limit(1),
      );
      if (!d?.telefono) return;
      await this.notificaciones.encolarAviso(
        ctx.negocioId,
        d.telefono,
        { sucursalNombre: d.sucursalNombre, especialistaNombre: d.especialistaNombre, inicio: d.inicio },
        { sucursalId: d.sucursalId, citaId },
      );
    } catch {
      /* el aviso nunca debe tumbar la cancelación */
    }
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
   * (HU-ESP-007, RF-028). Solo chequeos de sanidad.
   *
   * Plan-Finanzas D7: antes creaba la cita `Completada` SIN atención — trabajo
   * registrado que jamás entraba a reportes ni liquidaciones. Ahora se crea en
   * curso y se CIERRA de verdad (atención + snapshot + pago por el total con el
   * método capturado). Si el cierre falla (p. ej. candado de comisión bancaria
   * con método electrónico), la cita se borra: nunca queda a medias.
   */
  async walkInRetroactivo(
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
    // `validarServicios: false` — la atención ya ocurrió; impedir registrarla
    // porque hoy el especialista no tenga ese servicio asignado solo dejaría el
    // trabajo sin cobrar ni liquidar.
    const nueva = await this.crearInterna(ctx, { ...input, estado: EstadoCita.EnProgreso, validarServicios: false });
    try {
      await this.atencionService.completar(ctx, nueva.id, { pagos: [], metodoUnico: input.metodoPago });
    } catch (e) {
      await runInTenantTx(ctx, (tx) => tx.delete(cita).where(eq(cita.id, nueva.id)));
      throw e;
    }
    return { ...nueva, estado: EstadoCita.Completada };
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
      /** El retroactivo no valida capacidades: registra algo que ya ocurrió. */
      validarServicios?: boolean;
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
          servicioIds: input.servicioIds,
          validarServicios: input.validarServicios,
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

  /** Especialista enlazado al usuario en sesión (D2), o null si no tiene ficha. */
  private async especialistaDe(tx: DrizzleTx, usuarioId: string): Promise<string | null> {
    const [e] = await tx
      .select({ id: especialista.id })
      .from(especialista)
      .where(and(eq(especialista.usuarioId, usuarioId), eq(especialista.activo, true)))
      .limit(1);
    return e?.id ?? null;
  }
}
