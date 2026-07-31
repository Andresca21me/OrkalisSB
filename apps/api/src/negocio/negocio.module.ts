import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { CorreoModule } from '../correo/correo.module';
import { LogoNegocioController, MarcaController, NegocioController } from './negocio.controller';
import { MarcaService, NegocioService } from './negocio.service';
import { SucursalController } from './sucursal.controller';
import { SucursalService } from './sucursal.service';
import { EquipoController, EspecialistaFotoController, InvitacionPublicaController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { InvitacionEspecialistaService } from './invitacion-especialista.service';
import { SuscripcionController } from './suscripcion.controller';
import { SuscripcionService } from './suscripcion.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Negocio, sucursales, equipo, suscripción y usuarios (FASE-07/09). Depende del
 * PlanModule (global) y del módulo de configurabilidad (global).
 */
@Module({
  // La invitación de especialistas (Plan-Correo E5) usa el CorreoModule para el
  // enlace de activación y el puerto Verify para el celular del especialista.
  imports: [NotificacionesModule, CorreoModule],
  controllers: [NegocioController, MarcaController, LogoNegocioController, SucursalController, EquipoController, EspecialistaFotoController, InvitacionPublicaController, SuscripcionController, UsuariosController],
  providers: [NegocioService, MarcaService, SucursalService, EquipoService, InvitacionEspecialistaService, SuscripcionService, UsuariosService],
  exports: [SuscripcionService, MarcaService],
})
export class NegocioModule {}
