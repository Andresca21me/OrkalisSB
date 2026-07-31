import { Module } from '@nestjs/common';
import { ModuloGate } from '../operacion/modulo-gate.service';
import { AtencionService } from './atencion.service';
import { DesgloseService } from './desglose.service';
import { FinanzasController } from './finanzas.controller';

/**
 * Motor financiero (FASE-09, ADR-006). Provee el cierre/reversión de la atención.
 * `ModuloGate` (cuyas dependencias `PlanService`/`ConfigResolver` son globales) se
 * provee aquí para que el cierre resuelva `modulo.inventario` como plan ∧ config,
 * no solo config — cerrando el hueco por el que un negocio degradado seguiría
 * vendiendo productos (Plan-Inventario, §1.3/D11).
 */
@Module({
  controllers: [FinanzasController],
  providers: [AtencionService, DesgloseService, ModuloGate],
  exports: [AtencionService, DesgloseService],
})
export class FinanzasModule {}
