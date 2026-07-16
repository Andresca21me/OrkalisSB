/* Orkalis — datos de demo para el enlace público de reservas.
   Dos verticales: barbería (por defecto) y salón. Estructura idéntica;
   sólo cambian etiquetas y datos concretos. */
(function () {
  const COP = (n) =>
    "$\u00A0" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

  // --- Barbería -------------------------------------------------------
  const barberia = {
    vertical: "barberia",
    specialistLabel: "Barbero",
    specialistLabelPlural: "Barberos",
    business: {
      name: "Barbería La Navaja",
      tagline: "Cortes clásicos y fades de precisión",
      rating: 4.9,
      reviews: 312,
      address: "Cra. 13 #85-32, Chapinero, Bogotá",
      hours: "Lun a Sáb · 9:00 a 20:00",
      phone: "+57 311 845 2210",
    },
    categories: ["Cortes", "Barba", "Combos", "Cuidado"],
    services: [
      { id: "corte-clasico", cat: "Cortes", name: "Corte clásico", desc: "Tijera y máquina, lavado incluido", price: 28000, min: 30 },
      { id: "fade-premium", cat: "Cortes", name: "Fade premium", desc: "Degradado a piel con perfilado", price: 38000, min: 40, popular: true },
      { id: "corte-nino", cat: "Cortes", name: "Corte para niño", desc: "Menores de 12 años", price: 22000, min: 30 },
      { id: "perfilado-barba", cat: "Barba", name: "Perfilado de barba", desc: "Navaja y toalla caliente", price: 20000, min: 20 },
      { id: "afeitado-ritual", cat: "Barba", name: "Afeitado ritual", desc: "Navaja, vapor y bálsamo", price: 30000, min: 35 },
      { id: "corte-barba", cat: "Combos", name: "Corte + barba", desc: "El combo de la casa", price: 42000, min: 45, popular: true },
      { id: "facial-express", cat: "Cuidado", name: "Facial express", desc: "Limpieza con mascarilla negra", price: 18000, min: 15 },
    ],
    specialists: [
      { id: "andres", name: "Andrés Mejía", role: "Barbero senior", rating: 4.9, years: 8, picks: ["fade-premium", "corte-barba"] },
      { id: "julian", name: "Julián Restrepo", role: "Barbero", rating: 4.8, years: 5, picks: ["corte-clasico", "afeitado-ritual"] },
      { id: "camilo", name: "Camilo Ortiz", role: "Barbero", rating: 4.7, years: 3, picks: ["perfilado-barba", "facial-express"] },
    ],
  };

  // --- Salón ----------------------------------------------------------
  const salon = {
    vertical: "salon",
    specialistLabel: "Especialista",
    specialistLabelPlural: "Especialistas",
    business: {
      name: "Estudio Aura",
      tagline: "Color, cuidado y estilo en un solo lugar",
      rating: 4.8,
      reviews: 487,
      address: "Cl. 90 #11-45, El Nogal, Bogotá",
      hours: "Mar a Dom · 8:00 a 19:00",
      phone: "+57 320 671 9043",
    },
    categories: ["Cabello", "Color", "Uñas", "Tratamientos"],
    services: [
      { id: "corte-peinado", cat: "Cabello", name: "Corte y peinado", desc: "Diagnóstico, corte y brushing", price: 45000, min: 45, popular: true },
      { id: "peinado-evento", cat: "Cabello", name: "Peinado para evento", desc: "Recogido o suelto con fijación", price: 70000, min: 60 },
      { id: "color-completo", cat: "Color", name: "Color completo", desc: "Tinte raíz a puntas, una tonalidad", price: 130000, min: 120 },
      { id: "balayage", cat: "Color", name: "Balayage", desc: "Mechas a mano alzada y matiz", price: 210000, min: 180, popular: true },
      { id: "manicure-semi", cat: "Uñas", name: "Manicure semipermanente", desc: "Esmaltado de larga duración", price: 55000, min: 60 },
      { id: "pedicure-spa", cat: "Uñas", name: "Pedicure spa", desc: "Exfoliación, masaje y esmaltado", price: 65000, min: 75 },
      { id: "keratina", cat: "Tratamientos", name: "Tratamiento de keratina", desc: "Alisado y nutrición profunda", price: 180000, min: 150 },
    ],
    specialists: [
      { id: "valentina", name: "Valentina Gómez", role: "Estilista senior", rating: 4.9, years: 10, picks: ["corte-peinado", "peinado-evento"] },
      { id: "daniela", name: "Daniela Cárdenas", role: "Colorista", rating: 4.8, years: 7, picks: ["color-completo", "balayage"] },
      { id: "mariana", name: "Mariana Ruiz", role: "Manicurista", rating: 4.9, years: 6, picks: ["manicure-semi", "pedicure-spa"] },
    ],
  };

  // --- Disponibilidad: genera fechas y franjas -----------------------
  const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function buildDays(base) {
    // 14 días a partir de hoy (9 jun 2026 = martes)
    const start = new Date(2026, 5, 9);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const dow = d.getDay();
      // barbería cierra domingo; salón cierra lunes
      const closed = base.vertical === "barberia" ? dow === 0 : dow === 1;
      days.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
        dow: DAY_NAMES[dow],
        day: d.getDate(),
        month: MONTHS[d.getMonth()],
        isToday: i === 0,
        closed,
      });
    }
    return days;
  }

  // Franjas por día — algunas ocupadas para realismo
  function slotsFor(dayKey, specialistId) {
    const all = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30",
      "12:00", "14:00", "14:30", "15:00", "15:30", "16:00",
      "16:30", "17:00", "17:30", "18:00", "18:30"];
    // pseudo-aleatorio determinista
    let seed = 0;
    const s = dayKey + (specialistId || "any");
    for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 9973;
    return all.map((t, i) => {
      const taken = (seed + i * 7) % 5 === 0;
      return { time: t, taken };
    });
  }

  window.OrkData = {
    COP,
    verticals: { barberia, salon },
    buildDays,
    slotsFor,
    get(vertical) { return this.verticals[vertical] || barberia; },
  };
})();
