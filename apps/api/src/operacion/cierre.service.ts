import { Injectable } from '@nestjs/common';
import { runInTenantTx } from '../db/tx';
import { cierrePeriodo } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ModuloGate } from './modulo-gate.service';
import { ReportesService } from './reportes.service';

type Cierre = typeof cierrePeriodo.$inferSelect;
type TipoCierre = 'quincenal' | 'mensual';

/** Cierre de período — módulo OPCIONAL (FASE-10, RF-046). */
@Injectable()
export class CierreService {
  constructor(
    private readonly gate: ModuloGate,
    private readonly reportes: ReportesService,
  ) {}

  /**
   * Cierra un período archivando un snapshot de sus totales (conserva el
   * histórico; no borra datos operativos). Requiere el módulo activo.
   */
  async cerrar(
    ctx: TenantContext,
    input: { tipo: TipoCierre; desde: Date; hasta: Date; sucursalId?: string },
  ): Promise<Cierre> {
    await this.gate.assertActivo(ctx, 'modulo.cierre_periodo');
    const resumen = await this.reportes.financiero(ctx, input.desde, input.hasta, input.sucursalId);

    return runInTenantTx(ctx, async (tx) => {
      const [c] = await tx
        .insert(cierrePeriodo)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId ?? null,
          tipo: input.tipo,
          desde: input.desde,
          hasta: input.hasta,
          datosArchivados: resumen,
        })
        .returning();
      return c;
    });
  }

  listar(ctx: TenantContext): Promise<Cierre[]> {
    return runInTenantTx(ctx, (tx) => tx.select().from(cierrePeriodo));
  }
}
