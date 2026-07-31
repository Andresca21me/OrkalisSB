import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import type { TipoTokenAccion } from '../db/schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { correos, type CorreoRenderizado } from './templates-email';
import { TokenAccionService, type FilaTokenAccion } from './token-accion.service';

/** Ruta pública del frontend que atiende cada tipo de enlace (Plan-Correo §2.6). */
const RUTA: Record<TipoTokenAccion, string> = {
  alta_email: '/verificar-correo',
  cambio_email: '/verificar-correo',
  reset_password: '/restablecer',
  invitacion_especialista: '/invitacion',
};

/**
 * Orquestador de los correos de acceso (Plan-Correo): crea el token de un solo
 * uso, arma el enlace con la base pública, renderiza la plantilla y encola en
 * el outbox. Los endpoints de cada flujo (auth, negocio) llaman aquí; este
 * servicio no valida reglas de negocio, solo compone y despacha.
 */
@Injectable()
export class CorreoAuthService {
  constructor(
    private readonly tokens: TokenAccionService,
    private readonly notificaciones: NotificacionesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Flujo 1 — enlace de verificación del alta. Devuelve el id para el polling del wizard. */
  async enviarVerificacionAlta(email: string, nombre: string): Promise<{ verificacionId: string }> {
    const { id, token } = await this.tokens.crear({ tipo: 'alta_email', email, payload: { nombre } });
    await this.encolar('alta_email', email, null, correos.verificacionAlta({ nombre, url: this.url('alta_email', token) }));
    return { verificacionId: id };
  }

  /** Flujo 2 — enlace de restablecimiento de contraseña. */
  async enviarResetPassword(u: { usuarioId: string; negocioId: string; email: string; nombre: string }): Promise<void> {
    const { token } = await this.tokens.crear({
      tipo: 'reset_password',
      email: u.email,
      usuarioId: u.usuarioId,
      negocioId: u.negocioId,
      payload: { nombre: u.nombre },
    });
    await this.encolar('reset_password', u.email, u.negocioId, correos.resetPassword({ nombre: u.nombre, url: this.url('reset_password', token) }));
  }

  /** Flujo 3 — verificación de la dirección NUEVA al cambiar el correo. */
  async enviarCambioEmail(u: { usuarioId: string; negocioId: string; nombre: string; nuevoEmail: string }): Promise<{ id: string }> {
    const { id, token } = await this.tokens.crear({
      tipo: 'cambio_email',
      email: u.nuevoEmail,
      usuarioId: u.usuarioId,
      negocioId: u.negocioId,
      payload: { nombre: u.nombre, nuevoEmail: u.nuevoEmail },
    });
    await this.encolar('cambio_email', u.nuevoEmail, u.negocioId, correos.cambioEmail({ nombre: u.nombre, url: this.url('cambio_email', token) }));
    return { id };
  }

  /** Flujo 3 — aviso a la dirección anterior tras consolidar el cambio (sin token). */
  async avisarCorreoCambiado(u: { negocioId: string; emailAnterior: string; nombre: string; nuevoEmail: string }): Promise<void> {
    await this.encolar('cambio_email', u.emailAnterior, u.negocioId, correos.avisoCorreoCambiado({ nombre: u.nombre, nuevoEmail: u.nuevoEmail }));
  }

  /** Flujo 4 — invitación de un especialista. Devuelve el id para reenvíos desde el panel. */
  async enviarInvitacionEspecialista(u: {
    negocioId: string;
    especialistaId: string;
    email: string;
    nombre: string;
    negocio: string;
  }): Promise<{ id: string }> {
    const { id, token } = await this.tokens.crear({
      tipo: 'invitacion_especialista',
      email: u.email,
      negocioId: u.negocioId,
      payload: { nombre: u.nombre, negocio: u.negocio, especialistaId: u.especialistaId },
    });
    await this.encolar(
      'invitacion_especialista',
      u.email,
      u.negocioId,
      correos.invitacionEspecialista({ nombre: u.nombre, negocio: u.negocio, url: this.url('invitacion_especialista', token) }),
    );
    return { id };
  }

  /**
   * Reenvío genérico: regenera el token (cooldown/tope los valida el servicio de
   * tokens) y vuelve a mandar el MISMO correo del flujo, re-renderizado con el
   * contexto guardado en `payload`.
   */
  async reenviar(id: string): Promise<void> {
    const { token, fila } = await this.tokens.regenerar(id);
    const url = this.url(fila.tipo, token);
    const p = fila.payload ?? {};
    const render: CorreoRenderizado = {
      alta_email: () => correos.verificacionAlta({ nombre: p.nombre ?? '', url }),
      reset_password: () => correos.resetPassword({ nombre: p.nombre ?? '', url }),
      cambio_email: () => correos.cambioEmail({ nombre: p.nombre ?? '', url }),
      invitacion_especialista: () => correos.invitacionEspecialista({ nombre: p.nombre ?? '', negocio: p.negocio ?? '', url }),
    }[fila.tipo]();
    await this.encolar(fila.tipo, fila.email, fila.negocioId, render);
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  private async encolar(tipo: TipoTokenAccion, email: string, negocioId: string | null, correo: CorreoRenderizado): Promise<void> {
    await this.notificaciones.encolarEmailAcceso({
      negocioId,
      email,
      asunto: correo.asunto,
      cuerpo: correo.texto,
      html: correo.html,
      tipo: tipo === 'invitacion_especialista' ? 'invitacion' : tipo,
    });
  }

  private url(tipo: TipoTokenAccion, token: string): string {
    return `${this.urlBase()}${RUTA[tipo]}?token=${token}`;
  }

  /** Base pública de los enlaces: APP_URL o, en su defecto, el primer origen CORS (dev). */
  private urlBase(): string {
    const g = <K extends keyof Env>(k: K): Env[K] => this.config.get(k, { infer: true });
    const base = g('APP_URL') ?? g('CORS_ORIGIN').split(',')[0];
    return base.trim().replace(/\/+$/, '');
  }
}
