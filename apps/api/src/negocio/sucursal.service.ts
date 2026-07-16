import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { sucursal, suscripcion } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { PlanService } from '../plans/plan.service';
import { ConfigWriteService } from '../config-module/config-write.service';

type Sucursal = typeof sucursal.$inferSelect;

/**
 * Gestión de sucursales (FASE-07, RF-003/RF-004). Crear sucursales adicionales
 * requiere que el PLAN lo permita (ADR-009). Activar/desactivar NO afecta el cobro.
 */
@Injectable()
export class SucursalService {
  constructor(
    private readonly plans: PlanService,
    private readonly configWrite: ConfigWriteService,
  ) {}

  listar(ctx: TenantContext): Promise<Sucursal[]> {
    return runInTenantTx(ctx, (tx) => tx.select().from(sucursal));
  }

  /** Crea una sucursal (con gating por plan). Opcionalmente clona config de otra. */
  async crear(ctx: TenantContext, nombre: string, clonarDeSucursalId?: string): Promise<Sucursal> {
    const nueva = await runInTenantTx(ctx, async (tx) => {
      const [{ c }] = await tx.select({ c: count() }).from(sucursal);
      const [sus] = await tx
        .select({ plan: suscripcion.plan })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, ctx.negocioId))
        .limit(1);
      const plan = (sus?.plan ?? PlanSuscripcion.Basico) as PlanSuscripcion;

      if (!this.plans.permiteSucursales(plan, c + 1)) {
        throw new BadRequestException(
          `El plan ${plan} admite hasta ${this.plans.maxSucursales(plan)} sucursal(es). Mejora tu plan para agregar más.`,
        );
      }

      const [s] = await tx.insert(sucursal).values({ negocioId: ctx.negocioId, nombre }).returning();
      return s;
    });

    // Clonado de configuración (instantánea) tras crear, si se pidió (RF-011).
    if (clonarDeSucursalId) {
      await this.configWrite.clonar(ctx, clonarDeSucursalId, nueva.id);
    }
    return nueva;
  }

  async editar(ctx: TenantContext, id: string, nombre: string): Promise<Sucursal> {
    const [s] = await runInTenantTx(ctx, (tx) =>
      tx
        .update(sucursal)
        .set({ nombre, actualizadoEn: new Date() })
        .where(eq(sucursal.id, id))
        .returning(),
    );
    if (!s) throw new NotFoundException('Sucursal no encontrada.');
    return s;
  }

  /** Activar/desactivar. No afecta el cobro (ADR-009). */
  async cambiarEstado(ctx: TenantContext, id: string, activa: boolean): Promise<Sucursal> {
    const [s] = await runInTenantTx(ctx, (tx) =>
      tx
        .update(sucursal)
        .set({ activa, actualizadoEn: new Date() })
        .where(eq(sucursal.id, id))
        .returning(),
    );
    if (!s) throw new NotFoundException('Sucursal no encontrada.');
    return s;
  }
}
