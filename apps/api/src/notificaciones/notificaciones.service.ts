import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobQueue } from './job-queue';
import { NOTIFICATION_SENDER, type NotificationSender } from './notification-sender.port';
import { CuposService, type CanalCupo } from './cupos.service';
import { plantillas, type DatosCita } from './templates';
import { METRICAS, MetricsService } from '../observability/metrics.service';

interface DatosCitaSer {
  sucursalNombre: string;
  especialistaNombre: string;
  servicioNombre?: string;
  inicio: string; // ISO
}

/**
 * Orquestador de notificaciones (FASE-11). Encola (no bloquea) y los workers
 * envían vía el puerto `NotificationSender`, contabilizando cupos y aplicando
 * la política de exceso. El dominio solo llama a los métodos `encolar*`.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger('Notificaciones');

  constructor(
    private readonly queue: JobQueue,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    private readonly cupos: CuposService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.queue.registrar('enviar-otp', (p) => this.hOtp(p as { negocioId: string; telefono: string; codigo: string }));
    this.queue.registrar('enviar-confirmacion', (p) => this.hCita(p, 'confirmacion'));
    this.queue.registrar('enviar-recordatorio', (p) => this.hCita(p, 'recordatorio'));
    this.queue.registrar('enviar-aviso', (p) => this.hCita(p, 'aviso'));
    this.queue.registrar('exportacion-pesada', (p) => this.hExportacion(p));
  }

  // ── API de encolado (la usa el dominio) ─────────────────────────────────────
  encolarOtp(negocioId: string, telefono: string, codigo: string): void {
    this.queue.enqueue('enviar-otp', { negocioId, telefono, codigo });
  }
  encolarConfirmacion(negocioId: string, telefono: string, datos: DatosCita): void {
    this.queue.enqueue('enviar-confirmacion', this.payload(negocioId, telefono, datos));
  }
  encolarRecordatorio(negocioId: string, telefono: string, datos: DatosCita): void {
    this.queue.enqueue('enviar-recordatorio', this.payload(negocioId, telefono, datos));
  }
  encolarAviso(negocioId: string, telefono: string, datos: DatosCita): void {
    this.queue.enqueue('enviar-aviso', this.payload(negocioId, telefono, datos));
  }
  encolarExportacion(payload: Record<string, unknown>): void {
    this.queue.enqueue('exportacion-pesada', payload);
  }

  // ── Handlers (corren en el worker) ──────────────────────────────────────────
  private async hOtp(p: { negocioId: string; telefono: string; codigo: string }): Promise<void> {
    await this.enviarSms(p.negocioId, 'sms', true, p.telefono, plantillas.otp(p.codigo));
  }

  private async hCita(payload: unknown, tipo: 'confirmacion' | 'recordatorio' | 'aviso'): Promise<void> {
    const p = payload as { negocioId: string; telefono: string; datos: DatosCitaSer };
    const datos: DatosCita = { ...p.datos, inicio: new Date(p.datos.inicio) };
    const mensaje = plantillas[tipo](datos);
    await this.enviarSms(p.negocioId, 'sms', true, p.telefono, mensaje);
  }

  private async hExportacion(payload: unknown): Promise<void> {
    // v1: la generación CSV es sincrónica (FASE-10). El PDF pesado se integrará
    // con un generador real aquí; por ahora se registra el job.
    this.logger.log(`Exportación procesada: ${JSON.stringify(payload)}`);
  }

  /**
   * Envía un SMS con política de cupo (ADR-009): si se agotó el cupo del canal,
   * el marketing se DETIENE (no transaccional); utility/confirmaciones/
   * recordatorios se envían igual y se avisa al admin (no se cortan).
   */
  private async enviarSms(
    negocioId: string,
    canal: CanalCupo,
    transaccional: boolean,
    to: string,
    mensaje: string,
  ): Promise<void> {
    const estado = await this.cupos.verificar(negocioId, canal);
    if (!estado.dentroDeCupo) {
      if (!transaccional) {
        this.logger.warn(`Cupo '${canal}' agotado (negocio ${negocioId}): marketing detenido.`);
        return;
      }
      this.logger.warn(`Cupo '${canal}' agotado (negocio ${negocioId}): se envía igual (transaccional).`);
    }
    await this.sender.enviarSms(to, mensaje);
    await this.cupos.registrar(negocioId, canal);
    this.metrics.inc(METRICAS.notificacionesEnviadas);
  }

  private payload(negocioId: string, telefono: string, datos: DatosCita) {
    return {
      negocioId,
      telefono,
      datos: { ...datos, inicio: datos.inicio.toISOString() } satisfies DatosCitaSer,
    };
  }
}
