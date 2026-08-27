import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { medirSms } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { METRICAS, MetricsService } from '../observability/metrics.service';
import { AlertasService } from './alertas.service';
import { CuposService, type CanalCupo } from './cupos.service';
import { canalDePago, esErrorDeSaldo, esErrorDeWhatsapp, MensajeriaEstadoService } from './mensajeria-estado.service';
import { NOTIFICATION_ADAPTERS, type Canal, type MensajeSalida, type NotificationSender } from './notification-sender.port';
import { RemitenteResolver } from './remitente/remitente.resolver';

/** Fila reclamada del outbox (columnas en snake_case: viene de SQL crudo). */
type FilaMensaje = {
  id: string;
  /** NULL = correo de plataforma (Plan-Correo): sin cupos ni alertas de negocio. */
  negocio_id: string | null;
  canal: Canal;
  cupo_canal: CanalCupo;
  tipo: string;
  transaccional: boolean;
  destino: string;
  cuerpo: string | null;
  cuerpo_html: string | null;
  plantilla_clave: string | null;
  variables: Record<string, string> | null;
  asunto: string | null;
  intento: number;
  cita_id: string | null;
};

/** Estados que puede reportar el proveedor por webhook. */
export type EstadoProveedor = 'enviado' | 'entregado' | 'fallido';

/** Orden del ciclo de vida: un webhook nunca puede retroceder el estado. */
const RANGO: Record<string, number> = {
  pendiente: 0,
  enviando: 1,
  enviado: 2,
  entregado: 3,
  fallido: 3,
  sin_cupo: 3,
};

/**
 * Worker del outbox durable (Plan-Mensajeria FASE-02, ADR-007).
 *
 * Reclama filas `pendiente` con `FOR UPDATE SKIP LOCKED` (seguro con varias
 * réplicas), resuelve el `PerfilRemitente` del negocio (D6), despacha por el
 * adaptador del canal y cierra el ciclo de vida en la propia fila. Un fallo
 * transitorio (429/5xx/red) reintenta con backoff exponencial hasta
 * `MAX_INTENTOS`; uno permanente marca `fallido` sin reintentar.
 *
 * Corre con la conexión admin porque es una tarea de plataforma cross-tenant
 * (igual que `RecordatoriosScheduler`); el aislamiento lo garantiza el filtro
 * por `negocio_id` de cada fila.
 */
@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger('OutboxWorker');
  private static readonly LOTE = 20;
  private static readonly MAX_INTENTOS = 3;
  /** Una fila `enviando` más vieja que esto quedó colgada por un crash. */
  private static readonly TIMEOUT_ENVIANDO_MIN = 5;
  private corriendo = false;

  constructor(
    @Inject(NOTIFICATION_ADAPTERS) private readonly adapters: NotificationSender[],
    private readonly remitente: RemitenteResolver,
    private readonly cupos: CuposService,
    private readonly alertas: AlertasService,
    private readonly metrics: MetricsService,
    private readonly estado: MensajeriaEstadoService,
  ) {}

  @Interval(5_000)
  async tick(): Promise<void> {
    if (this.estado.pausada()) {
      this.estado.avisarPausaUnaVez('Mensajería pausada por saldo: SMS y WhatsApp quedan en espera (el email sigue).');
    }
    if (this.corriendo) return; // sin solapamiento dentro del mismo proceso
    this.corriendo = true;
    try {
      await this.procesarLote();
    } catch (e) {
      this.logger.error(`Ciclo del outbox falló: ${(e as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  /**
   * Procesa pendientes hasta agotarlos (uso en pruebas; equivale al antiguo
   * `JobQueue.drain`). Los que quedaron con backoff a futuro no se reclaman,
   * así que siempre termina.
   */
  async drain(maxCiclos = 20): Promise<number> {
    let total = 0;
    for (let i = 0; i < maxCiclos; i++) {
      const n = await this.procesarLote();
      if (n === 0) break;
      total += n;
    }
    return total;
  }

  /** Un ciclo: recupera colgados, reclama un lote y lo despacha. */
  async procesarLote(): Promise<number> {
    await this.recuperarColgados();
    const filas = await this.reclamar();
    for (const fila of filas) await this.procesar(fila);
    return filas.length;
  }

  // ── Reclamo y recuperación ──────────────────────────────────────────────────

  /**
   * Marca como `enviando` (e incrementa el intento) el siguiente lote listo.
   * `FOR UPDATE SKIP LOCKED` evita que dos workers tomen la misma fila.
   */
  private async reclamar(): Promise<FilaMensaje[]> {
    // Con el saldo pausado, SMS y WhatsApp no se reclaman: se quedan
    // `pendiente` y saldrán al reanudar. El email va por otro proveedor y otra
    // cuenta, así que sigue su curso — es además el canal por el que se avisa al
    // administrador de que algo pasa.
    const pausada = this.estado.pausada();
    const filas = await adminDb.execute<FilaMensaje>(sql`
      UPDATE "mensaje" SET "estado" = 'enviando', "intento" = "intento" + 1, "actualizado_en" = now()
      WHERE "id" IN (
        SELECT "id" FROM "mensaje"
        WHERE "estado" = 'pendiente' AND "proximo_intento_en" <= now()
          AND (NOT ${pausada} OR "canal" NOT IN ('sms', 'whatsapp'))
        ORDER BY "creado_en"
        LIMIT ${OutboxWorker.LOTE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "negocio_id", "canal", "cupo_canal", "tipo", "transaccional",
                "destino", "cuerpo", "cuerpo_html", "plantilla_clave", "variables", "asunto", "intento", "cita_id"
    `);
    return [...filas];
  }

  /** Devuelve a `pendiente` las filas que quedaron en `enviando` tras un crash. */
  private async recuperarColgados(): Promise<void> {
    const filas = await adminDb.execute<{ id: string }>(sql`
      UPDATE "mensaje" SET "estado" = 'pendiente', "actualizado_en" = now()
      WHERE "estado" = 'enviando'
        AND "actualizado_en" < now() - (${OutboxWorker.TIMEOUT_ENVIANDO_MIN} * interval '1 minute')
      RETURNING "id"
    `);
    if (filas.length) this.logger.warn(`Recuperados ${filas.length} mensajes colgados en 'enviando'.`);
  }

  // ── Despacho de una fila ────────────────────────────────────────────────────

  private async procesar(fila: FilaMensaje): Promise<void> {
    try {
      // Caducidad: un mensaje ligado a una cita que ya empezó hace rato no se
      // envía. Pasa con los que esperaron una pausa de saldo — confirmar o
      // recordar una cita pasada solo confunde al cliente y quema crédito. El
      // margen de 15 min protege a los walk-ins registrados sobre la hora.
      if (fila.cita_id) {
        const [caducada] = await adminDb.execute<{ id: string }>(sql`
          SELECT "id" FROM "cita" WHERE "id" = ${fila.cita_id} AND "inicio" < now() - interval '15 minutes'
        `);
        if (caducada) {
          await this.marcarFallido(fila, 'Caducado: la cita ya había pasado cuando se pudo enviar.');
          return;
        }
      }

      // Política de cupo (ADR-009): el marketing se DETIENE al agotarse; lo
      // transaccional (OTP, confirmaciones, recordatorios) se envía igual.
      // Los correos de plataforma (negocio_id NULL, Plan-Correo) no tienen plan
      // al que cargarles cupo: pasan de largo por toda la contabilidad.
      const cupo = fila.negocio_id ? await this.cupos.verificar(fila.negocio_id, fila.cupo_canal) : { dentroDeCupo: true };
      if (!cupo.dentroDeCupo && !fila.transaccional) {
        // Segunda barrera: el cupo pudo agotarse entre el encolado y el envío.
        await this.marcarSinCupo(fila, `Cupo '${fila.cupo_canal}' agotado: marketing detenido.`);
        return;
      }
      const sobreCupo = !cupo.dentroDeCupo;
      if (sobreCupo) {
        this.logger.warn(`Cupo '${fila.cupo_canal}' agotado (negocio ${fila.negocio_id}): se envía igual (transaccional).`);
      }

      const adapter = this.adapters.find((a) => a.soporta(fila.canal));
      if (!adapter) {
        await this.marcarFallido(fila, `Sin adaptador para el canal '${fila.canal}'.`);
        return;
      }

      // Sin negocio, el remitente es el de plataforma con una clave fija de caché.
      const perfil = this.remitente.resolver(fila.negocio_id ?? 'plataforma');
      const { proveedorId } = await adapter.enviar(this.aMensajeSalida(fila), perfil);

      await adminDb.execute(sql`
        UPDATE "mensaje"
        SET "estado" = 'enviado', "enviado_en" = now(), "actualizado_en" = now(),
            "proveedor" = ${adapter.proveedor}, "proveedor_id" = ${proveedorId},
            "sobre_cupo" = ${sobreCupo}, "error" = NULL
        WHERE "id" = ${fila.id}
      `);
      // El consumo se suma SOLO tras el envío definitivo (nunca por intento
      // fallido), con el canal de cupo real del mensaje.
      // Saldo de PLATAFORMA (distinto del cupo del plan, que es por negocio):
      // se descuentan segmentos, que es la unidad que factura el proveedor. El
      // `MockAdapter` no cuesta nada, así que no descuenta.
      if (adapter.proveedor !== 'mock') await this.estado.registrarEnvio(segmentosDe(fila));
      this.metrics.incPor(METRICAS.mensajesEnviados, fila.canal);
      this.metrics.inc(METRICAS.notificacionesEnviadas); // compatibilidad
      if (fila.negocio_id) {
        const trasEnviar = await this.cupos.registrar(fila.negocio_id, fila.cupo_canal);
        await this.alertas.avisarCupo(fila.negocio_id, trasEnviar);
      }
    } catch (e) {
      await this.tratarError(fila, e as Error);
    }
  }

  private aMensajeSalida(fila: FilaMensaje): MensajeSalida {
    return {
      canal: fila.canal,
      to: fila.destino,
      cuerpo: fila.cuerpo ?? undefined,
      // FASE-05 resolverá `plantilla_clave` → Content SID por negocio/idioma.
      plantillaContentSid: fila.plantilla_clave ?? undefined,
      variables: fila.variables ?? undefined,
      asunto: fila.asunto ?? undefined,
      html: fila.cuerpo_html ?? undefined,
    };
  }

  /** Transitorio y con intentos disponibles → backoff; si no → fallido. */
  private async tratarError(fila: FilaMensaje, e: Error): Promise<void> {
    const motivo = e.message ?? String(e);
    // Fallo propio del canal WhatsApp (63xxx: sin cuenta de WhatsApp, fuera de
    // ventana, plantilla inválida…): reintentar por el mismo canal no sirve y
    // NO es un problema de saldo — se degrada a SMS en el acto. El cuerpo de
    // texto ya viaja en la fila, así que el reenvío no re-renderiza nada.
    // Va ANTES del chequeo de saldo para que un 63xxx jamás pause la plataforma.
    if (fila.canal === 'whatsapp' && esErrorDeWhatsapp(e)) {
      await this.degradarASms(fila, `WhatsApp rechazado: ${motivo}`);
      return;
    }
    // Sin crédito no hay reintento que valga: se apaga el interruptor para que
    // el resto de la cola no siga estrellándose contra el mismo muro, y la
    // plataforma pasa a mostrar los códigos en pantalla. Solo aplica a los
    // canales que gastan el crédito Twilio: un fallo de SendGrid (email) no
    // debe apagar los SMS de todo el mundo.
    if (canalDePago(fila.canal) && esErrorDeSaldo(e)) {
      await this.estado.pausar(`El proveedor rechazó el envío por saldo: ${motivo}`);
      await this.marcarFallido(fila, motivo);
      return;
    }
    if (esTransitorio(e) && fila.intento < OutboxWorker.MAX_INTENTOS) {
      const segundos = 30 * 2 ** (fila.intento - 1); // 30s, 60s, 120s
      await adminDb.execute(sql`
        UPDATE "mensaje"
        SET "estado" = 'pendiente', "error" = ${motivo}, "actualizado_en" = now(),
            "proximo_intento_en" = now() + (${segundos} * interval '1 second')
        WHERE "id" = ${fila.id}
      `);
      this.metrics.incPor(METRICAS.mensajesReintentados, fila.canal);
      this.logger.warn(`Mensaje ${fila.id} reintenta en ${segundos}s (intento ${fila.intento}): ${motivo}`);
      return;
    }
    await this.marcarFallido(fila, motivo);
  }

  /**
   * Degrada una fila WhatsApp a SMS y la devuelve a `pendiente` para que el
   * worker la reenvíe. Es el **fallback de canal en tiempo de envío**: el de
   * tiempo de encolado (sin sender/plantilla/cupo) vive en `RouterCanalService`.
   * `cupo_canal` pasa a 'sms' para que el consumo se impute al canal real; la
   * plantilla y sus variables se limpian (el adapter de SMS usa `cuerpo`, que
   * toda fila WhatsApp lleva renderizado desde el encolado).
   */
  private async degradarASms(fila: { id: string }, motivo: string): Promise<void> {
    await adminDb.execute(sql`
      UPDATE "mensaje"
      SET "canal" = 'sms', "cupo_canal" = 'sms', "plantilla_clave" = NULL, "variables" = NULL,
          "canal_preferido" = 'whatsapp', "motivo_fallback" = ${motivo}, "error" = ${motivo},
          "estado" = 'pendiente', "actualizado_en" = now(), "proximo_intento_en" = now()
      WHERE "id" = ${fila.id}
    `);
    this.metrics.incPor(METRICAS.mensajesDegradados, 'whatsapp');
    this.logger.warn(`Mensaje ${fila.id} degradado a SMS: ${motivo}`);
  }

  private async marcarFallido(fila: FilaMensaje, motivo: string): Promise<void> {
    await adminDb.execute(sql`
      UPDATE "mensaje" SET "estado" = 'fallido', "error" = ${motivo}, "actualizado_en" = now()
      WHERE "id" = ${fila.id}
    `);
    this.metrics.incPor(METRICAS.mensajesFallidos, fila.canal);
    this.logger.error(`Mensaje ${fila.id} fallido: ${motivo}`);
  }

  private async marcarSinCupo(fila: FilaMensaje, motivo: string): Promise<void> {
    await adminDb.execute(sql`
      UPDATE "mensaje" SET "estado" = 'sin_cupo', "error" = ${motivo}, "actualizado_en" = now()
      WHERE "id" = ${fila.id}
    `);
    this.metrics.incPor(METRICAS.mensajesSinCupo, fila.canal);
    this.logger.warn(`Mensaje ${fila.id} no enviado: ${motivo}`);
  }

  // ── Estado reportado por el proveedor (webhook) ─────────────────────────────

  /**
   * Aplica el estado real de entrega a la fila del `proveedorId`. **Idempotente**:
   * el mismo evento dos veces no cambia nada y un evento tardío nunca retrocede
   * el ciclo de vida (se compara el rango del estado).
   *
   * **Re-envío tras rechazo del operador.** Que Twilio acepte el SMS no
   * garantiza nada: el operador móvil puede tirarlo después (filtrado 30007,
   * congestión) y avisarlo por este webhook. Antes eso era terminal — el
   * cliente se quedaba sin su confirmación "a veces sí, a veces no". Ahora un
   * mensaje transaccional con intentos disponibles vuelve a `pendiente` y el
   * worker lo reenvía; el tope de `MAX_INTENTOS` (que crece en cada reclamo)
   * acota el gasto si el operador lo rechaza siempre. Si el rechazado era un
   * **WhatsApp**, el reenvío es directamente **por SMS** (degradar de canal):
   * repetir contra Meta el mismo rechazo solo quema intentos.
   */
  async aplicarEstadoProveedor(
    proveedorId: string,
    nuevo: EstadoProveedor,
    error?: string,
    errorCode?: number,
  ): Promise<'aplicado' | 'ignorado' | 'desconocido'> {
    const [fila] = await adminDb.execute<{ id: string; estado: string; canal: Canal; transaccional: boolean; intento: number }>(sql`
      SELECT "id", "estado", "canal", "transaccional", "intento" FROM "mensaje" WHERE "proveedor_id" = ${proveedorId} LIMIT 1
    `);
    if (!fila) return 'desconocido';
    if (RANGO[nuevo] <= RANGO[fila.estado]) return 'ignorado';

    if (nuevo === 'fallido' && fila.transaccional && fila.intento < OutboxWorker.MAX_INTENTOS) {
      const motivo = error ?? 'el operador no entregó el mensaje';
      // WhatsApp rechazado tras la aceptación (la mayoría de los fallos de Meta
      // llegan por aquí, no como excepción): reintentarlo por WhatsApp repite
      // el mismo rechazo — se degrada a SMS. El código (63016, 63024…) queda en
      // el motivo para el registro del admin.
      if (fila.canal === 'whatsapp') {
        await this.degradarASms(fila, errorCode ? `WhatsApp no entregado (código ${errorCode}): ${motivo}` : `WhatsApp no entregado: ${motivo}`);
        return 'aplicado';
      }
      await adminDb.execute(sql`
        UPDATE "mensaje"
        SET "estado" = 'pendiente', "error" = ${motivo}, "actualizado_en" = now(),
            "proximo_intento_en" = now() + interval '90 seconds'
        WHERE "id" = ${fila.id}
      `);
      this.metrics.incPor(METRICAS.mensajesReintentados, fila.canal);
      this.logger.warn(`Mensaje ${fila.id} no entregado por el operador; se reenvía (intento ${fila.intento}): ${motivo}`);
      return 'aplicado';
    }

    await adminDb.execute(sql`
      UPDATE "mensaje"
      SET "estado" = ${nuevo}::estado_mensaje, "actualizado_en" = now(),
          "entregado_en" = CASE WHEN ${nuevo} = 'entregado' THEN now() ELSE "entregado_en" END,
          "error" = ${error ?? null}
      WHERE "id" = ${fila.id}
    `);
    if (nuevo === 'entregado') this.metrics.incPor(METRICAS.mensajesEntregados, fila.canal);
    if (nuevo === 'fallido') this.metrics.incPor(METRICAS.mensajesFallidos, fila.canal);
    return 'aplicado';
  }
}

/**
 * ¿El fallo merece reintento? Sí para límite de tasa (429), errores del
 * proveedor (5xx) y problemas de red; no para credenciales, número inválido o
 * plantilla rechazada — reintentarlos solo gasta cupo.
 */
/**
 * Segmentos que factura el proveedor por esta fila.
 *
 * Un SMS no es una unidad de cobro: por encima de 160 caracteres (o de 70 si
 * lleva tildes en `á í ó ú`, que están fuera del GSM-7) se parte en varios y se
 * cobra cada trozo. Contar mensajes en vez de segmentos subestimaría el gasto
 * justo en los mensajes largos, que son los caros.
 *
 * WhatsApp y email no se cobran por segmento; se apuntan como 1 para que el
 * contador siga siendo una cota superior del gasto en SMS.
 */
function segmentosDe(fila: FilaMensaje): number {
  if (fila.canal !== 'sms' || !fila.cuerpo) return 1;
  return medirSms(fila.cuerpo).segmentos || 1;
}

export function esTransitorio(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string') {
    return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(code);
  }
  // Sin señal clara (p. ej. timeout del SDK): se reintenta, el tope lo acota.
  return /timeout|socket hang up|network/i.test((e as Error)?.message ?? '');
}
