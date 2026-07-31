import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CorreoAuthService } from './correo-auth.service';
import { CorreoScheduler } from './correo.scheduler';
import { TokenAccionService } from './token-accion.service';

/**
 * Correo transaccional de acceso/credenciales (Plan-Correo).
 *
 * No tiene controladores propios: los endpoints viven en el dominio que los
 * dispara (auth → registro/reset/cambio de correo; negocio → invitación de
 * especialistas) y este módulo les presta el token de un solo uso y el envío.
 */
@Module({
  imports: [NotificacionesModule],
  providers: [TokenAccionService, CorreoAuthService, CorreoScheduler],
  exports: [TokenAccionService, CorreoAuthService],
})
export class CorreoModule {}
