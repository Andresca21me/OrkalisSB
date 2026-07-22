import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';
import { NOTIFICATION_ADAPTERS, type NotificationSender } from './notification-sender.port';
import { RemitenteResolver } from './remitente/remitente.resolver';
import { TwilioSmsAdapter } from './adapters/twilio-sms.adapter';
import { TwilioWhatsappAdapter } from './adapters/twilio-whatsapp.adapter';
import { SendgridEmailAdapter } from './adapters/sendgrid-email.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { VERIFY_PORT, type VerifyPort } from './verify/verify.port';
import { TwilioVerifyAdapter } from './verify/twilio-verify.adapter';
import { MockVerifyAdapter } from './verify/mock-verify.adapter';

/**
 * Notificaciones multicanal (Plan-Mensajeria FASE-01, ADR-007). Los adaptadores
 * se registran por entorno: Twilio (SMS/WhatsApp) y SendGrid (email) si hay
 * claves; el `MockAdapter` va SIEMPRE al final como fallback (soporta todos los
 * canales). El `NotificacionesService` despacha por `soporta(canal)` y resuelve
 * el `PerfilRemitente` con `RemitenteResolver` (D6). Cambiar de proveedor o
 * añadir un canal no toca el dominio, solo este factory.
 */
@Module({
  controllers: [NotificacionesController],
  providers: [
    JobQueue,
    CuposService,
    NotificacionesService,
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
    {
      provide: VERIFY_PORT,
      useFactory: (config: ConfigService<Env, true>): VerifyPort => {
        const g = <K extends keyof Env>(k: K): Env[K] => config.get(k, { infer: true });
        const ok = Boolean(g('TWILIO_ACCOUNT_SID') && g('TWILIO_AUTH_TOKEN') && g('TWILIO_VERIFY_SERVICE_SID'));
        return ok ? new TwilioVerifyAdapter() : new MockVerifyAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificacionesService, JobQueue, CuposService, RemitenteResolver, VERIFY_PORT],
})
export class NotificacionesModule {}
