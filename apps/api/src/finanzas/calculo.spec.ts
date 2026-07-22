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
/** Un solo método de pago por el monto indicado. */
const pago = (metodo: MetodoPago, monto: number) => [{ metodo, monto }];

describe('calcularAtencion', () => {
  it('2 servicios + 1 producto, 50/50, efectivo (coincide con cálculo a mano)', () => {
    const r = calcularAtencion([pct(25000), pct(25000)], [{ cantidad: 1, valor: 10000 }], pago(MetodoPago.Efectivo, 60000), base);
    expect(r.total).toBe(60000);
    expect(r.ganProf).toBe(25000);
    expect(r.ganSalon).toBe(35000); // 25000 (split) + 10000 (producto)
  });

  it('servicio valor_fijo: el profesional recibe exactamente el valor fijo', () => {
    const r = calcularAtencion(
      [{ precio: 60000, splitType: SplitType.ValorFijo, splitValor: 20000 }],
      [],
      pago(MetodoPago.Efectivo, 60000),
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
      pago(MetodoPago.Efectivo, 40000),
      base,
    );
    expect(r.ganProf).toBe(24000);
    expect(r.ganSalon).toBe(16000);
  });

  it('comisión bancaria 2% por transferencia la absorbe el salón', () => {
    const r = calcularAtencion([pct(100000)], [], pago(MetodoPago.Transferencia, 100000), { ...base, comisionBancaria: 2 });
    expect(r.total).toBe(100000);
    expect(r.comisionBancaria).toBe(2000);
    expect(r.ganProf).toBe(50000);
    expect(r.ganSalon).toBe(48000); // 50000 - 2000
  });

  it('efectivo NO aplica comisión bancaria', () => {
    const r = calcularAtencion([pct(100000)], [], pago(MetodoPago.Efectivo, 100000), { ...base, comisionBancaria: 2 });
    expect(r.comisionBancaria).toBe(0);
    expect(r.ganSalon).toBe(50000);
  });

  it('deducción administrativa se retiene del profesional hacia el salón', () => {
    const r = calcularAtencion([pct(100000)], [], pago(MetodoPago.Efectivo, 100000), { ...base, deduccionAdministrativa: 10 });
    // prof split 50000, deducción 10% = 5000 → prof 45000, salón 55000.
    expect(r.ganProf).toBe(45000);
    expect(r.ganSalon).toBe(55000);
  });

  it('partición por especialista OFF: no hay ganancia individual', () => {
    const r = calcularAtencion([pct(50000)], [], pago(MetodoPago.Efectivo, 50000), { ...base, particionPorEspecialista: false });
    expect(r.ganProf).toBe(0);
    expect(r.ganSalon).toBe(50000);
  });

  it('inventario OFF: ignora el componente de productos', () => {
    const r = calcularAtencion([pct(50000)], [{ cantidad: 5, valor: 9999 }], pago(MetodoPago.Efectivo, 50000), {
      ...base,
      inventarioActivo: false,
    });
    expect(r.totalProductos).toBe(0);
    expect(r.total).toBe(50000);
  });

  it('pago dividido: la comisión bancaria solo aplica a la porción electrónica', () => {
    // Total 100000 = 40000 efectivo + 60000 transferencia; comisión 2%.
    const r = calcularAtencion(
      [pct(100000)],
      [],
      [
        { metodo: MetodoPago.Efectivo, monto: 40000 },
        { metodo: MetodoPago.Transferencia, monto: 60000 },
      ],
      { ...base, comisionBancaria: 2 },
    );
    expect(r.total).toBe(100000);
    expect(r.comisionBancaria).toBe(1200); // 2% de 60000 (solo la parte electrónica)
    expect(r.ganSalon).toBe(48800); // 50000 − 1200
  });
});
