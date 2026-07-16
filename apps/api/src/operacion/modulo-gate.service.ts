import { ForbiddenException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { suscripcion } from '../db/schema';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { PlanService } from '../plans/plan.service';
import type { TenantContext } from '../db/tenant-context';

/**
 * Gating de módulos (FASE-10 + Plan-Pagos FASE-08, ADR-002/ADR-P3). Un módulo
 * está disponible solo si **el plan lo incluye Y la config del negocio lo activa**
 * (`plan ∧ config`). Si el plan no lo incluye, no hay forma de activarlo.
 */
@Injectable()
export class ModuloGate {
  constructor(
    private readonly config: ConfigResolverService,
    private readonly plans: PlanService,
  ) {}

  async assertActivo(ctx: TenantContext, clave: string, sucursalId: string | null = null): Promise<void> {
    const plan = await this.planDe(ctx.negocioId);
    if (!this.plans.moduloPermitido(plan, clave)) {
      throw new ForbiddenException('Tu plan no incluye este módulo. Mejora tu plan para activarlo.');
    }
    const activo = await this.config.resolverModulo(ctx.negocioId, sucursalId, clave);
    if (!activo) {
      throw new ForbiddenException(`El módulo '${clave}' no está activo para este negocio.`);
    }
  }

  async estaActivo(ctx: TenantContext, clave: string, sucursalId: string | null = null): Promise<boolean> {
    const [plan, activo] = await Promise.all([
      this.planDe(ctx.negocioId),
      this.config.resolverModulo(ctx.negocioId, sucursalId, clave),
    ]);
    return activo && this.plans.moduloPermitido(plan, clave);
  }

  /** Plan vigente del negocio (default básico si faltara la suscripción). */
  private async planDe(negocioId: string): Promise<PlanSuscripcion> {
    const [s] = await adminDb
      .select({ plan: suscripcion.plan })
      .from(suscripcion)
      .where(eq(suscripcion.negocioId, negocioId))
      .limit(1);
    return (s?.plan ?? PlanSuscripcion.Basico) as PlanSuscripcion;
  }
}
