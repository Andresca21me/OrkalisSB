import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { ForbiddenException } from '@nestjs/common';
import {
  EstadoCita,
  PlanSuscripcion,
  RolUsuario,
  type BajaEspecialistaResp,
  type CitasFuturasResp,
  type GananciasDetalle,
  type GananciasEspecialista,
  type TransaccionEspecialista,
} from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  atencion,
  atencionServicio,
  cita,
  citaServicio,
  cliente,
  disponibilidad,
  especialista,
  especialistaFoto,
  especialistaServicio,
  especialistaSucursal,
  producto,
  servicio,
  sucursal,
  suscripcion,
  usuario,
  usuarioSucursal,
  ventaProducto,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { round2 } from '../finanzas/calculo';
import { PlanService } from '../plans/plan.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { transicionar } from '../agendamiento/cita-state-machine';
import { filtrarPorServicios } from '../agendamiento/validators/capacidades';

/** Qué hacer con las citas futuras al dar de baja a un especialista. */
export type AccionBaja = 'reasignar' | 'cancelar';

/** Credenciales opcionales del login del especialista (Gestión, Plan-Pagos). */
/** Opciones del alta. */
export interface OpcionesCrearEspecialista {
  telefono?: string;
  apellidos?: string;
  credenciales?: CredencialesEspecialista;
  /** Servicios que realiza. Vacío/ausente = todos (sin restricción). */
  servicioIds?: string[];
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
  constructor(
    private readonly plans: PlanService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Lista el equipo con las sucursales y servicios asignados a cada uno (FASE-07). */
  listar(
    ctx: TenantContext,
  ): Promise<(Especialista & { sucursalIds: string[]; servicioIds: string[]; fotoVersion: string | null })[]> {
    return runInTenantTx(ctx, async (tx) => {
      const esps = await tx.select().from(especialista);
      // Solo la marca de tiempo, nunca los bytes: el listado se pide a cada rato
      // y arrastrar las imágenes lo haría lento sin ninguna ganancia.
      const fotos = await tx
        .select({ id: especialistaFoto.especialistaId, v: especialistaFoto.actualizadoEn })
        .from(especialistaFoto);
      const versionPorEsp = new Map(fotos.map((f) => [f.id, f.v.toISOString()]));
      const rels = await tx
        .select({ especialistaId: especialistaSucursal.especialistaId, sucursalId: especialistaSucursal.sucursalId })
        .from(especialistaSucursal);
      const porEsp = new Map<string, string[]>();
      for (const r of rels) {
        const arr = porEsp.get(r.especialistaId) ?? [];
        arr.push(r.sucursalId);
        porEsp.set(r.especialistaId, arr);
      }
      // Servicios asignados. Se cruza con `servicio.activo` para no devolver
      // como capacidad un servicio que el admin ya retiró del catálogo.
      const servs = await tx
        .select({ especialistaId: especialistaServicio.especialistaId, servicioId: especialistaServicio.servicioId })
        .from(especialistaServicio)
        .innerJoin(servicio, eq(servicio.id, especialistaServicio.servicioId))
        .where(eq(servicio.activo, true));
      const servPorEsp = new Map<string, string[]>();
      for (const r of servs) {
        const arr = servPorEsp.get(r.especialistaId) ?? [];
        arr.push(r.servicioId);
        servPorEsp.set(r.especialistaId, arr);
      }
      return esps.map((e) => ({
        ...e,
        sucursalIds: porEsp.get(e.id) ?? [],
        servicioIds: servPorEsp.get(e.id) ?? [],
        fotoVersion: versionPorEsp.get(e.id) ?? null,
      }));
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
        })
        .returning();
      if (sucursalIds.length) {
        await this.validarSucursales(tx, sucursalIds);
        await tx
          .insert(especialistaSucursal)
          .values(sucursalIds.map((sid) => ({ especialistaId: e.id, sucursalId: sid })));
        // Horario del especialista. Si la sede ya tiene horario propio no se
        // inserta nada: sin ventanas, el especialista HEREDA el horario de la
        // sucursal (`ventanasEfectivas`), y así ampliarlo mueve a todo el equipo
        // en vez de dejar a cada uno anclado al horario del día en que entró.
        // Las sedes sin horario definido (cuentas anteriores) conservan el
        // Lun–Sáb 9:00–18:00 de siempre: sin esto quedarían sin ninguna franja.
        const sedes = await tx
          .select({ id: sucursal.id, apertura: sucursal.horaApertura })
          .from(sucursal)
          .where(inArray(sucursal.id, sucursalIds));
        const sinHorario = sedes.filter((s) => !s.apertura).map((s) => s.id);
        if (sinHorario.length) {
          await tx.insert(disponibilidad).values(
            sinHorario.flatMap((sid) =>
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
      }
      // Servicios que realiza (opcional). Sin esto queda sin restricción: los
      // realiza todos, que es el comportamiento por defecto.
      if (opciones.servicioIds?.length) {
        await this.validarServicios(tx, opciones.servicioIds);
        await tx
          .insert(especialistaServicio)
          .values(opciones.servicioIds.map((sid) => ({ especialistaId: e.id, servicioId: sid })));
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
   * "Yo también atiendo" (Plan-Correo E8): crea la ficha de especialista del
   * PROPIO usuario en sesión y la enlaza a su cuenta. Sin invitación ni segundo
   * correo: la cuenta ya existe con correo verificado y contraseña; solo faltaba
   * el recurso de agenda. El cupo del plan se cobra igual que en cualquier alta.
   */
  async crearMiFicha(
    ctx: TenantContext,
    opts: { nombre?: string; apellidos?: string; especialidad?: string; sucursalIds: string[]; servicioIds?: string[]; disponible?: boolean },
  ): Promise<Especialista> {
    if (!ctx.usuarioId) throw new ForbiddenException('La sesión no identifica a un usuario.');

    const { yaTiene, nombreUsuario } = await runInTenantTx(ctx, async (tx) => {
      const [ya] = await tx
        .select({ id: especialista.id })
        .from(especialista)
        .where(and(eq(especialista.usuarioId, ctx.usuarioId!), eq(especialista.activo, true)))
        .limit(1);
      const [u] = await tx.select({ nombre: usuario.nombre }).from(usuario).where(eq(usuario.id, ctx.usuarioId!)).limit(1);
      return { yaTiene: !!ya, nombreUsuario: u?.nombre ?? '' };
    });
    if (yaTiene) throw new ConflictException('Tu cuenta ya está enlazada a una ficha de especialista.');

    const e = await this.crear(ctx, opts.nombre?.trim() || nombreUsuario, opts.especialidad?.trim() || undefined, opts.sucursalIds, {
      apellidos: opts.apellidos?.trim() || undefined,
      servicioIds: opts.servicioIds,
    });
    const [enlazado] = await runInTenantTx(ctx, (tx) =>
      tx
        .update(especialista)
        .set({ usuarioId: ctx.usuarioId!, ...(opts.disponible === false ? { disponible: false } : {}), actualizadoEn: new Date() })
        .where(eq(especialista.id, e.id))
        .returning(),
    );
    return enlazado;
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
    // D2 (Plan-Finanzas): un especialista solo consulta las SUYAS. Antes bastaba
    // cambiar el id de la URL para ver las de un compañero.
    if (ctx.rol === RolUsuario.Especialista && (await this.miEspecialistaId(ctx)) !== id) {
      throw new ForbiddenException('Solo puedes consultar tus propias ganancias.');
    }
    return runInTenantTx(ctx, async (tx) => {
      const [a] = await tx
        .select({
          servicios: count(),
          // `gan_prof` ya incluye la comisión por productos vendidos en cita (D4);
          // aquí se resta para dejar `ganServicios` puro y sumarla a `comisiones`.
          gan: sql<number>`coalesce(sum(${atencion.ganProf}), 0)`.mapWith(Number),
          comProductosCita: sql<number>`coalesce(sum(${atencion.comisionProductos}), 0)`.mapWith(Number),
        })
        .from(atencion)
        .where(and(eq(atencion.especialistaId, id), gte(atencion.creadoEn, desde), lte(atencion.creadoEn, hasta)));

      const [v] = await tx
        .select({ comisiones: sql<number>`coalesce(sum(${ventaProducto.comisionProf}), 0)`.mapWith(Number) })
        .from(ventaProducto)
        .where(and(eq(ventaProducto.especialistaId, id), gte(ventaProducto.creadoEn, desde), lte(ventaProducto.creadoEn, hasta)));

      const comProductosCita = round2(a?.comProductosCita ?? 0);
      const ganServicios = round2((a?.gan ?? 0) - comProductosCita);
      const comisiones = round2((v?.comisiones ?? 0) + comProductosCita);
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

  /**
   * Detalle de ganancias por transacción (Plan-Finanzas F2): la tabla
   * Fecha · Cliente · Concepto · Bruto · Regla · Neto que unifica citas
   * cobradas y ventas directas de mostrador. Los agregados son los mismos de
   * `ganancias` (misma fuente), así el detalle siempre cuadra con la cabecera.
   */
  async gananciasDetalle(ctx: TenantContext, id: string, desde: Date, hasta: Date): Promise<GananciasDetalle> {
    const totales = await this.ganancias(ctx, id, desde, hasta); // incluye el candado D2

    const transacciones = await runInTenantTx(ctx, async (tx) => {
      const ats = await tx
        .select({
          atencionId: atencion.id,
          citaId: atencion.citaId,
          fecha: atencion.creadoEn,
          ganProf: atencion.ganProf,
          comisionProductos: atencion.comisionProductos,
          snapshot: atencion.snapshotParam,
          clienteNombre: cliente.nombre,
        })
        .from(atencion)
        .innerJoin(cita, eq(cita.id, atencion.citaId))
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(and(eq(atencion.especialistaId, id), gte(atencion.creadoEn, desde), lte(atencion.creadoEn, hasta)));

      // Líneas congeladas de servicio (concepto + regla). Atenciones previas al
      // plan no las tienen: caen al nombre de cita_servicio y regla genérica.
      const atIds = ats.map((a) => a.atencionId);
      const lineasPorAtencion = new Map<string, { nombre: string; reglaTipo: string; reglaValor: string; precio: string }[]>();
      const nombresViejos = new Map<string, string[]>();
      if (atIds.length) {
        const lineas = await tx
          .select({
            atencionId: atencionServicio.atencionId,
            nombre: atencionServicio.nombre,
            reglaTipo: atencionServicio.reglaTipo,
            reglaValor: atencionServicio.reglaValor,
            precio: atencionServicio.precio,
          })
          .from(atencionServicio)
          .where(inArray(atencionServicio.atencionId, atIds));
        for (const l of lineas) {
          lineasPorAtencion.set(l.atencionId, [...(lineasPorAtencion.get(l.atencionId) ?? []), l]);
        }
        const sinLineas = ats.filter((a) => !lineasPorAtencion.has(a.atencionId));
        if (sinLineas.length) {
          const viejos = await tx
            .select({ citaId: citaServicio.citaId, nombre: servicio.nombre })
            .from(citaServicio)
            .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
            .where(inArray(citaServicio.citaId, sinLineas.map((a) => a.citaId)));
          for (const v of viejos) nombresViejos.set(v.citaId, [...(nombresViejos.get(v.citaId) ?? []), v.nombre]);
        }
      }

      const ventas = await tx
        .select({
          ventaId: ventaProducto.id,
          fecha: ventaProducto.creadoEn,
          total: ventaProducto.total,
          comision: ventaProducto.comisionProf,
          cantidad: ventaProducto.cantidad,
          nombre: producto.nombre,
        })
        .from(ventaProducto)
        .innerJoin(producto, eq(producto.id, ventaProducto.productoId))
        .where(and(eq(ventaProducto.especialistaId, id), gte(ventaProducto.creadoEn, desde), lte(ventaProducto.creadoEn, hasta)));

      const filas: TransaccionEspecialista[] = [
        ...ats.map((a) => {
          const lineas = lineasPorAtencion.get(a.atencionId);
          const snap = (a.snapshot ?? {}) as { totalServicios?: number };
          const nombres = lineas?.map((l) => l.nombre) ?? nombresViejos.get(a.citaId) ?? [];
          const comProd = Number(a.comisionProductos);
          return {
            tipo: 'cita' as const,
            fecha: a.fecha.toISOString(),
            citaId: a.citaId,
            atencionId: a.atencionId,
            ventaId: null,
            clienteNombre: a.clienteNombre ?? null,
            concepto: nombres.join(' + ') || 'Servicios',
            bruto: Number(snap.totalServicios ?? lineas?.reduce((s, l) => s + Number(l.precio), 0) ?? 0),
            reglaResumen: resumenRegla(lineas, comProd),
            neto: Number(a.ganProf),
          };
        }),
        ...ventas.map((v) => ({
          tipo: 'venta_directa' as const,
          fecha: v.fecha.toISOString(),
          citaId: null,
          atencionId: null,
          ventaId: v.ventaId,
          clienteNombre: null,
          concepto: `${v.nombre} ×${v.cantidad}`,
          bruto: Number(v.total),
          reglaResumen: 'Comisión por producto',
          neto: Number(v.comision),
        })),
      ];
      return filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    });

    return { ...totales, transacciones };
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

  /**
   * Reemplaza el conjunto de servicios que el especialista realiza.
   *
   * Lista **vacía = sin restricción** (los realiza todos), no "no realiza
   * ninguno": para que alguien no reciba reservas está el interruptor
   * `disponible`. Quitar un servicio NO toca las citas ya agendadas —son un
   * compromiso ya adquirido con el cliente—; solo impide reservas nuevas.
   */
  async asignarServicios(ctx: TenantContext, id: string, servicioIds: string[]): Promise<void> {
    await runInTenantTx(ctx, async (tx) => {
      await this.asegurarExiste(tx, id);
      await this.validarServicios(tx, servicioIds);
      await tx.delete(especialistaServicio).where(eq(especialistaServicio.especialistaId, id));
      if (servicioIds.length) {
        await tx
          .insert(especialistaServicio)
          .values(servicioIds.map((sid) => ({ especialistaId: id, servicioId: sid })));
      }
    });
  }

  /** Los servicios deben existir y ser del negocio (RLS ya acota la consulta). */
  private async validarServicios(tx: DrizzleTx, servicioIds: string[]): Promise<void> {
    if (!servicioIds.length) return;
    const filas = await tx
      .select({ id: servicio.id })
      .from(servicio)
      .where(inArray(servicio.id, servicioIds));
    if (filas.length !== new Set(servicioIds).size) {
      throw new BadRequestException('Algún servicio no existe en este negocio.');
    }
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

  /**
   * Citas futuras aún vivas del especialista (pendientes de atender). Son las
   * que hay que resolver antes de darlo de baja: las pasadas y las ya cerradas
   * son historial y no se tocan.
   */
  async citasFuturas(ctx: TenantContext, id: string): Promise<CitasFuturasResp> {
    return runInTenantTx(ctx, async (tx) => {
      const filas = await tx
        .select({
          id: cita.id,
          inicio: cita.inicio,
          clienteNombre: cliente.nombre,
        })
        .from(cita)
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(
          and(
            eq(cita.especialistaId, id),
            gte(cita.inicio, new Date()),
            inArray(cita.estado, [EstadoCita.Solicitada, EstadoCita.Confirmada]),
          ),
        )
        .orderBy(cita.inicio);
      const muestra = filas.slice(0, 5);
      const nombres = new Map<string, string[]>();
      if (muestra.length) {
        const servs = await tx
          .select({ citaId: citaServicio.citaId, nombre: servicio.nombre })
          .from(citaServicio)
          .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
          .where(inArray(citaServicio.citaId, muestra.map((m) => m.id)));
        for (const s of servs) {
          const arr = nombres.get(s.citaId) ?? [];
          arr.push(s.nombre);
          nombres.set(s.citaId, arr);
        }
      }
      return {
        total: filas.length,
        muestra: muestra.map((m) => ({
          id: m.id,
          inicio: m.inicio.toISOString(),
          clienteNombre: m.clienteNombre,
          servicios: nombres.get(m.id) ?? [],
        })),
      };
    });
  }

  /**
   * Baja lógica: deja de aparecer pero conserva su historial (HU-ADM-005).
   *
   * Si tiene citas futuras sin atender, **no se ejecuta a ciegas**: lanza 409
   * con el conteo para que el admin decida qué hacer con ellas. Dejar citas
   * asignadas a alguien que ya no trabaja es peor que cualquiera de las dos
   * salidas, porque nadie se entera hasta que el cliente se presenta.
   */
  async darDeBaja(ctx: TenantContext, id: string, accion?: AccionBaja): Promise<BajaEspecialistaResp> {
    const futuras = await this.citasFuturas(ctx, id);
    if (futuras.total > 0 && !accion) {
      throw new ConflictException({
        message: 'El especialista tiene citas futuras pendientes.',
        citasFuturas: futuras.total,
      });
    }
    const resultado = futuras.total > 0 ? await this.resolverCitasFuturas(ctx, id, accion!) : { reasignadas: 0, canceladas: 0 };
    await this.setActivo(ctx, id, false);
    return resultado;
  }

  /**
   * Reubica o cancela las citas futuras antes de la baja.
   *
   * Cada cita va en su PROPIA transacción a propósito: si una choca por solape
   * con la agenda del candidato, solo se pierde ese intento y no se deshace el
   * trabajo ya hecho con las demás.
   */
  private async resolverCitasFuturas(
    ctx: TenantContext,
    id: string,
    accion: AccionBaja,
  ): Promise<BajaEspecialistaResp> {
    const pendientes = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ id: cita.id, sucursalId: cita.sucursalId, inicio: cita.inicio })
        .from(cita)
        .where(
          and(
            eq(cita.especialistaId, id),
            gte(cita.inicio, new Date()),
            inArray(cita.estado, [EstadoCita.Solicitada, EstadoCita.Confirmada]),
          ),
        )
        .orderBy(cita.inicio),
    );

    let reasignadas = 0;
    let canceladas = 0;
    for (const c of pendientes) {
      let movida = false;
      if (accion === 'reasignar') {
        const candidatos = await this.candidatosPara(ctx, c.id, c.sucursalId, id);
        for (const cand of candidatos) {
          try {
            await this.reasignarCita(ctx, c.id, cand);
            movida = true;
            reasignadas++;
            break;
          } catch {
            // Solape u otro rechazo con ESE candidato: se prueba el siguiente.
          }
        }
      }
      // Sin candidato viable (o acción "cancelar"): se cancela y se avisa al
      // cliente. Es la única salida honesta: una cita que nadie puede atender.
      if (!movida) {
        await this.cancelarCita(ctx, c.id);
        canceladas++;
      }
    }
    return { reasignadas, canceladas };
  }

  /**
   * Mueve la cita al nuevo especialista. Se implementa aquí y no reutilizando
   * `AgendamientoService` porque ese módulo ya depende de este: invertir la
   * dependencia crearía un ciclo. El EXCLUDE de la base sigue siendo la garantía
   * de que no se pisen dos turnos.
   */
  private async reasignarCita(ctx: TenantContext, citaId: string, especialistaId: string): Promise<void> {
    await runInTenantTx(ctx, async (tx) => {
      try {
        await tx
          .update(cita)
          .set({ especialistaId, actualizadoEn: new Date() })
          .where(eq(cita.id, citaId));
      } catch (e) {
        if ((e as { code?: string }).code === '23P01') {
          throw new ConflictException('El destino ya tiene un turno en esa franja.');
        }
        throw e;
      }
    });
  }

  /** Cancela la cita y avisa al cliente: se quedó sin quien la atienda. */
  private async cancelarCita(ctx: TenantContext, citaId: string): Promise<void> {
    const datos = await runInTenantTx(ctx, async (tx) => {
      const [c] = await tx
        .select({
          estado: cita.estado,
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
        .limit(1);
      if (!c) return null;
      const nuevoEstado = transicionar(c.estado as EstadoCita, 'cancelar');
      await tx.update(cita).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(cita.id, citaId));
      return c;
    });
    // Post-commit y sin propagar: si la mensajería falla, la cita ya quedó
    // cancelada y eso es lo que no puede perderse.
    if (datos?.telefono) {
      try {
        await this.notificaciones.encolarAviso(
          ctx.negocioId,
          datos.telefono,
          { sucursalNombre: datos.sucursalNombre, especialistaNombre: datos.especialistaNombre, inicio: datos.inicio },
          { sucursalId: datos.sucursalId, citaId },
        );
      } catch {
        /* el aviso es best-effort */
      }
    }
  }

  /** Quién puede hacerse cargo de esta cita: activo, libre, de la sede y capacitado. */
  private async candidatosPara(
    ctx: TenantContext,
    citaId: string,
    sucursalId: string,
    excluirId: string,
  ): Promise<string[]> {
    return runInTenantTx(ctx, async (tx) => {
      const servs = await tx
        .select({ id: citaServicio.servicioId })
        .from(citaServicio)
        .where(eq(citaServicio.citaId, citaId));
      const equipo = await tx
        .select({ id: especialista.id })
        .from(especialista)
        .innerJoin(especialistaSucursal, eq(especialistaSucursal.especialistaId, especialista.id))
        .where(
          and(
            eq(especialistaSucursal.sucursalId, sucursalId),
            eq(especialista.activo, true),
            eq(especialista.disponible, true),
          ),
        );
      const ids = equipo.map((e) => e.id).filter((x) => x !== excluirId);
      return filtrarPorServicios(tx, ids, servs.map((s) => s.id));
    });
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
  // ── Foto de perfil ──────────────────────────────────────────────────────────

  /**
   * Guarda la foto a partir de un data URL (`data:image/jpeg;base64,…`).
   *
   * La imagen ya llega recortada y reducida desde el navegador; aquí se valida
   * de todas formas, porque el endpoint es público a ojos de cualquiera con un
   * token de admin y no se puede confiar en que el cliente hizo su parte.
   */
  async guardarFoto(ctx: TenantContext, especialistaId: string, dataUrl: string): Promise<{ fotoVersion: string }> {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
    if (!m) throw new BadRequestException('La foto debe ser una imagen JPEG, PNG o WebP.');
    const datos = Buffer.from(m[2], 'base64');
    if (datos.length === 0) throw new BadRequestException('La foto llegó vacía.');
    if (datos.length > 400_000) {
      throw new BadRequestException('La foto pesa demasiado (máximo 400 KB ya optimizada).');
    }

    const actualizadoEn = new Date();
    return runInTenantTx(ctx, async (tx) => {
      // Comprobar que el especialista es de ESTE negocio antes de escribir: RLS
      // ya lo impediría, pero así el error es entendible en vez de un fallo seco.
      const [e] = await tx.select({ id: especialista.id }).from(especialista).where(eq(especialista.id, especialistaId)).limit(1);
      if (!e) throw new NotFoundException('Especialista no encontrado.');

      await tx
        .insert(especialistaFoto)
        .values({ especialistaId, mime: m[1], datos, actualizadoEn })
        .onConflictDoUpdate({
          target: especialistaFoto.especialistaId,
          set: { mime: m[1], datos, actualizadoEn },
        });
      return { fotoVersion: actualizadoEn.toISOString() };
    });
  }

  /** Quita la foto: el avatar vuelve a la inicial sobre color. */
  async borrarFoto(ctx: TenantContext, especialistaId: string): Promise<void> {
    await runInTenantTx(ctx, (tx) =>
      tx.delete(especialistaFoto).where(eq(especialistaFoto.especialistaId, especialistaId)),
    );
  }

  /**
   * Ficha del especialista que hay detrás del usuario de la sesión.
   *
   * Los endpoints `mi/…` la usan en lugar de aceptar un id por la URL: RLS
   * acota al negocio, pero dentro de un mismo negocio un especialista podría
   * escribir sobre la ficha de un compañero con solo cambiar el id. Al deducirlo
   * de la sesión sencillamente no hay nada que manipular.
   */
  async miEspecialistaId(ctx: TenantContext): Promise<string> {
    if (!ctx.usuarioId) throw new ForbiddenException('La sesión no identifica a un usuario.');
    const [e] = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ id: especialista.id })
        .from(especialista)
        .where(and(eq(especialista.usuarioId, ctx.usuarioId!), eq(especialista.activo, true)))
        .limit(1),
    );
    if (!e) throw new ForbiddenException('Tu usuario no está enlazado a un especialista.');
    return e.id;
  }

  /** El propio especialista cambia su foto de perfil. */
  async guardarMiFoto(ctx: TenantContext, dataUrl: string): Promise<{ fotoVersion: string }> {
    return this.guardarFoto(ctx, await this.miEspecialistaId(ctx), dataUrl);
  }

  /** El propio especialista quita su foto y vuelve a la inicial. */
  async borrarMiFoto(ctx: TenantContext): Promise<void> {
    await this.borrarFoto(ctx, await this.miEspecialistaId(ctx));
  }

  /**
   * Bytes de la foto para servirla. Se lee con la conexión admin porque el
   * endpoint es PÚBLICO (la reserva del cliente final no tiene sesión) y esas
   * fotos ya se muestran en el enlace público de reservas.
   */
  async leerFoto(especialistaId: string): Promise<{ mime: string; datos: Buffer; actualizadoEn: Date } | null> {
    const [f] = await adminDb
      .select()
      .from(especialistaFoto)
      .where(eq(especialistaFoto.especialistaId, especialistaId))
      .limit(1);
    return f ? { mime: f.mime, datos: f.datos, actualizadoEn: f.actualizadoEn } : null;
  }

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

/** "60%" · "Fijo $20.000" · "60% · Fijo $20.000 + comisión productos". */
function resumenRegla(
  lineas: { reglaTipo: string; reglaValor: string }[] | undefined,
  comisionProductos: number,
): string {
  const partes = lineas?.length
    ? [...new Set(lineas.map((l) => (l.reglaTipo === 'valor_fijo' ? `Fijo $${Number(l.reglaValor).toLocaleString('es-CO')}` : `${Number(l.reglaValor)}%`)))]
    : ['Reparto aplicado'];
  const base = partes.join(' · ');
  return comisionProductos > 0 ? `${base} + comisión productos` : base;
}
