import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, sql } from 'drizzle-orm';
import { adminDb } from '../db/admin-client';
import { refreshToken, usuario } from '../db/schema';
import { CorreoAuthService } from '../correo/correo-auth.service';
import { TokenAccionService } from '../correo/token-accion.service';

/**
 * Flujos de credenciales autorizados por correo (Plan-Correo E2–E4): la
 * verificación del alta, y más adelante el reset de contraseña y el cambio de
 * correo. Vive aparte de `AuthService` (sesiones/registro) para no engordarlo;
 * comparte su misma naturaleza cross-tenant (adminDb): aquí casi nunca hay
 * sesión y se busca por email global.
 */
@Injectable()
export class CredencialesService {
  private readonly logger = new Logger('Credenciales');

  constructor(
    private readonly tokens: TokenAccionService,
    private readonly correo: CorreoAuthService,
  ) {}

  // ── Flujo 1 · Verificación del correo en el alta (E2) ──────────────────────

  /**
   * Arranca la verificación del Paso 2 del wizard: manda el enlace y devuelve el
   * id para el polling. El 409 con correo ya registrado es deliberado (D7): el
   * usuario está tecleando SU correo y hoy ese conflicto ya se revela en el
   * paso 6 — solo se adelanta la noticia.
   */
  async iniciarVerificacionAlta(email: string, nombre: string): Promise<{ verificacionId: string }> {
    const limpio = email.toLowerCase().trim();
    const [yaExiste] = await adminDb.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, limpio)).limit(1);
    if (yaExiste) throw new ConflictException('Ya existe una cuenta con ese correo. Inicia sesión.');
    return this.correo.enviarVerificacionAlta(limpio, nombre.trim());
  }

  /** Reenvía el enlace del alta (cooldown y tope los valida el servicio de tokens). */
  async reenviarVerificacionAlta(verificacionId: string): Promise<void> {
    const fila = await this.tokens.porId(verificacionId);
    if (!fila || fila.tipo !== 'alta_email' || fila.usadoEn) {
      throw new BadRequestException('Esta verificación ya no está activa.');
    }
    await this.correo.reenviar(verificacionId);
  }

  /**
   * Estado para el polling del wizard. No devuelve el email ni nada sensible:
   * el id es un uuid aleatorio que solo conoce quien inició el flujo.
   */
  async estadoVerificacionAlta(verificacionId: string): Promise<{ verificado: boolean }> {
    const fila = await this.tokens.porId(verificacionId);
    if (!fila || fila.tipo !== 'alta_email') throw new NotFoundException('Verificación no encontrada.');
    return { verificado: fila.usadoEn !== null };
  }

  /**
   * Destino del clic en el enlace del correo (página `/verificar-correo`).
   * Gasta el token de forma atómica; el doble clic responde amistoso sin
   * filtrar nada (el primero ya verificó — para el usuario "ya estás listo").
   */
  async verificarCorreo(token: string): Promise<{ ok: true; contexto: 'alta' | 'cambio_email' }> {
    const alta = await this.tokens.usar('alta_email', token);
    if (alta) return { ok: true, contexto: 'alta' };

    // ¿Es la confirmación de un cambio de correo (E4)? Aquí se consolida: hasta
    // este clic la cuenta seguía con la dirección anterior.
    const cambio = await this.tokens.usar('cambio_email', token);
    if (cambio && cambio.usuarioId) {
      await this.consolidarCambioEmail(cambio.usuarioId, cambio.email);
      return { ok: true, contexto: 'cambio_email' };
    }

    // Doble clic sobre un enlace ya verificado: respuesta idempotente.
    const repetido = (await this.tokens.validarUsado('alta_email', token)) ?? (await this.tokens.validarUsado('cambio_email', token));
    if (repetido) return { ok: true, contexto: repetido.tipo === 'alta_email' ? 'alta' : 'cambio_email' };
    throw new BadRequestException('Este enlace no es válido o ya venció. Pide uno nuevo.');
  }

  // ── Flujo 3 · Credenciales desde Configuración (E4) ────────────────────────

  /**
   * Cambio de contraseña con sesión: valida la actual y revoca TODAS las
   * sesiones (D8). El frontend renueva la suya iniciando sesión con la clave
   * nueva acto seguido, así el usuario ni se entera.
   */
  async cambiarPassword(usuarioId: string, passwordActual: string, passwordNueva: string): Promise<void> {
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.id, usuarioId)).limit(1);
    if (!u) throw new UnauthorizedException('Usuario no encontrado.');
    const ok = await argon2.verify(u.passwordHash, passwordActual);
    if (!ok) throw new UnauthorizedException('La contraseña actual no es correcta.');

    const passwordHash = await argon2.hash(passwordNueva);
    await adminDb.transaction(async (tx) => {
      await tx.update(usuario).set({ passwordHash, actualizadoEn: new Date() }).where(eq(usuario.id, usuarioId));
      await tx
        .update(refreshToken)
        .set({ revocado: true })
        .where(and(eq(refreshToken.usuarioId, usuarioId), eq(refreshToken.revocado, false)));
    });
  }

  /**
   * Pide cambiar el correo de acceso: valida la contraseña (es una operación
   * sensible) y manda el enlace a la dirección NUEVA. El correo de la cuenta no
   * cambia hasta que ese enlace se abra (`consolidarCambioEmail`).
   */
  async solicitarCambioEmail(usuarioId: string, password: string, nuevoEmail: string): Promise<void> {
    const limpio = nuevoEmail.toLowerCase().trim();
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.id, usuarioId)).limit(1);
    if (!u) throw new UnauthorizedException('Usuario no encontrado.');
    const ok = await argon2.verify(u.passwordHash, password);
    if (!ok) throw new UnauthorizedException('La contraseña no es correcta.');
    if (limpio === u.email) throw new BadRequestException('Ese ya es tu correo de acceso.');

    const [enUso] = await adminDb.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, limpio)).limit(1);
    if (enUso) throw new ConflictException('Ya existe una cuenta con ese correo.');

    await this.correo.enviarCambioEmail({ usuarioId, negocioId: u.negocioId, nombre: u.nombre, nuevoEmail: limpio });
  }

  /** Dirección pendiente de confirmar del usuario, para pintar el estado en Config. */
  async cambioEmailPendiente(usuarioId: string): Promise<{ pendiente: string | null }> {
    const fila = await this.tokens.pendienteDe('cambio_email', usuarioId);
    return { pendiente: fila?.email ?? null };
  }

  /** Cancela la solicitud pendiente (el enlace enviado deja de servir). */
  async cancelarCambioEmail(usuarioId: string): Promise<void> {
    await this.tokens.cancelarDe('cambio_email', usuarioId);
  }

  /** Reenvía el enlace del cambio de correo pendiente. */
  async reenviarCambioEmail(usuarioId: string): Promise<void> {
    const fila = await this.tokens.pendienteDe('cambio_email', usuarioId);
    if (!fila) throw new BadRequestException('No tienes un cambio de correo pendiente.');
    await this.correo.reenviar(fila.id);
  }

  /**
   * Consolida el cambio: la cuenta pasa a la dirección nueva (probada con el
   * clic) y se avisa a la anterior — si alguien secuestró la sesión, el dueño
   * real se entera por su correo de siempre.
   */
  private async consolidarCambioEmail(usuarioId: string, nuevoEmail: string): Promise<void> {
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.id, usuarioId)).limit(1);
    if (!u) throw new BadRequestException('La cuenta de este enlace ya no existe.');
    const emailAnterior = u.email;
    try {
      await adminDb
        .update(usuario)
        .set({ email: nuevoEmail, emailVerificadoEn: new Date(), actualizadoEn: new Date() })
        .where(eq(usuario.id, usuarioId));
    } catch (e) {
      // Alguien registró esa dirección entre la solicitud y el clic.
      if (e instanceof Error && /usuario_email_uq|unique/i.test(e.message)) {
        throw new ConflictException('Ese correo ya está en uso por otra cuenta.');
      }
      throw e;
    }
    try {
      await this.correo.avisarCorreoCambiado({ negocioId: u.negocioId, emailAnterior, nombre: u.nombre, nuevoEmail });
    } catch (e) {
      // El cambio ya está hecho; que el aviso informativo falle no lo deshace.
      this.logger.warn(`No se pudo avisar el cambio de correo a ${emailAnterior}: ${(e as Error).message}`);
    }
  }

  // ── Flujo 2 · "¿Olvidaste tu contraseña?" (E3) ─────────────────────────────

  /**
   * Pide el enlace de restablecimiento. SIEMPRE termina bien hacia afuera
   * (D7, anti-enumeración): si el correo no tiene cuenta, simplemente no sale
   * ningún email — la respuesta al cliente es idéntica.
   */
  async olvidoPassword(email: string): Promise<void> {
    const limpio = email.toLowerCase().trim();
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.email, limpio)).limit(1);
    if (!u || !u.activo) {
      this.logger.log(`Olvido de contraseña para un correo sin cuenta activa (no se envía nada).`);
      return;
    }
    await this.correo.enviarResetPassword({ usuarioId: u.id, negocioId: u.negocioId, email: limpio, nombre: u.nombre });
  }

  /** ¿El enlace sirve? La página lo valida antes de mostrar el formulario. */
  async validarTokenReset(token: string): Promise<{ valido: boolean }> {
    return { valido: (await this.tokens.validar('reset_password', token)) !== null };
  }

  /**
   * Consuma el restablecimiento: gasta el token (un solo uso, atómico), fija la
   * contraseña nueva y REVOCA todas las sesiones del usuario (D8) — quien tenga
   * un refresh robado se queda afuera. Abrir el enlace del propio correo prueba
   * además que el correo es suyo: se estampa la verificación si faltaba.
   */
  async restablecerPassword(token: string, password: string): Promise<void> {
    const fila = await this.tokens.usar('reset_password', token);
    if (!fila || !fila.usuarioId) {
      throw new UnauthorizedException('El enlace no es válido o ya venció. Pide uno nuevo.');
    }
    const passwordHash = await argon2.hash(password);
    await adminDb.transaction(async (tx) => {
      await tx
        .update(usuario)
        .set({
          passwordHash,
          actualizadoEn: new Date(),
          emailVerificadoEn: sql`COALESCE(${usuario.emailVerificadoEn}, now())`,
        })
        .where(eq(usuario.id, fila.usuarioId!));
      await tx
        .update(refreshToken)
        .set({ revocado: true })
        .where(and(eq(refreshToken.usuarioId, fila.usuarioId!), eq(refreshToken.revocado, false)));
    });
  }
}
