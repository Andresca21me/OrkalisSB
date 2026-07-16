/* Orkalis — datos del Panel de Administración (Lote 3).
   Reutiliza OrkData (servicios, especialistas, negocio) y SpecData (productos,
   sucursales, pagos). Añade la vista multi-especialista del día, KPIs del panel,
   resumen financiero del mes, clientes/CRM y periodos de cierre. */
(function () {
  const COP = OrkData.COP;
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmt = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  const NOW_MIN = 12 * 60; // 12:00, martes 9 jun 2026

  // ── Color de cinta por especialista ───────────────────────────────
  const RIBBONS = ["#1A73E8", "#0F766E", "#64748B", "#B45309", "#7C3AED", "#0F1923"];
  function specialistColor(vertical, id) {
    const list = OrkData.get(vertical).specialists;
    const i = Math.max(0, list.findIndex((s) => s.id === id));
    return RIBBONS[i % RIBBONS.length];
  }

  // ── Citas del día (multi-especialista) ────────────────────────────
  // raw: hora, cliente, teléfono, servicios, especialista, estado, pago
  const APPTS = {
    barberia: [
      { time: "9:00",  clientName: "Mateo Herrera",  clientPhone: "300 218 7745", serviceIds: ["corte-clasico"],              specialistId: "julian", status: "Completada",  payment: "efectivo", source: "agenda" },
      { time: "9:30",  clientName: "Sebastián Ríos",  clientPhone: "311 902 4418", serviceIds: ["perfilado-barba"],            specialistId: "camilo", status: "Completada",  payment: "nequi",    source: "publico" },
      { time: "10:00", clientName: "Felipe Cano",     clientPhone: "315 770 1192", serviceIds: ["fade-premium"],               specialistId: "andres", status: "Completada",  payment: "nequi",    source: "agenda" },
      { time: "10:30", clientName: "Óscar Díaz",      clientPhone: "300 551 8830", serviceIds: ["corte-clasico"],              specialistId: "julian", status: "No asistió",  source: "agenda" },
      { time: "11:30", clientName: "Daniel Ríos",     clientPhone: "311 845 2210", serviceIds: ["corte-barba"],                specialistId: "andres", status: "En progreso", source: "agenda" },
      { time: "12:30", clientName: "Iván Lozano",     clientPhone: "318 220 7765", serviceIds: ["afeitado-ritual"],            specialistId: "julian", status: "Confirmada",  source: "agenda" },
      { time: "13:30", clientName: "Camilo Restrepo", clientPhone: "320 551 8830", serviceIds: ["corte-barba"],                specialistId: "camilo", status: "Confirmada",  source: "agenda" },
      { time: "15:30", clientName: "Tomás Vélez",     clientPhone: "",             serviceIds: ["perfilado-barba"],            specialistId: "julian", status: "Solicitada",  source: "publico" },
      { time: "16:00", clientName: "Nicolás Pérez",   clientPhone: "319 663 0098", serviceIds: ["fade-premium"],               specialistId: "andres", status: "Cancelada",   source: "agenda" },
      { time: "17:00", clientName: "Andrés Patiño",   clientPhone: "301 445 9921", serviceIds: ["corte-barba", "facial-express"], specialistId: "camilo", status: "Confirmada", source: "agenda" },
    ],
    salon: [
      { time: "8:30",  clientName: "Camila Soto",     clientPhone: "301 445 9921", serviceIds: ["corte-peinado"],              specialistId: "valentina", status: "Completada",  payment: "efectivo", source: "agenda" },
      { time: "9:30",  clientName: "Lucía Naranjo",   clientPhone: "318 220 7765", serviceIds: ["balayage"],                   specialistId: "daniela",   status: "Completada",  payment: "credito",  source: "agenda" },
      { time: "10:30", clientName: "Andrea Gil",      clientPhone: "319 663 0098", serviceIds: ["manicure-semi"],             specialistId: "mariana",   status: "Completada",  payment: "nequi",    source: "publico" },
      { time: "11:30", clientName: "Sofía Marín",     clientPhone: "316 448 7720", serviceIds: ["corte-peinado"],              specialistId: "valentina", status: "En progreso", source: "agenda" },
      { time: "12:30", clientName: "Paula Restrepo",  clientPhone: "300 991 2245", serviceIds: ["color-completo"],             specialistId: "daniela",   status: "Confirmada",  source: "agenda" },
      { time: "13:00", clientName: "Marcela Ruiz",    clientPhone: "311 902 4418", serviceIds: ["corte-peinado"],              specialistId: "valentina", status: "No asistió",  source: "agenda" },
      { time: "14:00", clientName: "Juliana Botero",  clientPhone: "320 671 9043", serviceIds: ["pedicure-spa"],               specialistId: "mariana",   status: "Confirmada",  source: "agenda" },
      { time: "15:00", clientName: "Tatiana Ramírez", clientPhone: "",             serviceIds: ["keratina"],                   specialistId: "daniela",   status: "Solicitada",  source: "publico" },
      { time: "16:00", clientName: "Diana Castaño",   clientPhone: "315 770 1192", serviceIds: ["balayage"],                   specialistId: "daniela",   status: "Cancelada",   source: "agenda" },
      { time: "16:30", clientName: "Verónica Lara",   clientPhone: "300 218 7745", serviceIds: ["manicure-semi", "pedicure-spa"], specialistId: "mariana", status: "Confirmada", source: "agenda" },
    ],
  };

  function decorate(appt, vertical) {
    const data = OrkData.get(vertical);
    const services = appt.serviceIds.map((id) => data.services.find((s) => s.id === id)).filter(Boolean);
    const total = services.reduce((a, s) => a + s.price, 0);
    const dur = services.reduce((a, s) => a + s.min, 0);
    const start = toMin(appt.time);
    const sp = data.specialists.find((s) => s.id === appt.specialistId);
    return {
      ...appt, id: appt.id || (appt.time + "-" + appt.specialistId),
      services, total, dur, startMin: start, endMin: start + dur, endLabel: fmt(start + dur),
      specialist: sp, specialistName: sp ? sp.name : "—", color: specialistColor(vertical, appt.specialistId),
    };
  }

  // Orden por prioridad de estado y hora (para la Agenda)
  const STATUS_RANK = { "En progreso": 0, Solicitada: 1, Confirmada: 2, "No asistió": 3, Completada: 4, Cancelada: 5 };
  function dayAppointments(vertical, { sort = "hora" } = {}) {
    const list = APPTS[vertical].map((a) => decorate(a, vertical));
    if (sort === "prioridad")
      return list.sort((a, b) => (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (a.startMin - b.startMin));
    return list.sort((a, b) => a.startMin - b.startMin);
  }

  const ACTIVE_STATES = ["Solicitada", "Confirmada", "En progreso", "Completada"];
  function computeTotals(list) {
    const programadas = list.filter((a) => a.status === "Confirmada" || a.status === "Solicitada").length;
    const completadas = list.filter((a) => a.status === "Completada");
    const enProgreso = list.filter((a) => a.status === "En progreso").length;
    const ingresosReal = completadas.reduce((a, t) => a + t.total, 0);
    const ingresosEst = list.filter((a) => ACTIVE_STATES.includes(a.status)).reduce((a, t) => a + t.total, 0);
    return { total: list.length, programadas, completadas: completadas.length, enProgreso, ingresosReal, ingresosEst };
  }
  function dayTotals(vertical) { return computeTotals(dayAppointments(vertical)); }

  // Próxima cita a partir de NOW
  function computeNext(list) {
    const upcoming = list
      .filter((a) => (a.status === "Confirmada" || a.status === "Solicitada") && a.startMin >= NOW_MIN)
      .sort((a, b) => a.startMin - b.startMin);
    if (!upcoming.length) return null;
    const n = upcoming[0];
    return { ...n, inMin: n.startMin - NOW_MIN };
  }
  function nextAppointment(vertical) { return computeNext(dayAppointments(vertical)); }

  const DAY_META = {
    barberia: { citasTrend: "+2", citasTrendUp: true, disponibles: 3 },
    salon:    { citasTrend: "+1", citasTrendUp: true, disponibles: 3 },
  };
  function dayMeta(vertical) {
    return { ...DAY_META[vertical], especialistas: OrkData.get(vertical).specialists.length };
  }

  // ── KPIs del panel ────────────────────────────────────────────────
  function dashboardKpis(vertical) {
    const totals = dayTotals(vertical);
    const sps = OrkData.get(vertical).specialists;
    const meta = {
      barberia: { citasTrend: "+2", citasTrendUp: true, disponibles: 3, total: 3 },
      salon:    { citasTrend: "+1", citasTrendUp: true, disponibles: 3, total: 3 },
    }[vertical];
    const next = nextAppointment(vertical);
    return {
      citasHoy: totals.total,
      citasTrend: meta.citasTrend, citasTrendUp: meta.citasTrendUp,
      ingresosEst: totals.ingresosEst,
      disponibles: meta.disponibles, especialistas: sps.length,
      next,
    };
  }

  // ── Resumen financiero del mes ────────────────────────────────────
  const FINANCE = {
    barberia: { ingresos: 18420000, profesionales: 9840000, salon: 7260000, productos: 1320000, mes: "junio" },
    salon:    { ingresos: 41250000, profesionales: 22300000, salon: 15100000, productos: 3850000, mes: "junio" },
  };
  function monthlyFinance(vertical) { return FINANCE[vertical] || FINANCE.barberia; }

  // ── Stock bajo (reutiliza productos de SpecData) ──────────────────
  function lowStock(vertical) {
    return SpecData.products(vertical).filter((p) => p.stock <= 3).slice(0, 3);
  }

  // ── Clientes / CRM ────────────────────────────────────────────────
  const CLIENTS = {
    barberia: [
      { id: "c1",  name: "Andrés Patiño",   phone: "301 445 9921", email: "andres.patino@gmail.com",   servicios: 14, gastado: 532000, ultima: "2026-06-02", nuevo: false, pro: false, freq: true },
      { id: "c2",  name: "Daniel Ríos",     phone: "311 845 2210", email: "drios@outlook.com",          servicios: 9,  gastado: 348000, ultima: "2026-06-09", nuevo: false, pro: false, freq: true },
      { id: "c3",  name: "Felipe Cano",     phone: "315 770 1192", email: "felipe.cano@gmail.com",      servicios: 6,  gastado: 228000, ultima: "2026-06-09", nuevo: false, pro: false, freq: false },
      { id: "c4",  name: "Mateo Herrera",   phone: "300 218 7745", email: "",                            servicios: 3,  gastado: 84000,  ultima: "2026-06-09", nuevo: false, pro: false, freq: false },
      { id: "c5",  name: "Sebastián Ríos",  phone: "311 902 4418", email: "seba.rios@gmail.com",        servicios: 2,  gastado: 50000,  ultima: "2026-06-05", nuevo: true,  pro: false, freq: false },
      { id: "c6",  name: "Tomás Vélez",     phone: "318 442 1190", email: "",                            servicios: 1,  gastado: 20000,  ultima: "2026-06-01", nuevo: true,  pro: false, freq: false },
      { id: "c7",  name: "Iván Lozano",     phone: "318 220 7765", email: "ivan.lozano@empresa.co",     servicios: 11, gastado: 410000, ultima: "2026-05-28", nuevo: false, pro: false, freq: true },
      { id: "c8",  name: "Camilo Ortiz",    phone: "320 551 8830", email: "camilo.o@orkalis.co",        servicios: 0,  gastado: 0,      ultima: null,        nuevo: false, pro: true,  freq: false },
      { id: "c9",  name: "Nicolás Pérez",   phone: "319 663 0098", email: "nico.perez@gmail.com",       servicios: 4,  gastado: 152000, ultima: "2026-05-21", nuevo: false, pro: false, freq: false },
      { id: "c10", name: "Juan D. Rincón",  phone: "300 991 2245", email: "jrincon@gmail.com",          servicios: 7,  gastado: 266000, ultima: "2026-05-30", nuevo: false, pro: false, freq: true },
    ],
    salon: [
      { id: "c1",  name: "Valentina Gómez",  phone: "320 671 9043", email: "valen.gomez@orkalis.co",     servicios: 0,  gastado: 0,       ultima: null,        nuevo: false, pro: true,  freq: false },
      { id: "c2",  name: "Paula Restrepo",   phone: "300 991 2245", email: "paula.restrepo@gmail.com",   servicios: 12, gastado: 1380000, ultima: "2026-06-09", nuevo: false, pro: false, freq: true },
      { id: "c3",  name: "Lucía Naranjo",    phone: "318 220 7765", email: "lucia.naranjo@gmail.com",    servicios: 8,  gastado: 1240000, ultima: "2026-06-09", nuevo: false, pro: false, freq: true },
      { id: "c4",  name: "Camila Soto",      phone: "301 445 9921", email: "camisoto@outlook.com",       servicios: 15, gastado: 980000,  ultima: "2026-06-09", nuevo: false, pro: false, freq: true },
      { id: "c5",  name: "Andrea Gil",       phone: "319 663 0098", email: "",                            servicios: 5,  gastado: 320000,  ultima: "2026-06-09", nuevo: false, pro: false, freq: false },
      { id: "c6",  name: "Tatiana Ramírez",  phone: "316 448 7720", email: "tati.ramirez@gmail.com",     servicios: 2,  gastado: 285000,  ultima: "2026-06-04", nuevo: true,  pro: false, freq: false },
      { id: "c7",  name: "Juliana Botero",   phone: "318 442 1190", email: "juli.botero@empresa.co",     servicios: 9,  gastado: 690000,  ultima: "2026-05-29", nuevo: false, pro: false, freq: true },
      { id: "c8",  name: "Verónica Lara",    phone: "300 218 7745", email: "",                            servicios: 3,  gastado: 175000,  ultima: "2026-06-02", nuevo: true,  pro: false, freq: false },
      { id: "c9",  name: "Diana Castaño",    phone: "315 770 1192", email: "diana.castano@gmail.com",    servicios: 6,  gastado: 1110000, ultima: "2026-05-25", nuevo: false, pro: false, freq: false },
      { id: "c10", name: "Marcela Ruiz",     phone: "311 902 4418", email: "marcela.ruiz@gmail.com",     servicios: 4,  gastado: 540000,  ultima: "2026-05-18", nuevo: false, pro: false, freq: false },
    ],
  };
  function clients(vertical) { return CLIENTS[vertical] || CLIENTS.barberia; }

  function clientStats(vertical) {
    const list = clients(vertical).filter((c) => !c.pro);
    const total = list.length;
    const nuevos = list.filter((c) => c.nuevo).length;
    const ingresos = list.reduce((a, c) => a + c.gastado, 0);
    const conGasto = list.filter((c) => c.servicios > 0);
    const promedio = conGasto.length ? Math.round(ingresos / conGasto.length) : 0;
    return { total, nuevos, ingresos, promedio };
  }

  // Historial de un cliente (servicios recibidos)
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  function clientHistory(vertical, clientId) {
    const data = OrkData.get(vertical);
    const c = clients(vertical).find((x) => x.id === clientId);
    if (!c || c.servicios === 0) return [];
    // genera un historial determinista a partir de los servicios del negocio
    const pays = ["efectivo", "nequi", "debito", "credito"];
    const payLabel = { efectivo: "Efectivo", nequi: "Nequi", debito: "T. débito", credito: "T. crédito", qr: "Código QR" };
    let seed = 0; for (let i = 0; i < clientId.length + c.name.length; i++) seed = (seed * 31 + (clientId + c.name).charCodeAt(i % (clientId.length))) % 9973;
    const out = [];
    const n = Math.min(c.servicios, 6);
    let day = 9, month = 5; // empieza ~jun 2026 hacia atrás
    for (let i = 0; i < n; i++) {
      const svc = data.services[(seed + i * 5) % data.services.length];
      const sp = data.specialists[(seed + i * 3) % data.specialists.length];
      const pay = pays[(seed + i) % pays.length];
      day -= 9 + ((seed + i) % 12); month = 5; let mm = month, dd = day;
      while (dd <= 0) { mm -= 1; dd += 30; }
      out.push({
        date: `2026-${String(mm + 1).padStart(2, "0")}-${String(Math.max(1, dd)).padStart(2, "0")}`,
        service: svc.name, specialist: sp.name, payment: payLabel[pay], amount: svc.price,
      });
    }
    return out;
  }

  // ── Periodos de cierre (Historial) ────────────────────────────────
  const PERIODS = {
    barberia: [
      { id: "p-2026-05b", label: "16–31 may 2026", citas: 168, ingresos: 9120000, estado: "Cerrado" },
      { id: "p-2026-05a", label: "1–15 may 2026",  citas: 152, ingresos: 8340000, estado: "Cerrado" },
      { id: "p-2026-04b", label: "16–30 abr 2026", citas: 174, ingresos: 9460000, estado: "Cerrado" },
    ],
    salon: [
      { id: "p-2026-05b", label: "16–31 may 2026", citas: 96,  ingresos: 19800000, estado: "Cerrado" },
      { id: "p-2026-05a", label: "1–15 may 2026",  citas: 88,  ingresos: 18250000, estado: "Cerrado" },
      { id: "p-2026-04b", label: "16–30 abr 2026", citas: 102, ingresos: 21100000, estado: "Cerrado" },
    ],
  };
  function periods(vertical) { return PERIODS[vertical] || PERIODS.barberia; }

  // Citas archivadas dentro del periodo abierto actual (1–15 jun)
  function currentPeriodAppointments(vertical) {
    // muestra las completadas/canceladas del día como ejemplo de lo acumulado
    return dayAppointments(vertical).filter((a) => ["Completada", "Cancelada", "No asistió"].includes(a.status));
  }

  // ── Cabecera dinámica ─────────────────────────────────────────────
  const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MONTHS_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function greeting() {
    const h = Math.floor(NOW_MIN / 60);
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }
  function todayLabel() {
    // martes 9 jun 2026
    const d = new Date(2026, 5, 9);
    return `${DOW[d.getDay()]}, ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]} de 2026`;
  }

  // ordena una lista (hora | prioridad)
  function sortAppointments(list, mode) {
    const arr = [...list];
    if (mode === "prioridad") return arr.sort((a, b) => (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (a.startMin - b.startMin));
    return arr.sort((a, b) => a.startMin - b.startMin);
  }

  window.AdminData = {
    COP, NOW_MIN, fmt, fmtDate, specialistColor,
    branches: (v) => SpecData.branches(v),
    admin: { name: "Catalina Mejía", role: "Administradora" },
    dayAppointments, dayTotals, nextAppointment, dashboardKpis,
    computeTotals, computeNext, dayMeta, sortAppointments,
    monthlyFinance, lowStock,
    clients, clientStats, clientHistory,
    periods, currentPeriodAppointments,
    greeting, todayLabel, STATUS_RANK,
  };
})();
