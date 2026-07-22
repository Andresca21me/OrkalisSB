import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { runInTenantTx } from '../db/tx';
import { mensaje } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

/** Tamaño de página del registro (fijo: la UI no lo negocia). */
const POR_PAGINA = 50;
/** Ventana por defecto si no se pide rango. */
const DIAS_DEFECTO = 30;

export interface FiltrosMensajes {
  canal?: string;
  estado?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
}

/**
 * Registro de mensajes para el admin (Plan-Mensajeria FASE-10).
 *
 * Lectura sobre el outbox, que ya es el log de auditoría (FASE-02). Va dentro
 * del tenant (RLS) y **nunca expone el cuerpo completo** de mensajes de otro
 * negocio ni datos del proveedor más allá del id, que es lo que sirve para
 * rastrear un envío en el panel de Twilio.
 */
@Injectable()
export class MensajesService {
  async listar(ctx: TenantContext, f: FiltrosMensajes) {
    const pagina = Math.max(0, f.pagina ?? 0);
    const desde = f.desde ? new Date(f.desde) : new Date(Date.now() - DIAS_DEFECTO * 86400_000);
    const hasta = f.hasta ? new Date(f.hasta) : new Date();

    const filtros: SQL[] = [
      eq(mensaje.negocioId, ctx.negocioId),
      gte(mensaje.creadoEn, desde),
      lte(mensaje.creadoEn, hasta),
    ];
    if (f.canal) filtros.push(eq(mensaje.canal, f.canal as 'sms'));
    if (f.estado) filtros.push(eq(mensaje.estado, f.estado as 'enviado'));
    if (f.tipo) filtros.push(eq(mensaje.tipo, f.tipo));
    const donde = and(...filtros);

    return runInTenantTx(ctx, async (tx) => {
      const [{ total }] = await tx.select({ total: count() }).from(mensaje).where(donde);
      const filas = await tx
        .select({
          id: mensaje.id,
          canal: mensaje.canal,
          tipo: mensaje.tipo,
          estado: mensaje.estado,
          destino: mensaje.destino,
          cuerpo: mensaje.cuerpo,
          error: mensaje.error,
          intento: mensaje.intento,
          sobreCupo: mensaje.sobreCupo,
          proveedorId: mensaje.proveedorId,
          citaId: mensaje.citaId,
          creadoEn: mensaje.creadoEn,
          enviadoEn: mensaje.enviadoEn,
          entregadoEn: mensaje.entregadoEn,
        })
        .from(mensaje)
        .where(donde)
        .orderBy(desc(mensaje.creadoEn))
        .limit(POR_PAGINA)
        .offset(pagina * POR_PAGINA);

      return { total: Number(total), pagina, porPagina: POR_PAGINA, mensajes: filas };
    });
  }

  /**
   * Conteo por estado del período, para la cabecera del registro. Es lo que
   * permite ver de un vistazo si hay una tasa de fallo anómala.
   */
  async resumen(ctx: TenantContext, dias = DIAS_DEFECTO) {
    const desde = new Date(Date.now() - dias * 86400_000);
    const filas = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ estado: mensaje.estado, n: count() })
        .from(mensaje)
        .where(and(eq(mensaje.negocioId, ctx.negocioId), gte(mensaje.creadoEn, desde)))
        .groupBy(mensaje.estado),
    );
    const porEstado = Object.fromEntries(filas.map((f) => [f.estado, Number(f.n)]));
    const total = filas.reduce((s, f) => s + Number(f.n), 0);
    const fallidos = (porEstado.fallido ?? 0) + (porEstado.sin_cupo ?? 0);
    return { dias, total, porEstado, tasaFallo: total ? fallidos / total : 0 };
  }
}
