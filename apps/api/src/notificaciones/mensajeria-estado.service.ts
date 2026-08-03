import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { adminDb } from '../db/admin-client';
import { twilioConfigurado } from './messaging-mode';

/** Foto del interruptor tal y como está en base de datos. */
export interface EstadoMensajeria {
  activa: boolean;
  presupuesto: number;
  consumidos: number;
  motivo: string | null;
  pausadaEn: Date | null;
}

/** Lo que ve la consola: el estado más el porqué de que esté operativa o no. */
export interface EstadoMensajeriaVista extends EstadoMensajeria {
  /** true solo si hay claves de Twilio Y el interruptor está encendido. */
  operativa: boolean;
  /** false = ni siquiera hay credenciales; el interruptor da igual. */
  twilioConfigurado: boolean;
  /** Segmentos que quedan; `null` cuando no hay tope declarado. */
  restantes: number | null;
}

const INICIAL: EstadoMensajeria = { activa: true, presupuesto: 0, consumidos: 0, motivo: null, pausadaEn: null };

/**
 * Canales que gastan el crédito de Twilio.
 *
 * El email va por SendGrid, con su propia cuenta y su propio saldo, así que
 * pararlo porque se acabaron los SMS sería apagar una luz que no cuesta nada —y
 * justo la que avisa al administrador de lo que está pasando.
 */
export const CANALES_DE_PAGO = ['sms', 'whatsapp'] as const;

/** ¿Este canal consume el crédito que gobierna el interruptor? */
export function canalDePago(canal: string): boolean {
  return (CANALES_DE_PAGO as readonly string[]).includes(canal);
}

/**
 * Interruptor global de la mensajería: decide si la plataforma puede gastar
 * crédito del proveedor o si entra en **modo sin mensajes**.
 *
 * **El problema que resuelve.** El crédito de Twilio es finito y lo comparten
 * todos los negocios. Cuando se agota, cada envío falla en silencio: los OTP no
 * llegan, nadie puede reservar ni dar de alta a un especialista, y la plataforma
 * queda inservible por algo ajeno a ella. En modo sin mensajes los códigos se
 * muestran en pantalla y los recordatorios dejan de encolarse; todo lo demás
 * sigue funcionando igual.
 *
 * **Se apaga por dos vías, y hacen falta las dos.** El contador de segmentos es
 * una estimación nuestra y puede desviarse (mensajes largos, reintentos, tarifas
 * distintas); el rechazo del proveedor es la verdad, pero llega tarde —cuando ya
 * han fallado envíos—. Con el contador se corta antes de quedarse a cero y con
 * el rechazo se cubre el caso de que la cuenta se agote por otro lado.
 *
 * **Se lee de memoria, no de la base.** El estado se consulta en cada OTP y en
 * cada vuelta del worker; una consulta por comprobación sería un peaje absurdo
 * para un dato que cambia dos veces al mes. La caché se refresca cada 30 s (y en
 * el acto tras cualquier escritura), así que con varias instancias todas
 * convergen en menos de medio minuto — de sobra para esto.
 */
@Injectable()
export class MensajeriaEstadoService implements OnModuleInit {
  private readonly logger = new Logger('MensajeriaEstado');
  private cache: EstadoMensajeria = { ...INICIAL };
  /** Evita repetir el mismo aviso en cada vuelta del worker (cada 5 s). */
  private avisoPausaDado = false;

  async onModuleInit(): Promise<void> {
    await this.refrescar();
    if (!this.operativa()) {
      this.logger.warn(
        twilioConfigurado()
          ? `Mensajería PAUSADA: ${this.cache.motivo ?? 'sin motivo registrado'}. Los códigos se muestran en pantalla.`
          : 'Sin claves Twilio: modo sin mensajes (los códigos se muestran en pantalla).',
      );
    }
  }

  /** Refresco periódico para que varias instancias converjan tras un cambio. */
  @Interval(30_000)
  async refrescar(): Promise<EstadoMensajeria> {
    try {
      const filas = await adminDb.execute<{
        activa: boolean;
        presupuesto: number;
        consumidos: number;
        motivo: string | null;
        pausada_en: string | Date | null;
      }>(sql`SELECT "activa", "presupuesto", "consumidos", "motivo", "pausada_en" FROM "mensajeria_saldo" WHERE "id" = 1`);
      const f = filas[0];
      // Sin fila (base recién creada) se asume encendido: el fallo seguro aquí
      // es dejar enviar, no dejar la plataforma muda por un dato que falta.
      this.cache = f
        ? {
            activa: f.activa,
            presupuesto: Number(f.presupuesto),
            consumidos: Number(f.consumidos),
            motivo: f.motivo,
            // SQL crudo devuelve la marca de tiempo como texto (el mapeo de
            // Drizzle solo actúa en el query builder), así que se normaliza aquí
            // y quien consuma el estado siempre recibe una fecha.
            pausadaEn: f.pausada_en ? new Date(f.pausada_en) : null,
          }
        : { ...INICIAL };
    } catch (e) {
      // Un fallo de base no debe apagar la mensajería: se conserva lo último
      // conocido y se reintenta en el siguiente refresco.
      this.logger.warn(`No se pudo refrescar el estado de mensajería: ${(e as Error).message}`);
    }
    return this.cache;
  }

  /**
   * ¿Está cortada la mensajería por el interruptor de saldo?
   *
   * Se mira SOLO el interruptor, no las credenciales, y la diferencia importa:
   * sin claves de Twilio la plataforma sigue "enviando" contra el `MockAdapter`,
   * que es lo que hace utilizables el entorno de desarrollo y el registro de
   * mensajes. Pausado, en cambio, no debe moverse nada.
   */
  pausada(): boolean {
    return !this.cache.activa;
  }

  /** ¿Se está gastando crédito real ahora mismo? */
  operativa(): boolean {
    return twilioConfigurado() && this.cache.activa;
  }

  /**
   * Modo sin mensajes: al destinatario no le va a llegar nada —porque está
   * pausado o porque no hay proveedor de verdad detrás—, así que los códigos hay
   * que enseñarlos en pantalla o quien reserva se queda atascado.
   */
  sinMensajes(): boolean {
    return !this.operativa();
  }

  /** Avisa una sola vez por pausa, para no inundar el log del worker. */
  avisarPausaUnaVez(mensaje: string): void {
    if (this.avisoPausaDado) return;
    this.avisoPausaDado = true;
    this.logger.warn(mensaje);
  }

  vista(): EstadoMensajeriaVista {
    const c = this.cache;
    return {
      ...c,
      operativa: this.operativa(),
      twilioConfigurado: twilioConfigurado(),
      restantes: c.presupuesto > 0 ? Math.max(0, c.presupuesto - c.consumidos) : null,
    };
  }

  /**
   * Suma segmentos ya enviados y apaga el interruptor si se agotó el
   * presupuesto. El incremento y la comprobación van en la **misma sentencia**
   * para que dos envíos simultáneos no se pisen el contador ni se salten el
   * corte.
   */
  async registrarEnvio(segmentos: number): Promise<EstadoMensajeria> {
    const n = Math.max(1, Math.trunc(segmentos) || 1);
    const filas = await adminDb.execute<{ activa: boolean; presupuesto: number; consumidos: number }>(sql`
      UPDATE "mensajeria_saldo"
      SET "consumidos" = "consumidos" + ${n},
          "activa" = CASE
            WHEN "presupuesto" > 0 AND "consumidos" + ${n} >= "presupuesto" THEN false
            ELSE "activa" END,
          "motivo" = CASE
            WHEN "presupuesto" > 0 AND "consumidos" + ${n} >= "presupuesto" AND "activa"
              THEN 'Se agotaron los ' || "presupuesto" || ' segmentos comprados.'
            ELSE "motivo" END,
          "pausada_en" = CASE
            WHEN "presupuesto" > 0 AND "consumidos" + ${n} >= "presupuesto" AND "activa" THEN now()
            ELSE "pausada_en" END,
          "actualizado_en" = now()
      WHERE "id" = 1
      RETURNING "activa", "presupuesto", "consumidos"
    `);
    const antes = this.cache.activa;
    await this.refrescar();
    if (antes && filas[0] && !filas[0].activa) {
      this.logger.warn(`Mensajería PAUSADA automáticamente: presupuesto de ${filas[0].presupuesto} segmentos agotado.`);
    }
    return this.cache;
  }

  /** Apaga el interruptor. Idempotente: pausar dos veces no cambia el motivo original. */
  async pausar(motivo: string): Promise<EstadoMensajeria> {
    await adminDb.execute(sql`
      UPDATE "mensajeria_saldo"
      SET "activa" = false,
          "motivo" = CASE WHEN "activa" THEN ${motivo} ELSE "motivo" END,
          "pausada_en" = CASE WHEN "activa" THEN now() ELSE "pausada_en" END,
          "actualizado_en" = now()
      WHERE "id" = 1
    `);
    const antes = this.cache.activa;
    await this.refrescar();
    if (antes) this.logger.warn(`Mensajería PAUSADA: ${motivo}`);
    return this.cache;
  }

  /**
   * Vuelve a encender. `presupuesto` es el crédito recién comprado: al fijarlo
   * se reinicia el contador, porque lo gastado antes pertenece a la recarga
   * anterior y arrastrarlo dejaría el interruptor apagado al instante.
   */
  async reanudar(presupuesto?: number): Promise<EstadoMensajeria> {
    const p = presupuesto == null ? null : Math.max(0, Math.trunc(presupuesto));
    await adminDb.execute(sql`
      UPDATE "mensajeria_saldo"
      SET "activa" = true,
          "presupuesto" = COALESCE(${p}, "presupuesto"),
          "consumidos" = CASE WHEN ${p}::int IS NULL THEN "consumidos" ELSE 0 END,
          "motivo" = NULL,
          "pausada_en" = NULL,
          "actualizado_en" = now()
      WHERE "id" = 1
    `);
    this.avisoPausaDado = false;
    await this.refrescar();
    this.logger.log(`Mensajería REANUDADA (presupuesto ${this.cache.presupuesto || 'sin tope'}).`);
    return this.cache;
  }
}

/**
 * ¿El proveedor rechazó el envío por dinero (saldo agotado o cuenta suspendida
 * por impago)?
 *
 * Es la señal que apaga el interruptor sin esperar al contador. Twilio no tiene
 * un único código para esto: la cuenta sin fondos acaba suspendida y responde
 * `20003` (que también es "credenciales inválidas") o marca el mensaje como
 * fallido con `30002`/`30003`. Se comparan por código y, en último término, por
 * el texto, porque un falso positivo aquí solo provoca una pausa que se deshace
 * con un clic — mientras que un falso negativo deja la plataforma enviando al
 * vacío.
 */
export function esErrorDeSaldo(e: unknown): boolean {
  if (e == null) return false;
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'number' && [20003, 20005, 30002, 30003, 30032].includes(code)) return true;
  const status = (e as { status?: number }).status;
  if (status === 402) return true;
  return /insufficient funds|account (is )?suspended|not enough (funds|balance)|upgrade (your|the) account|exceeded the .*balance/i.test(
    (e as Error)?.message ?? '',
  );
}

/**
 * ¿El fallo es propio del CANAL WhatsApp (no del mensaje ni de la cuenta)?
 *
 * Twilio reserva los códigos 63xxx para los canales de mensajería social:
 * destinatario sin WhatsApp, fuera de la ventana de 24 h sin plantilla (63016),
 * plantilla/variables inválidas, sender degradado por Meta… Ninguno se arregla
 * reintentando por el mismo canal; la respuesta correcta es **degradar a SMS**
 * (el mensaje ya viaja con su cuerpo de texto listo). Se incluyen también
 * `21910` (par From/To de canales incompatibles) y `21655` (ContentSid
 * inválido), que en la práctica solo aparecen enviando WhatsApp.
 */
export function esErrorDeWhatsapp(e: unknown): boolean {
  if (e == null) return false;
  const code = (e as { code?: unknown }).code;
  const n = typeof code === 'number' ? code : typeof code === 'string' ? Number(code) : NaN;
  if (Number.isInteger(n) && ((n >= 63000 && n <= 63999) || n === 21910 || n === 21655)) return true;
  return /whatsapp/i.test((e as Error)?.message ?? '') && /template|window|channel/i.test((e as Error)?.message ?? '');
}
