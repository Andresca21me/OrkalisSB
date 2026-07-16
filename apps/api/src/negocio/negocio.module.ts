import { Module } from '@nestjs/common';
import { NegocioController } from './negocio.controller';
import { NegocioService } from './negocio.service';
import { SucursalController } from './sucursal.controller';
import { SucursalService } from './sucursal.service';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { SuscripcionController } from './suscripcion.controller';
import { SuscripcionService } from './suscripcion.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

/**
 * Negocio, sucursales, equipo, suscripción y usuarios (FASE-07/09). Depende del
 * PlanModule (global) y del módulo de configurabilidad (global).
 */
@Module({
  controllers: [NegocioController, SucursalController, EquipoController, SuscripcionController, UsuariosController],
  providers: [NegocioService, SucursalService, EquipoService, SuscripcionService, UsuariosService],
  exports: [SuscripcionService],
})
export class NegocioModule {}
