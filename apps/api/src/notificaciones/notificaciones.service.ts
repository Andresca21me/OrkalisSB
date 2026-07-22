import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { runInTenantTx } from '../db/tx';
import { mensaje } from '../db/schema';
import { JobQueue } from './job-queue';
import type { Canal } from './notification-sender.port';
import { CuposService, type CanalCupo } from './cupos.service';
import { PlantillasService } from './plantillas.service';
import { plantillas, type DatosCita } from './templates';
import { METRICAS, MetricsService } from '../observability/metrics.service';

/** Tipos de mensaje que emite el dominio (crece por fase). */
export type TipoMensaje = 'otp' | 'confirmacion' | 'recordatorio' | 'aviso' | 'marketing' | 'alerta';

/** Datos comunes de trazabilidad de un mensaje encolado. */
interface Contexto {
  sucursalId?: string | null;
  citaId?: string | null;
}

/**
 * Orquestador de notificaciones (Plan-Mensajeria FASE-02).
 *
 * `encolar*` **persiste** una fila en el outbox (`mensaje`, estado `pendiente`)
 * dentro del tenant y retorna: no habla con el proveedor ni bloquea la petición
 * (RNF-002). El envío real, los reintentos y la contabilidad de cupos corren en
 * el `OutboxWorker`. Como la cola es durable, reiniciar el proceso ya no pierde
 * mensajes. El dominio sigue viendo solo los métodos `encolar*`.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger('Notificaciones');

  constructor(
    private readonly queue: JobQueue,
    private readonly cupos: CuposService,
    private readonly plantillas: PlantillasService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    // La mensajería ya no usa la cola en memoria; queda para jobs no-mensajería.
    this.queue.registrar('exportacion-pesada', (p) => this.hExportacion(p));
  }

  // ── API de encolado (la usa el dominio) ─────────────────────────────────────
  async encolarOtp(negocioId: string, telefono: string, codigo: string, ctx: Contexto = {}): Promise<void> {
    await this.encolar(negocioId, {
      tipo: 'otp',
      canal: 'sms',
      cupoCanal: 'sms',
      destino: telefono,
      cuerpo: plantillas.otp(codigo),
      ...ctx,
    });
  }

  async encolarConfirmacion(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'confirmacion', ctx);
  }

  async encolarRecordatorio(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'recordatorio', ctx);
  }

  async encolarAviso(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'aviso', ctx);
  }

  /**
   * Mensaje de marketing (NO transaccional): sujeto a bloqueo duro por cupo
   * (D2). Es la costura que usarán las campañas de FASE-05 en adelante.
   */
  async encolarMarketing(negocioId: string, telefono: string, cuerpo: string, ctx: Contexto = {}): Promise<void> {
    await this.encolar(negocioId, {
      tipo: 'marketing',
      canal: 'sms',
      cupoCanal: 'sms',
      transaccional: false,
      destino: telefono,
      cuerpo,
      ...ctx,
    });
  }

  /** Aviso por email al administrador (sobreconsumo de cupos, FASE-03). */
  async encolarAlerta(negocioId: string, email: string, asunto: string, cuerpo: string): Promise<void> {
    await this.encolar(negocioId, {
      tipo: 'alerta',
      canal: 'email',
      cupoCanal: 'email',
      destino: email,
      asunto,
      cuerpo,
    });
  }

  encolarExportacion(payload: Record<string, unknown>): void {
    this.queue.enqueue('exportacion-pesada', payload);
  }

  // ── Interno ─────────────────────────────────────────────────────────────────
  private async encolarCita(
    negocioId: string,
    telefono: string,
    datos: DatosCita,
    tipo: 'confirmacion' | 'recordatorio' | 'aviso',
    ctx: Contexto,
  ): Promise<void> {
    // El texto se resuelve AQUÍ (plantilla del negocio o default de plataforma)
    // y se guarda ya renderizado en el outbox: editar la plantilla después no
    // reescribe lo que ya estaba en cola.
    // v1: el canal por evento (SMS vs WhatsApp) llega en FASE-05; aquí SMS.
    const cuerpo = await this.plantillas.cuerpoSms(negocioId, tipo, datos);
    await this.encolar(negocioId, {
      tipo,
      canal: 'sms',
      cupoCanal: 'sms',
      destino: telefono,
      cuerpo,
      ...ctx,
    });
  }

  /**
   * Inserta la fila del outbox. Un fallo aquí NO debe tumbar la operación de
   * negocio que la originó (la reserva ya está confirmada): se registra y sigue.
   *
   * Política de cupo D2 aplicada **antes de encolar**: el marketing sin cupo
   * entra directo como `sin_cupo` (queda auditado, pero el worker no lo
   * reclamará nunca); lo transaccional siempre se encola y ya decidirá el worker.
   */
  private async encolar(
    negocioId: string,
    fila: {
      tipo: TipoMensaje;
      canal: Canal;
      cupoCanal: CanalCupo;
      destino: string;
      cuerpo?: string;
      asunto?: string;
      plantillaClave?: string;
      variables?: Record<string, string>;
      transaccional?: boolean;
      sucursalId?: string | null;
      citaId?: string | null;
    },
  ): Promise<void> {
    const transaccional = fila.transaccional ?? true;
    try {
      const sinCupo = !transaccional && !(await this.cupos.verificar(negocioId, fila.cupoCanal)).dentroDeCupo;
      await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
        tx.insert(mensaje).values({
          negocioId,
          sucursalId: fila.sucursalId ?? null,
          canal: fila.canal,
          cupoCanal: fila.cupoCanal,
          tipo: fila.tipo,
          transaccional,
          destino: fila.destino,
          cuerpo: fila.cuerpo,
          asunto: fila.asunto,
          plantillaClave: fila.plantillaClave,
          variables: fila.variables,
          citaId: fila.citaId ?? null,
          ...(sinCupo ? { estado: 'sin_cupo' as const, error: `Cupo '${fila.cupoCanal}' agotado: marketing detenido.` } : {}),
        }),
      );
      if (sinCupo) {
        this.metrics.incPor(METRICAS.mensajesSinCupo, fila.canal);
        this.logger.warn(`Marketing no encolado por cupo '${fila.cupoCanal}' agotado (negocio ${negocioId}).`);
      } else {
        this.metrics.incPor(METRICAS.mensajesEncolados, fila.canal);
      }
    } catch (e) {
      this.logger.error(`No se pudo encolar '${fila.tipo}' (negocio ${negocioId}): ${(e as Error).message}`);
    }
  }

  private async hExportacion(payload: unknown): Promise<void> {
    // v1: la generación CSV es sincrónica (FASE-10). El PDF pesado se integrará
    // con un generador real aquí; por ahora se registra el job.
    this.logger.log(`Exportación procesada: ${JSON.stringify(payload)}`);
  }
}
