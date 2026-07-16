/* Orkalis — datos y lógica de Recepción + modales transversales (Lote 7).
   Reutiliza OrkData (servicios/especialistas), SpecData (pagos/productos),
   ConfigData (parámetros financieros) y AdminData (citas del día, clientes).
   Centraliza el cálculo de reparto de servicio y la comisión de venta de
   productos para que el desglose sea idéntico en Panel y Recepción. */
(function () {
  const COP = OrkData.COP;
  const PAYMENTS = SpecData.PAYMENTS; // efectivo, debito, credito, nequi, qr
  const PAY_LABEL = Object.fromEntries(PAYMENTS.map((p) => [p.id, p.label]));
  const isCard = (id) => id === "debito" || id === "credito";
  const isTransfer = (id) => id === "nequi" || id === "qr";
  const round = (n) => Math.round(n);

  // Parámetros financieros vigentes (nivel negocio; los overrides por sucursal
  // se modelan en Configuración 6.5 — aquí usamos el efectivo del negocio).
  function params(vertical) { return ConfigData.finBusiness(vertical); }

  // ── Reparto de un servicio completado ─────────────────────────────
  // total → deducción administrativa + comisión bancaria (si tarjeta),
  // el resto se reparte profesional / negocio según los %.
  function splitService({ total, payment, vertical, isPro }) {
    const p = params(vertical);
    const comisionBancaria = isCard(payment) ? round(total * p.comisionBancaria / 100) : 0;
    const deduccion = round(total * p.deduccionAdmin / 100);
    const tarifaPro = isPro ? round(total * p.tarifaPro / 100) : 0;
    const base = total - comisionBancaria - deduccion;
    const profesional = round(base * p.repartoPro / 100);
    const salon = base - profesional;
    return {
      total, comisionBancaria, deduccion, tarifaPro, base, profesional, salon,
      repartoPro: p.repartoPro, repartoSalon: p.repartoSalon,
      deduccionPct: p.deduccionAdmin, comisionPct: p.comisionBancaria, tarifaProPct: p.tarifaPro,
      isCard: isCard(payment),
    };
  }

  // ── Comisión de venta de producto ─────────────────────────────────
  // Si lo vende un especialista → 5% para él, 95% negocio.
  // Si lo vende el negocio → 100% negocio.
  // Descuento informativo del 2% por transferencia cuando aplica.
  const PRODUCT_COMMISSION = 0.05;
  const TRANSFER_DISCOUNT = 0.02;
  function splitProduct({ amount, bySpecialist, payment }) {
    const especialista = bySpecialist ? round(amount * PRODUCT_COMMISSION) : 0;
    const salon = amount - especialista;
    const transfer = isTransfer(payment);
    const transferDiscount = transfer ? round(amount * TRANSFER_DISCOUNT) : 0;
    return { amount, especialista, salon, bySpecialist, transfer, transferDiscount, commissionPct: PRODUCT_COMMISSION * 100 };
  }

  // ── Board de recepción: citas del día agrupadas por especialista ──
  function dayBoard(vertical) {
    const sps = OrkData.get(vertical).specialists;
    const appts = AdminData.dayAppointments(vertical, { sort: "hora" });
    return sps.map((sp) => ({
      specialist: sp,
      color: AdminData.specialistColor(vertical, sp.id),
      appts: appts.filter((a) => a.specialistId === sp.id),
    }));
  }

  // Acción contextual según estado (botón rápido en el board)
  function quickAction(status) {
    if (status === "Confirmada" || status === "Solicitada") return { label: "Iniciar", icon: "play", next: "En progreso" };
    if (status === "En progreso") return { label: "Cobrar", icon: "dollar-sign", next: "Completada", cobro: true };
    return null;
  }

  // Sugerencia de cliente (autocompletado) sobre clientes existentes
  function searchClients(vertical, q) {
    const t = (q || "").trim().toLowerCase();
    if (!t) return [];
    return AdminData.clients(vertical)
      .filter((c) => !c.inactive)
      .filter((c) => c.name.toLowerCase().includes(t) || (c.phone || "").includes(t) || (c.email || "").toLowerCase().includes(t))
      .slice(0, 5);
  }

  // Horas disponibles para selects de cita (cada 30 min, 6:00–21:30)
  const TIMES = (() => {
    const out = [];
    for (let h = 6; h <= 21; h++) for (const m of [0, 30]) out.push(`${h}:${String(m).padStart(2, "0")}`);
    return out;
  })();

  window.RecepData = {
    COP, PAYMENTS, PAY_LABEL, isCard, isTransfer, TIMES,
    params, splitService, splitProduct, dayBoard, quickAction, searchClients,
    PRODUCT_COMMISSION, TRANSFER_DISCOUNT,
    recepcionist: { name: "Laura Quintero", role: "Recepción" },
  };
})();
