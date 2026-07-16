import { Module } from '@nestjs/common';
import { AtencionService } from './atencion.service';

/** Motor financiero (FASE-09, ADR-006). Provee el cierre/reversión de la atención. */
@Module({
  providers: [AtencionService],
  exports: [AtencionService],
})
export class FinanzasModule {}
