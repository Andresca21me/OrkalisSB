/* Orkalis — datos de la app del especialista (Lote 2).
   Reutiliza OrkData (servicios, especialistas, negocio) de Lote 1 y añade
   turnos del día, métodos de pago, reparto y un puente con la reserva pública. */
(function () {
  const NOW_MIN = 12 * 60; // "ahora" conceptual: 12:00 del martes 9 jun 2026

  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmt = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

  const PAYMENTS = [
    { id: "efectivo", label: "Efectivo", icon: "wallet" },
    { id: "debito", label: "T. débito", icon: "credit-card" },
    { id: "credito", label: "T. crédito", icon: "credit-card" },
    { id: "nequi", label: "Nequi", icon: "smartphone" },
    { id: "qr", label: "Código QR", icon: "qr" },
  ];

  // Reparto (cuando la partición por especialista está activa)
  const SPLIT = { service: 0.6, product: 0.1 }; // 60% servicios al profesional, 10% comisión producto

  const PRODUCTS = {
    barberia: [
      { id: "pomada", name: "Pomada mate", price: 32000, stock: 8 },
      { id: "aceite-barba", name: "Aceite para barba", price: 28000, stock: 3 },
      { id: "shampoo", name: "Shampoo anticaspa", price: 24000, stock: 0 },
    ],
    salon: [
      { id: "mascarilla", name: "Mascarilla nutritiva", price: 45000, stock: 12 },
      { id: "serum", name: "Sérum de puntas", price: 52000, stock: 2 },
      { id: "protector", name: "Protector térmico", price: 38000, stock: 0 },
    ],
  };

  // Especialista logueado por vertical
  const ME = {
    barberia: { id: "andres", name: "Andrés Mejía", role: "Barbero senior", first: "Andrés" },
    salon: { id: "valentina", name: "Valentina Gómez", role: "Estilista senior", first: "Valentina" },
  };

  const BRANCHES = {
    barberia: ["La Navaja · Chapinero", "La Navaja · Cedritos"],
    salon: ["Estudio Aura · El Nogal", "Estudio Aura · Santa Bárbara"],
  };

  // Turnos base del día (sin la reserva pública, que se inyecta aparte)
  const TURNOS = {
    barberia: [
      { id: "t1", time: "9:00", clientName: "Mateo Herrera", clientPhone: "300 218 7745", serviceIds: ["corte-clasico"], status: "Completada", payment: "efectivo", source: "agenda" },
      { id: "t2", time: "10:00", clientName: "Felipe Cano", clientPhone: "311 902 4418", serviceIds: ["fade-premium"], status: "Completada", payment: "nequi", source: "agenda" },
      { id: "t4", time: "13:30", clientName: "Carolina Mesa", clientPhone: "320 551 8830", serviceIds: ["corte-barba"], status: "Confirmada", source: "agenda" },
      { id: "t5", time: "15:30", clientName: "Tomás Vélez", clientPhone: "", serviceIds: ["perfilado-barba"], status: "Confirmada", source: "agenda" },
      { id: "t6", time: "17:00", clientName: "Andrés Patiño", clientPhone: "315 770 1192", serviceIds: ["fade-premium"], status: "Confirmada", source: "agenda" },
    ],
    salon: [
      { id: "t1", time: "8:30", clientName: "Camila Soto", clientPhone: "301 445 9921", serviceIds: ["corte-peinado"], status: "Completada", payment: "efectivo", source: "agenda" },
      { id: "t2", time: "10:00", clientName: "Lucía Naranjo", clientPhone: "318 220 7765", serviceIds: ["balayage"], status: "Completada", payment: "credito", source: "agenda" },
      { id: "t4", time: "14:00", clientName: "Paula Restrepo", clientPhone: "300 991 2245", serviceIds: ["color-completo"], status: "Confirmada", source: "agenda" },
      { id: "t6", time: "16:30", clientName: "Andrea Gil", clientPhone: "319 663 0098", serviceIds: ["manicure-semi"], status: "Confirmada", source: "agenda" },
    ],
  };

  // Turno "actual" por defecto (12:00) — se sustituye por la reserva pública si existe
  const CURRENT_DEFAULT = {
    barberia: { id: "t3", time: "12:00", clientName: "Daniel Ríos", clientPhone: "311 845 2210", serviceIds: ["fade-premium"], status: "Confirmada", source: "agenda" },
    salon: { id: "t3", time: "12:00", clientName: "Sofía Marín", clientPhone: "316 448 7720", serviceIds: ["corte-peinado"], status: "Confirmada", source: "agenda" },
  };

  // Lee la reserva pública (Lote 1) y la convierte en turno del especialista
  function readPublicBooking(vertical) {
    try {
      const raw = localStorage.getItem("orkalis_public_booking");
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (o.vertical !== vertical) return null;
      if (o.status === "Cancelada") return null;
      const data = OrkData.get(vertical);
      const ids = (o.serviceIds || []).filter((id) => data.services.some((s) => s.id === id));
      if (!ids.length) return null;
      return {
        id: "pub-" + o.code, time: o.time || "12:00",
        clientName: o.clientName || "Cliente", clientPhone: o.clientPhone || "",
        serviceIds: ids, status: o.status === "Solicitada" ? "Solicitada" : "Confirmada",
        source: "publico", code: o.code, isNew: true,
      };
    } catch (e) { return null; }
  }

  // Enriquecer un turno con datos de servicios (precio, duración, total)
  function decorate(turno, vertical) {
    const data = OrkData.get(vertical);
    const services = turno.serviceIds.map((id) => data.services.find((s) => s.id === id)).filter(Boolean);
    const total = services.reduce((a, s) => a + s.price, 0);
    const dur = services.reduce((a, s) => a + s.min, 0);
    const start = toMin(turno.time);
    return { ...turno, services, total, dur, startMin: start, endMin: start + dur, endLabel: fmt(start + dur) };
  }

  // Lista completa del día (con turno actual / pública), ordenada por hora
  function dayTurnos(vertical, { currentStatus } = {}) {
    const pub = readPublicBooking(vertical);
    const current = pub || { ...CURRENT_DEFAULT[vertical] };
    if (currentStatus) current.status = currentStatus;
    const all = [...TURNOS[vertical], current];
    return all.map((t) => decorate(t, vertical)).sort((a, b) => a.startMin - b.startMin);
  }

  // Ganancias agregadas por período (con reparto)
  const EARNINGS = {
    barberia: {
      semana: { total: 612000, servicios: 19, comisiones: 38000 },
      mes: { total: 2480000, servicios: 78, comisiones: 162000 },
    },
    salon: {
      semana: { total: 1340000, servicios: 14, comisiones: 96000 },
      mes: { total: 5210000, servicios: 52, comisiones: 410000 },
    },
  };

  window.SpecData = {
    NOW_MIN, PAYMENTS, SPLIT, toMin, fmt,
    me: (v) => ME[v] || ME.barberia,
    branches: (v) => BRANCHES[v] || BRANCHES.barberia,
    products: (v) => PRODUCTS[v] || PRODUCTS.barberia,
    earnings: (v) => EARNINGS[v] || EARNINGS.barberia,
    readPublicBooking, decorate, dayTurnos, CURRENT_DEFAULT,
  };
})();
