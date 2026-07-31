import { createHash, randomBytes } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { adminDb } from '../db/admin-client';
import { tokenAccion, type TipoTokenAccion } from '../db/schema';

/** TTL por tipo, en minutos (Plan-Correo §2.2). */
const TTL_MIN: Record<TipoTokenAccion, number> = {
  alta_email: 24 * 60,
  reset_password: 60,
  cambio_email: 24 * 60,
  invitacion_especialista: 7 * 24 * 60,
};

const MAX_REENVIOS = 5;
const COOLDOWN_S = 60;

export type FilaTokenAccion = typeof tokenAccion.$inferSelect;

/**
 * Tokens de un solo uso para acciones autorizadas por correo (Plan-Correo, D3).
 *
 * El token en claro (32 bytes, base64url) existe solo en el retorno de
 * `crear`/`regenerar` — de ahí viaja al enlace del correo y jamás se persiste:
 * la tabla guarda su SHA-256. Todos los métodos que gastan el token son un solo
 * UPDATE condicional, así que dos clics simultáneos no lo consumen dos veces.
 *
 * Corre con `adminDb`: estos flujos ocurren sin sesión (y el del alta, antes de
 * que exista el negocio). La tabla tiene RLS que niega todo al rol de app.
 */
@Injectable()
export class TokenAccionService {
  /**
   * Crea un token nuevo e invalida los vigentes del mismo (tipo, email): nunca
   * hay dos enlaces válidos a la vez para el mismo destino.
   */
  async crear(opts: {
    tipo: TipoTokenAccion;
    email: string;
    usuarioId?: string | null;
    negocioId?: string | null;
    payload?: Record<string, string>;
  }): Promise<{ id: string; token: string }> {
    const email = opts.email.trim().toLowerCase();
    const { token, hash } = generarToken();
    return adminDb.transaction(async (tx) => {
      await tx
        .delete(tokenAccion)
        .where(and(eq(tokenAccion.tipo, opts.tipo), eq(tokenAccion.email, email), isNull(tokenAccion.consumidoEn)));
      const [fila] = await tx
        .insert(tokenAccion)
        .values({
          tipo: opts.tipo,
          tokenHash: hash,
          email,
          usuarioId: opts.usuarioId ?? null,
          negocioId: opts.negocioId ?? null,
          payload: opts.payload,
          expiraEn: expiracion(opts.tipo),
        })
        .returning({ id: tokenAccion.id });
      return { id: fila.id, token };
    });
  }

  /**
   * Reenvío: regenera el token (el enlace anterior deja de servir), extiende la
   * expiración y cuenta el intento. Cooldown de 60 s y tope de 5 reenvíos.
   */
  async regenerar(id: string): Promise<{ token: string; fila: FilaTokenAccion }> {
    const fila = await this.porId(id);
    if (!fila || fila.usadoEn || fila.consumidoEn) {
      throw new HttpException('Esta verificación ya no está activa.', HttpStatus.BAD_REQUEST);
    }
    if (fila.reenvios >= MAX_REENVIOS) {
      throw new HttpException('Alcanzaste el máximo de reenvíos. Empieza de nuevo.', HttpStatus.BAD_REQUEST);
    }
    const desdeUltimo = (Date.now() - fila.ultimoEnvio.getTime()) / 1000;
    if (desdeUltimo < COOLDOWN_S) {
      throw new HttpException('Espera un momento antes de reenviar.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const { token, hash } = generarToken();
    const [actualizada] = await adminDb
      .update(tokenAccion)
      .set({
        tokenHash: hash,
        expiraEn: expiracion(fila.tipo),
        reenvios: fila.reenvios + 1,
        ultimoEnvio: new Date(),
      })
      .where(and(eq(tokenAccion.id, id), isNull(tokenAccion.usadoEn)))
      .returning();
    if (!actualizada) throw new HttpException('Esta verificación ya no está activa.', HttpStatus.BAD_REQUEST);
    return { token, fila: actualizada };
  }

  async porId(id: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb.select().from(tokenAccion).where(eq(tokenAccion.id, id)).limit(1);
    return fila ?? null;
  }

  /** Busca por token en claro SIN gastarlo (para "¿es válido este enlace?"). */
  async validar(tipo: TipoTokenAccion, token: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .select()
      .from(tokenAccion)
      .where(and(eq(tokenAccion.tokenHash, hashDe(token)), eq(tokenAccion.tipo, tipo)))
      .limit(1);
    if (!fila || fila.usadoEn || fila.consumidoEn || fila.expiraEn < new Date()) return null;
    return fila;
  }

  /**
   * Busca un token que YA se usó (para responder idempotente al doble clic:
   * "este enlace ya cumplió", sin filtrar más). Null si no existe o no se usó.
   */
  async validarUsado(tipo: TipoTokenAccion, token: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .select()
      .from(tokenAccion)
      .where(and(eq(tokenAccion.tokenHash, hashDe(token)), eq(tokenAccion.tipo, tipo)))
      .limit(1);
    if (!fila || !fila.usadoEn) return null;
    return fila;
  }

  /**
   * Gasta el token (estampa `usado_en`) de forma atómica: null si no existe, ya
   * se usó o venció. Es el "clic en el enlace".
   */
  async usar(tipo: TipoTokenAccion, token: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .update(tokenAccion)
      .set({ usadoEn: new Date() })
      .where(
        and(
          eq(tokenAccion.tokenHash, hashDe(token)),
          eq(tokenAccion.tipo, tipo),
          isNull(tokenAccion.usadoEn),
          sql`${tokenAccion.expiraEn} > now()`,
        ),
      )
      .returning();
    return fila ?? null;
  }

  /**
   * Ejecuta la acción final (estampa `consumido_en`) de forma atómica: null si
   * ya se consumió. Solo el alta usa las dos estampas (verificar ≠ registrar).
   */
  async consumir(id: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .update(tokenAccion)
      .set({ consumidoEn: new Date() })
      .where(and(eq(tokenAccion.id, id), isNull(tokenAccion.consumidoEn)))
      .returning();
    return fila ?? null;
  }

  /** Token vigente (ni usado ni vencido) de un usuario para un tipo, si existe. */
  async pendienteDe(tipo: TipoTokenAccion, usuarioId: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .select()
      .from(tokenAccion)
      .where(
        and(
          eq(tokenAccion.tipo, tipo),
          eq(tokenAccion.usuarioId, usuarioId),
          isNull(tokenAccion.usadoEn),
          sql`${tokenAccion.expiraEn} > now()`,
        ),
      )
      .limit(1);
    return fila ?? null;
  }

  /** Cancela (borra) los tokens vigentes de un usuario para un tipo. */
  async cancelarDe(tipo: TipoTokenAccion, usuarioId: string): Promise<void> {
    await adminDb
      .delete(tokenAccion)
      .where(and(eq(tokenAccion.tipo, tipo), eq(tokenAccion.usuarioId, usuarioId), isNull(tokenAccion.usadoEn)));
  }

  /** Última invitación de un especialista concreto (en cualquier estado). */
  async invitacionDe(negocioId: string, especialistaId: string): Promise<FilaTokenAccion | null> {
    const [fila] = await adminDb
      .select()
      .from(tokenAccion)
      .where(
        and(
          eq(tokenAccion.tipo, 'invitacion_especialista'),
          eq(tokenAccion.negocioId, negocioId),
          sql`${tokenAccion.payload}->>'especialistaId' = ${especialistaId}`,
        ),
      )
      .orderBy(desc(tokenAccion.creadoEn))
      .limit(1);
    return fila ?? null;
  }

  /** Borra la invitación no usada de un especialista (p. ej. al vincularlo a otra cuenta). */
  async cancelarInvitacion(negocioId: string, especialistaId: string): Promise<void> {
    await adminDb
      .delete(tokenAccion)
      .where(
        and(
          eq(tokenAccion.tipo, 'invitacion_especialista'),
          eq(tokenAccion.negocioId, negocioId),
          sql`${tokenAccion.payload}->>'especialistaId' = ${especialistaId}`,
          isNull(tokenAccion.usadoEn),
        ),
      );
  }

  /** Invitaciones vigentes (ni usadas ni vencidas) de un negocio, para los badges del equipo. */
  async invitacionesPendientes(negocioId: string): Promise<FilaTokenAccion[]> {
    return adminDb
      .select()
      .from(tokenAccion)
      .where(
        and(
          eq(tokenAccion.tipo, 'invitacion_especialista'),
          eq(tokenAccion.negocioId, negocioId),
          isNull(tokenAccion.usadoEn),
          sql`${tokenAccion.expiraEn} > now()`,
        ),
      );
  }

  /** Purga tokens vencidos hace más de 30 días (se llama desde el tick del worker). */
  async limpiarVencidos(): Promise<number> {
    const filas = await adminDb
      .delete(tokenAccion)
      .where(lt(tokenAccion.expiraEn, sql`now() - interval '30 days'`))
      .returning({ id: tokenAccion.id });
    return filas.length;
  }
}

function generarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashDe(token) };
}

function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiracion(tipo: TipoTokenAccion): Date {
  return new Date(Date.now() + TTL_MIN[tipo] * 60_000);
}
