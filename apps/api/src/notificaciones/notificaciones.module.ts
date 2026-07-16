import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { JobQueue } from './job-queue';
import { CuposService } from './cupos.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';
import { NOTIFICATION_SENDER } from './notification-sender.port';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { MockAdapter } from './adapters/mock.adapter';

/**
 * Notificaciones (FASE-11, ADR-007). El adaptador se elige por entorno: Twilio
 * si hay claves, si no el mock (loguea, no envía). Cambiar de proveedor no toca
 * el dominio (solo este factory).
 */
@Module({
  controllers: [NotificacionesController],
  providers: [
    JobQueue,
    CuposService,
    NotificacionesService,
    RecordatoriosScheduler,
    {
      provide: NOTIFICATION_SENDER,
      useFactory: (config: ConfigService<Env, true>) => {
        const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
        const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
        const from = config.get('TWILIO_FROM_NUMBER', { infer: true });
        if (sid && token && from) {
          return new TwilioAdapter(sid, token, from);
        }
        new Logger('Notificaciones').warn('Sin claves Twilio: usando MockAdapter (no se envían SMS reales).');
        return new MockAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificacionesService, JobQueue, CuposService],
})
export class NotificacionesModule {}
