import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { BadRequestException } from '@nestjs/common';
import { EstadoCita, OrigenCita, PerfilNegocio, type CitaPublica, type PublicServicio } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  cita,
  citaServicio,
  cliente,
  especialista,
  especialistaFoto,
  especialistaSucursal,
  negocio,
  negocioLogo,
  retencionFranja,
  servicio,
  sucursal,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { DisponibilidadService, type FranjaPublica } from './disponibilidad.service';
import { OtpService } from './otp.service';
import { HorarioService } from './horario.service';
import { capacidadesDe } from './validators/capacidades';
import { ValidadorFactory } from './validators/validador.factory';
import { bogotaParts } from './validators/validador-cita.port';
import { transicionar } from './cita-state-machine';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AvisosEspecialistaService } from './avisos-especialista.service';
import { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';
import { METRICAS, MetricsService } from '../observability/metrics.service';

/** Código de error Postgres para violación de restricción EXCLUDE. */
const EXCLUSION_VIOLATION = '23P01';

/**
 * Flujo de reserva PÚBLICA sin sesión (FASE-08, ADR-005). El `slug` es el id de
 * la sucursal; se resuelve el negocio con la conexión admin (no hay tenant aún)
 * y luego se opera bajo `runInTenantTx` para que RLS acote al negocio.
 */
@Injectable()
export class PublicAgendamientoService {
  constructor(
    private readonly disponibilidad: DisponibilidadService,
    private readonly otp: OtpService,
    private readonly config: ConfigResolverService,
    private readonly validadores: ValidadorFactory,
    private readonly notificaciones: NotificacionesService,
    private readonly metrics: MetricsService,
    private readonly horario: HorarioService,
    private readonly avisos: AvisosEspecialistaService,
    private readonly estadoMensajeria: MensajeriaEstadoService,
  ) {}

  /** Resuelve el negocio de la sucursal (slug) y arma un contexto de sistema. */
  private async ctxDeSucursal(sucursalId: string): Promise<TenantContext> {
    const [suc] = await adminDb
      .select({ negocioId: sucursal.negocioId, activa: sucursal.activa })
      .from(sucursal)
      .where(eq(sucursal.id, sucursalId))
      .limit(1);
    if (!suc || !suc.activa) throw new NotFoundException('Sucursal no disponible.');
    return { negocioId: suc.negocioId, sucursalIds: [sucursalId], rol: 'public' };
  }

  /** Negocio dueño de la sucursal (lo necesita la tarjeta Open Graph). */
  async negocioIdDeSucursal(sucursalId: string): Promise<string> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    return ctx.negocioId;
  }

  /** Info pública de la sucursal: negocio, perfil, sede, otras sedes y horario. */
  async info(sucursalId: string): Promise<{
    negocioId: string;
    sucursalId: string;
    sucursalNombre: string;
    negocioNombre: string;
    perfil: PerfilNegocio;
    sucursales: { id: string; nombre: string }[];
    diasLaborables: boolean[];
    serviciosDia: Record<string, boolean[]>;
    negocioDescripcion: string | null;
    colorPrimario: string | null;
    logoVersion: string | null;
  }> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    return runInTenantTx(ctx, async (tx) => {
      const [neg] = await tx
        .select({
          nombre: negocio.nombre,
          perfil: negocio.perfil,
          descripcion: negocio.descripcion,
          colorPrimario: negocio.colorPrimario,
        })
        .from(negocio)
        .where(eq(negocio.id, ctx.negocioId))
        .limit(1);
      // Solo la fecha del logo: los bytes se piden aparte y el navegador los cachea.
      const [logo] = await tx
        .select({ v: negocioLogo.actualizadoEn })
        .from(negocioLogo)
        .where(eq(negocioLogo.negocioId, ctx.negocioId))
        .limit(1);
      const sucs = await tx
        .select({ id: sucursal.id, nombre: sucursal.nombre })
        .from(sucursal)
        .where(eq(sucursal.activa, true));
      const actual = sucs.find((s) => s.id === sucursalId);
      const { diasLaborables, serviciosDia } = await this.horario.infoPublica(tx, sucursalId);
      return {
        negocioId: ctx.negocioId,
        sucursalId,
        sucursalNombre: actual?.nombre ?? '',
        negocioNombre: neg?.nombre ?? '',
        perfil: (neg?.perfil ?? PerfilNegocio.Salon) as PerfilNegocio,
        sucursales: sucs,
        diasLaborables,
        serviciosDia,
        negocioDescripcion: neg?.descripcion ?? null,
        colorPrimario: neg?.colorPrimario ?? null,
        logoVersion: logo?.v.toISOString() ?? null,
      };
    });
  }

  /** Detalle público de una cita (gestión por id). */
  async detalleCita(sucursalId: string, citaId: string): Promise<CitaPublica> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    const detalle = await runInTenantTx(ctx, (tx) => this.cargarDetalle(tx, sucursalId, citaId));
    if (!detalle) throw new NotFoundException('Cita no encontrada.');
    return detalle;
  }

  /** Recupera una cita por código (prefijo del id) + teléfono del cliente. */
  async buscarCita(sucursalId: string, telefono: string, codigo: string): Promise<CitaPublica> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    const code = codigo.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
    if (code.length < 6) throw new BadRequestException('Código inválido.');
    const found = await runInTenantTx(ctx, async (tx) => {
      const [row] = await tx
        .select({ id: cita.id })
        .from(cita)
        .innerJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(
          and(
            eq(cita.sucursalId, sucursalId),
            eq(cliente.telefono, telefono),
            sql`${cita.id}::text like ${code + '%'}`,
          ),
        )
        .limit(1);
      if (!row) return null;
      return this.cargarDetalle(tx, sucursalId, row.id);
    });
    if (!found) throw new NotFoundException('No encontramos una cita con ese código y teléfono.');
    return found;
  }

  /** Arma el detalle de una cita (servicios, especialista, sede, total). */
  private async cargarDetalle(
    tx: DrizzleTx,
    sucursalId: string,
    citaId: string,
  ): Promise<CitaPublica | null> {
    const [c] = await tx
      .select({
        id: cita.id,
        estado: cita.estado,
        inicio: cita.inicio,
        fin: cita.fin,
        sucursalNombre: sucursal.nombre,
        especialistaNombre: especialista.nombre,
      })
      .from(cita)
      .innerJoin(sucursal, eq(sucursal.id, cita.sucursalId))
      .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
      .where(and(eq(cita.id, citaId), eq(cita.sucursalId, sucursalId)))
      .limit(1);
    if (!c) return null;

    const servicios = await tx
      .select({ nombre: servicio.nombre, precio: citaServicio.precioAplicado })
      .from(citaServicio)
      .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
      .where(eq(citaServicio.citaId, citaId));
    const total = servicios.reduce((a, s) => a + Number(s.precio), 0);

    return {
      id: c.id,
      codigo: c.id.slice(0, 8).toUpperCase(),
      estado: c.estado as EstadoCita,
      inicio: c.inicio.toISOString(),
      fin: c.fin.toISOString(),
      sucursalNombre: c.sucursalNombre,
      especialistaNombre: c.especialistaNombre,
      servicios: servicios.map((s) => ({ nombre: s.nombre, precio: s.precio })),
      total: total.toFixed(2),
    };
  }

  /** Especialistas activos asignados a la sucursal (para reservar). */
  async especialistasPublicos(sucursalId: string): Promise<{ id: string; nombre: string; especialidad: string | null; fotoVersion: string | null }[]> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    return runInTenantTx(ctx, async (tx) => {
      const filas = await tx
        .select({
          id: especialista.id,
          nombre: especialista.nombre,
          especialidad: especialista.especialidad,
          // LEFT JOIN a la foto: solo la fecha, que hace de versión en la URL.
          // Los bytes se piden aparte, para que el navegador los cachee.
          fotoEn: especialistaFoto.actualizadoEn,
        })
        .from(especialista)
        .innerJoin(especialistaSucursal, eq(especialistaSucursal.especialistaId, especialista.id))
        .leftJoin(especialistaFoto, eq(especialistaFoto.especialistaId, especialista.id))
        .where(and(eq(especialistaSucursal.sucursalId, sucursalId), eq(especialista.activo, true), eq(especialista.disponible, true)));
      return filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        especialidad: f.especialidad,
        fotoVersion: f.fotoEn?.toISOString() ?? null,
      }));
    });
  }

  /**
   * Catálogo de servicios activos del negocio (para reservar), cada uno con los
   * especialistas de ESTA sucursal que pueden realizarlo.
   *
   * Ese `especialistaIds` es lo que permite al cliente filtrar sin más viajes al
   * servidor: ocultar lo que nadie atiende y descartar combinaciones imposibles.
   * Se devuelven también los servicios con lista vacía —el front decide ocultarlos—
   * para que una cita ya creada pueda seguir mostrando su nombre.
   */
  async serviciosPublicos(sucursalId: string): Promise<PublicServicio[]> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    return runInTenantTx(ctx, async (tx) => {
      const servicios = await tx
        .select({ id: servicio.id, nombre: servicio.nombre, precio: servicio.precio, duracionMin: servicio.duracionMin, categoria: servicio.categoria })
        .from(servicio)
        .where(eq(servicio.activo, true));
      if (servicios.length === 0) return [];

      // Equipo elegible de la sucursal (activo y libre).
      const equipo = await tx
        .select({ id: especialista.id })
        .from(especialista)
        .innerJoin(especialistaSucursal, eq(especialistaSucursal.especialistaId, especialista.id))
        .where(and(eq(especialistaSucursal.sucursalId, sucursalId), eq(especialista.activo, true), eq(especialista.disponible, true)));
      const candidatos = equipo.map((e) => e.id);

      // UNA consulta para todo el equipo y el cruce en memoria: quien no declara
      // servicios los realiza todos (por eso no aparece en el mapa y pasa siempre).
      const capacidades = await capacidadesDe(tx, candidatos);
      return servicios.map((s) => ({
        ...s,
        especialistaIds: candidatos.filter((id) => {
          const declarados = capacidades.get(id);
          return !declarados || declarados.has(s.id);
        }),
      }));
    });
  }

  async franjas(
    sucursalId: string,
    especialistaParam: string, // uuid o 'any'
    servicioIds: string[],
    fecha: string,
  ): Promise<FranjaPublica[]> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    return this.disponibilidad.franjasPublicas(ctx, sucursalId, especialistaParam, servicioIds, fecha);
  }

  /** Retiene una franja con TTL. No crea cita. Devuelve la retención. */
  async retener(
    sucursalId: string,
    especialistaId: string,
    inicio: Date,
    fin: Date,
  ): Promise<{ retencionId: string; expiraEn: Date }> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    const ttlMin = await this.config.resolverNumero(
      ctx.negocioId,
      sucursalId,
      'agendamiento.duracion_retencion_min',
    );
    const expiraEn = new Date(Date.now() + ttlMin * 60_000);

    return runInTenantTx(ctx, async (tx) => {
      // Housekeeping: limpia retenciones expiradas de esa franja.
      await tx
        .delete(retencionFranja)
        .where(and(eq(retencionFranja.especialistaId, especialistaId), lt(retencionFranja.expiraEn, new Date())));

      try {
        const [r] = await tx
          .insert(retencionFranja)
          .values({
            negocioId: ctx.negocioId,
            sucursalId,
            especialistaId,
            rango: sql`tstzrange(${inicio.toISOString()}, ${fin.toISOString()})`,
            expiraEn,
          })
          .returning({ id: retencionFranja.id });
        return { retencionId: r.id, expiraEn };
      } catch (e) {
        if ((e as { code?: string }).code === EXCLUSION_VIOLATION) {
          throw new ConflictException('Esa franja ya no está disponible. Elige otra.');
        }
        throw e;
      }
    });
  }

  /**
   * Genera y envía un OTP.
   *
   * Si la mensajería no está operativa (sin Twilio o con el interruptor de saldo
   * apagado) el SMS no sale y se devuelve el código en `devCode` para que la
   * pantalla se lo enseñe al cliente. Sin eso nadie podría reservar: el flujo
   * entero se apoya en un código que no llegaría nunca.
   */
  async enviarOtp(sucursalId: string, telefono: string): Promise<{ enviado: boolean; devCode?: string }> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    const codigo = await runInTenantTx(ctx, (tx) => this.otp.generar(tx, ctx.negocioId, telefono));
    if (this.estadoMensajeria.sinMensajes()) return { enviado: false, devCode: codigo };
    await this.notificaciones.encolarOtp(ctx.negocioId, telefono, codigo, { sucursalId }); // outbox: persiste y sigue
    return { enviado: true };
  }

  /** Confirma la reserva: verifica OTP, crea cliente y cita (EXCLUDE = garantía). */
  async confirmar(
    sucursalId: string,
    input: { retencionId: string; telefono: string; nombre?: string; codigoOtp: string; servicioIds: string[] },
  ): Promise<{ citaId: string; codigo: string; estado: EstadoCita }> {
    const ctx = await this.ctxDeSucursal(sucursalId);

    const resultado = await runInTenantTx(ctx, async (tx) => {
      await this.otp.verificar(tx, ctx.negocioId, input.telefono, input.codigoOtp);

      // Retención: fuente de la franja. Si no existe → ya usada/expirada (idempotencia).
      const [ret] = await tx
        .select({
          especialistaId: retencionFranja.especialistaId,
          ini: sql<Date>`lower(${retencionFranja.rango})`,
          fin: sql<Date>`upper(${retencionFranja.rango})`,
        })
        .from(retencionFranja)
        .where(eq(retencionFranja.id, input.retencionId))
        .limit(1);
      if (!ret) throw new ConflictException('La reserva ya fue procesada o expiró.');

      const inicio = new Date(ret.ini);
      const fin = new Date(ret.fin);

      // Regla de negocio (D-horario): el cliente NO puede reservar en un día que
      // el negocio marcó como cerrado, ni un servicio desactivado ese día.
      const weekday = bogotaParts(inicio).weekday;
      if (!(await this.horario.esDiaLaborable(tx, sucursalId, weekday))) {
        throw new BadRequestException('Ese día el negocio no atiende. Por favor elige otro día.');
      }
      const inactivos = await this.horario.serviciosInactivosEnDia(tx, weekday, input.servicioIds);
      if (inactivos.size > 0) {
        throw new BadRequestException('Alguno de los servicios elegidos no está disponible ese día.');
      }

      await this.validadores
        .paraOrigen(OrigenCita.AgendamientoPublico)
        .validar(tx, {
          negocioId: ctx.negocioId,
          sucursalId,
          especialistaId: ret.especialistaId,
          inicio,
          fin,
          // Entre retener y confirmar pudieron quitarle el servicio al
          // especialista (o darlo de baja): se revalida contra la retención.
          servicioIds: input.servicioIds,
        });

      // get_or_create cliente por teléfono (RF-034). Si ya existe y llega un
      // nombre nuevo, se ACTUALIZA: el teléfono es la identidad, pero el cliente
      // puede corregir/cambiar su nombre en una reserva posterior (antes se
      // quedaba con el nombre de la primera reserva).
      const nombreNuevo = input.nombre?.trim();
      let [cli] = await tx
        .select({ id: cliente.id, nombre: cliente.nombre })
        .from(cliente)
        .where(eq(cliente.telefono, input.telefono))
        .limit(1);
      if (!cli) {
        [cli] = await tx
          .insert(cliente)
          .values({ negocioId: ctx.negocioId, nombre: nombreNuevo || 'Cliente', telefono: input.telefono })
          .returning({ id: cliente.id, nombre: cliente.nombre });
      } else if (nombreNuevo && nombreNuevo !== cli.nombre) {
        await tx.update(cliente).set({ nombre: nombreNuevo }).where(eq(cliente.id, cli.id));
      }
      // Nombre efectivo tras la posible actualización (variable {{cliente}}).
      const nombreCliente = nombreNuevo || cli.nombre;

      // precio estimado = suma de los servicios elegidos.
      const servicios = await tx
        .select({ id: servicio.id, precio: servicio.precio })
        .from(servicio)
        .where(inArray(servicio.id, input.servicioIds));
      if (servicios.length !== new Set(input.servicioIds).size) {
        throw new NotFoundException('Algún servicio no existe.');
      }
      const precioEst = servicios.reduce((s, x) => s + Number(x.precio), 0);

      // Estado de entrada según la bandera de aprobación manual (config).
      const aprobacionManual = await this.config.resolverModulo(
        ctx.negocioId,
        sucursalId,
        'agendamiento.aprobacion_manual',
      );
      const estado = aprobacionManual ? EstadoCita.Solicitada : EstadoCita.Confirmada;

      let citaId: string;
      try {
        const [c] = await tx
          .insert(cita)
          .values({
            negocioId: ctx.negocioId,
            sucursalId,
            clienteId: cli.id,
            especialistaId: ret.especialistaId,
            inicio,
            fin,
            estado,
            origen: OrigenCita.AgendamientoPublico,
            precioEst: precioEst.toFixed(2),
          })
          .returning({ id: cita.id });
        citaId = c.id;
      } catch (e) {
        if ((e as { code?: string }).code === EXCLUSION_VIOLATION) {
          this.metrics.inc(METRICAS.exclusionViolaciones);
          throw new ConflictException('Esa franja acaba de ser tomada. Elige otra.');
        }
        throw e;
      }

      await tx.insert(citaServicio).values(
        servicios.map((s) => ({ citaId, servicioId: s.id, precioAplicado: s.precio })),
      );

      // Libera la retención usada.
      await tx.delete(retencionFranja).where(eq(retencionFranja.id, input.retencionId));

      // Nombres para la plantilla de confirmación.
      const [suc] = await tx.select({ nombre: sucursal.nombre }).from(sucursal).where(eq(sucursal.id, sucursalId)).limit(1);
      const [esp] = await tx
        .select({ nombre: especialista.nombre })
        .from(especialista)
        .where(eq(especialista.id, ret.especialistaId))
        .limit(1);

      return {
        citaId,
        estado,
        notif: {
          sucursalNombre: suc?.nombre ?? '',
          especialistaNombre: esp?.nombre ?? '',
          clienteNombre: nombreCliente,
          inicio,
        },
      };
    });

    // Post-commit: encola la confirmación en el outbox (no habla con Twilio, RNF-002).
    await this.notificaciones.encolarConfirmacion(ctx.negocioId, input.telefono, resultado.notif, {
      sucursalId,
      citaId: resultado.citaId,
    });
    // Si la reserva quedó confirmada, el especialista se entera al momento
    // (si quedó SOLICITADA se le avisará al aprobarla).
    if (resultado.estado === EstadoCita.Confirmada) {
      await this.avisos.avisar(ctx, resultado.citaId, 'Nueva cita en tu agenda');
    }
    this.metrics.inc(METRICAS.reservasCreadas);
    return {
      citaId: resultado.citaId,
      codigo: resultado.citaId.slice(0, 8).toUpperCase(),
      estado: resultado.estado,
    };
  }

  /** Cancela una cita desde el enlace público, respetando la antelación mínima. */
  async cancelarDesdeEnlace(sucursalId: string, citaId: string): Promise<{ estado: EstadoCita }> {
    const ctx = await this.ctxDeSucursal(sucursalId);
    const horas = await this.config.resolverNumero(
      ctx.negocioId,
      sucursalId,
      'agendamiento.antelacion_cancelacion_horas',
    );
    const r = await runInTenantTx(ctx, async (tx) => {
      const [c] = await tx
        .select({
          estado: cita.estado,
          inicio: cita.inicio,
          telefono: cliente.telefono,
          sucursalNombre: sucursal.nombre,
          especialistaNombre: especialista.nombre,
        })
        .from(cita)
        .innerJoin(sucursal, eq(sucursal.id, cita.sucursalId))
        .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(and(eq(cita.id, citaId), eq(cita.sucursalId, sucursalId)))
        .limit(1);
      if (!c) throw new ConflictException('Cita no encontrada.');
      const margenMs = c.inicio.getTime() - Date.now();
      if (margenMs < horas * 3600_000) {
        throw new BadRequestException(
          `La cancelación requiere al menos ${horas} h de antelación; contacta a la sucursal.`,
        );
      }
      const nuevoEstado = transicionar(c.estado as EstadoCita, 'cancelar');
      await tx.update(cita).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(cita.id, citaId));
      return { ...c, estado: nuevoEstado };
    });

    // Aviso de cancelación al cliente (RF-048).
    if (r.telefono) {
      await this.notificaciones.encolarAviso(
        ctx.negocioId,
        r.telefono,
        { sucursalNombre: r.sucursalNombre, especialistaNombre: r.especialistaNombre, inicio: r.inicio },
        { sucursalId, citaId },
      );
    }
    await this.avisos.avisar(ctx, citaId, 'Cita cancelada por el cliente');
    return { estado: r.estado };
  }

  /** Limpieza de retenciones expiradas (worker en FASE-11/14). */
  async limpiarRetencionesExpiradas(): Promise<number> {
    const res = await adminDb.delete(retencionFranja).where(lt(retencionFranja.expiraEn, new Date()));
    return res.count ?? 0;
  }
}
