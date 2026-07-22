import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobQueue } from './job-queue';
import { NOTIFICATION_ADAPTERS, type MensajeSalida, type NotificationSender } from './notification-sender.port';
import { RemitenteResolver } from './remitente/remitente.resolver';
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
    @Inject(NOTIFICATION_ADAPTERS) private readonly adapters: NotificationSender[],
    private readonly remitente: RemitenteResolver,
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
    await this.despachar(p.negocioId, 'sms', true, { canal: 'sms', to: p.telefono, cuerpo: plantillas.otp(p.codigo) });
  }

  private async hCita(payload: unknown, tipo: 'confirmacion' | 'recordatorio' | 'aviso'): Promise<void> {
    const p = payload as { negocioId: string; telefono: string; datos: DatosCitaSer };
    const datos: DatosCita = { ...p.datos, inicio: new Date(p.datos.inicio) };
    const cuerpo = plantillas[tipo](datos);
    // v1: el canal por evento (SMS vs WhatsApp) llega en FASE-05; aquí SMS por defecto.
    await this.despachar(p.negocioId, 'sms', true, { canal: 'sms', to: p.telefono, cuerpo });
  }

  private async hExportacion(payload: unknown): Promise<void> {
    // v1: la generación CSV es sincrónica (FASE-10). El PDF pesado se integrará
    // con un generador real aquí; por ahora se registra el job.
    this.logger.log(`Exportación procesada: ${JSON.stringify(payload)}`);
  }

  /**
   * Despacha un `MensajeSalida` con política de cupo (ADR-009): si se agotó el
   * cupo del canal, el marketing se DETIENE (no transaccional); utility/
   * confirmaciones/recordatorios se envían igual y se avisa al admin (no se
   * cortan). Resuelve el `PerfilRemitente` (D6) y elige el adaptador cuyo
   * `soporta(canal)` es true (el MockAdapter queda de fallback).
   */
  private async despachar(
    negocioId: string,
    cupoCanal: CanalCupo,
    transaccional: boolean,
    mensaje: MensajeSalida,
  ): Promise<void> {
    const estado = await this.cupos.verificar(negocioId, cupoCanal);
    if (!estado.dentroDeCupo) {
      if (!transaccional) {
        this.logger.warn(`Cupo '${cupoCanal}' agotado (negocio ${negocioId}): marketing detenido.`);
        return;
      }
      this.logger.warn(`Cupo '${cupoCanal}' agotado (negocio ${negocioId}): se envía igual (transaccional).`);
    }
    const adapter = this.adapters.find((a) => a.soporta(mensaje.canal));
    if (!adapter) {
      this.logger.error(`Sin adaptador para el canal '${mensaje.canal}'.`);
      return;
    }
    const perfil = this.remitente.resolver(negocioId);
    await adapter.enviar(mensaje, perfil);
    await this.cupos.registrar(negocioId, cupoCanal);
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
