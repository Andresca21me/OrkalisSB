import { Global, Module } from '@nestjs/common';
import { PlanService } from './plan.service';

/** Catálogo de planes (FASE-07, ADR-009). Global: lo usan suscripción, sucursal, facturación (Mercado Pago) y notificaciones. */
@Global()
@Module({
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
