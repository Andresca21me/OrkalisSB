/* Orkalis — datos de Configuración, Suscripción y Developer (Lote 6).
   Reutiliza OrkData (negocio, especialistas), SpecData (sucursales) y AdminData
   (COP, admin). Modela módulos (feature flags), parámetros financieros con
   herencia, reglas de agendamiento, notificaciones, sucursales, usuarios/roles,
   suscripción cobrada por nº de sucursales activas, y retención/limpieza. */
(function () {
  const COP = OrkData.COP;

  // ── Módulos (feature flags) ───────────────────────────────────────
  function modules(vertical) {
    const esp = vertical === "salon" ? "especialista" : "barbero";
    return [
      { id: "inventario", name: "Inventario", icon: "package", default: true, hasData: true,
        desc: "Control de stock de productos, alertas de existencias bajas y descuento automático al vender." },
      { id: "particion", name: "Partición por especialista", icon: "users", default: true, hasData: true,
        desc: `Reparte cada servicio entre el ${esp} y el negocio según los parámetros financieros.` },
      { id: "cierre", name: "Cierre de período", icon: "calendar", default: true, hasData: true, sub: "quincenal",
        desc: "Habilita liquidaciones por corte (quincenal o mensual) con cuadre de caja." },
      { id: "aprobacion", name: "Aprobación manual de reservas", icon: "shield-check", default: false,
        desc: "Las reservas del enlace público entran como Solicitada hasta que el equipo las confirme." },
      { id: "productos", name: "Ventas de productos", icon: "store", default: true, hasData: true,
        desc: "Registra venta de productos junto al cobro de una cita o de forma independiente." },
      { id: "recordatorios", name: "Recordatorios automáticos", icon: "bell", default: true,
        desc: "Envía recordatorios al cliente antes de cada cita por los canales configurados." },
    ];
  }

  // Sub-opción del cierre
  const CIERRE_FREQ = [{ value: "quincenal", label: "Quincenal" }, { value: "mensual", label: "Mensual" }];

  // ── Parámetros financieros (con herencia) ─────────────────────────
  // Valores a nivel negocio (la fuente de la herencia)
  const FIN_BUSINESS = {
    barberia: { repartoPro: 60, repartoSalon: 40, deduccionAdmin: 5, comisionBancaria: 2.5, tarifaPro: 5 },
    salon:    { repartoPro: 55, repartoSalon: 45, deduccionAdmin: 6, comisionBancaria: 2.5, tarifaPro: 5 },
  };
  // Overrides de ejemplo por sucursal (segunda sede sobrescribe el reparto)
  function finBusiness(vertical) { return { ...(FIN_BUSINESS[vertical] || FIN_BUSINESS.barberia) }; }
  function finOverrideSample(vertical, branchIndex) {
    // La sede principal hereda todo; la segunda sobrescribe el reparto profesional/salón
    if (branchIndex === 1) return { repartoPro: true, repartoSalon: true };
    return {};
  }
  const FIN_FIELDS = [
    { id: "repartoPro", label: "Reparto profesional", suffix: "%", group: "reparto",
      hint: "Porcentaje del servicio que recibe el profesional." },
    { id: "repartoSalon", label: "Reparto del negocio", suffix: "%", group: "reparto",
      hint: "Porcentaje que retiene el negocio." },
    { id: "deduccionAdmin", label: "Deducción administrativa", suffix: "%",
      hint: "Se descuenta antes del reparto para cubrir gastos de operación." },
    { id: "comisionBancaria", label: "Comisión bancaria", suffix: "%",
      hint: "Costo de procesamiento de pagos con tarjeta o datáfono." },
    { id: "tarifaPro", label: "Tarifa a cliente profesional", suffix: "%",
      hint: "Recargo aplicado a clientes de tipo profesional." },
  ];

  // ── Reglas de agendamiento ────────────────────────────────────────
  const SCHED_BUSINESS = {
    confirmacionAuto: true,
    antelacionCancelacion: 2,   // horas
    recordatorio1: 24,          // horas antes
    recordatorio2: 2,           // horas antes
    retencionFranja: 10,        // minutos
    antelacionReserva: 60,      // minutos mínimos para reservar
  };
  function schedBusiness() { return { ...SCHED_BUSINESS }; }

  // ── Notificaciones ────────────────────────────────────────────────
  const NOTIF_EVENTS = [
    { id: "otp", name: "Código OTP de reserva", desc: "Verifica el teléfono del cliente al reservar en línea.", editable: false },
    { id: "confirmacion", name: "Confirmación de cita", desc: "Se envía al confirmar la reserva.", editable: true },
    { id: "recordatorio", name: "Recordatorio de cita", desc: "Según la ventana de recordatorios configurada.", editable: true },
    { id: "cambio", name: "Aviso de cambio o cancelación", desc: "Cuando una cita se reagenda o se cancela.", editable: true },
  ];
  const NOTIF_CHANNELS = [
    { id: "sms", label: "SMS", icon: "smartphone", status: "ok" },
    { id: "email", label: "Email", icon: "mail", status: "ok" },
    { id: "whatsapp", label: "WhatsApp", icon: "smartphone", status: "soon" },
  ];
  // Matriz por defecto (negocio): canal activo por evento
  function notifDefaults() {
    return {
      otp: { sms: true, email: false, whatsapp: false },
      confirmacion: { sms: true, email: true, whatsapp: false },
      recordatorio: { sms: true, email: false, whatsapp: false },
      cambio: { sms: true, email: true, whatsapp: false },
    };
  }
  // Plantillas/remitente editables
  function notifTemplates(vertical) {
    const biz = OrkData.get(vertical).business.name;
    return {
      remitente: biz,
      confirmacion: `Hola {cliente}, tu cita en ${biz} quedó confirmada para {fecha} con {especialista}.`,
      recordatorio: `Recordatorio: tu cita en ${biz} es {fecha}. Responde CANCELAR si no podrás asistir.`,
      cambio: `Tu cita en ${biz} cambió. Nueva fecha: {fecha}. Si no la solicitaste, contáctanos.`,
    };
  }

  // ── Sucursales ────────────────────────────────────────────────────
  const BRANCH_DETAIL = {
    barberia: [
      { id: "b1", name: "La Navaja · Chapinero", address: "Cra. 13 #85-32, Chapinero, Bogotá", hours: "Lun a Sáb · 9:00–20:00", estado: "Activa", especialistas: 3, principal: true },
      { id: "b2", name: "La Navaja · Cedritos",  address: "Cl. 140 #11-20, Cedritos, Bogotá",  hours: "Lun a Sáb · 10:00–20:00", estado: "Activa", especialistas: 2, principal: false },
    ],
    salon: [
      { id: "b1", name: "Estudio Aura · El Nogal",       address: "Cl. 90 #11-45, El Nogal, Bogotá",      hours: "Mar a Dom · 8:00–19:00", estado: "Activa", especialistas: 3, principal: true },
      { id: "b2", name: "Estudio Aura · Santa Bárbara",  address: "Cl. 116 #18-40, Santa Bárbara, Bogotá", hours: "Mar a Dom · 9:00–19:00", estado: "Activa", especialistas: 2, principal: false },
    ],
  };
  function branchDetail(vertical) { return (BRANCH_DETAIL[vertical] || BRANCH_DETAIL.barberia).map((b) => ({ ...b })); }

  // ── Usuarios y roles ──────────────────────────────────────────────
  const USERS = {
    barberia: [
      { id: "u1", name: "Catalina Mejía", email: "catalina@lanavaja.co", role: "Administrador", scope: "all", activo: true, self: true },
      { id: "u2", name: "Andrés Mejía",   email: "andres@lanavaja.co",   role: "Especialista", scope: ["b1"], activo: true },
      { id: "u3", name: "Julián Restrepo", email: "julian@lanavaja.co",  role: "Especialista", scope: ["b1"], activo: true },
      { id: "u4", name: "Camilo Ortiz",   email: "camilo@lanavaja.co",   role: "Especialista", scope: ["b2"], activo: true },
      { id: "u5", name: "Laura Quintero", email: "recepcion@lanavaja.co", role: "Recepcionista", scope: ["b1", "b2"], activo: true },
      { id: "u6", name: "Mauricio Soto",  email: "mauricio@lanavaja.co", role: "Especialista", scope: ["b2"], activo: false },
    ],
    salon: [
      { id: "u1", name: "Catalina Mejía",   email: "catalina@estudioaura.co", role: "Administrador", scope: "all", activo: true, self: true },
      { id: "u2", name: "Valentina Gómez",  email: "valentina@estudioaura.co", role: "Especialista", scope: ["b1"], activo: true },
      { id: "u3", name: "Daniela Cárdenas", email: "daniela@estudioaura.co",  role: "Especialista", scope: ["b1"], activo: true },
      { id: "u4", name: "Mariana Ruiz",     email: "mariana@estudioaura.co",  role: "Especialista", scope: ["b2"], activo: true },
      { id: "u5", name: "Sara Londoño",     email: "recepcion@estudioaura.co", role: "Recepcionista", scope: ["b1", "b2"], activo: true },
      { id: "u6", name: "Paola Rincón",     email: "paola@estudioaura.co",    role: "Especialista", scope: ["b2"], activo: false },
    ],
  };
  function users(vertical) { return (USERS[vertical] || USERS.barberia).map((u) => ({ ...u })); }
  const ROLES = [
    { value: "Administrador", desc: "Acceso total: configuración, finanzas y todas las sucursales." },
    { value: "Recepcionista", desc: "Agenda, clientes y cobros. Sin finanzas ni configuración." },
    { value: "Especialista", desc: "Su agenda y sus clientes. Acceso desde la app móvil." },
  ];

  // ── Suscripción / estado de cuenta ────────────────────────────────
  const PLAN = { name: "Orkalis Pro", pricePerBranch: 89000, currency: "COP" };
  function subscription(vertical, { activeBranches = 2, status = "Activa" } = {}) {
    const cost = PLAN.pricePerBranch * activeBranches;
    return {
      plan: PLAN.name, pricePerBranch: PLAN.pricePerBranch,
      activeBranches, cost, status,
      nextBilling: "1 jul 2026", paymentMethod: { brand: "Visa", last4: "4421", exp: "08/27" },
      branches: branchDetail(vertical).slice(0, activeBranches).map((b) => ({ name: b.name, cost: PLAN.pricePerBranch })),
    };
  }
  function invoices(vertical) {
    return [
      { id: "FAC-2026-06", period: "Jun 2026", date: "1 jun 2026", amount: 178000, estado: "Pagada", method: "Visa ••4421" },
      { id: "FAC-2026-05", period: "May 2026", date: "1 may 2026", amount: 178000, estado: "Pagada", method: "Visa ••4421" },
      { id: "FAC-2026-04", period: "Abr 2026", date: "1 abr 2026", amount: 89000,  estado: "Pagada", method: "Visa ••4421" },
      { id: "FAC-2026-03", period: "Mar 2026", date: "1 mar 2026", amount: 89000,  estado: "Pagada", method: "PSE" },
    ];
  }

  // ── Developer / Mantenimiento ─────────────────────────────────────
  function retentionRules() {
    return [
      { id: "citas", table: "Citas", desc: "Citas completadas, canceladas y no asistidas.", days: 365, on: true, rows: 18420, oldest: "12 ene 2025" },
      { id: "gastos", table: "Gastos variables", desc: "Registros de caja menor y gastos del día.", days: 730, on: true, rows: 2140, oldest: "3 mar 2024" },
      { id: "historial", table: "Historial de servicios", desc: "Servicios prestados por cliente.", days: 0, on: false, rows: 31280, oldest: "2 feb 2024" },
      { id: "logs", table: "Registros de actividad", desc: "Eventos de acceso y cambios de configuración.", days: 90, on: true, rows: 54900, oldest: "13 mar 2026" },
    ];
  }
  function dbStats() {
    return [
      { label: "Filas totales", value: "106.740", icon: "list" },
      { label: "Tamaño de la base", value: "248 MB", icon: "archive" },
      { label: "Registro más antiguo", value: "feb 2024", icon: "clock" },
    ];
  }
  // Qué se preserva siempre en una limpieza de datos de prueba
  const PRESERVED = ["Inventario", "Clientes", "Equipo y especialistas", "Servicios", "Cierres históricos"];

  window.ConfigData = {
    COP,
    modules, CIERRE_FREQ,
    finBusiness, finOverrideSample, FIN_FIELDS,
    schedBusiness,
    NOTIF_EVENTS, NOTIF_CHANNELS, notifDefaults, notifTemplates,
    branchDetail,
    users, ROLES,
    PLAN, subscription, invoices,
    retentionRules, dbStats, PRESERVED,
    // utilidades de formato
    pct: (n) => `${String(n).replace(".", ",")}%`,
  };
})();
