import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { NegocioController } from './negocio.controller';
import { NegocioService } from './negocio.service';
import { SucursalController } from './sucursal.controller';
import { SucursalService } from './sucursal.service';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { VerificacionEspecialistaService } from './verificacion-especialista.service';
import { SuscripcionController } from './suscripcion.controller';
import { SuscripcionService } from './suscripcion.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Negocio, sucursales, equipo, suscripción y usuarios (FASE-07/09). Depende del
 * PlanModule (global) y del módulo de configurabilidad (global).
 */
@Module({
  // El alta verificada (FASE-06) usa el puerto Verify y el RemitenteResolver.
  imports: [NotificacionesModule],
  controllers: [NegocioController, SucursalController, EquipoController, SuscripcionController, UsuariosController],
  providers: [NegocioService, SucursalService, EquipoService, VerificacionEspecialistaService, SuscripcionService, UsuariosService],
  exports: [SuscripcionService],
})
export class NegocioModule {}
