/* Orkalis — datos del sitio de marketing y suscripción (Lote 8).
   Planes con cobro por especialista, matemática de precios mensual/anual,
   matriz de funciones, testimonios, FAQ y copy por vertical. Reutiliza
   OrkData.COP para el formato COP. */
(function () {
  const COP = OrkData.COP;

  // ── Planes (cobro por especialista; base de 2 incluidos) ──────────
  const PLANS = [
    {
      id: "basico", name: "Básico", base: 80000, perExtra: 15000, included: 2, sucursales: 1,
      blurb: "Empieza a recibir reservas en línea y ordena tu día.",
      msgShort: "WhatsApp + SMS de respaldo",
      cta: "Empezar",
      perks: ["Reservas 24/7 con enlace público", "Agenda en vivo por especialista", "Recordatorios por WhatsApp + SMS", "Clientes y CRM básico", "1 sucursal"],
    },
    {
      id: "pro", name: "Pro", base: 130000, perExtra: 18000, included: 2, sucursales: 1, highlight: true,
      blurb: "Para negocios que ya viven de su agenda.",
      msgShort: "WhatsApp + SMS · más cupos",
      cta: "Empezar",
      perks: ["Todo lo de Básico", "Inventario y venta de productos", "Servicios y repartición por especialista", "Nómina y liquidaciones quincenales", "Más cupos de mensajería", "1 sucursal"],
    },
    {
      id: "premium", name: "Premium", base: 210000, perExtra: 22000, included: 2, sucursales: 2,
      blurb: "Crece a una segunda sede con reportes finos.",
      msgShort: "WhatsApp + SMS · alto volumen",
      cta: "Empezar",
      perks: ["Todo lo de Pro", "Hasta 2 sucursales", "Reportes avanzados y exportables", "Parámetros financieros por sucursal", "Soporte prioritario"],
    },
    {
      id: "empresarial", name: "Empresarial", base: 720000, perExtra: 25000, included: 2, sucursales: Infinity, contact: true,
      blurb: "Cadenas y franquicias con varias sedes.",
      msgShort: "Mensajería a la medida",
      cta: "Contactar ventas",
      perks: ["Todo lo de Premium", "Sucursales ilimitadas", "Roles y permisos avanzados", "Acompañamiento de implementación", "SLA y soporte dedicado"],
    },
  ];
  const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[1];

  // Precio mensual = base + (especialistas adicionales × tarifa)
  function monthly(plan, specialists) {
    const extra = Math.max(0, (specialists || plan.included) - plan.included);
    return plan.base + extra * plan.perExtra;
  }
  // Anual: 2 meses gratis → se cobran 10 meses al año
  function annualTotal(plan, specialists) { return monthly(plan, specialists) * 10; }
  // Precio mostrado "por mes" según ciclo
  function displayMonthly(plan, specialists, cycle) {
    const m = monthly(plan, specialists);
    return cycle === "anual" ? Math.round(m * 10 / 12) : m;
  }
  function sucursalLabel(plan) { return plan.sucursales === Infinity ? "Sucursales ilimitadas" : plan.sucursales === 1 ? "1 sucursal" : `Hasta ${plan.sucursales} sucursales`; }

  // ── Matriz de funciones (8.3) ─────────────────────────────────────
  // valor por plan: true / "—" / texto de límite
  const FEATURE_GROUPS = [
    { group: "Agenda y reservas", rows: [
      { label: "Reservas en línea (enlace público)", vals: [true, true, true, true] },
      { label: "Agenda en vivo por especialista", vals: [true, true, true, true] },
      { label: "App del especialista (móvil)", vals: [true, true, true, true] },
      { label: "Walk-ins y cobro presencial", vals: [true, true, true, true] },
      { label: "Aprobación manual de reservas", vals: [true, true, true, true] },
    ] },
    { group: "Clientes y operación", rows: [
      { label: "Clientes / CRM", vals: ["Básico", "Completo", "Completo", "Completo"] },
      { label: "Inventario y productos", vals: ["—", true, true, true] },
      { label: "Servicios y repartición", vals: ["—", true, true, true] },
      { label: "Nómina y liquidaciones", vals: ["—", true, true, true] },
      { label: "Cierre de período (quincenal/mensual)", vals: ["—", true, true, true] },
    ] },
    { group: "Escala y análisis", rows: [
      { label: "Sucursales", vals: ["1", "1", "2", "Ilimitadas"] },
      { label: "Reportes", vals: ["Básicos", "Básicos", "Avanzados", "Avanzados"] },
      { label: "Parámetros financieros por sucursal", vals: ["—", "—", true, true] },
      { label: "Roles y permisos avanzados", vals: ["—", "—", "—", true] },
    ] },
    { group: "Mensajería y soporte", rows: [
      { label: "WhatsApp (recordatorios/confirmaciones)", vals: ["500/mes", "1.500/mes", "4.000/mes", "A la medida"] },
      { label: "SMS de respaldo", vals: ["200/mes", "600/mes", "1.500/mes", "A la medida"] },
      { label: "Soporte", vals: ["Email", "Email + chat", "Prioritario", "Dedicado · SLA"] },
    ] },
  ];

  // ── Copy por vertical ─────────────────────────────────────────────
  const VERTICAL = {
    barberia: {
      label: "Barbería", esp: "barberos", espSingular: "barbero",
      heroTitle: "Tus clientes reservan solos. Tú dejas de vivir en WhatsApp.",
      heroSub: "Agenda en línea, recordatorios automáticos, finanzas y equipo de tu barbería en un solo lugar.",
      bookingHost: "orkalis.co/r/la-navaja",
      sample: "La Navaja",
    },
    salon: {
      label: "Salón de belleza", esp: "especialistas", espSingular: "especialista",
      heroTitle: "Tu salón, agendado solo. Sin chats interminables ni cuadernos.",
      heroSub: "Reservas en línea, recordatorios, inventario y liquidaciones de tu salón en una sola plataforma.",
      bookingHost: "orkalis.co/r/estudio-aura",
      sample: "Estudio Aura",
    },
  };
  const v = (vertical) => VERTICAL[vertical] || VERTICAL.barberia;

  // ── Dolores → solución ────────────────────────────────────────────
  const PAINS = [
    { icon: "smartphone", pain: "Citas perdidas en el chat", sol: "Un enlace público donde el cliente reserva 24/7, sin crear cuenta. La franja se bloquea sola." },
    { icon: "calendar-x", pain: "Ausentismo que cuesta plata", sol: "Recordatorios automáticos por WhatsApp y SMS. Menos sillas vacías, hasta −40% de inasistencias." },
    { icon: "wallet", pain: "Caos de caja y nómina", sol: "Cada servicio se reparte solo entre el profesional y el negocio. Cierres y liquidaciones sin Excel." },
  ];

  // ── Funciones clave (tarjetas) ────────────────────────────────────
  const FEATURES = [
    { icon: "calendar", title: "Reservas 24/7", desc: "Tu cliente agenda desde un enlace, sin cuenta ni app." },
    { icon: "users", title: "Agenda en vivo", desc: "El día de cada especialista, ordenado y en tiempo real." },
    { icon: "bell", title: "Recordatorios automáticos", desc: "WhatsApp y SMS antes de cada cita. Menos ausencias." },
    { icon: "wallet", title: "Inventario, nómina y finanzas", desc: "Stock, repartición y liquidaciones, todo conectado." },
    { icon: "store", title: "Multi-sucursal", desc: "Una vista del negocio y de cada sede, con su configuración." },
    { icon: "settings", title: "Todo configurable", desc: "Enciende o apaga módulos y reglas según tu operación." },
  ];

  // ── Cómo funciona ─────────────────────────────────────────────────
  const STEPS = [
    { n: 1, icon: "store", title: "Crea tu negocio", desc: "Datos, sucursal y equipo en minutos, con valores listos para operar." },
    { n: 2, icon: "share", title: "Comparte tu enlace", desc: "Publica tu enlace de reservas en redes, Google y WhatsApp." },
    { n: 3, icon: "calendar", title: "Tus clientes agendan solos", desc: "Las citas entran a tu agenda y el equipo solo atiende y cobra." },
  ];

  // ── Prueba social ─────────────────────────────────────────────────
  const TESTIMONIALS = {
    barberia: [
      { quote: "Dejé de contestar WhatsApp todo el día. La agenda se llena sola y las inasistencias bajaron muchísimo.", name: "Andrés Mejía", role: "Dueño · La Navaja", city: "Bogotá" },
      { quote: "El cierre de quincena lo hacía en Excel un domingo entero. Ahora sale solo, con el reparto de cada barbero.", name: "Camilo Soto", role: "Barbería Norte", city: "Medellín" },
      { quote: "Tener dos sedes en una sola vista me cambió la operación. Sé qué pasa en cada local en segundos.", name: "Julián Restrepo", role: "Distrito Barber", city: "Cali" },
    ],
    salon: [
      { quote: "Mis clientas reservan a cualquier hora y reciben su recordatorio. Las sillas vacías casi desaparecieron.", name: "Valentina Gómez", role: "Estudio Aura", city: "Bogotá" },
      { quote: "El inventario y la liquidación de cada estilista por fin cuadran sin que yo persiga papeles.", name: "Daniela Cárdenas", role: "Salón Lumière", city: "Barranquilla" },
      { quote: "Pasé de un cuaderno a tener todo el salón ordenado. La implementación fue de un día.", name: "Mariana Ruiz", role: "Casa Bella", city: "Bucaramanga" },
    ],
  };
  const METRICS = [
    { value: "−40%", label: "inasistencias" },
    { value: "24/7", label: "reservas en línea" },
    { value: "1 día", label: "para empezar a operar" },
  ];

  // ── FAQ ───────────────────────────────────────────────────────────
  const FAQ = [
    { q: "¿El cliente necesita crear una cuenta para reservar?", a: "No. Tu cliente entra a tu enlace público, elige servicio, especialista y hora, y confirma con un código por mensaje. Sin cuenta ni app." },
    { q: "¿Cómo se cobra la suscripción?", a: "Por especialista activo. Cada plan incluye 2 especialistas y suma una tarifa por cada uno adicional. Puedes pagar mensual o anual (2 meses gratis)." },
    { q: "¿Incluye WhatsApp?", a: "Sí. Los recordatorios y confirmaciones salen por WhatsApp, con SMS de respaldo. Cada plan trae sus cupos de mensajería." },
    { q: "¿El cobro a mis clientes pasa por Orkalis?", a: "No. El cobro del servicio a tus clientes es presencial, como hoy. Orkalis solo cobra tu suscripción a la plataforma." },
    { q: "¿Puedo apagar módulos que no uso?", a: "Sí. Inventario, nómina, cierres y más se encienden o apagan por negocio o por sucursal, sin perder datos." },
    { q: "¿Funciona con varias sucursales?", a: "Sí. Premium incluye hasta 2 sedes y Empresarial es ilimitado. El cobro escala por especialista activo de cada sede." },
  ];

  window.SiteData = {
    COP, PLANS, planById, monthly, annualTotal, displayMonthly, sucursalLabel,
    FEATURE_GROUPS, v, VERTICAL, PAINS, FEATURES, STEPS, TESTIMONIALS, METRICS, FAQ,
  };
})();
