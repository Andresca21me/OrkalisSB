/**
 * Proración del cargo de una SUBIDA de plan/cupo (Plan-Pagos FASE-09 v2).
 *
 * Función PURA y determinista (recibe `ahora`): al subir en una cuenta activa se
 * cobra la **diferencia mensual** solo por los **días que faltan** del ciclo en
 * curso; la fecha del próximo cobro no cambia y a partir de ahí se cobra el monto
 * nuevo completo.
 *
 * Ciclo = `[proximoCobro − 1 mes, proximoCobro]`. Como el día de cobro está
 * anclado a 1..28 (ver `proximoCobro`/`siguienteCobro`), restar un mes nunca
 * desborda de mes, así que `inicio` siempre es una fecha válida del mes anterior.
 *
 * Garantías: devuelve un **entero en COP**, **≥ 0** y **nunca mayor** que la
 * diferencia mensual completa. Un día parcial restante cuenta como día completo
 * de servicio (se usa `ceil`), favoreciendo no infra-cobrar el servicio futuro.
 */
export function prorratearDiferencia(
  difMensual: number,
  proximoCobro: Date | null,
  ahora: Date,
): number {
  // Solo se prorratea una subida (diferencia positiva).
  if (difMensual <= 0) return 0;
  const difEntera = Math.round(difMensual);

  // Sin ciclo conocido (no debería ocurrir en cuenta activa): cobro conservador
  // de la diferencia completa.
  if (!proximoCobro) return difEntera;

  const MS_DIA = 86_400_000;
  const inicio = new Date(
    Date.UTC(
      proximoCobro.getUTCFullYear(),
      proximoCobro.getUTCMonth() - 1,
      proximoCobro.getUTCDate(),
      12,
      0,
      0,
    ),
  );
  const diasCiclo = Math.max(1, Math.round((proximoCobro.getTime() - inicio.getTime()) / MS_DIA));
  const diasRestantes = Math.max(
    0,
    Math.min(diasCiclo, Math.ceil((proximoCobro.getTime() - ahora.getTime()) / MS_DIA)),
  );

  const prorrateado = Math.round((difEntera * diasRestantes) / diasCiclo);
  // Nunca cobrar más que la diferencia mensual completa.
  return Math.min(difEntera, Math.max(0, prorrateado));
}
