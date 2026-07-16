/* Orkalis — datos del módulo Gestión (Lote 4): Inventario · Servicios · Equipo.
   Augmenta window.AdminData. Reutiliza OrkData (servicios/especialistas) y
   AdminData.COP. Todos los montos en COP; contexto Colombia. */
(function () {
  const COP = OrkData.COP;
  const MONTHS_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // ──────────────────────────────────────────────────────────────────
  // 4.1 INVENTARIO — dos tipos: "servicio" (consumo) y "venta" (retail)
  //   estado de stock derivado: Agotado (0) · Stock bajo (≤ mínimo) · En stock
  // ──────────────────────────────────────────────────────────────────
  const INV_CATEGORIES = {
    barberia: ["Cuidado de barba", "Cabello", "Afeitado", "Higiene", "Accesorios"],
    salon: ["Color", "Tratamiento", "Uñas", "Cuidado", "Accesorios"],
  };

  const PRODUCTS_FULL = {
    barberia: [
      // — de servicio (consumo interno) —
      { id: "iv-talco",    name: "Talco mentolado",        cat: "Higiene",          tipo: "servicio", qty: 12, unit: "unidades", cost: 6500,  use: 800,   min: 4, supplier: "Distrib. La 13" },
      { id: "iv-espuma",   name: "Espuma de afeitar",      cat: "Afeitado",         tipo: "servicio", qty: 5,  unit: "unidades", cost: 14000, use: 1200,  min: 6, supplier: "Barber Depot" },
      { id: "iv-aftershave", name: "Tónico after shave",   cat: "Afeitado",         tipo: "servicio", qty: 2,  unit: "unidades", cost: 22000, use: 1500,  min: 3, supplier: "Barber Depot" },
      { id: "iv-algodon",  name: "Algodón en lámina",      cat: "Higiene",          tipo: "servicio", qty: 0,  unit: "paquetes", cost: 9000,  use: 300,   min: 5, supplier: "Distrib. La 13" },
      { id: "iv-crema",    name: "Crema de afeitar premium", cat: "Afeitado",       tipo: "servicio", qty: 8,  unit: "unidades", cost: 18000, use: 1500,  min: 4, supplier: "Proraso CO" },
      { id: "iv-aceite-toalla", name: "Aceite esencial (toallas)", cat: "Cuidado de barba", tipo: "servicio", qty: 9, unit: "frascos", cost: 16000, use: 600, min: 4, supplier: "Aromas Andina" },
      // — de venta (retail) —
      { id: "iv-pomada",   name: "Pomada mate",            cat: "Cabello",          tipo: "venta", qty: 8,  unit: "unidades", cost: 18000, use: 0, sale: 32000, min: 5, supplier: "Reuzel CO" },
      { id: "iv-cera",     name: "Cera modeladora",        cat: "Cabello",          tipo: "venta", qty: 14, unit: "unidades", cost: 16000, use: 0, sale: 30000, min: 5, supplier: "Reuzel CO" },
      { id: "iv-aceite-barba", name: "Aceite para barba 30ml", cat: "Cuidado de barba", tipo: "venta", qty: 3, unit: "unidades", cost: 16000, use: 0, sale: 28000, min: 6, supplier: "Aromas Andina" },
      { id: "iv-shampoo",  name: "Shampoo anticaspa",      cat: "Higiene",          tipo: "venta", qty: 0,  unit: "unidades", cost: 13000, use: 0, sale: 24000, min: 4, supplier: "Head&Co" },
      { id: "iv-balsamo",  name: "Bálsamo para barba",     cat: "Cuidado de barba", tipo: "venta", qty: 11, unit: "unidades", cost: 19000, use: 0, sale: 34000, min: 4, supplier: "Aromas Andina" },
      { id: "iv-peine",    name: "Peine de madera",        cat: "Accesorios",       tipo: "venta", qty: 22, unit: "unidades", cost: 8000,  use: 0, sale: 18000, min: 6, supplier: "Barber Depot" },
    ],
    salon: [
      // — de servicio —
      { id: "sv-tinte",    name: "Tinte 7.0 rubio medio",  cat: "Color",            tipo: "servicio", qty: 6,  unit: "tubos",    cost: 28000, use: 9000,  min: 8, supplier: "L'Oréal Pro" },
      { id: "sv-oxigenada", name: "Agua oxigenada 20 vol", cat: "Color",            tipo: "servicio", qty: 4,  unit: "litros",   cost: 12000, use: 2000,  min: 6, supplier: "L'Oréal Pro" },
      { id: "sv-keratina", name: "Keratina líquida",       cat: "Tratamiento",      tipo: "servicio", qty: 10, unit: "frascos",  cost: 55000, use: 12000, min: 4, supplier: "Brasil Cacau" },
      { id: "sv-acetona",  name: "Acetona pura",           cat: "Uñas",             tipo: "servicio", qty: 0,  unit: "litros",   cost: 9000,  use: 600,   min: 3, supplier: "Beauty Supply" },
      { id: "sv-mascarilla-uso", name: "Mascarilla hidratante", cat: "Tratamiento", tipo: "servicio", qty: 9, unit: "frascos",  cost: 42000, use: 6000,  min: 4, supplier: "Kérastase" },
      { id: "sv-aluminio", name: "Papel aluminio (mechas)", cat: "Color",           tipo: "servicio", qty: 15, unit: "rollos",   cost: 14000, use: 900,   min: 5, supplier: "Beauty Supply" },
      // — de venta —
      { id: "sv-mascarilla", name: "Mascarilla nutritiva", cat: "Tratamiento",      tipo: "venta", qty: 12, unit: "unidades", cost: 26000, use: 0, sale: 45000, min: 5, supplier: "L'Oréal Pro" },
      { id: "sv-serum",    name: "Sérum de puntas",        cat: "Cuidado",          tipo: "venta", qty: 2,  unit: "unidades", cost: 30000, use: 0, sale: 52000, min: 5, supplier: "Kérastase" },
      { id: "sv-protector", name: "Protector térmico",     cat: "Cuidado",          tipo: "venta", qty: 0,  unit: "unidades", cost: 21000, use: 0, sale: 38000, min: 4, supplier: "GHD CO" },
      { id: "sv-matizador", name: "Shampoo matizador",     cat: "Cuidado",          tipo: "venta", qty: 9,  unit: "unidades", cost: 24000, use: 0, sale: 42000, min: 4, supplier: "L'Oréal Pro" },
      { id: "sv-esmalte",  name: "Esmalte semipermanente", cat: "Uñas",             tipo: "venta", qty: 18, unit: "unidades", cost: 15000, use: 0, sale: 28000, min: 6, supplier: "OPI CO" },
      { id: "sv-argan",    name: "Aceite de argán",        cat: "Tratamiento",      tipo: "venta", qty: 7,  unit: "unidades", cost: 33000, use: 0, sale: 58000, min: 4, supplier: "Moroccanoil" },
    ],
  };

  function stockStatus(p) {
    if (p.qty <= 0) return "Agotado";
    if (p.qty <= p.min) return "Stock bajo";
    return "En stock";
  }
  function products(vertical) {
    return (PRODUCTS_FULL[vertical] || PRODUCTS_FULL.barberia).map((p) => ({ ...p, status: stockStatus(p), totalValue: p.qty * p.cost }));
  }
  function invCategories(vertical) { return INV_CATEGORIES[vertical] || INV_CATEGORIES.barberia; }
  function inventoryStats(vertical) {
    const list = products(vertical);
    const lowOrOut = list.filter((p) => p.qty <= p.min);
    return {
      count: list.length,
      low: lowOrOut.length,
      lowList: lowOrOut,
      totalValue: list.reduce((a, p) => a + p.totalValue, 0),
      servicio: list.filter((p) => p.tipo === "servicio").length,
      venta: list.filter((p) => p.tipo === "venta").length,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // 4.2 SERVICIOS — catálogo (con reparto) + registro de realizados
  //   split: { mode: "default" | "pct" | "fijo", prof, salon }
  //   surcharge: sobrecargo "de back" (recargo fijo)
  // ──────────────────────────────────────────────────────────────────
  const SERVICE_CFG = {
    barberia: {
      "corte-clasico":   { active: true,  split: { mode: "default" } },
      "fade-premium":    { active: true,  split: { mode: "pct", prof: 65, salon: 35 }, surcharge: 20000 },
      "corte-nino":      { active: true,  split: { mode: "default" } },
      "perfilado-barba": { active: true,  split: { mode: "default" } },
      "afeitado-ritual": { active: true,  split: { mode: "fijo", prof: 18000 } },
      "corte-barba":     { active: true,  split: { mode: "pct", prof: 60, salon: 40 } },
      "facial-express":  { active: false, split: { mode: "default" } },
    },
    salon: {
      "corte-peinado":   { active: true,  split: { mode: "default" } },
      "peinado-evento":  { active: false, split: { mode: "default" } },
      "color-completo":  { active: true,  split: { mode: "pct", prof: 55, salon: 45 }, surcharge: 20000 },
      "balayage":        { active: true,  split: { mode: "pct", prof: 70, salon: 30 } },
      "manicure-semi":   { active: true,  split: { mode: "default" } },
      "pedicure-spa":    { active: true,  split: { mode: "default" } },
      "keratina":        { active: true,  split: { mode: "fijo", prof: 60000 } },
    },
  };
  const DEFAULT_SPLIT = 60; // % profesional por defecto

  function servicesCatalog(vertical) {
    const data = OrkData.get(vertical);
    const cfg = SERVICE_CFG[vertical] || {};
    return data.services.map((s) => {
      const c = cfg[s.id] || { active: true, split: { mode: "default" } };
      const split = c.split || { mode: "default" };
      const custom = split.mode !== "default";
      let splitLabel = `${DEFAULT_SPLIT}% / ${100 - DEFAULT_SPLIT}%`;
      if (split.mode === "pct") splitLabel = `${split.prof}% / ${split.salon}%`;
      else if (split.mode === "fijo") splitLabel = `Fijo ${COP(split.prof)}`;
      return { ...s, active: c.active !== false, split, custom, splitLabel, surcharge: c.surcharge || 0 };
    });
  }
  function serviceCategories(vertical) { return OrkData.get(vertical).categories; }
  function serviceStats(vertical) {
    const list = servicesCatalog(vertical);
    const active = list.filter((s) => s.active);
    const avg = active.length ? Math.round(active.reduce((a, s) => a + s.price, 0) / active.length) : 0;
    return { total: list.length, active: active.length, avg };
  }
  // reparto resuelto a montos (para liquidación / preview del modal)
  function resolveSplit(price, split) {
    if (!split || split.mode === "default") return { prof: Math.round(price * DEFAULT_SPLIT / 100), salon: Math.round(price * (100 - DEFAULT_SPLIT) / 100), label: "Estándar 60/40" };
    if (split.mode === "pct") return { prof: Math.round(price * split.prof / 100), salon: Math.round(price * split.salon / 100), label: `${split.prof}/${split.salon}` };
    if (split.mode === "fijo") return { prof: split.prof, salon: Math.max(0, price - split.prof), label: `Fijo profesional` };
    return { prof: 0, salon: price, label: "—" };
  }

  // Registro de servicios realizados (últimos) — sintético, determinista
  const REG_TIMES = ["9:00", "9:30", "10:15", "11:00", "11:45", "12:30", "13:30", "14:20", "15:00", "16:10", "17:00", "18:00"];
  function serviceRegistry(vertical) {
    const data = OrkData.get(vertical);
    const cli = (AdminData.clients(vertical) || []).filter((c) => !c.pro);
    const notesPool = ["", "Cliente frecuente", "Pagó con Nequi", "Primera visita", "Pidió mismo estilo", "", "Recomendó a un amigo", ""];
    const out = [];
    let day = 9, mon = 5; // jun 2026 hacia atrás
    for (let i = 0; i < 12; i++) {
      const svc = data.services[(i * 3 + 1) % data.services.length];
      const sp = data.specialists[(i * 2) % data.specialists.length];
      const c = cli[(i * 4 + 2) % cli.length];
      if (i && i % 3 === 0) { day -= 1; }
      out.push({
        id: "reg-" + i,
        service: svc.name, price: svc.price,
        client: c ? c.name : "Cliente ocasional",
        specialist: sp.name,
        date: `2026-${String(mon + 1).padStart(2, "0")}-${String(Math.max(1, day)).padStart(2, "0")}`,
        time: REG_TIMES[i % REG_TIMES.length],
        notes: notesPool[i % notesPool.length],
      });
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────────────
  // 4.3 EQUIPO — especialistas, disponibilidad, ganancias, liquidación
  // ──────────────────────────────────────────────────────────────────
  const TEAM_EXTRA = {
    barberia: {
      andres: { phone: "311 845 2210", email: "andres.mejia@orkalis.co", hired: "2019-03-04", branches: ["La Navaja · Chapinero"],            available: false, serviciosHoy: 3, earn: { hoy: 142000, semana: 612000, mes: 2480000 } },
      julian: { phone: "318 220 7765", email: "julian.restrepo@orkalis.co", hired: "2021-08-16", branches: ["La Navaja · Chapinero", "La Navaja · Cedritos"], available: true, serviciosHoy: 2, earn: { hoy: 96000,  semana: 488000, mes: 2010000 } },
      camilo: { phone: "320 551 8830", email: "camilo.ortiz@orkalis.co", hired: "2023-02-01", branches: ["La Navaja · Cedritos"],             available: false, serviciosHoy: 3, earn: { hoy: 110000, semana: 402000, mes: 1740000 } },
    },
    salon: {
      valentina: { phone: "320 671 9043", email: "valentina.gomez@orkalis.co", hired: "2016-05-10", branches: ["Estudio Aura · El Nogal"],          available: false, serviciosHoy: 3, earn: { hoy: 285000, semana: 1340000, mes: 5210000 } },
      daniela:   { phone: "318 220 7765", email: "daniela.cardenas@orkalis.co", hired: "2019-11-20", branches: ["Estudio Aura · El Nogal", "Estudio Aura · Santa Bárbara"], available: true, serviciosHoy: 2, earn: { hoy: 198000, semana: 1180000, mes: 4620000 } },
      mariana:   { phone: "319 663 0098", email: "mariana.ruiz@orkalis.co", hired: "2020-07-03", branches: ["Estudio Aura · Santa Bárbara"],      available: true, serviciosHoy: 2, earn: { hoy: 132000, semana: 740000,  mes: 2980000 } },
    },
  };
  function team(vertical) {
    const data = OrkData.get(vertical);
    const ex = TEAM_EXTRA[vertical] || {};
    return data.specialists.map((s) => ({ ...s, ...(ex[s.id] || {}), specialty: s.role }));
  }
  function teamStats(vertical) {
    const list = team(vertical);
    const libres = list.filter((s) => s.available).length;
    return {
      activos: list.length, libres,
      serviciosHoy: list.reduce((a, s) => a + (s.serviciosHoy || 0), 0),
      gananciasHoy: list.reduce((a, s) => a + ((s.earn && s.earn.hoy) || 0), 0),
      gananciasMes: list.reduce((a, s) => a + ((s.earn && s.earn.mes) || 0), 0),
    };
  }

  // Meses disponibles para liquidación (con/ sin actividad)
  function liquidationMonths() {
    return [
      { key: "2026-06", label: "junio 2026", activity: true },
      { key: "2026-05", label: "mayo 2026", activity: true },
      { key: "2026-04", label: "abril 2026", activity: true },
      { key: "2026-03", label: "marzo 2026", activity: false },
    ];
  }

  // Liquidación detallada de un especialista para un mes.
  // payMethod: "efectivo" | "transferencia" (transferencia → -2% sobre brutas)
  function liquidation(vertical, specialistId, monthKey, payMethod) {
    const list = team(vertical);
    const sp = list.find((s) => s.id === specialistId) || list[0];
    const month = liquidationMonths().find((m) => m.key === monthKey) || liquidationMonths()[0];
    if (!month.activity) return { sp, month, empty: true };

    const data = OrkData.get(vertical);
    const catalog = servicesCatalog(vertical);
    // genera filas de servicio deterministas a partir de los picks del especialista
    const picks = (sp.picks && sp.picks.length ? sp.picks : data.services.slice(0, 2).map((s) => s.id));
    const monthFactor = monthKey === "2026-06" ? 1 : monthKey === "2026-05" ? 0.92 : 0.84;
    const rows = [];
    const baseCount = Math.round((sp.earn ? sp.earn.mes : 2000000) / 26000 * monthFactor);
    let seed = 0; for (let i = 0; i < specialistId.length; i++) seed += specialistId.charCodeAt(i);
    for (let i = 0; i < 6; i++) {
      const svc = catalog.find((s) => s.id === picks[i % picks.length]) || catalog[(seed + i) % catalog.length];
      const rep = resolveSplit(svc.price, svc.split);
      const productCost = (i % 2 === 0) ? 0 : Math.round(svc.price * 0.08);
      rows.push({
        date: `${monthKey}-${String(3 + i * 4).padStart(2, "0")}`,
        service: svc.name, price: svc.price,
        repLabel: svc.split.mode === "default" ? "Estándar" : svc.split.mode === "pct" ? `${svc.split.prof}/${svc.split.salon}` : "Fijo",
        prof: rep.prof, salon: rep.salon,
        productCost,
        back: svc.surcharge || 0,
      });
    }
    // ventas de productos con comisión 10%
    const ventas = [
      { product: products(vertical).find((p) => p.tipo === "venta").name, qty: 3, unit: products(vertical).find((p) => p.tipo === "venta").sale, },
      { product: products(vertical).filter((p) => p.tipo === "venta")[1].name, qty: 2, unit: products(vertical).filter((p) => p.tipo === "venta")[1].sale },
    ].map((v) => ({ ...v, total: v.qty * v.unit, comision: Math.round(v.qty * v.unit * 0.10) }));

    // resumen
    const brutas = Math.round((sp.earn ? sp.earn.mes : 2000000) * monthFactor);
    const costoProductos = rows.reduce((a, r) => a + r.productCost, 0) + 84000;
    const comisionBack = rows.reduce((a, r) => a + Math.round(r.back * 0.5), 0) + 40000;
    const comisionBancaria = Math.round(brutas * 0.025);
    const deduccionAdmin = Math.round(brutas * 0.04);
    const comisionVentas = ventas.reduce((a, v) => a + v.comision, 0);
    const descTransfer = payMethod === "transferencia" ? Math.round(brutas * 0.02) : 0;
    const neto = brutas - costoProductos - comisionBack - comisionBancaria - deduccionAdmin - descTransfer + comisionVentas;
    const totalServicios = baseCount;
    const promedio = totalServicios ? Math.round(brutas / totalServicios) : 0;

    return {
      sp, month, empty: false, payMethod: payMethod || "efectivo",
      summary: { brutas, costoProductos, comisionBack, comisionBancaria, deduccionAdmin, comisionVentas, descTransfer, neto, totalServicios, promedio },
      rows, ventas,
    };
  }

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return `${MONTHS_FULL[m - 1]} ${y}`;
  }

  Object.assign(window.AdminData, {
    // inventario
    products, invCategories, inventoryStats, stockStatus,
    // servicios
    servicesCatalog, serviceCategories, serviceStats, resolveSplit, serviceRegistry, DEFAULT_SPLIT,
    // equipo
    team, teamStats, liquidation, liquidationMonths, monthLabel,
  });
})();
