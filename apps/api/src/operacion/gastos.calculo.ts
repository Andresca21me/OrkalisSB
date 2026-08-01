import { round2 } from '../finanzas/calculo';

/**
 * Ocurrencias de gastos en un período — funciones de dominio PURAS.
 *
 * Modelo (Plan-Gastos):
 *  - Gasto VARIABLE: puntual; cuenta en el período si su `fecha` (día Bogotá)
 *    cae dentro. Inactivo = eliminado de los reportes (como siempre).
 *  - Gasto FIJO: plantilla recurrente; se cobra CADA MES en su `diaCobro`
 *    (recortado al último día del mes), desde el mes en que se registró.
 *    Desactivarlo detiene los cobros futuros pero CONSERVA las ocurrencias ya
 *    cobradas (hasta el día de la desactivación) — así los cierres pasados no
 *    cambian retroactivamente.
 *  - Filas antiguas sin `fecha`/`diaCobro` (pre-migración) usan su día de
 *    creación: reproduce exactamente el comportamiento anterior.
 */

export interface GastoFila {
  id: string;
  sucursalId: string;
  tipo: string; // 'fijo' | 'variable'
  categoria: string | null;
  monto: string;
  fecha: string | null; // YYYY-MM-DD (variables)
  diaCobro: number | null; // 1–31 (fijos)
  activo: boolean;
  desactivadoEn: Date | null;
  creadoEn: Date;
}

/** Una ocurrencia concreta de un gasto dentro del período consultado. */
export interface OcurrenciaGasto {
  gastoId: string;
  sucursalId: string;
  tipo: 'fijo' | 'variable';
  categoria: string | null;
  monto: number;
  /** Día (Bogotá) en que el gasto golpea las finanzas. */
  fecha: string;
  /** Fijos: día del mes configurado. Null en variables. */
  diaCobro: number | null;
  /** Fijos desactivados siguen mostrando sus ocurrencias pasadas. */
  activo: boolean;
}

const BOGOTA_MS = 5 * 3600_000;

/** Día local Bogotá (YYYY-MM-DD) de un instante UTC. */
export function diaBogota(d: Date): string {
  return new Date(d.getTime() - BOGOTA_MS).toISOString().slice(0, 10);
}

/**
 * Último día Bogotá que cubre un `hasta` de período. Los llamadores usan dos
 * convenciones — fin del día inclusivo (…23:59:59.999) o medianoche exclusiva
 * del día siguiente (…00:00:00.000) — y restar 1 ms resuelve ambas: sin esto,
 * la quincena 16–31 jul "capturaría" el gasto fijo del 1 de agosto.
 */
export function diaFinPeriodo(hasta: Date): string {
  return diaBogota(new Date(hasta.getTime() - 1));
}

function ultimoDiaDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma `delta` meses a un ancla 'YYYY-MM'. */
function moverMes(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Expande gastos crudos a sus ocurrencias dentro de [desde, hasta] (instantes
 * UTC; el corte de día es Bogotá). Devuelve las ocurrencias ordenadas de la
 * más reciente a la más antigua.
 */
export function ocurrenciasEnPeriodo(gastos: GastoFila[], desde: Date, hasta: Date): OcurrenciaGasto[] {
  const d1 = diaBogota(desde);
  const d2 = diaFinPeriodo(hasta);
  const out: OcurrenciaGasto[] = [];

  for (const g of gastos) {
    const monto = Number(g.monto);
    if (g.tipo !== 'fijo') {
      if (!g.activo) continue;
      const fecha = g.fecha ?? diaBogota(g.creadoEn);
      if (fecha >= d1 && fecha <= d2) {
        out.push({ gastoId: g.id, sucursalId: g.sucursalId, tipo: 'variable', categoria: g.categoria, monto, fecha, diaCobro: null, activo: g.activo });
      }
      continue;
    }

    // Fijo: una ocurrencia por mes en `diaCobro`, desde el mes de registro
    // (aunque el día ya haya pasado: quien registra su arriendo espera verlo en
    // el cierre del mes en curso) hasta el mes del fin del período o el de la
    // desactivación.
    const diaCobro = g.diaCobro ?? Number(diaBogota(g.creadoEn).slice(8, 10));
    const mesInicio = diaBogota(g.creadoEn).slice(0, 7);
    // Desactivado: se conservan las ocurrencias ESTRICTAMENTE anteriores al día
    // de la baja (quien borra un fijo recién creado espera que desaparezca hoy).
    const diaTope = g.activo ? d2 : diaBogota(g.desactivadoEn ?? g.creadoEn);
    let mes = mesInicio >= d1.slice(0, 7) ? mesInicio : d1.slice(0, 7);
    while (mes <= d2.slice(0, 7)) {
      const [y, m] = mes.split('-').map(Number);
      const fecha = `${mes}-${String(Math.min(diaCobro, ultimoDiaDelMes(y, m))).padStart(2, '0')}`;
      if (fecha >= d1 && fecha <= d2 && (g.activo ? fecha <= diaTope : fecha < diaTope)) {
        out.push({ gastoId: g.id, sucursalId: g.sucursalId, tipo: 'fijo', categoria: g.categoria, monto, fecha, diaCobro, activo: g.activo });
      }
      mes = moverMes(mes, 1);
    }
  }

  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Totales del período a partir de las ocurrencias. */
export function totalesDeOcurrencias(ocurrencias: OcurrenciaGasto[]): { fijos: number; variables: number; total: number } {
  let fijos = 0;
  let variables = 0;
  for (const o of ocurrencias) {
    if (o.tipo === 'fijo') fijos += o.monto;
    else variables += o.monto;
  }
  return { fijos: round2(fijos), variables: round2(variables), total: round2(fijos + variables) };
}
