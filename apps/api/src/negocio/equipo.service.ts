import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { ForbiddenException } from '@nestjs/common';
import { PlanSuscripcion, RolUsuario, type GananciasEspecialista } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  atencion,
  disponibilidad,
  especialista,
  especialistaSucursal,
  sucursal,
  suscripcion,
  usuario,
  usuarioSucursal,
  ventaProducto,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { round2 } from '../finanzas/calculo';
import { PlanService } from '../plans/plan.service';

/** Credenciales opcionales del login del especialista (Gestión, Plan-Pagos). */
/** Opciones del alta (FASE-06 añade teléfono verificado y apellidos). */
export interface OpcionesCrearEspecialista {
  telefono?: string;
  telefonoVerificadoEn?: Date;
  apellidos?: string;
  credenciales?: CredencialesEspecialista;
}

export interface CredencialesEspecialista {
  email: string;
  /** Contraseña en claro (alta directa). Excluyente con `passwordHash`. */
  password?: string;
  /** Hash ya calculado (alta verificada de FASE-06: nunca se guardó el claro). */
  passwordHash?: string;
}

type Especialista = typeof especialista.$inferSelect;

/**
 * Gestión del equipo (FASE-07, HU-ADM-005, Plan-Pagos FASE-08). El alta valida
 * el **cupo de especialistas pagados** (`suscripcion.num_especialistas`): no se
 * puede crear más allá de lo contratado (se sube el plan en FASE-09). El cupo
 * pagado NO se autoajusta con el conteo; lo fija el registro/cambio de plan.
 */
@Injectable()
export class EquipoService {
  constructor(private readonly plans: PlanService) {}

  /** Lista el equipo con las sucursales asignadas a cada especialista (FASE-07). */
  listar(ctx: TenantContext): Promise<(Especialista & { sucursalIds: string[] })[]> {
    return runInTenantTx(ctx, async (tx) => {
      const esps = await tx.select().from(especialista);
      const rels = await tx
        .select({ especialistaId: especialistaSucursal.especialistaId, sucursalId: especialistaSucursal.sucursalId })
        .from(especialistaSucursal);
      const porEsp = new Map<string, string[]>();
      for (const r of rels) {
        const arr = porEsp.get(r.especialistaId) ?? [];
        arr.push(r.sucursalId);
        porEsp.set(r.especialistaId, arr);
      }
      return esps.map((e) => ({ ...e, sucursalIds: porEsp.get(e.id) ?? [] }));
    });
  }

  async crear(
    ctx: TenantContext,
    nombre: string,
    especialidad: string | undefined,
    sucursalIds: string[] = [],
    opciones: OpcionesCrearEspecialista = {},
  ): Promise<Especialista> {
    const credenciales = opciones.credenciales;
    return runInTenantTx(ctx, async (tx) => {
      await this.asegurarCupo(tx, ctx.negocioId);

      const [e] = await tx
        .insert(especialista)
        .values({
          negocioId: ctx.negocioId,
          nombre,
          especialidad,
          apellidos: opciones.apellidos,
          telefono: opciones.telefono,
          telefonoVerificadoEn: opciones.telefonoVerificadoEn,
        })
        .returning();
      if (sucursalIds.length) {
        await this.validarSucursales(tx, sucursalIds);
        await tx
          .insert(especialistaSucursal)
          .values(sucursalIds.map((sid) => ({ especialistaId: e.id, sucursalId: sid })));
        // Horario por defecto (Lun–Sáb 9:00–18:00) en cada sede asignada, para
        // que el especialista sea reservable de inmediato. Sin esto quedaba sin
        // ninguna franja en la reserva pública (no hay UI para editar ventanas).
        await tx.insert(disponibilidad).values(
          sucursalIds.flatMap((sid) =>
            [1, 2, 3, 4, 5, 6].map((dia) => ({
              negocioId: ctx.negocioId,
              sucursalId: sid,
              especialistaId: e.id,
              diaSemana: dia,
              horaInicio: '09:00',
              horaFin: '18:00',
            })),
          ),
        );
      }
      // Acceso al panel (opcional): crea o enlaza el login del especialista, de
      // modo que el recurso de agenda y la cuenta sean UNA sola cosa (Plan-Pagos).
      if (credenciales) {
        const usuarioId = await this.crearOEnlazarLogin(tx, ctx, nombre, credenciales, sucursalIds);
        const [conLogin] = await tx
          .update(especialista)
          .set({ usuarioId, actualizadoEn: new Date() })
          .where(eq(especialista.id, e.id))
          .returning();
        return conLogin;
      }
      return e;
    });
  }

  /**
   * Crea el login del especialista (rol especialista) o, si el correo ya existe
   * como login de especialista de ESTE negocio sin recurso enlazado, lo enlaza
   * (rescata cuentas creadas antes por separado). Devuelve el id del usuario.
   */
  private async crearOEnlazarLogin(
    tx: DrizzleTx,
    ctx: TenantContext,
    nombre: string,
    { email, password, passwordHash: hashPrevio }: CredencialesEspecialista,
    sucursalIds: string[],
  ): Promise<string> {
    const correo = email.trim().toLowerCase();
    const [existe] = await tx.select().from(usuario).where(eq(usuario.email, correo)).limit(1);

    if (existe) {
      if (existe.negocioId !== ctx.negocioId || existe.rol !== RolUsuario.Especialista) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      const [yaEnlazado] = await tx
        .select({ id: especialista.id })
        .from(especialista)
        .where(eq(especialista.usuarioId, existe.id))
        .limit(1);
      if (yaEnlazado) throw new ConflictException('Ese correo ya está enlazado a otro especialista.');
      // Sincroniza el alcance del login con las sucursales del especialista.
      await tx.delete(usuarioSucursal).where(eq(usuarioSucursal.usuarioId, existe.id));
      if (sucursalIds.length) {
        await tx.insert(usuarioSucursal).values(sucursalIds.map((sid) => ({ usuarioId: existe.id, sucursalId: sid })));
      }
      return existe.id;
    }

    // En el alta verificada (FASE-06) el hash ya viene calculado: la contraseña
    // en claro nunca se persistió en el borrador de la verificación.
    const passwordHash = hashPrevio ?? (await argon2.hash(password!));
    let nuevoId: string;
    try {
      const [u] = await tx
        .insert(usuario)
        .values({ negocioId: ctx.negocioId, nombre: nombre.trim(), email: correo, passwordHash, rol: RolUsuario.Especialista })
        .returning({ id: usuario.id });
      nuevoId = u.id;
    } catch (e) {
      // Choque con el índice único global de email (otro negocio).
      if (e instanceof Error && /usuario_email_uq|unique/i.test(e.message)) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw e;
    }
    if (sucursalIds.length) {
      await tx.insert(usuarioSucursal).values(sucursalIds.map((sid) => ({ usuarioId: nuevoId, sucursalId: sid })));
    }
    return nuevoId;
  }

  /**
   * Ganancias del especialista en un período (FASE-10, H3): Σ ganancia del
   * profesional por atenciones + Σ comisiones por venta de productos. Derivado.
   */
  async ganancias(
    ctx: TenantContext,
    id: string,
    desde: Date,
    hasta: Date,
  ): Promise<GananciasEspecialista> {
    return runInTenantTx(ctx, async (tx) => {
      const [a] = await tx
        .select({
          servicios: count(),
          gan: sql<number>`coalesce(sum(${atencion.ganProf}), 0)`.mapWith(Number),
        })
        .from(atencion)
        .where(and(eq(atencion.especialistaId, id), gte(atencion.creadoEn, desde), lte(atencion.creadoEn, hasta)));

      const [v] = await tx
        .select({ comisiones: sql<number>`coalesce(sum(${ventaProducto.comisionProf}), 0)`.mapWith(Number) })
        .from(ventaProducto)
        .where(and(eq(ventaProducto.especialistaId, id), gte(ventaProducto.creadoEn, desde), lte(ventaProducto.creadoEn, hasta)));

      const ganServicios = round2(a?.gan ?? 0);
      const comisiones = round2(v?.comisiones ?? 0);
      return {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        servicios: Number(a?.servicios ?? 0),
        ganServicios,
        comisiones,
        total: round2(ganServicios + comisiones),
      };
    });
  }

  /** Reemplaza el conjunto de sucursales del especialista. */
  async asignarSucursales(ctx: TenantContext, id: string, sucursalIds: string[]): Promise<void> {
    await runInTenantTx(ctx, async (tx) => {
      await this.asegurarExiste(tx, id);
      await this.validarSucursales(tx, sucursalIds);
      await tx.delete(especialistaSucursal).where(eq(especialistaSucursal.especialistaId, id));
      if (sucursalIds.length) {
        await tx
          .insert(especialistaSucursal)
          .values(sucursalIds.map((sid) => ({ especialistaId: id, sucursalId: sid })));
      }
    });
  }

  async editar(
    ctx: TenantContext,
    id: string,
    cambios: { nombre?: string; especialidad?: string; disponible?: boolean },
  ): Promise<Especialista> {
    const [e] = await runInTenantTx(ctx, (tx) =>
      tx
        .update(especialista)
        .set({ ...cambios, actualizadoEn: new Date() })
        .where(eq(especialista.id, id))
        .returning(),
    );
    if (!e) throw new NotFoundException('Especialista no encontrado.');
    return e;
  }

  /** Baja lógica: deja de aparecer pero conserva su historial (HU-ADM-005). */
  async darDeBaja(ctx: TenantContext, id: string): Promise<void> {
    await this.setActivo(ctx, id, false);
  }

  /** Reactiva, respetando el cupo de especialistas pagados (FASE-08). */
  async reactivar(ctx: TenantContext, id: string): Promise<void> {
    await runInTenantTx(ctx, async (tx) => {
      const cupo = await this.cupoDisponible(tx, ctx.negocioId);
      const [{ c: activos }] = await tx
        .select({ c: count() })
        .from(especialista)
        .where(eq(especialista.activo, true));
      if (!this.plans.puedeAgregarEspecialista(activos, cupo)) {
        throw new ForbiddenException(
          `Alcanzaste el cupo de ${cupo} especialistas de tu plan. Sube tu plan para reactivar más.`,
        );
      }
      const [e] = await tx
        .update(especialista)
        .set({ activo: true, actualizadoEn: new Date() })
        .where(eq(especialista.id, id))
        .returning();
      if (!e) throw new NotFoundException('Especialista no encontrado.');
    });
  }

  /** Cupo efectivo de especialistas del negocio = max(pagados, incluidos). */
  /**
   * Comprueba el cupo del plan sin crear nada. La usa la verificación de
   * FASE-06 para no gastarle al admin un SMS si igualmente no podría añadirlo.
   */
  async verificarCupo(ctx: TenantContext): Promise<void> {
    await runInTenantTx(ctx, (tx) => this.asegurarCupo(tx, ctx.negocioId));
  }

  /** Lanza si el negocio ya alcanzó los especialistas pagados (FASE-08). */
  private async asegurarCupo(tx: DrizzleTx, negocioId: string): Promise<void> {
    const cupo = await this.cupoDisponible(tx, negocioId);
    const [{ c: activos }] = await tx
      .select({ c: count() })
      .from(especialista)
      .where(eq(especialista.activo, true));
    if (!this.plans.puedeAgregarEspecialista(activos, cupo)) {
      throw new ForbiddenException(
        `Alcanzaste el cupo de ${cupo} especialistas de tu plan. Sube tu plan para agregar más.`,
      );
    }
  }

  private async cupoDisponible(tx: DrizzleTx, negocioId: string): Promise<number> {
    const [sus] = await tx
      .select({ plan: suscripcion.plan, num: suscripcion.numEspecialistas })
      .from(suscripcion)
      .where(eq(suscripcion.negocioId, negocioId))
      .limit(1);
    const plan = (sus?.plan ?? 'basico') as PlanSuscripcion;
    return this.plans.cupoEspecialistas(plan, sus?.num ?? 0);
  }

  private async setActivo(ctx: TenantContext, id: string, activo: boolean): Promise<void> {
    const [e] = await runInTenantTx(ctx, (tx) =>
      tx
        .update(especialista)
        .set({ activo, actualizadoEn: new Date() })
        .where(eq(especialista.id, id))
        .returning(),
    );
    if (!e) throw new NotFoundException('Especialista no encontrado.');
  }

  private async asegurarExiste(tx: DrizzleTx, id: string): Promise<void> {
    const [e] = await tx.select({ id: especialista.id }).from(especialista).where(eq(especialista.id, id)).limit(1);
    if (!e) throw new NotFoundException('Especialista no encontrado.');
  }

  /** Verifica que todas las sucursales pertenezcan al negocio (RLS las acota). */
  private async validarSucursales(tx: DrizzleTx, sucursalIds: string[]): Promise<void> {
    if (!sucursalIds.length) return;
    const filas = await tx
      .select({ id: sucursal.id })
      .from(sucursal)
      .where(inArray(sucursal.id, sucursalIds));
    if (filas.length !== new Set(sucursalIds).size) {
      throw new BadRequestException('Alguna sucursal no pertenece al negocio.');
    }
  }
}
