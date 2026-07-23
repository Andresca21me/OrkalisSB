import type { DefinicionClave, ValorConfig } from './config.types';

/**
 * Validación de dominio centralizada (FASE-06, RF-012). Se aplica en TODA
 * escritura, sin importar el nivel. Dos capas: por tipo (cada clave) y cruzada
 * (invariantes entre claves, p. ej. repartición prof + salón = 100).
 */

/** Valida un valor contra su definición. Devuelve mensaje de error o `null`. */
export function validarValor(def: DefinicionClave, valor: unknown): string | null {
  switch (def.tipo) {
    case 'boolean':
      return typeof valor === 'boolean' ? null : 'Debe ser booleano.';
    case 'porcentaje':
      return typeof valor === 'number' && valor >= 0 && valor <= 100
        ? null
        : 'Debe ser un porcentaje entre 0 y 100.';
    case 'numero':
      return typeof valor === 'number' && valor >= 0 ? null : 'Debe ser un número ≥ 0.';
    case 'dinero':
      return typeof valor === 'number' && valor >= 0 ? null : 'Debe ser un monto ≥ 0.';
    case 'duracion':
      return typeof valor === 'number' && valor > 0 ? null : 'Debe ser una duración > 0.';
    case 'enum':
      return typeof valor === 'string' && def.enumValores?.includes(valor)
        ? null
        : `Debe ser uno de: ${def.enumValores?.join(', ')}.`;
    default:
      return 'Tipo de clave desconocido.';
  }
}

/**
 * Validaciones cruzadas sobre el conjunto EFECTIVO resultante de una escritura.
 * Devuelve el primer error encontrado o `null`.
 */
export function validacionesCruzadas(efectivos: Map<string, ValorConfig>): string | null {
  // Repartición profesional + salón = 100 (HU-ADM-004).
  const prof = efectivos.get('finanzas.reparticion_profesional');
  const salon = efectivos.get('finanzas.reparticion_salon');
  if (typeof prof === 'number' && typeof salon === 'number' && prof + salon !== 100) {
    return 'La repartición profesional + salón debe sumar 100%.';
  }

  // Comisión de producto en % no puede pasar de 100 (Plan-Inventario, D2). Como
  // monto fijo por unidad NO tiene tope aquí (el tope real —no cobrar más que la
  // línea— se aplica al calcular, porque depende del precio de cada venta).
  const comTipo = efectivos.get('finanzas.comision_producto_tipo');
  const comValor = efectivos.get('finanzas.comision_producto_valor');
  if (comTipo === 'porcentaje' && typeof comValor === 'number' && comValor > 100) {
    return 'La comisión por producto en porcentaje no puede superar el 100%.';
  }
  return null;
}
