/* Orkalis — Modales transversales (Lote 7). Parte 2: 7.5 Venta de productos
   (sin servicio) + 7.2 Walk-in y cobro. Reutiliza los pickers de admin-modals. */

// ───────────────────────── 7.5 · Venta de productos ─────────────────
function ProductSaleModal({ open, vertical, onClose, onConfirm }) {
  const specialists = OrkData.get(vertical).specialists;
  const [client, setClient] = React.useState({ name: "", phone: "" });
  const [soldBy, setSoldBy] = React.useState("salon"); // "salon" | specialistId
  const [payment, setPayment] = React.useState("efectivo");
  const [products, setProducts] = React.useState([]);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => { if (open) { setClient({ name: "", phone: "" }); setSoldBy("salon"); setPayment("efectivo"); setProducts([]); setTouched(false); } }, [open, vertical]);
  if (!open) return null;

  const amount = products.reduce((a, it) => a + it.price * it.qty, 0);
  const stockError = products.some((it) => it.qty > it.stock);
  const empty = products.length === 0;
  const bySpecialist = soldBy !== "salon";
  const split = amount ? RecepData.splitProduct({ amount, bySpecialist, payment }) : null;
  const canSave = !empty && !stockError;
  const sellerName = bySpecialist ? (specialists.find((s) => s.id === soldBy) || {}).name : "El negocio";

  const confirm = () => { setTouched(true); if (canSave) onConfirm({ amount }); };

  return (
    <Dialog open onClose={onClose} width={560}
      title="Venta de productos" subtitle="Registra una venta directa de productos al cliente, sin servicio."
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" iconLeft="check" disabled={!canSave} onClick={confirm}>Registrar venta · {RecepData.COP(amount)}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "8px 0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Cliente" optional>
            <ClientAutocomplete vertical={vertical} value={client.name} onChange={(v) => setClient((c) => ({ ...c, name: v }))} onPick={(c) => setClient({ name: c.name, phone: c.phone || "" })} placeholder="Nombre del cliente" />
          </GField>
          <GField label="Teléfono" optional><GInput value={client.phone} onChange={(v) => setClient((c) => ({ ...c, phone: v }))} placeholder="300 000 0000" /></GField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Vendido por" hint={bySpecialist ? `Comisión del ${RecepData.PRODUCT_COMMISSION * 100}% para el especialista.` : "La venta es 100% del negocio."}>
            <GSelect value={soldBy} onChange={setSoldBy} options={[{ value: "salon", label: "El negocio (directo)" }, ...specialists.map((s) => ({ value: s.id, label: s.name }))]} />
          </GField>
          <GField label="Método de pago"><GSelect value={payment} onChange={setPayment} options={RecepData.PAYMENTS.map((p) => ({ value: p.id, label: p.label }))} /></GField>
        </div>

        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Productos</div>
          <ProductPicker vertical={vertical} items={products} onChange={setProducts} />
          {touched && empty && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Selecciona al menos un producto.</span>}
          {stockError && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Hay productos con cantidad mayor al stock.</span>}
        </div>

        {/* Resumen de comisión */}
        {split && (
          <div style={{ padding: "4px 16px 8px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ padding: "12px 0 2px", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Resumen de la venta</div>
            <GSummaryRow first label="Total de productos" value={RecepData.COP(split.amount)} strong />
            {split.bySpecialist
              ? <>
                  <GSummaryRow label={`Comisión · ${sellerName.split(" ")[0]}`} sub={`${split.commissionPct}%`} value={RecepData.COP(split.especialista)} tone="pos" />
                  <GSummaryRow label="Para el negocio" sub="95%" value={RecepData.COP(split.salon)} />
                </>
              : <GSummaryRow label="Para el negocio" sub="100%" value={RecepData.COP(split.salon)} />}
            {split.transfer && <GSummaryRow label="Descuento por transferencia" sub={`${RecepData.TRANSFER_DISCOUNT * 100}% · informativo`} value={`– ${RecepData.COP(split.transferDiscount)}`} tone="neg" />}
          </div>
        )}

        {empty && (
          <div style={{ display: "flex", gap: 11, padding: 13, borderRadius: "var(--radius-sm)", background: "var(--info-tint)", border: "1px solid rgba(59,130,246,0.22)" }}>
            <Icon name="info" size={17} color="var(--info)" style={{ flex: "none", marginTop: 1 }} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>Al registrar la venta se descuenta el stock de los productos seleccionados.</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ───────────────────────── 7.2 · Walk-in y cobro ────────────────────
function WalkInModal({ open, vertical, branch, inventoryOn, onClose, onConfirm }) {
  const specialists = OrkData.get(vertical).specialists;
  const [mode, setMode] = React.useState("vivo"); // "vivo" | "retro"
  const [client, setClient] = React.useState({ name: "", phone: "" });
  const [specialistId, setSpecialistId] = React.useState(specialists[0].id);
  const [services, setServices] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [payment, setPayment] = React.useState("");
  const [start, setStart] = React.useState("12:00");
  const [end, setEnd] = React.useState("12:30");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => { if (open) { setMode("vivo"); setClient({ name: "", phone: "" }); setSpecialistId(specialists[0].id); setServices([]); setProducts([]); setPayment(""); setTouched(false); } }, [open, vertical]);
  if (!open) return null;

  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const total = services.reduce((a, it) => a + (Number(it.price) || 0), 0) + products.reduce((a, it) => a + it.price * it.qty, 0);
  const noServices = services.length === 0;
  const stockError = products.some((it) => it.qty > it.stock);
  const noPayment = !payment;
  const hoursInvalid = mode === "retro" && toMin(end) <= toMin(start);
  const canCobrar = !noServices && !stockError && !noPayment && !hoursInvalid;

  const split = payment && !noServices ? RecepData.splitService({ total: services.reduce((a, it) => a + (Number(it.price) || 0), 0), payment, vertical }) : null;

  const confirm = () => { setTouched(true); if (canCobrar) onConfirm({ total }); };

  return (
    <Dialog open onClose={onClose} width={620}
      title="Registrar walk-in y cobrar" subtitle={`Atención sin cita en ${branch || "la sucursal"}.`}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" iconLeft="dollar-sign" disabled={!canCobrar} onClick={confirm}>Confirmar cobro · {RecepData.COP(total)}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "8px 0 16px" }}>
        {/* Modo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Modo de registro</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{mode === "vivo" ? "En vivo: la atención está ocurriendo ahora." : "Retroactivo: registra una atención ya ocurrida."}</div>
          </div>
          <GSegmented value={mode} onChange={setMode} options={[{ value: "vivo", label: "En vivo", icon: "play" }, { value: "retro", label: "Retroactivo", icon: "clock" }]} />
        </div>

        {/* Cliente */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Cliente" optional>
            <ClientAutocomplete vertical={vertical} value={client.name} onChange={(v) => setClient((c) => ({ ...c, name: v }))} onPick={(c) => setClient({ name: c.name, phone: c.phone || "" })} placeholder="Nombre o teléfono" />
          </GField>
          <GField label="Especialista que atiende"><GSelect value={specialistId} onChange={setSpecialistId} options={specialists.map((s) => ({ value: s.id, label: s.name }))} /></GField>
        </div>

        {/* Horas en modo retroactivo */}
        {mode === "retro" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <GField label="Hora de inicio"><GSelect value={start} onChange={setStart} options={RecepData.TIMES} invalid={hoursInvalid} /></GField>
            <GField label="Hora de fin" error={hoursInvalid ? "La hora de fin debe ser posterior al inicio." : null}>
              <GSelect value={end} onChange={setEnd} options={RecepData.TIMES} invalid={hoursInvalid} />
            </GField>
          </div>
        )}

        {/* Servicios */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Servicios</div>
          <ServicePicker vertical={vertical} items={services} onChange={setServices} />
          {touched && noServices && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6 }}><Icon name="alert-circle" size={13} color="var(--error)" />Agrega al menos un servicio.</span>}
        </div>

        {/* Productos */}
        {inventoryOn && (
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Productos <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>· opcional</span></div>
            <ProductPicker vertical={vertical} items={products} onChange={setProducts} />
            {stockError && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Hay productos con cantidad mayor al stock.</span>}
          </div>
        )}

        {/* Pago */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Método de pago <span style={{ color: "var(--error)" }}>· requerido</span></div>
          <PaymentPicker value={payment} onChange={setPayment} invalid={touched && noPayment} />
          {touched && noPayment && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Selecciona un método de pago para cerrar el cobro.</span>}
        </div>

        {/* Desglose */}
        {split && (
          <div style={{ padding: "4px 16px 8px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ padding: "12px 0 2px", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Reparto del servicio</div>
            <GSummaryRow first label="Profesional" sub={`${split.repartoPro}%`} value={RecepData.COP(split.profesional)} tone="pos" />
            <GSummaryRow label="Negocio" sub={`${split.repartoSalon}%`} value={RecepData.COP(split.salon)} />
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--navy)", color: "#fff" }}>
          <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Total a cobrar</span>
          <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "-0.02em" }}>{RecepData.COP(total)}</span>
        </div>
      </div>
    </Dialog>
  );
}

Object.assign(window, { ProductSaleModal, WalkInModal });
