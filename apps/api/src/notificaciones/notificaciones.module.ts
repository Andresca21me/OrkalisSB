import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { MensajeriaEstadoService } from './mensajeria-estado.service';
import { AlertasService } from './alertas.service';
import { PlantillasService } from './plantillas.service';
import { MensajesService } from './mensajes.service';
import { RouterCanalService } from './router-canal.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';
import { OutboxWorker } from './outbox.worker';
import { TwilioWebhooksController } from './webhooks.controller';
import { NOTIFICATION_ADAPTERS, type NotificationSender } from './notification-sender.port';
import { RemitenteResolver } from './remitente/remitente.resolver';
import { TwilioSmsAdapter } from './adapters/twilio-sms.adapter';
import { TwilioWhatsappAdapter } from './adapters/twilio-whatsapp.adapter';
import { SendgridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { MockAdapter } from './adapters/mock.adapter';

/**
 * Notificaciones multicanal (Plan-Mensajeria FASE-01, ADR-007). Los adaptadores
 * se registran por entorno: Twilio (SMS/WhatsApp) y SendGrid (email) si hay
 * claves; el `MockAdapter` va SIEMPRE al final como fallback (soporta todos los
 * canales). El `OutboxWorker` despacha por `soporta(canal)` y resuelve el
 * `PerfilRemitente` con `RemitenteResolver` (D6). Cambiar de proveedor o añadir
 * un canal no toca el dominio, solo este factory.
 *
 * FASE-02: el envío ya no vive en una cola en memoria — `NotificacionesService`
 * escribe en el outbox durable (`mensaje`), el `OutboxWorker` despacha con
 * reintentos y `TwilioWebhooksController` recibe el estado real de entrega.
 */
@Module({
  controllers: [NotificacionesController, TwilioWebhooksController],
  providers: [
    JobQueue,
    CuposService,
    MensajeriaEstadoService,
    AlertasService,
    PlantillasService,
    MensajesService,
    RouterCanalService,
    NotificacionesService,
    OutboxWorker,
    RecordatoriosScheduler,
    RemitenteResolver,
    {
      provide: NOTIFICATION_ADAPTERS,
      useFactory: (config: ConfigService<Env, true>): NotificationSender[] => {
        const g = <K extends keyof Env>(k: K): Env[K] => config.get(k, { infer: true });
        const twilioOk = Boolean(g('TWILIO_ACCOUNT_SID') && g('TWILIO_AUTH_TOKEN') && (g('TWILIO_FROM_NUMBER') || g('TWILIO_MESSAGING_SERVICE_SID')));
        const statusCb = g('TWILIO_STATUS_CALLBACK_URL');
        const adapters: NotificationSender[] = [];
        if (twilioOk) {
          adapters.push(new TwilioSmsAdapter(statusCb));
          if (g('TWILIO_WHATSAPP_FROM')) adapters.push(new TwilioWhatsappAdapter(statusCb));
        }
        const sgKey = g('SENDGRID_API_KEY');
        const mailFrom = g('MAIL_FROM');
        if (sgKey && mailFrom) adapters.push(new SendgridEmailAdapter(sgKey, mailFrom));
        adapters.push(new MockAdapter()); // fallback SIEMPRE al final
        const log = new Logger('Notificaciones');
        if (!twilioOk) log.warn('Sin claves Twilio: SMS/WhatsApp en MockAdapter (no se envía real).');
        else log.log(`Adaptadores activos: ${adapters.map((a) => a.constructor.name).join(', ')}`);
        return adapters;
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificacionesService, OutboxWorker, AlertasService, PlantillasService, JobQueue, CuposService, MensajeriaEstadoService, RemitenteResolver],
})
export class NotificacionesModule {}
