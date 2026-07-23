import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { EstadoSuscripcion, PerfilNegocio, RolUsuario, tieneAcceso, type SesionUsuario } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import {
  especialista,
  especialistaFoto,
  negocio,
  refreshToken,
  sucursal,
  suscripcion,
  usuario,
  usuarioSucursal,
} from '../db/schema';
import type { Env } from '../config/env.validation';
import type { TenantContext } from '../db/tenant-context';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from './auth.types';
import type { RegistroDto } from './dto/registro.dto';
import { PlanService } from '../plans/plan.service';
import { SuscripcionEstadoService } from '../pagos/suscripcion-estado.service';
import { TransicionInvalidaError } from '../pagos/suscripcion-estado';
import { METRICAS, MetricsService } from '../observability/metrics.service';

/** Días de la prueba gratis al registrarse (Plan-Pagos, regla #1). */
const DIAS_PRUEBA = 15;

/** Motivo por el que una cuenta queda sin acceso (Plan-Pagos FASE-11). */
export type MotivoBloqueo = 'prueba_vencida' | 'suspendida' | 'cancelada';

/** Veredicto de acceso por estado de suscripción (sin lanzar). */
export interface AccesoSuscripcion {
  estado: EstadoSuscripcion;
  bloqueado: boolean;
  motivo: MotivoBloqueo | null;
}

/** Mensaje al usuario según el motivo de bloqueo. */
export function mensajeBloqueo(motivo: MotivoBloqueo): string {
  switch (motivo) {
    case 'prueba_vencida':
      return 'Tu prueba terminó. Agrega un método de pago para continuar.';
    case 'cancelada':
      return 'Tu suscripción está cancelada. Reactívala para continuar.';
    default:
      return 'Tu cuenta está suspendida por falta de pago. Actualiza tu método para reactivarla.';
  }
}

/** Resultado del alta pública: tokens de sesión + ruteo del front. */
export interface RegistroResult extends TokenPair {
  negocioId: string;
  modo: 'prueba' | 'pago';
  /** `true` si eligió "pagar ya" → el front debe enviar al checkout (FASE-05). */
  requierePago: boolean;
}

/**
 * Servicio de autenticación (FASE-05, ADR-003).
 *
 * Usa la conexión ADMIN: el login es intrínsecamente cross-tenant (se busca al
 * usuario por email global antes de conocer su negocio) y la gestión de refresh
 * tokens ocurre antes de tener `TenantContext`. El resto del dominio NUNCA usa
 * adminDb: opera con la conexión de app + `runInTenantTx` (FASE-04).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly metrics: MetricsService,
    private readonly plans: PlanService,
    private readonly suscripcionEstado: SuscripcionEstadoService,
  ) {}

  /**
   * Alta pública de un negocio (Plan-Pagos FASE-03, HU-ADM-001). Crea, en una
   * transacción, el `negocio` + `suscripcion` + `sucursal` inicial + `usuario`
   * admin + su alcance. Arranca en estado `prueba` (15 días); la config de
   * módulos por defecto se resuelve por perfil (no requiere filas). Devuelve la
   * sesión iniciada y si debe ir al checkout (`modo='pago'`, FASE-05).
   */
  async registrar(dto: RegistroDto): Promise<RegistroResult> {
    const email = dto.admin.email.toLowerCase().trim();

    const incluidos = this.plans.getPlan(dto.plan).especialistasIncluidos;
    if (dto.numEspecialistas < incluidos) {
      throw new BadRequestException(
        `El plan ${dto.plan} incluye ${incluidos} especialistas; elige al menos ${incluidos}.`,
      );
    }

    // Pre-chequeo amistoso del email (el índice único global cubre la carrera).
    const [yaExiste] = await adminDb
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.email, email))
      .limit(1);
    if (yaExiste) {
      throw new ConflictException('Ya existe una cuenta con ese correo. Inicia sesión.');
    }

    const passwordHash = await argon2.hash(dto.admin.password);
    const estado = EstadoSuscripcion.Prueba;
    const trialFin = new Date(Date.now() + DIAS_PRUEBA * 24 * 60 * 60 * 1000);

    let negocioId: string;
    let usuarioId: string;
    try {
      const ids = await adminDb.transaction(async (tx) => {
        const [neg] = await tx
          .insert(negocio)
          .values({ nombre: dto.negocioNombre.trim(), perfil: dto.perfil, estadoSuscripcion: estado })
          .returning({ id: negocio.id });
        await tx.insert(suscripcion).values({
          negocioId: neg.id,
          plan: dto.plan,
          numEspecialistas: dto.numEspecialistas,
          estado,
          trialFin,
        });
        const [suc] = await tx
          .insert(sucursal)
          .values({ negocioId: neg.id, nombre: 'Principal' })
          .returning({ id: sucursal.id });
        const [admin] = await tx
          .insert(usuario)
          .values({
            negocioId: neg.id,
            nombre: dto.admin.nombre.trim(),
            email,
            passwordHash,
            rol: RolUsuario.Admin,
          })
          .returning({ id: usuario.id });
        await tx.insert(usuarioSucursal).values({ usuarioId: admin.id, sucursalId: suc.id });
        return { negocioId: neg.id, usuarioId: admin.id };
      });
      negocioId = ids.negocioId;
      usuarioId = ids.usuarioId;
    } catch (e) {
      // Violación del índice único de email (carrera) u otro conflicto.
      if (e instanceof Error && /usuario_email_uq|unique/i.test(e.message)) {
        throw new ConflictException('Ya existe una cuenta con ese correo. Inicia sesión.');
      }
      throw e;
    }

    this.metrics.inc(METRICAS.loginExitosos);
    const tokens = await this.emitirTokens(usuarioId, negocioId, RolUsuario.Admin, null, randomUUID());
    return { ...tokens, negocioId, modo: dto.modo, requierePago: dto.modo === 'pago' };
  }

  /** Verifica credenciales y emite el par de tokens. */
  async login(email: string, password: string): Promise<TokenPair> {
    const [u] = await adminDb
      .select()
      .from(usuario)
      .where(eq(usuario.email, email.toLowerCase().trim()))
      .limit(1);

    // Mensaje genérico para no filtrar si el email existe.
    const credsInvalidas = new UnauthorizedException('Credenciales inválidas.');
    if (!u || !u.activo) throw credsInvalidas;

    const ok = await argon2.verify(u.passwordHash, password);
    if (!ok) throw credsInvalidas;

    // NO se bloquea aquí: una cuenta sin acceso obtiene una sesión LIMITADA para
    // poder pagar en la pantalla de facturación (FASE-11). El bloqueo de los
    // endpoints normales lo hace `SuscripcionAccesoGuard` por petición.
    const sucursalIds = await this.resolveSucursalIds(u.id, u.rol as RolUsuario);
    this.metrics.inc(METRICAS.loginExitosos);
    return this.emitirTokens(u.id, u.negocioId, u.rol as RolUsuario, sucursalIds, randomUUID());
  }

  /** Rota el refresh token (revoca el usado, emite uno nuevo). Detecta reuso. */
  async refresh(payload: RefreshTokenPayload): Promise<TokenPair> {
    const [rt] = await adminDb
      .select()
      .from(refreshToken)
      .where(eq(refreshToken.jti, payload.jti))
      .limit(1);

    if (!rt) throw new UnauthorizedException('Sesión inválida.');

    // Reuso de un token ya revocado → posible robo: se revoca toda la familia.
    if (rt.revocado) {
      await adminDb
        .update(refreshToken)
        .set({ revocado: true })
        .where(eq(refreshToken.familia, rt.familia));
      throw new UnauthorizedException('Token reutilizado; sesión revocada.');
    }
    if (rt.expiraEn.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesión expirada.');
    }

    // Carga fresca del usuario (refleja cambios de rol/estado).
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.id, rt.usuarioId)).limit(1);
    if (!u || !u.activo) throw new UnauthorizedException('Sesión inválida.');
    // No se bloquea por suscripción: la sesión limitada (FASE-11) debe poder
    // renovarse para seguir pagando. El guard por petición aplica el bloqueo.

    // Rota: revoca el actual y emite uno nuevo en la MISMA familia.
    await adminDb
      .update(refreshToken)
      .set({ revocado: true })
      .where(eq(refreshToken.jti, payload.jti));

    const sucursalIds = await this.resolveSucursalIds(u.id, u.rol as RolUsuario);
    return this.emitirTokens(u.id, u.negocioId, u.rol as RolUsuario, sucursalIds, rt.familia);
  }

  /** Revoca el refresh token presentado (cierre de sesión). */
  async logout(payload: RefreshTokenPayload): Promise<void> {
    await adminDb
      .update(refreshToken)
      .set({ revocado: true })
      .where(eq(refreshToken.jti, payload.jti));
  }

  /** Devuelve el usuario y su contexto (negocio, rol, sucursales). */
  async me(ctx: TenantContext): Promise<SesionUsuario> {
    const [u] = await adminDb
      .select()
      .from(usuario)
      .where(and(eq(usuario.id, ctx.usuarioId!), eq(usuario.negocioId, ctx.negocioId)))
      .limit(1);
    if (!u) throw new UnauthorizedException('Usuario no encontrado.');

    const [n] = await adminDb
      .select({
        id: negocio.id,
        nombre: negocio.nombre,
        perfil: negocio.perfil,
        estadoSuscripcion: negocio.estadoSuscripcion,
      })
      .from(negocio)
      .where(eq(negocio.id, u.negocioId))
      .limit(1);
    if (!n) throw new UnauthorizedException('Negocio no encontrado.');

    // Especialista enlazado (si el usuario es recurso de agenda). Se trae de
    // paso la fecha de su foto —no los bytes— para que el panel pueda componer
    // la URL del avatar sin una petición extra.
    const [esp] = await adminDb
      .select({ id: especialista.id, fotoVersion: especialistaFoto.actualizadoEn })
      .from(especialista)
      .leftJoin(especialistaFoto, eq(especialistaFoto.especialistaId, especialista.id))
      .where(and(eq(especialista.usuarioId, u.id), eq(especialista.activo, true)))
      .limit(1);

    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol as RolUsuario,
      negocioId: u.negocioId,
      sucursalIds: ctx.sucursalIds,
      especialistaId: esp?.id ?? null,
      fotoVersion: esp?.fotoVersion?.toISOString() ?? null,
      negocio: {
        id: n.id,
        nombre: n.nombre,
        perfil: n.perfil as PerfilNegocio,
        estadoSuscripcion: n.estadoSuscripcion as EstadoSuscripcion,
      },
    };
  }

  /**
   * Evalúa el acceso por estado de suscripción SIN lanzar (Plan-Pagos FASE-11).
   * Aplica en caliente el corte de la prueba vencida (sin esperar al cron) y
   * devuelve el veredicto. Lo usa el `SuscripcionAccesoGuard` por petición y el
   * `getResumen` para exponer el motivo a la pantalla de facturación.
   */
  async evaluarAcceso(negocioId: string): Promise<AccesoSuscripcion> {
    const [s] = await adminDb
      .select({ estado: suscripcion.estado, trialFin: suscripcion.trialFin })
      .from(suscripcion)
      .where(eq(suscripcion.negocioId, negocioId))
      .limit(1);
    if (!s) throw new UnauthorizedException('Negocio no encontrado.');

    let estado = s.estado as EstadoSuscripcion;
    let motivo: MotivoBloqueo = 'suspendida';

    // Corte en caliente de la prueba vencida: si la prueba ya pasó, suspende.
    if (estado === EstadoSuscripcion.Prueba && s.trialFin && s.trialFin.getTime() < Date.now()) {
      try {
        await this.suscripcionEstado.aplicar(negocioId, 'prueba_vence');
      } catch (e) {
        // Otra request concurrente ya la suspendió: la transición ya no aplica.
        if (!(e instanceof TransicionInvalidaError)) throw e;
      }
      estado = EstadoSuscripcion.Suspendida;
      motivo = 'prueba_vencida';
    } else if (estado === EstadoSuscripcion.Cancelada) {
      motivo = 'cancelada';
    }

    const bloqueado = !tieneAcceso(estado);
    return { estado, bloqueado, motivo: bloqueado ? motivo : null };
  }

  /**
   * Lanza `ForbiddenException` con `codigo`/`motivo` si la cuenta está bloqueada.
   * (Conserva el contrato previo para llamadores que prefieran lanzar.)
   */
  async assertNegocioActivo(negocioId: string): Promise<void> {
    const { bloqueado, motivo } = await this.evaluarAcceso(negocioId);
    if (bloqueado && motivo) {
      throw new ForbiddenException({
        codigo: 'SUSCRIPCION_BLOQUEADA',
        motivo,
        message: mensajeBloqueo(motivo),
      });
    }
  }

  /** admin/operador = alcance consolidado (null); resto = sus sucursales. */
  private async resolveSucursalIds(
    usuarioId: string,
    rol: RolUsuario,
  ): Promise<string[] | null> {
    if (rol === RolUsuario.Admin || rol === RolUsuario.OperadorPlataforma) {
      return null;
    }
    const filas = await adminDb
      .select({ sucursalId: usuarioSucursal.sucursalId })
      .from(usuarioSucursal)
      .where(eq(usuarioSucursal.usuarioId, usuarioId));
    return filas.map((f) => f.sucursalId);
  }

  /** Firma el par access+refresh y persiste el jti del refresh. */
  private async emitirTokens(
    usuarioId: string,
    negocioId: string,
    rol: RolUsuario,
    sucursalIds: string[] | null,
    familia: string,
  ): Promise<TokenPair> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const jti = randomUUID();

    const accessPayload: AccessTokenPayload = {
      sub: usuarioId,
      negocio_id: negocioId,
      rol,
      sucursal_ids: sucursalIds,
      tipo: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: usuarioId,
      negocio_id: negocioId,
      jti,
      familia,
      tipo: 'refresh',
    };

    const [accessToken, refreshTokenStr] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshTtl,
      }),
    ]);

    await adminDb.insert(refreshToken).values({
      jti,
      familia,
      usuarioId,
      negocioId,
      expiraEn: new Date(Date.now() + refreshTtl * 1000),
    });

    return { accessToken, refreshToken: refreshTokenStr };
  }
}
