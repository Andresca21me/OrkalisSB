import { MetodoPago, SplitType } from '@orkalis/shared';
import { calcularAtencion, type ParametrosFinancieros } from './calculo';

const base: ParametrosFinancieros = {
  reparticionProfesional: 50,
  reparticionSalon: 50,
  deduccionAdministrativa: 0,
  comisionBancaria: 0,
  tarifaClienteProfesional: 0,
  particionPorEspecialista: true,
  inventarioActivo: true,
};

const pct = (precio: number) => ({ precio, splitType: SplitType.Porcentaje, splitValor: 0 });

describe('calcularAtencion', () => {
  it('2 servicios + 1 producto, 50/50, efectivo (coincide con cálculo a mano)', () => {
    const r = calcularAtencion([pct(25000), pct(25000)], [{ cantidad: 1, valor: 10000 }], MetodoPago.Efectivo, base);
    expect(r.total).toBe(60000);
    expect(r.ganProf).toBe(25000);
    expect(r.ganSalon).toBe(35000); // 25000 (split) + 10000 (producto)
  });

  it('servicio valor_fijo: el profesional recibe exactamente el valor fijo', () => {
    const r = calcularAtencion(
      [{ precio: 60000, splitType: SplitType.ValorFijo, splitValor: 20000 }],
      [],
      MetodoPago.Efectivo,
      base,
    );
    expect(r.ganProf).toBe(20000);
    expect(r.ganSalon).toBe(40000);
  });

  it('servicio porcentaje con % por servicio: usa el splitValor del servicio (no el global)', () => {
    // Global 50%, pero el servicio define 60% → el profesional recibe el 60%.
    const r = calcularAtencion(
      [{ precio: 40000, splitType: SplitType.Porcentaje, splitValor: 60 }],
      [],
      MetodoPago.Efectivo,
      base,
    );
    expect(r.ganProf).toBe(24000);
    expect(r.ganSalon).toBe(16000);
  });

  it('comisión bancaria 2% por transferencia la absorbe el salón', () => {
    const r = calcularAtencion([pct(100000)], [], MetodoPago.Transferencia, { ...base, comisionBancaria: 2 });
    expect(r.total).toBe(100000);
    expect(r.comisionBancaria).toBe(2000);
    expect(r.ganProf).toBe(50000);
    expect(r.ganSalon).toBe(48000); // 50000 - 2000
  });

  it('efectivo NO aplica comisión bancaria', () => {
    const r = calcularAtencion([pct(100000)], [], MetodoPago.Efectivo, { ...base, comisionBancaria: 2 });
    expect(r.comisionBancaria).toBe(0);
    expect(r.ganSalon).toBe(50000);
  });

  it('deducción administrativa se retiene del profesional hacia el salón', () => {
    const r = calcularAtencion([pct(100000)], [], MetodoPago.Efectivo, { ...base, deduccionAdministrativa: 10 });
    // prof split 50000, deducción 10% = 5000 → prof 45000, salón 55000.
    expect(r.ganProf).toBe(45000);
    expect(r.ganSalon).toBe(55000);
  });

  it('partición por especialista OFF: no hay ganancia individual', () => {
    const r = calcularAtencion([pct(50000)], [], MetodoPago.Efectivo, { ...base, particionPorEspecialista: false });
    expect(r.ganProf).toBe(0);
    expect(r.ganSalon).toBe(50000);
  });

  it('inventario OFF: ignora el componente de productos', () => {
    const r = calcularAtencion([pct(50000)], [{ cantidad: 5, valor: 9999 }], MetodoPago.Efectivo, {
      ...base,
      inventarioActivo: false,
    });
    expect(r.totalProductos).toBe(0);
    expect(r.total).toBe(50000);
  });
});
