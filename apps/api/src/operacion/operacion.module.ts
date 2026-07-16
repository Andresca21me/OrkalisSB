import { Module } from '@nestjs/common';
import { ModuloGate } from './modulo-gate.service';
import { ClientesService } from './clientes.service';
import { ServiciosService } from './servicios.service';
import { InventarioService } from './inventario.service';
import { GastosService } from './gastos.service';
import { LiquidacionesService } from './liquidaciones.service';
import { ReportesService } from './reportes.service';
import { CierreService } from './cierre.service';
import {
  CierreController,
  ClientesController,
  GastosController,
  InventarioController,
  LiquidacionesController,
  ReportesController,
  ServiciosController,
} from './operacion.controllers';

/** Operación interna (FASE-10): CRM, catálogo, inventario, gastos, liquidaciones, reportes, cierre. */
@Module({
  controllers: [
    ClientesController,
    ServiciosController,
    InventarioController,
    GastosController,
    LiquidacionesController,
    ReportesController,
    CierreController,
  ],
  providers: [
    ModuloGate,
    ClientesService,
    ServiciosService,
    InventarioService,
    GastosService,
    LiquidacionesService,
    ReportesService,
    CierreService,
  ],
  exports: [ClientesService, ServiciosService],
})
export class OperacionModule {}
