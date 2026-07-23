import { randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, lt } from 'drizzle-orm';
import { runInTenantTx } from '../db/tx';
import { adminDb } from '../db/admin-client';
import { especialista as tablaEspecialista, verificacionEspecialista } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { aE164Colombia } from '../notificaciones/phone';
import { RemitenteResolver } from '../notificaciones/remitente/remitente.resolver';
import { VERIFY_PORT, type VerifyPort } from '../notificaciones/verify/verify.port';
import { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';
import { EquipoService } from './equipo.service';

/** Vida de una verificación antes de expirar. */
const TTL_MIN = 10;
/** Intentos de código antes de cancelar la verificación. */
const MAX_INTENTOS = 5;
/** Reenvíos permitidos por verificación. */
const MAX_REENVIOS = 3;
/** Espera mínima entre reenvíos. */
const COOLDOWN_S = 30;

type Especialista = typeof tablaEspecialista.$inferSelect;

/** Datos del alta que se guardan mientras se verifica el celular. */
type Borrador = {
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  sucursalIds: string[];
  /** Servicios que realizará. Vacío/ausente = todos (sin restricción). */
  servicioIds?: string[];
  email?: string;
  /** Hash argon2 — la contraseña en claro NUNCA se persiste. */
  passwordHash?: string;
};

export interface IniciarInput {
  nombre: string;
  apellidos?: string;
  celular: string;
  especialidad?: string;
  sucursalIds?: string[];
  servicioIds?: string[];
  email?: string;
  password?: string;
}

/**
 * Alta de especialista con verificación del celular (Plan-Mensajeria FASE-06, D3).
 *
 * El especialista **no se crea hasta que el código es correcto**: mientras tanto
 * solo existe un borrador en `verificacion_especialista`. Así un alta abandonada
 * no deja un registro a medias ni consume cupo del plan, y el número que quede
 * guardado está siempre verificado — que es lo que habilita los avisos de
 * FASE-07.
 *
 * El código lo gestiona Twilio Verify: **nunca lo conocemos ni lo devolvemos**.
 *
 * Excepción: en **modo sin mensajes** (sin crédito o con el interruptor de saldo
 * apagado) no hay SMS que enviar, así que el código se genera aquí, se guarda
 * hasheado en la propia fila y se le devuelve al admin para que lo vea en
 * pantalla. Deja de ser una prueba de posesión del teléfono —imposible sin
 * envío— y pasa a ser un paso de confirmación, pero el alta sigue siendo
 * posible, que es lo que importa cuando la alternativa es no poder trabajar.
 */
@Injectable()
export class VerificacionEspecialistaService {
  private readonly logger = new Logger('VerificacionEspecialista');

  constructor(
    private readonly equipo: EquipoService,
    private readonly remitente: RemitenteResolver,
    @Inject(VERIFY_PORT) private readonly verify: VerifyPort,
    private readonly estadoMensajeria: MensajeriaEstadoService,
  ) {}

  /**
   * Valida los datos, guarda el borrador y envía el código.
   *
   * El cupo del plan se comprueba **aquí** además de al crear: es preferible
   * decirle al admin que no tiene cupo antes de gastarle un SMS de Verify.
   */
  async iniciar(ctx: TenantContext, input: IniciarInput): Promise<{ verificacionId: string; expiraEn: Date; codigoVisible?: string }> {
    const nombre = input.nombre?.trim();
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    const telefono = this.normalizarCelular(input.celular);

    await this.equipo.verificarCupo(ctx);

    const borrador: Borrador = {
      nombre,
      apellidos: input.apellidos?.trim() || undefined,
      especialidad: input.especialidad?.trim() || undefined,
      sucursalIds: input.sucursalIds ?? [],
      servicioIds: input.servicioIds ?? [],
      email: input.email?.trim().toLowerCase() || undefined,
      passwordHash: input.password ? await argon2.hash(input.password) : undefined,
    };
    if (borrador.email && !borrador.passwordHash) {
      throw new BadRequestException('Para dar acceso al panel hace falta correo y contraseña.');
    }

    const expiraEn = new Date(Date.now() + TTL_MIN * 60_000);
    const local = this.estadoMensajeria.sinMensajes() ? await this.codigoLocal() : null;
    const [fila] = await runInTenantTx(ctx, (tx) =>
      tx
        .insert(verificacionEspecialista)
        .values({ negocioId: ctx.negocioId, telefono, datosBorrador: borrador, expiraEn, codigoLocalHash: local?.hash })
        .returning({ id: verificacionEspecialista.id }),
    );

    if (local) return { verificacionId: fila.id, expiraEn, codigoVisible: local.codigo };
    await this.enviarCodigo(ctx.negocioId, telefono);
    return { verificacionId: fila.id, expiraEn };
  }

  /**
   * Comprueba el código y, solo si es correcto, crea el especialista.
   *
   * Idempotente por diseño: la fila pasa a `verificado` en la misma operación,
   * así que un doble clic no crea dos especialistas.
   */
  async confirmar(ctx: TenantContext, verificacionId: string, codigo: string): Promise<Especialista> {
    const fila = await this.cargarVigente(ctx, verificacionId);

    // Si el alta empezó en modo sin mensajes, se comprueba contra el código que
    // generamos nosotros: Twilio Verify no sabe nada de esta verificación.
    const ok = fila.codigoLocalHash
      ? await argon2.verify(fila.codigoLocalHash, codigo.trim())
      : await this.verify.check(fila.telefono, codigo.trim(), this.remitente.resolver(ctx.negocioId));

    if (!ok) {
      const intentos = fila.intentos + 1;
      const agotado = intentos >= MAX_INTENTOS;
      await runInTenantTx(ctx, (tx) =>
        tx
          .update(verificacionEspecialista)
          .set({ intentos, ...(agotado ? { estado: 'cancelado' as const } : {}) })
          .where(eq(verificacionEspecialista.id, verificacionId)),
      );
      throw new BadRequestException(
        agotado
          ? 'Demasiados intentos fallidos. Vuelve a empezar el alta.'
          : `Código incorrecto. Te quedan ${MAX_INTENTOS - intentos} intentos.`,
      );
    }

    const b = fila.datosBorrador as unknown as Borrador;
    const especialista = await this.equipo.crear(ctx, b.nombre, b.especialidad, b.sucursalIds ?? [], {
      telefono: fila.telefono,
      telefonoVerificadoEn: new Date(),
      apellidos: b.apellidos,
      servicioIds: b.servicioIds,
      credenciales: b.email && b.passwordHash ? { email: b.email, passwordHash: b.passwordHash } : undefined,
    });

    await runInTenantTx(ctx, (tx) =>
      tx
        .update(verificacionEspecialista)
        .set({ estado: 'verificado' })
        .where(eq(verificacionEspecialista.id, verificacionId)),
    );
    this.logger.log(`Especialista ${especialista.id} creado con celular verificado.`);
    return especialista;
  }

  /** Reenvía el código respetando cooldown y tope de reenvíos. */
  async reenviar(ctx: TenantContext, verificacionId: string): Promise<{ reenvios: number; codigoVisible?: string }> {
    const fila = await this.cargarVigente(ctx, verificacionId);

    const esperados = Math.ceil((COOLDOWN_S * 1000 - (Date.now() - fila.ultimoEnvioEn.getTime())) / 1000);
    if (esperados > 0) {
      throw new BadRequestException(`Espera ${esperados} s para reenviar el código.`);
    }
    if (fila.reenvios >= MAX_REENVIOS) {
      throw new BadRequestException('Alcanzaste el máximo de reenvíos. Vuelve a empezar el alta.');
    }

    const reenvios = fila.reenvios + 1;
    // Se rehace el código local aunque la verificación empezara con Verify: si
    // la mensajería se apagó a mitad del alta, reenviar por SMS no llegaría a
    // ninguna parte y el admin se quedaría bloqueado.
    const local = this.estadoMensajeria.sinMensajes() ? await this.codigoLocal() : null;
    await runInTenantTx(ctx, (tx) =>
      tx
        .update(verificacionEspecialista)
        .set({ reenvios, ultimoEnvioEn: new Date(), ...(local ? { codigoLocalHash: local.hash } : {}) })
        .where(eq(verificacionEspecialista.id, verificacionId)),
    );
    if (local) return { reenvios, codigoVisible: local.codigo };
    await this.enviarCodigo(ctx.negocioId, fila.telefono);
    return { reenvios };
  }

  /** Marca como expiradas las verificaciones vencidas (limpieza, cross-tenant). */
  async expirarVencidas(): Promise<number> {
    const filas = await adminDb
      .update(verificacionEspecialista)
      .set({ estado: 'expirado' })
      .where(and(eq(verificacionEspecialista.estado, 'pendiente'), lt(verificacionEspecialista.expiraEn, new Date())))
      .returning({ id: verificacionEspecialista.id });
    return filas.length;
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  /** Código de 6 dígitos generado en casa, con su hash para guardar. */
  private async codigoLocal(): Promise<{ codigo: string; hash: string }> {
    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    return { codigo, hash: await argon2.hash(codigo) };
  }

  private async enviarCodigo(negocioId: string, telefono: string): Promise<void> {
    const perfil = this.remitente.resolver(negocioId);
    await this.verify.start(telefono, 'sms', perfil);
  }

  /** Carga la verificación y valida que siga siendo utilizable. */
  private async cargarVigente(ctx: TenantContext, id: string) {
    const [fila] = await runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(verificacionEspecialista)
        .where(and(eq(verificacionEspecialista.id, id), eq(verificacionEspecialista.negocioId, ctx.negocioId)))
        .limit(1),
    );
    if (!fila) throw new NotFoundException('Verificación no encontrada.');
    if (fila.estado === 'verificado') {
      throw new BadRequestException('Esta verificación ya se completó.');
    }
    if (fila.estado === 'cancelado') {
      throw new ForbiddenException('Verificación cancelada por demasiados intentos. Vuelve a empezar.');
    }
    if (fila.estado === 'expirado' || fila.expiraEn.getTime() < Date.now()) {
      throw new BadRequestException('El código expiró. Vuelve a empezar el alta.');
    }
    return fila;
  }

  /**
   * Normaliza a E.164 y valida que sea un celular colombiano plausible.
   * Twilio rechaza cualquier otra cosa, así que conviene fallar aquí con un
   * mensaje entendible antes de gastar el envío.
   */
  private normalizarCelular(celular: string): string {
    const e164 = aE164Colombia(celular ?? '');
    if (!/^\+573\d{9}$/.test(e164)) {
      throw new BadRequestException('El celular debe ser un móvil colombiano de 10 dígitos (empieza por 3).');
    }
    return e164;
  }
}
