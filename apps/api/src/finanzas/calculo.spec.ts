import { MetodoPago, SplitType } from '@orkalis/shared';
import { calcularAtencion, comisionProducto, round2, type ParametrosFinancieros } from './calculo';

const base: ParametrosFinancieros = {
  reparticionProfesional: 50,
  reparticionSalon: 50,
  deduccionAdministrativa: 0,
  comisionBancaria: 0,
  tarifaClienteProfesional: 0,
  particionPorEspecialista: true,
  inventarioActivo: true,
  comisionProductoTipo: 'porcentaje',
  comisionProductoValor: 0,
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

  // ── Comisión por venta de producto (Plan-Inventario, D2/D4) ─────────────────

  it('comisión de producto en % la recibe el profesional y el resto va al salón', () => {
    // Servicio 50000 (50/50) + 2 productos de 10000; comisión 10% sobre 20000 = 2000.
    const r = calcularAtencion(
      [pct(50000)],
      [{ cantidad: 2, valor: 10000 }],
      pago(MetodoPago.Efectivo, 70000),
      { ...base, comisionProductoValor: 10 },
    );
    expect(r.total).toBe(70000);
    expect(r.comisionProductos).toBe(2000);
    expect(r.comisionesPorLinea).toEqual([2000]);
    expect(r.ganProf).toBe(27000); // 25000 servicio + 2000 comisión
    expect(r.ganSalon).toBe(43000); // 25000 servicio + 20000 producto − 2000 comisión
  });

  it('comisión de producto por monto fijo por unidad', () => {
    // 3 unidades × 1500 de comisión fija = 4500.
    const r = calcularAtencion(
      [],
      [{ cantidad: 3, valor: 20000 }],
      pago(MetodoPago.Efectivo, 60000),
      { ...base, comisionProductoTipo: 'valor_fijo', comisionProductoValor: 1500 },
    );
    expect(r.comisionProductos).toBe(4500);
    expect(r.ganProf).toBe(4500);
    expect(r.ganSalon).toBe(55500); // 60000 − 4500
  });

  it('monto fijo con tope: la comisión nunca supera el valor de la línea', () => {
    // Comisión fija 5000/ud pero el producto vale 3000/ud → tope = 2 × 3000 = 6000.
    const r = calcularAtencion(
      [],
      [{ cantidad: 2, valor: 3000 }],
      pago(MetodoPago.Efectivo, 6000),
      { ...base, comisionProductoTipo: 'valor_fijo', comisionProductoValor: 5000 },
    );
    expect(r.comisionProductos).toBe(6000);
    expect(r.ganProf).toBe(6000);
    expect(r.ganSalon).toBe(0);
  });

  it('regresión: comisión 0 reproduce el reparto anterior (todo el producto al salón)', () => {
    const r = calcularAtencion([pct(50000)], [{ cantidad: 1, valor: 10000 }], pago(MetodoPago.Efectivo, 60000), base);
    expect(r.comisionProductos).toBe(0);
    expect(r.ganProf).toBe(25000);
    expect(r.ganSalon).toBe(35000);
  });

  it('sin partición por especialista: el producto entero va al salón, sin comisión', () => {
    const r = calcularAtencion(
      [pct(50000)],
      [{ cantidad: 1, valor: 10000 }],
      pago(MetodoPago.Efectivo, 60000),
      { ...base, particionPorEspecialista: false, comisionProductoValor: 20 },
    );
    expect(r.comisionProductos).toBe(0);
    expect(r.ganProf).toBe(0);
    expect(r.ganSalon).toBe(60000);
  });

  it('inventario OFF: no hay comisión de producto aunque esté configurada', () => {
    const r = calcularAtencion(
      [pct(50000)],
      [{ cantidad: 5, valor: 9999 }],
      pago(MetodoPago.Efectivo, 50000),
      { ...base, inventarioActivo: false, comisionProductoValor: 20 },
    );
    expect(r.comisionProductos).toBe(0);
    expect(r.totalProductos).toBe(0);
  });

  it('invariante ganProf + ganSalon + comisionBancaria = total (con comisión y banca)', () => {
    const r = calcularAtencion(
      [pct(80000)],
      [{ cantidad: 2, valor: 15000 }],
      [
        { metodo: MetodoPago.Efectivo, monto: 50000 },
        { metodo: MetodoPago.Tarjeta, monto: 60000 },
      ],
      { ...base, comisionBancaria: 3, comisionProductoValor: 15 },
    );
    expect(round2(r.ganProf + r.ganSalon + r.comisionBancaria)).toBe(r.total);
  });
});

describe('comisionProducto (helper compartido)', () => {
  it('porcentaje sobre el valor de la línea', () => {
    expect(comisionProducto(2, 10000, 'porcentaje', 10)).toBe(2000);
  });
  it('valor fijo por unidad con tope en la línea', () => {
    expect(comisionProducto(3, 20000, 'valor_fijo', 1500)).toBe(4500);
    expect(comisionProducto(2, 3000, 'valor_fijo', 5000)).toBe(6000); // tope
  });
  it('valor 0 o cantidad 0 → sin comisión', () => {
    expect(comisionProducto(5, 10000, 'porcentaje', 0)).toBe(0);
    expect(comisionProducto(0, 10000, 'porcentaje', 10)).toBe(0);
  });
});
