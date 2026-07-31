import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { RolUsuario } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx } from '../db/tx';
import { especialista, especialistaSucursal, negocio, usuario, usuarioSucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CorreoAuthService } from '../correo/correo-auth.service';
import { TokenAccionService } from '../correo/token-accion.service';
import { aE164Colombia } from '../notificaciones/phone';
import { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';
import { RemitenteResolver } from '../notificaciones/remitente/remitente.resolver';
import { VERIFY_PORT, type VerifyPort } from '../notificaciones/verify/verify.port';
import { EquipoService } from './equipo.service';

type Especialista = typeof especialista.$inferSelect;

export interface InvitarInput {
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  email: string;
  sucursalIds: string[];
  servicioIds?: string[];
  disponible?: boolean;
}

/** Lo que la página pública puede saber de una invitación sin activarla. */
export type InfoInvitacion =
  | { estado: 'valida'; nombre: string; negocio: string; email: string }
  | { estado: 'usada' }
  | { estado: 'invalida' };

/**
 * Invitación de especialistas por correo (Plan-Correo E5, D4).
 *
 * Reemplaza el alta con OTP tecleado por el admin: ahora el admin captura los
 * datos básicos + el correo, el especialista se crea de una vez (sin teléfono
 * ni login) y recibe un enlace de 7 días con el que ÉL crea su contraseña y
 * después verifica su propio celular por SMS. El cupo del plan se cobra al
 * crear, como siempre; la invitación no consume nada extra.
 */
@Injectable()
export class InvitacionEspecialistaService {
  private readonly logger = new Logger('InvitacionEspecialista');

  constructor(
    private readonly equipo: EquipoService,
    private readonly correo: CorreoAuthService,
    private readonly tokens: TokenAccionService,
    private readonly remitente: RemitenteResolver,
    @Inject(VERIFY_PORT) private readonly verify: VerifyPort,
    private readonly estadoMensajeria: MensajeriaEstadoService,
  ) {}

  // ── Lado admin ──────────────────────────────────────────────────────────────

  /** Crea el especialista (datos básicos) y le manda la invitación. */
  async invitar(ctx: TenantContext, input: InvitarInput): Promise<Especialista & { invitacionEmail: string }> {
    const email = input.email.toLowerCase().trim();
    await this.asegurarEmailLibre(email);

    const esp = await this.equipo.crear(ctx, input.nombre.trim(), input.especialidad?.trim() || undefined, input.sucursalIds, {
      apellidos: input.apellidos?.trim() || undefined,
      servicioIds: input.servicioIds,
    });
    const creado = input.disponible === false ? await this.equipo.editar(ctx, esp.id, { disponible: false }) : esp;

    await this.enviarInvitacion(ctx.negocioId, creado, email);
    return { ...creado, invitacionEmail: email };
  }

  /**
   * Invita (o re-invita con otro correo) a un especialista que ya existe sin
   * acceso — el caso típico: los creados solo con el nombre desde el asistente
   * de alta del negocio.
   */
  async invitarExistente(ctx: TenantContext, especialistaId: string, email: string): Promise<void> {
    const limpio = email.toLowerCase().trim();
    await this.asegurarEmailLibre(limpio);
    const esp = await this.cargarEspecialista(ctx, especialistaId);
    if (esp.usuarioId) throw new ConflictException('Este especialista ya tiene acceso al panel.');
    await this.enviarInvitacion(ctx.negocioId, esp, limpio);
  }

  /**
   * "Este soy yo" sobre un especialista YA creado (E8): lo enlaza a la cuenta
   * del usuario en sesión. Cubre el caso de la ficha creada con solo el nombre
   * (asistente de alta) que en realidad era el propio admin. Si tenía una
   * invitación en el aire, se cancela: ya no hay nada que activar.
   */
  async vincularMiCuenta(ctx: TenantContext, especialistaId: string): Promise<void> {
    if (!ctx.usuarioId) throw new BadRequestException('La sesión no identifica a un usuario.');

    const esp = await this.cargarEspecialista(ctx, especialistaId);
    if (esp.usuarioId) throw new ConflictException('Este especialista ya tiene acceso al panel.');

    const [miFicha] = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ id: especialista.id })
        .from(especialista)
        .where(and(eq(especialista.usuarioId, ctx.usuarioId!), eq(especialista.activo, true)))
        .limit(1),
    );
    if (miFicha) throw new ConflictException('Tu cuenta ya está enlazada a otra ficha de especialista.');

    await runInTenantTx(ctx, (tx) =>
      tx.update(especialista).set({ usuarioId: ctx.usuarioId!, actualizadoEn: new Date() }).where(eq(especialista.id, especialistaId)),
    );
    await this.tokens.cancelarInvitacion(ctx.negocioId, especialistaId);
    this.logger.log(`Especialista ${especialistaId} vinculado a la cuenta del usuario en sesión.`);
  }

  /** Reenvía la invitación vigente (cooldown y tope los valida el servicio de tokens). */
  async reenviar(ctx: TenantContext, especialistaId: string): Promise<void> {
    await this.cargarEspecialista(ctx, especialistaId);
    const fila = await this.tokens.invitacionDe(ctx.negocioId, especialistaId);
    if (!fila) throw new BadRequestException('Este especialista no tiene una invitación. Envíale una con su correo.');
    if (fila.usadoEn) throw new BadRequestException('La invitación ya se activó: el especialista ya tiene acceso.');
    await this.correo.reenviar(fila.id);
  }

  /** Invitaciones vigentes del negocio, para los badges de la pantalla de equipo. */
  async pendientes(ctx: TenantContext): Promise<{ especialistaId: string; email: string; expiraEn: string }[]> {
    const filas = await this.tokens.invitacionesPendientes(ctx.negocioId);
    return filas
      .filter((f) => f.payload?.especialistaId)
      .map((f) => ({ especialistaId: f.payload!.especialistaId, email: f.email, expiraEn: f.expiraEn.toISOString() }));
  }

  // ── Lado público (la página /invitacion) ────────────────────────────────────

  async info(token: string): Promise<InfoInvitacion> {
    const fila = await this.tokens.validar('invitacion_especialista', token);
    if (!fila || !fila.payload?.especialistaId) {
      const usada = await this.tokens.validarUsado('invitacion_especialista', token);
      return usada ? { estado: 'usada' } : { estado: 'invalida' };
    }
    return {
      estado: 'valida',
      nombre: fila.payload.nombre ?? '',
      negocio: fila.payload.negocio ?? '',
      email: fila.email,
    };
  }

  /**
   * El especialista activa su cuenta creando SU contraseña. Orden deliberado:
   * primero se valida (sin gastar), luego se crea el usuario (el índice único de
   * email resuelve cualquier carrera) y al final se gasta el token — si el
   * proceso muere a mitad, el enlace sigue vivo y el reintento es idempotente.
   */
  async activar(token: string, password: string): Promise<{ ok: true; email: string }> {
    const fila = await this.tokens.validar('invitacion_especialista', token);
    if (!fila || !fila.payload?.especialistaId || !fila.negocioId) {
      const usada = await this.tokens.validarUsado('invitacion_especialista', token);
      throw usada
        ? new ConflictException('Esta invitación ya se activó. Inicia sesión con tu contraseña.')
        : new BadRequestException('La invitación no es válida o ya venció. Pide al negocio que la reenvíe.');
    }

    const [esp] = await adminDb.select().from(especialista).where(eq(especialista.id, fila.payload.especialistaId)).limit(1);
    if (!esp || !esp.activo) throw new BadRequestException('El negocio retiró esta invitación.');

    // Reintento tras un fallo a mitad: el usuario ya quedó creado y enlazado.
    if (esp.usuarioId) {
      const [u] = await adminDb.select({ email: usuario.email }).from(usuario).where(eq(usuario.id, esp.usuarioId)).limit(1);
      if (u?.email === fila.email) {
        await this.tokens.usar('invitacion_especialista', token);
        return { ok: true, email: fila.email };
      }
      throw new ConflictException('Este especialista ya tiene acceso al panel.');
    }

    const passwordHash = await argon2.hash(password);
    const nombreCompleto = [esp.nombre, esp.apellidos].filter(Boolean).join(' ');
    try {
      await adminDb.transaction(async (tx) => {
        const [u] = await tx
          .insert(usuario)
          .values({
            negocioId: fila.negocioId!,
            nombre: nombreCompleto,
            email: fila.email,
            passwordHash,
            rol: RolUsuario.Especialista,
            // Abrir el enlace que llegó a su correo ES la prueba de posesión.
            emailVerificadoEn: new Date(),
          })
          .returning({ id: usuario.id });
        const sedes = await tx
          .select({ sucursalId: especialistaSucursal.sucursalId })
          .from(especialistaSucursal)
          .where(eq(especialistaSucursal.especialistaId, esp.id));
        if (sedes.length) {
          await tx.insert(usuarioSucursal).values(sedes.map((s) => ({ usuarioId: u.id, sucursalId: s.sucursalId })));
        }
        await tx.update(especialista).set({ usuarioId: u.id, actualizadoEn: new Date() }).where(eq(especialista.id, esp.id));
      });
    } catch (e) {
      if (e instanceof Error && /usuario_email_uq|unique/i.test(e.message)) {
        throw new ConflictException('Ya existe una cuenta con ese correo. Pide al negocio que te invite con otro.');
      }
      throw e;
    }

    await this.tokens.usar('invitacion_especialista', token);
    this.logger.log(`Especialista ${esp.id} activó su cuenta por invitación.`);
    return { ok: true, email: fila.email };
  }

  // ── El propio especialista verifica su celular (paso 2 de la invitación) ────

  /**
   * Guarda el celular (sin verificar aún) y dispara el código por Twilio
   * Verify. Con la mensajería pausada responde 409 `SIN_MENSAJERIA` (D5): el
   * especialista entra igual y lo verifica después desde su panel.
   */
  async miTelefonoIniciar(ctx: TenantContext, celular: string): Promise<{ ok: true }> {
    const telefono = this.normalizarCelular(celular);
    if (this.estadoMensajeria.sinMensajes()) {
      throw new ConflictException({
        codigo: 'SIN_MENSAJERIA',
        message: 'La mensajería está pausada; verifica tu celular más tarde desde tu panel.',
      });
    }
    const id = await this.equipo.miEspecialistaId(ctx);
    await runInTenantTx(ctx, (tx) =>
      tx.update(especialista).set({ telefono, telefonoVerificadoEn: null, actualizadoEn: new Date() }).where(eq(especialista.id, id)),
    );
    await this.verify.start(telefono, 'sms', this.remitente.resolver(ctx.negocioId));
    return { ok: true };
  }

  /** Comprueba el código y estampa la verificación (habilita los avisos de agenda). */
  async miTelefonoConfirmar(ctx: TenantContext, codigo: string): Promise<{ ok: true }> {
    const id = await this.equipo.miEspecialistaId(ctx);
    const [esp] = await runInTenantTx(ctx, (tx) => tx.select().from(especialista).where(eq(especialista.id, id)).limit(1));
    if (!esp?.telefono) throw new BadRequestException('Primero registra tu celular.');
    if (esp.telefonoVerificadoEn) return { ok: true };

    const ok = await this.verify.check(esp.telefono, codigo.trim(), this.remitente.resolver(ctx.negocioId));
    if (!ok) throw new BadRequestException('Código incorrecto. Revisa el SMS e intenta de nuevo.');

    await runInTenantTx(ctx, (tx) =>
      tx.update(especialista).set({ telefonoVerificadoEn: new Date(), actualizadoEn: new Date() }).where(eq(especialista.id, id)),
    );
    return { ok: true };
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  private async enviarInvitacion(negocioId: string, esp: Especialista, email: string): Promise<void> {
    const [neg] = await adminDb.select({ nombre: negocio.nombre }).from(negocio).where(eq(negocio.id, negocioId)).limit(1);
    await this.correo.enviarInvitacionEspecialista({
      negocioId,
      especialistaId: esp.id,
      email,
      nombre: esp.nombre,
      negocio: neg?.nombre ?? 'Tu negocio',
    });
  }

  /** El correo de la invitación no puede pertenecer ya a una cuenta. */
  private async asegurarEmailLibre(email: string): Promise<void> {
    const [enUso] = await adminDb.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email)).limit(1);
    if (enUso) throw new ConflictException('Ya existe una cuenta con ese correo.');
  }

  private async cargarEspecialista(ctx: TenantContext, id: string): Promise<Especialista> {
    const [esp] = await runInTenantTx(ctx, (tx) => tx.select().from(especialista).where(eq(especialista.id, id)).limit(1));
    if (!esp) throw new NotFoundException('Especialista no encontrado.');
    return esp;
  }

  private normalizarCelular(celular: string): string {
    const e164 = aE164Colombia(celular ?? '');
    if (!/^\+573\d{9}$/.test(e164)) {
      throw new BadRequestException('El celular debe ser un móvil colombiano de 10 dígitos (empieza por 3).');
    }
    return e164;
  }
}
