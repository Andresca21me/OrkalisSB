/* Orkalis — datos del módulo Finanzas (Lote 5): Análisis · Control quincenal · Reportes.
   Augmenta window.AdminData. Cifras en COP, contexto Colombia.
   Lógica de reparto: la parte del profesional se separa en origen y NO es egreso.
   El salón ingresa: su porción neta de servicios + valor de productos usados +
   comisiones administrativas. Egresos = gastos fijos + variables + comisión bancaria. */
(function () {
  const COP = OrkData.COP;
  const MONTHS_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // ── Parámetros financieros vigentes (config) ──────────────────────
  // source: "heredado" del negocio · "propio" override de la sucursal.
  const PARAM_DEFAULTS = {
    repartoProf: 60,        // % al profesional
    repartoSalon: 40,       // % al salón
    deduccionAdmin: 3,      // % deducción administrativa
    comisionBancaria: 2,    // % comisión bancaria (sobre pagos con tarjeta)
    tarifaProfesional: 20000, // tarifa fija a cliente profesional (sobrecargo "back")
    comisionProducto: 10,   // % comisión por venta de producto
  };
  // un override por sucursal secundaria para demostrar el indicador "propio"
  function finParams(vertical, branch, consolidated) {
    const branches = SpecData.branches(vertical);
    const isSecond = !consolidated && branch === branches[1];
    return [
      { key: "reparto", label: "Repartición profesional / salón", value: `${PARAM_DEFAULTS.repartoProf}% / ${PARAM_DEFAULTS.repartoSalon}%`, source: "heredado" },
      { key: "admin", label: "Deducción administrativa", value: `${isSecond ? "3,5" : PARAM_DEFAULTS.deduccionAdmin}%`, source: isSecond ? "propio" : "heredado" },
      { key: "banco", label: "Comisión bancaria", value: `${PARAM_DEFAULTS.comisionBancaria}%`, source: "heredado" },
      { key: "tarifa", label: "Tarifa a cliente profesional", value: COP(PARAM_DEFAULTS.tarifaProfesional), source: "heredado" },
    ];
  }

  // ── Base financiera mensual por vertical ──────────────────────────
  // Componentes ya separados según la lógica de reparto.
  const FIN_BASE = {
    barberia: {
      facturado: 18420000,           // total facturado del mes
      profPayout: 9840000,           // pagos a profesionales (NO es egreso)
      repartoNetoSalon: 7260000,     // porción neta del salón por servicios
      productosUsados: 1320000,      // valor de productos consumidos en servicios
      comisionesAdmin: 295000,       // comisiones administrativas que ingresan al salón
      comisionesBancarias: 202000,   // comisión bancaria del mes (egreso)
      servicios: 312,
      inventarioValor: 1281000,
    },
    salon: {
      facturado: 41250000,
      profPayout: 22300000,
      repartoNetoSalon: 15100000,
      productosUsados: 3850000,
      comisionesAdmin: 690000,
      comisionesBancarias: 540000,
      servicios: 286,
      inventarioValor: 3940000,
    },
  };

  // Gastos fijos (se inactivan, borrado lógico) y variables (borrado físico)
  const GASTOS = {
    barberia: {
      fijos: [
        { id: "gf1", name: "Arriendo del local", cat: "Local", monto: 1800000, freq: "Mensual", metodo: "Transferencia", activo: true },
        { id: "gf2", name: "Servicios públicos", cat: "Local", monto: 380000, freq: "Mensual", metodo: "Débito automático", activo: true },
        { id: "gf3", name: "Plan Orkalis", cat: "Software", monto: 89000, freq: "Mensual", metodo: "T. crédito", activo: true },
        { id: "gf4", name: "Recepción (nómina)", cat: "Nómina", monto: 1423500, freq: "Mensual", metodo: "Transferencia", activo: true },
      ],
      variables: [
        { id: "gv1", name: "Compra de insumos", cat: "Insumos", monto: 620000, fecha: "2026-06-04", metodo: "Efectivo" },
        { id: "gv2", name: "Pauta en Instagram", cat: "Publicidad", monto: 250000, fecha: "2026-06-02", metodo: "T. crédito" },
        { id: "gv3", name: "Mantenimiento sillas", cat: "Mantenimiento", monto: 180000, fecha: "2026-06-06", metodo: "Efectivo" },
      ],
    },
    salon: {
      fijos: [
        { id: "gf1", name: "Arriendo del local", cat: "Local", monto: 4200000, freq: "Mensual", metodo: "Transferencia", activo: true },
        { id: "gf2", name: "Servicios públicos", cat: "Local", monto: 720000, freq: "Mensual", metodo: "Débito automático", activo: true },
        { id: "gf3", name: "Plan Orkalis", cat: "Software", monto: 149000, freq: "Mensual", metodo: "T. crédito", activo: true },
        { id: "gf4", name: "Recepción + asistente", cat: "Nómina", monto: 2680000, freq: "Mensual", metodo: "Transferencia", activo: true },
      ],
      variables: [
        { id: "gv1", name: "Compra de color e insumos", cat: "Insumos", monto: 1840000, fecha: "2026-06-05", metodo: "Transferencia" },
        { id: "gv2", name: "Campaña de temporada", cat: "Publicidad", monto: 560000, fecha: "2026-06-03", metodo: "T. crédito" },
        { id: "gv3", name: "Mantenimiento equipos", cat: "Mantenimiento", monto: 320000, fecha: "2026-06-07", metodo: "Efectivo" },
      ],
    },
  };
  function gastos(vertical) {
    const g = GASTOS[vertical] || GASTOS.barberia;
    return { fijos: g.fijos.map((x) => ({ ...x })), variables: g.variables.map((x) => ({ ...x })) };
  }
  const GASTO_CATS = ["Arriendo", "Servicios públicos", "Nómina administrativa", "Operativos", "Mantenimiento", "Marketing", "Seguros", "Impuestos", "Compra de productos", "Otros"];
  const GASTO_FREQS = ["Mensual", "Quincenal", "Anual"];

  // factores de escala por período
  const PERIOD_FACTOR = { semana: 1 / 4.3, mes: 1, ano: 11.6 };
  const PERIOD_LABEL = { semana: "Esta semana", mes: "Este mes", ano: "Este año" };
  // escenario financiero (tweak): multiplica egresos para mostrar las 3 saludes
  const SCENARIO_MULT = { saludable: 1, baja: 1.78, perdidas: 2.55 };

  // ── Análisis financiero del período ───────────────────────────────
  function analysis(vertical, period, scenario) {
    const b = FIN_BASE[vertical] || FIN_BASE.barberia;
    const f = PERIOD_FACTOR[period] != null ? PERIOD_FACTOR[period] : 1;
    const mult = SCENARIO_MULT[scenario] || 1;
    const g = gastos(vertical);
    const fijosMes = g.fijos.filter((x) => x.activo).reduce((a, x) => a + x.monto, 0);
    const variablesMes = g.variables.reduce((a, x) => a + x.monto, 0);

    // ingresos del salón
    const repartoNetoSalon = Math.round(b.repartoNetoSalon * f);
    const productosUsados = Math.round(b.productosUsados * f);
    const comisionesAdmin = Math.round(b.comisionesAdmin * f);
    const ingresosSalon = repartoNetoSalon + productosUsados + comisionesAdmin;

    // egresos operativos
    const gastosFijos = Math.round(fijosMes * f * mult);
    const gastosVariables = Math.round(variablesMes * f * mult);
    const comisionesBancarias = Math.round(b.comisionesBancarias * f);
    const egresos = gastosFijos + gastosVariables + comisionesBancarias;

    const neta = ingresosSalon - egresos;
    const margen = ingresosSalon ? (neta / ingresosSalon) * 100 : 0;
    const health = margen < 0 ? "perdidas" : margen < 10 ? "baja" : "saludable";

    return {
      period, periodLabel: PERIOD_LABEL[period],
      facturado: Math.round(b.facturado * f), profPayout: Math.round(b.profPayout * f),
      inventarioValor: b.inventarioValor,
      ingresosSalon, repartoNetoSalon, productosUsados, comisionesAdmin,
      egresos, gastosFijos, gastosVariables, comisionesBancarias,
      neta, margen, health,
    };
  }

  // ── Distribución por método de pago ───────────────────────────────
  const PAY_DIST = {
    barberia: [
      { id: "efectivo", label: "Efectivo", pct: 38, color: "#1A73E8" },
      { id: "nequi", label: "Nequi", pct: 31, color: "#0F766E" },
      { id: "debito", label: "T. débito", pct: 16, color: "#64748B" },
      { id: "credito", label: "T. crédito", pct: 11, color: "#B45309" },
      { id: "qr", label: "Código QR", pct: 4, color: "#7C3AED" },
    ],
    salon: [
      { id: "efectivo", label: "Efectivo", pct: 22, color: "#1A73E8" },
      { id: "nequi", label: "Nequi", pct: 27, color: "#0F766E" },
      { id: "debito", label: "T. débito", pct: 25, color: "#64748B" },
      { id: "credito", label: "T. crédito", pct: 21, color: "#B45309" },
      { id: "qr", label: "Código QR", pct: 5, color: "#7C3AED" },
    ],
  };
  function payDistribution(vertical, period) {
    const a = analysis(vertical, period || "mes");
    const dist = (PAY_DIST[vertical] || PAY_DIST.barberia);
    return dist.map((d) => ({ ...d, monto: Math.round(a.facturado * d.pct / 100) }));
  }

  // ── Ganancias por especialista (gráfico) ──────────────────────────
  function earningsBySpecialist(vertical, period) {
    const f = PERIOD_FACTOR[period] != null ? PERIOD_FACTOR[period] : 1;
    const team = AdminData.team(vertical);
    return team.map((s) => ({ id: s.id, name: s.name, color: AdminData.specialistColor(vertical, s.id), value: Math.round((s.earn ? s.earn.mes : 0) * f) }))
      .sort((a, b) => b.value - a.value);
  }

  // ── Valor del inventario (tendencia 6 puntos) ─────────────────────
  function inventoryTrend(vertical) {
    const b = FIN_BASE[vertical] || FIN_BASE.barberia;
    const base = b.inventarioValor;
    const factors = [0.82, 0.91, 0.78, 0.95, 1.08, 1];
    return factors.map((fc, i) => ({ label: MONTHS_SHORT[(0 + i)], value: Math.round(base * fc) }));
  }

  // ── Tendencia de ingresos (reportes) ──────────────────────────────
  function revenueTrend(vertical, period) {
    const b = FIN_BASE[vertical] || FIN_BASE.barberia;
    if (period === "semana") {
      const days = ["lun", "mar", "mié", "jue", "vie", "sáb"];
      const fc = [0.7, 0.85, 0.78, 0.92, 1.15, 1.35];
      const daily = b.facturado / 26;
      return days.map((d, i) => ({ label: d, value: Math.round(daily * fc[i]) }));
    }
    if (period === "ano") {
      const fc = [0.86, 0.79, 0.94, 0.9, 1.02, 1, 0.0, 0, 0, 0, 0, 0].slice(0, 6);
      return MONTHS_SHORT.slice(0, 6).map((m, i) => ({ label: m, value: Math.round(b.facturado * fc[i]) }));
    }
    // mes → semanas
    const fc = [0.92, 1.05, 0.88, 1.12];
    return ["Sem 1", "Sem 2", "Sem 3", "Sem 4"].map((w, i) => ({ label: w, value: Math.round((b.facturado / 4) * fc[i]) }));
  }

  // ── Distribución por tipo de servicio (reportes) ──────────────────
  const SERVICE_DIST = {
    barberia: [
      { label: "Cortes", pct: 46, color: "#1A73E8" },
      { label: "Barba", pct: 27, color: "#0F766E" },
      { label: "Combos", pct: 19, color: "#64748B" },
      { label: "Otros", pct: 8, color: "#B45309" },
    ],
    salon: [
      { label: "Color", pct: 38, color: "#1A73E8" },
      { label: "Corte y peinado", pct: 26, color: "#0F766E" },
      { label: "Tratamientos", pct: 21, color: "#64748B" },
      { label: "Uñas", pct: 15, color: "#B45309" },
    ],
  };
  function serviceDistribution(vertical) { return (SERVICE_DIST[vertical] || SERVICE_DIST.barberia).map((d) => ({ ...d })); }

  // ── Reportes: resumen administrativo ──────────────────────────────
  function adminReport(vertical, period) {
    const a = analysis(vertical, period);
    const b = FIN_BASE[vertical] || FIN_BASE.barberia;
    const f = PERIOD_FACTOR[period] != null ? PERIOD_FACTOR[period] : 1;
    return {
      ingresosTotales: a.facturado, servicios: Math.round(b.servicios * f),
      profesionales: a.profPayout, salon: a.neta, productosUsados: a.productosUsados,
      // desglose ganancias del salón
      breakdown: {
        valorNeto: a.repartoNetoSalon,
        productos: a.productosUsados,
        comisionAdmin: a.comisionesAdmin,
        comisionBancaria: a.comisionesBancarias,
        totalNeto: a.repartoNetoSalon + a.productosUsados + a.comisionesAdmin - a.comisionesBancarias,
      },
    };
  }
  // ranking de profesionales (reportes)
  function specialistRanking(vertical, period) {
    const f = PERIOD_FACTOR[period] != null ? PERIOD_FACTOR[period] : 1;
    const team = AdminData.team(vertical);
    return team.map((s) => ({
      id: s.id, name: s.name, color: AdminData.specialistColor(vertical, s.id),
      ingresos: Math.round((s.earn ? s.earn.mes : 0) * 1.6 * f),
      servicios: Math.round((s.earn ? s.earn.mes : 0) / 26000 * f),
    })).sort((a, b) => b.ingresos - a.ingresos);
  }

  // ── Control quincenal / cierre ────────────────────────────────────
  // Hoy: martes 9 jun 2026 → primera quincena (1–15) en curso; segunda sin datos.
  function quincena(vertical, which) {
    const b = FIN_BASE[vertical] || FIN_BASE.barberia;
    if (which === "primera") {
      const fc = 9 / 15 * 0.5; // 9 días de 15, primera mitad del mes
      return { which, label: "Primera quincena · 1–15 jun", enCurso: true, empty: false,
        ingresos: Math.round(b.facturado * fc), servicios: Math.round(b.servicios * fc), ganancias: Math.round(b.repartoNetoSalon * fc) };
    }
    if (which === "segunda") {
      return { which, label: "Segunda quincena · 16–30 jun", enCurso: false, empty: true,
        ingresos: 0, servicios: 0, ganancias: 0 };
    }
    // mes completo (acumulado = primera, segunda aún sin datos)
    const fc = 9 / 15 * 0.5;
    return { which: "mes", label: "Mes completo · junio", enCurso: true, empty: false,
      ingresos: Math.round(b.facturado * fc), servicios: Math.round(b.servicios * fc), ganancias: Math.round(b.repartoNetoSalon * fc) };
  }
  function archivableMonths() {
    return [
      { key: "2026-06", label: "junio 2026", current: true },
      { key: "2026-05", label: "mayo 2026", current: false },
      { key: "2026-04", label: "abril 2026", current: false },
      { key: "2026-03", label: "marzo 2026", current: false },
    ];
  }

  function monthLabelFin(key) {
    const [y, m] = key.split("-").map(Number);
    return `${MONTHS_FULL[m - 1]} ${y}`;
  }

  Object.assign(window.AdminData, {
    finParams, analysis, payDistribution, earningsBySpecialist, inventoryTrend,
    revenueTrend, serviceDistribution, adminReport, specialistRanking,
    gastos, GASTO_CATS, GASTO_FREQS,
    quincena, archivableMonths, monthLabelFin,
    PERIOD_LABEL,
  });
})();
