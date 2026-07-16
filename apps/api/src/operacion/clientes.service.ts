import { Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, or, sql, sum } from 'drizzle-orm';
import type { ClienteCRM, ClienteHistorial, MetodoPago } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { atencion, cita, citaServicio, cliente, especialista, servicio } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

type Cliente = typeof cliente.$inferSelect;

/** Clientes / CRM (FASE-06, RF-036..RF-038). Borrado lógico; historial con agregados. */
@Injectable()
export class ClientesService {
  /**
   * Directorio enriquecido para la tarjeta del CRM (`GET /clientes?buscar`).
   * Cada cliente trae nº de servicios completados, total gastado y última visita,
   * derivados de `atencion` (no toca esquema). Filtra por nombre/teléfono.
   */
  async listar(ctx: TenantContext, buscar?: string): Promise<ClienteCRM[]> {
    return runInTenantTx(ctx, async (tx) => {
      const cond = [eq(cliente.activo, true)];
      const q = buscar?.trim();
      if (q) {
        const like = `%${q}%`;
        cond.push(or(ilike(cliente.nombre, like), ilike(cliente.telefono, like))!);
      }
      const rows = await tx
        .select({
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          creadoEn: cliente.creadoEn,
          numServicios: count(atencion.id),
          gastado: sum(atencion.total).mapWith(Number),
          ultimaVisita: sql<string | null>`max(${atencion.creadoEn})`,
        })
        .from(cliente)
        .leftJoin(cita, eq(cita.clienteId, cliente.id))
        .leftJoin(atencion, eq(atencion.citaId, cita.id))
        .where(and(...cond))
        .groupBy(cliente.id)
        .orderBy(cliente.nombre);

      return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        creadoEn: r.creadoEn.toISOString(),
        numServicios: Number(r.numServicios),
        gastado: r.gastado ?? 0,
        ultimaVisita: r.ultimaVisita ? new Date(r.ultimaVisita).toISOString() : null,
      }));
    });
  }

  crear(ctx: TenantContext, nombre: string, telefono?: string): Promise<Cliente> {
    return runInTenantTx(ctx, async (tx) => {
      const [c] = await tx.insert(cliente).values({ negocioId: ctx.negocioId, nombre, telefono }).returning();
      return c;
    });
  }

  async editar(ctx: TenantContext, id: string, cambios: { nombre?: string; telefono?: string }): Promise<Cliente> {
    const [c] = await runInTenantTx(ctx, (tx) =>
      tx.update(cliente).set({ ...cambios, actualizadoEn: new Date() }).where(eq(cliente.id, id)).returning(),
    );
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    return c;
  }

  /** Borrado lógico (RF-036): conserva el historial; solo lo saca del directorio. */
  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    const [c] = await runInTenantTx(ctx, (tx) =>
      tx.update(cliente).set({ activo: false, actualizadoEn: new Date() }).where(eq(cliente.id, id)).returning(),
    );
    if (!c) throw new NotFoundException('Cliente no encontrado.');
  }

  /** Historial del cliente: línea de tiempo de atenciones + agregados (RF-037). */
  async historial(ctx: TenantContext, id: string): Promise<ClienteHistorial> {
    return runInTenantTx(ctx, async (tx) => {
      const [c] = await tx.select().from(cliente).where(eq(cliente.id, id)).limit(1);
      if (!c) throw new NotFoundException('Cliente no encontrado.');

      const atenciones = await tx
        .select({
          citaId: atencion.citaId,
          fecha: atencion.creadoEn,
          total: atencion.total,
          metodoPago: atencion.metodoPago,
          especialista: especialista.nombre,
        })
        .from(atencion)
        .innerJoin(cita, eq(cita.id, atencion.citaId))
        .innerJoin(especialista, eq(especialista.id, atencion.especialistaId))
        .where(eq(cita.clienteId, id))
        .orderBy(desc(atencion.creadoEn));

      // Servicios por cita en una sola consulta (evita N+1).
      const citaIds = atenciones.map((a) => a.citaId);
      const servPorCita = new Map<string, string[]>();
      if (citaIds.length) {
        const servs = await tx
          .select({ citaId: citaServicio.citaId, nombre: servicio.nombre })
          .from(citaServicio)
          .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
          .where(inArray(citaServicio.citaId, citaIds));
        for (const s of servs) {
          const arr = servPorCita.get(s.citaId) ?? [];
          arr.push(s.nombre);
          servPorCita.set(s.citaId, arr);
        }
      }

      const visitas = atenciones.map((a) => ({
        fecha: a.fecha.toISOString(),
        servicio: (servPorCita.get(a.citaId) ?? []).join(' · ') || '—',
        especialista: a.especialista,
        metodoPago: a.metodoPago as MetodoPago,
        monto: Number(a.total),
      }));

      return {
        cliente: {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          activo: c.activo,
          creadoEn: c.creadoEn.toISOString(),
        },
        numServicios: visitas.length,
        gastoAcumulado: visitas.reduce((s, v) => s + v.monto, 0),
        visitas,
      };
    });
  }

  /** Dedupe por teléfono dentro del negocio (RF-034). */
  async buscarPorTelefono(ctx: TenantContext, telefono: string): Promise<Cliente | null> {
    const [c] = await runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(cliente)
        .where(and(eq(cliente.telefono, telefono), eq(cliente.activo, true)))
        .limit(1),
    );
    return c ?? null;
  }
}
