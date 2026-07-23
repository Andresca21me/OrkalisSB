import { MetodoPago, SplitType } from '@orkalis/shared';

/**
 * Motor de cálculo financiero — funciones de dominio PURAS (FASE-09, ADR-006).
 * Sin BD, unit-testeables. Operan sobre el cierre REAL del turno y devuelven el
 * desglose + un snapshot auditable de los parámetros aplicados.
 *
 * Modelo v1 (documentado):
 *  - Servicio `valor_fijo`: el profesional recibe el valor fijo; el resto, al salón.
 *  - Servicio `porcentaje`: se aplica el % por servicio (`splitValor`); si es 0,
 *    se usa la repartición estándar de la sucursal (`reparticionProfesional`).
 *  - Deducción administrativa: % sobre la ganancia del profesional, retenido por el salón.
 *  - Productos: el ingreso es del salón salvo la comisión del especialista (Plan-Inventario, D2),
 *    que se configura como % de la venta o monto fijo por unidad. Con comisión 0 = todo al salón.
 *    La deducción administrativa y la tarifa NO aplican a productos, solo a servicios.
 *  - Tarifa cliente→profesional: % extra sobre servicios que paga el cliente y va al profesional.
 *  - Comisión bancaria: si el pago es electrónico, la absorbe el salón.
 *  - `particion_por_especialista` OFF: no se calcula ganancia individual (todo al salón).
 *  - `inventario` OFF: el cálculo opera sin componente de productos.
 */

export interface ServicioReal {
  precio: number;
  splitType: SplitType;
  splitValor: number;
}

export interface ProductoReal {
  cantidad: number;
  valor: number; // precio unitario
}

/** Una línea del pago (para dividir el cobro en varios métodos). */
export interface PagoReal {
  metodo: MetodoPago;
  monto: number;
}

/** Cómo se calcula la comisión del especialista por vender un producto (D2). */
export type ComisionProductoTipo = 'porcentaje' | 'valor_fijo';

export interface ParametrosFinancieros {
  reparticionProfesional: number; // %
  reparticionSalon: number; // %
  deduccionAdministrativa: number; // %
  comisionBancaria: number; // %
  tarifaClienteProfesional: number; // %
  particionPorEspecialista: boolean;
  inventarioActivo: boolean;
  /** % de la venta o monto fijo por unidad, según `comisionProductoTipo`. */
  comisionProductoTipo: ComisionProductoTipo;
  comisionProductoValor: number;
}

export interface ResultadoCalculo {
  total: number;
  ganProf: number;
  ganSalon: number;
  comisionBancaria: number;
  deduccion: number;
  tarifa: number;
  totalServicios: number;
  totalProductos: number;
  /** Parte de `ganProf` que proviene de comisiones por producto (D4). */
  comisionProductos: number;
  /** Comisión por cada línea de producto, en el MISMO orden que el array de entrada. */
  comisionesPorLinea: number[];
  snapshot: Record<string, unknown>;
}

/** Redondeo monetario consistente a 2 decimales (COP). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Comisión del especialista por una línea de venta de producto (D2). Es la ÚNICA
 * fuente de verdad del cálculo: la usan tanto el cierre de la cita como la venta
 * directa de mostrador, para que nunca diverjan.
 *
 *  - `porcentaje`: % sobre el valor de la línea (cantidad × precio unitario).
 *  - `valor_fijo`: monto fijo por unidad, con tope en el valor de la línea (nunca
 *    se paga al especialista más de lo que costó el producto).
 */
export function comisionProducto(
  cantidad: number,
  valorUnitario: number,
  tipo: ComisionProductoTipo,
  valor: number,
): number {
  if (!(valor > 0) || !(cantidad > 0)) return 0;
  const totalLinea = cantidad * valorUnitario;
  if (tipo === 'valor_fijo') return round2(Math.min(cantidad * valor, totalLinea));
  return round2((totalLinea * valor) / 100);
}

const METODOS_ELECTRONICOS: ReadonlySet<MetodoPago> = new Set([
  MetodoPago.Tarjeta,
  MetodoPago.Transferencia,
  MetodoPago.Nequi,
]);

export function calcularAtencion(
  servicios: ServicioReal[],
  productos: ProductoReal[],
  pagos: PagoReal[],
  p: ParametrosFinancieros,
): ResultadoCalculo {
  const totalServicios = round2(servicios.reduce((s, x) => s + x.precio, 0));
  const totalProductos = p.inventarioActivo
    ? round2(productos.reduce((s, x) => s + x.cantidad * x.valor, 0))
    : 0;

  // Comisión del especialista por producto (D2/D4). Solo con inventario activo y
  // partición por especialista: sin partición no hay ganancia individual, así que
  // el producto entero es del salón (coherente con `ganProf = 0` de más abajo).
  const comisionaProductos = p.inventarioActivo && p.particionPorEspecialista;
  const comisionesPorLinea = comisionaProductos
    ? productos.map((x) => comisionProducto(x.cantidad, x.valor, p.comisionProductoTipo, p.comisionProductoValor))
    : productos.map(() => 0);
  const comisionProductos = round2(comisionesPorLinea.reduce((s, c) => s + c, 0));

  // Repartición por servicio.
  let ganProfServicios = 0;
  let ganSalonServicios = 0;
  for (const s of servicios) {
    let prof: number;
    if (s.splitType === SplitType.ValorFijo) {
      prof = Math.min(s.splitValor, s.precio);
    } else {
      // Porcentaje: % por servicio si está definido (>0); si no, el estándar de la sucursal.
      const pctProf = s.splitValor > 0 ? s.splitValor : p.reparticionProfesional;
      prof = round2((s.precio * pctProf) / 100);
    }
    ganProfServicios += prof;
    ganSalonServicios += s.precio - prof;
  }
  ganProfServicios = round2(ganProfServicios);
  ganSalonServicios = round2(ganSalonServicios);

  // Deducción administrativa: retenida por el salón sobre la ganancia del prof.
  const deduccion = round2((ganProfServicios * p.deduccionAdministrativa) / 100);
  ganProfServicios = round2(ganProfServicios - deduccion);
  ganSalonServicios = round2(ganSalonServicios + deduccion);

  // Tarifa adicional cliente→profesional (el cliente la paga).
  const tarifa = round2((totalServicios * p.tarifaClienteProfesional) / 100);

  // El producto es del salón salvo la comisión que se lleva el especialista (D4:
  // la comisión va INCLUIDA en ganProf; el salón recibe el resto del producto).
  let ganProf = round2(ganProfServicios + tarifa + comisionProductos);
  let ganSalon = round2(ganSalonServicios + totalProductos - comisionProductos);
  const total = round2(totalServicios + totalProductos + tarifa);

  // Comisión bancaria: solo sobre la PORCIÓN electrónica del pago (soporta pago
  // dividido en varios métodos). La absorbe el salón.
  const montoElectronico = round2(
    pagos.filter((x) => METODOS_ELECTRONICOS.has(x.metodo)).reduce((s, x) => s + x.monto, 0),
  );
  const comisionBancaria = round2((montoElectronico * p.comisionBancaria) / 100);
  ganSalon = round2(ganSalon - comisionBancaria);

  // Sin partición por especialista: no hay ganancia individual.
  if (!p.particionPorEspecialista) {
    ganProf = 0;
    ganSalon = round2(total - comisionBancaria);
  }

  return {
    total,
    ganProf,
    ganSalon,
    comisionBancaria,
    deduccion,
    tarifa,
    totalServicios,
    totalProductos,
    comisionProductos,
    comisionesPorLinea,
    snapshot: {
      parametros: p,
      pagos,
      montoElectronico,
      totalServicios,
      totalProductos,
      comisionProductos,
      deduccion,
      tarifa,
      comisionBancaria,
      calculadoEn: new Date().toISOString(),
    },
  };
}
