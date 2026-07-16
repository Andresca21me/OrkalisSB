import { Module } from '@nestjs/common';
import { FinanzasModule } from '../finanzas/finanzas.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { DisponibilidadService } from './disponibilidad.service';
import { OtpService } from './otp.service';
import { PublicAgendamientoService } from './public-agendamiento.service';
import { AgendamientoService } from './agendamiento.service';
import { ValidadorFactory } from './validators/validador.factory';
import { PublicAgendamientoController } from './public-agendamiento.controller';
import { AgendamientoController } from './agendamiento.controller';

/** Agendamiento (FASE-08, ADR-005): disponibilidad, reserva pública+OTP, walk-ins. */
@Module({
  imports: [FinanzasModule, NotificacionesModule],
  controllers: [PublicAgendamientoController, AgendamientoController],
  providers: [
    DisponibilidadService,
    OtpService,
    PublicAgendamientoService,
    AgendamientoService,
    ValidadorFactory,
  ],
  exports: [PublicAgendamientoService, DisponibilidadService],
})
export class AgendamientoModule {}
