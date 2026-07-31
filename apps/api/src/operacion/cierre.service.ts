import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { runInTenantTx } from '../db/tx';
import { cierrePeriodo } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ModuloGate } from './modulo-gate.service';
import { ReportesService } from './reportes.service';
import { LiquidacionesService } from './liquidaciones.service';

type Cierre = typeof cierrePeriodo.$inferSelect;
type TipoCierre = 'quincenal' | 'mensual';

const FMT_ETIQUETA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Rango Bogotá del período a partir del ANCLA (Plan-Finanzas F6, D6). El rango
 * lo decide el BACKEND — antes lo mandaba el navegador y la pantalla archivaba
 * siempre `tipo: 'mensual'`, incluso cerrando una quincena.
 */
export function rangoDeCierre(tipo: TipoCierre, ancla: string): { desde: Date; hasta: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ancla);
  if (!m) throw new BadRequestException('El ancla del cierre debe ser una fecha YYYY-MM-DD.');
  const [y, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const finDeMes = new Date(Date.UTC(y, mes, 0)).getUTCDate();
  let d1: number;
  let d2: number;
  if (tipo === 'mensual') {
    d1 = 1;
    d2 = finDeMes;
  } else if (dia <= 15) {
    d1 = 1;
    d2 = 15;
  } else {
    d1 = 16;
    d2 = finDeMes;
  }
  const dd = (n: number) => String(n).padStart(2, '0');
  return {
    desde: new Date(`${y}-${dd(mes)}-${dd(d1)}T00:00:00-05:00`),
    hasta: new Date(`${y}-${dd(mes)}-${dd(d2)}T23:59:59.999-05:00`),
  };
}

/**
 * Cierre de período — módulo OPCIONAL (FASE-10, RF-046 · Plan-Finanzas F6).
 * Un cierre deja constancia de lo facturado Y lo liquidado del período: archiva
 * el `ReporteAnalisis` completo más la liquidación por especialista (antes
 * guardaba 7 números y la pantalla enseñaba otros). Los períodos no pueden
 * solaparse: cerrar dos veces la misma quincena es un error, no un duplicado.
 */
@Injectable()
export class CierreService {
  constructor(
    private readonly gate: ModuloGate,
    private readonly reportes: ReportesService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  async cerrar(
    ctx: TenantContext,
    input: { tipo: TipoCierre; ancla: string; sucursalId?: string },
  ): Promise<Cierre> {
    await this.gate.assertActivo(ctx, 'modulo.cierre_periodo');
    const { desde, hasta } = rangoDeCierre(input.tipo, input.ancla);

    // Anti-solape en el MISMO alcance (misma sucursal, o consolidado con
    // consolidado): dos cierres que se pisan romperían la contabilidad.
    const choque = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ id: cierrePeriodo.id, desde: cierrePeriodo.desde, hasta: cierrePeriodo.hasta })
        .from(cierrePeriodo)
        .where(
          and(
            input.sucursalId ? eq(cierrePeriodo.sucursalId, input.sucursalId) : isNull(cierrePeriodo.sucursalId),
            lt(cierrePeriodo.desde, hasta),
            gt(cierrePeriodo.hasta, desde),
          ),
        )
        .limit(1),
    );
    if (choque.length) {
      const c = choque[0];
      throw new ConflictException({
        codigo: 'CIERRE_SOLAPADO',
        message: `Ese período se pisa con un cierre existente (${FMT_ETIQUETA.format(c.desde)} – ${FMT_ETIQUETA.format(c.hasta)}). Un período se cierra una sola vez.`,
      });
    }

    // Se archiva LO QUE SE VE: el análisis completo + la liquidación del
    // período. Sin partición por especialista, la liquidación queda vacía.
    const analisis = await this.reportes.analisis(ctx, desde, hasta, input.sucursalId);
    const liquidaciones = await this.liquidaciones.preview(ctx, { desde, hasta, sucursalId: input.sucursalId }).catch(() => []);

    return runInTenantTx(ctx, async (tx) => {
      const [c] = await tx
        .insert(cierrePeriodo)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId ?? null,
          tipo: input.tipo,
          desde,
          hasta,
          datosArchivados: { analisis, liquidaciones },
        })
        .returning();
      return c;
    });
  }

  listar(ctx: TenantContext): Promise<Cierre[]> {
    return runInTenantTx(ctx, (tx) => tx.select().from(cierrePeriodo).orderBy(desc(cierrePeriodo.desde)));
  }
}
