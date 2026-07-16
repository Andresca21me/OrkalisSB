import { getDefinicion } from './registry';
import { validacionesCruzadas, validarValor } from './validation';
import type { ValorConfig } from './config.types';

describe('validarValor', () => {
  it('acepta booleano para una bandera de módulo', () => {
    expect(validarValor(getDefinicion('modulo.inventario')!, true)).toBeNull();
    expect(validarValor(getDefinicion('modulo.inventario')!, 'sí')).not.toBeNull();
  });

  it('acepta porcentaje 0–100 y rechaza fuera de rango', () => {
    const def = getDefinicion('finanzas.reparticion_profesional')!;
    expect(validarValor(def, 50)).toBeNull();
    expect(validarValor(def, 0)).toBeNull();
    expect(validarValor(def, 100)).toBeNull();
    expect(validarValor(def, 101)).not.toBeNull();
    expect(validarValor(def, -1)).not.toBeNull();
  });

  it('duracion debe ser > 0', () => {
    const def = getDefinicion('agendamiento.duracion_retencion_min')!;
    expect(validarValor(def, 10)).toBeNull();
    expect(validarValor(def, 0)).not.toBeNull();
  });
});

describe('validacionesCruzadas', () => {
  const mapa = (prof: number, salon: number): Map<string, ValorConfig> =>
    new Map([
      ['finanzas.reparticion_profesional', prof],
      ['finanzas.reparticion_salon', salon],
    ]);

  it('acepta repartición que suma 100', () => {
    expect(validacionesCruzadas(mapa(50, 50))).toBeNull();
    expect(validacionesCruzadas(mapa(70, 30))).toBeNull();
  });

  it('rechaza repartición que no suma 100', () => {
    expect(validacionesCruzadas(mapa(60, 50))).not.toBeNull();
    expect(validacionesCruzadas(mapa(40, 40))).not.toBeNull();
  });
});
