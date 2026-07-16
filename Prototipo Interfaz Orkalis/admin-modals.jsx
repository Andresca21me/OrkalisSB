/* Orkalis — Modales transversales (Lote 7). Parte 1: pickers compartidos +
   7.3 Modal de Cita (crear/editar) + 7.4 Cambiar estado / Completar con
   desglose. Reutiliza primitivas de ork-ui, admin-ui y admin-gestion-ui. */

// ───────────────────────── Picker de método de pago ─────────────────
function PaymentPicker({ value, onChange, invalid }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 8 }}>
      {RecepData.PAYMENTS.map((p) => {
        const on = value === p.id;
        return (
          <button key={p.id} type="button" onClick={() => onChange(p.id)} style={{
            display: "flex", alignItems: "center", gap: 9, height: 46, padding: "0 12px", cursor: "pointer", textAlign: "left",
            border: `1px solid ${on ? "var(--brand)" : invalid ? "var(--error)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-sm)", background: on ? "var(--brand-tint)" : "var(--surface-card)",
            boxShadow: on ? "0 0 0 1px var(--brand)" : "none", transition: "border-color var(--dur-fast) var(--ease-out)",
          }}>
            <Icon name={p.icon} size={18} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: on ? "var(--brand)" : "var(--text-primary)" }}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Autocompletado de cliente ────────────────
function ClientAutocomplete({ vertical, value, onChange, onPick, pro, placeholder = "Nombre del cliente" }) {
  const [focus, setFocus] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const results = RecepData.searchClients(vertical, value);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 42, padding: "0 12px", background: "var(--surface-card)",
        borderRadius: "var(--radius-xs)", border: `1px solid ${focus ? "var(--brand)" : "var(--border-default)"}`,
        boxShadow: focus ? "0 0 0 3px var(--brand-tint)" : "none", transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)" }}>
        <Icon name="search" size={16} color="var(--text-tertiary)" />
        <input value={value} placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocus(true); setOpen(true); }} onBlur={() => { setFocus(false); setTimeout(() => setOpen(false), 150); }}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
        {pro && <Badge tone="brand" size="md">Profesional</Badge>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 5, background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 6, maxHeight: 240, overflowY: "auto" }}>
          {results.map((c) => (
            <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); onPick(c); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderRadius: "var(--radius-xs)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-sunken)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Avatar name={c.name} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                  {c.pro && <Badge tone="brand" size="md">Profesional</Badge>}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{c.phone || "Sin teléfono"} · {c.servicios} servicios</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Selector de servicios (múltiples) ────────
function ServicePicker({ vertical, items, onChange }) {
  const all = OrkData.get(vertical).services;
  const [adding, setAdding] = React.useState(false);
  const available = all.filter((s) => !items.some((it) => it.id === s.id));

  const add = (svc) => { onChange([...items, { id: svc.id, name: svc.name, original: svc.price, price: svc.price, min: svc.min }]); setAdding(false); };
  const remove = (id) => onChange(items.filter((it) => it.id !== id));
  const setPrice = (id, price) => onChange(items.map((it) => it.id === id ? { ...it, price } : it));

  const totalPrice = items.reduce((a, it) => a + (Number(it.price) || 0), 0);
  const totalMin = items.reduce((a, it) => a + (it.min || 0), 0);

  return (
    <div>
      {items.length === 0 ? (
        <div style={{ padding: "18px 14px", borderRadius: "var(--radius-sm)", border: "1.5px dashed var(--border-default)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          Aún no agregas servicios.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const changed = Number(it.price) !== it.original;
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{it.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                    {it.min} min
                    {changed && <span style={{ textDecoration: "line-through" }}>· {RecepData.COP(it.original)}</span>}
                  </div>
                </div>
                <div style={{ width: 134, flex: "none" }}><GMoney value={it.price} onChange={(v) => setPrice(it.id, v)} /></div>
                <button type="button" onClick={() => remove(it.id)} aria-label="Quitar servicio" style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", padding: 6 }}>
                  <Icon name="x" size={16} color="var(--text-tertiary)" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative", marginTop: 10 }}>
        {available.length > 0 && (
          <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setAdding((o) => !o)}>Agregar servicio</Button>
        )}
        <Popover open={adding} onClose={() => setAdding(false)} width={300} top="calc(100% + 6px)">
          <div className="eyebrow" style={{ padding: "6px 10px 4px" }}>Servicios disponibles</div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {available.map((s) => (
              <button key={s.id} type="button" onClick={() => add(s)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderRadius: "var(--radius-xs)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-sunken)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <Icon name="scissors" size={15} color="var(--text-tertiary)" />
                <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{s.name}</span>
                <span className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{RecepData.COP(s.price)} · {s.min}m</span>
              </button>
            ))}
          </div>
        </Popover>
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{items.length} {items.length === 1 ? "servicio" : "servicios"} · {totalMin} min</span>
          <span className="data" style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>{RecepData.COP(totalPrice)}</span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Selector de productos + stock ────────────
function ProductPicker({ vertical, items, onChange, label = "Productos utilizados" }) {
  const all = SpecData.products(vertical);
  const [adding, setAdding] = React.useState(false);
  const available = all.filter((p) => !items.some((it) => it.id === p.id));

  const add = (p) => { onChange([...items, { id: p.id, name: p.name, price: p.price, stock: p.stock, qty: 1 }]); setAdding(false); };
  const remove = (id) => onChange(items.filter((it) => it.id !== id));
  const setQty = (id, qty) => onChange(items.map((it) => it.id === id ? { ...it, qty } : it));

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {items.map((it) => {
            const over = it.qty > it.stock;
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)", border: `1px solid ${over ? "var(--error)" : "var(--border-subtle)"}`, background: over ? "var(--error-tint)" : "var(--surface-card)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{it.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: over ? "var(--error)" : "var(--text-tertiary)" }}>
                    {RecepData.COP(it.price)} c/u · {over ? `solo ${it.stock} en stock` : `${it.stock} disponibles`}
                  </div>
                </div>
                <div style={{ width: 108, flex: "none" }}><GNumber value={it.qty} onChange={(v) => setQty(it.id, v)} min={1} suffix="u" invalid={over} /></div>
                <span className="data" style={{ width: 84, textAlign: "right", flex: "none", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{RecepData.COP(it.price * it.qty)}</span>
                <button type="button" onClick={() => remove(it.id)} aria-label="Quitar producto" style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", padding: 6 }}>
                  <Icon name="x" size={16} color="var(--text-tertiary)" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {available.length > 0 ? (
          <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setAdding((o) => !o)}>Agregar producto</Button>
        ) : items.length === 0 ? (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>No hay productos en inventario.</span>
        ) : null}
        <Popover open={adding} onClose={() => setAdding(false)} width={300} top="calc(100% + 6px)">
          <div className="eyebrow" style={{ padding: "6px 10px 4px" }}>Inventario</div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {available.map((p) => {
              const out = p.stock <= 0;
              return (
                <button key={p.id} type="button" disabled={out} onClick={() => add(p)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", border: "none", background: "transparent", cursor: out ? "not-allowed" : "pointer", textAlign: "left", borderRadius: "var(--radius-xs)", opacity: out ? 0.5 : 1 }}
                  onMouseEnter={(e) => { if (!out) e.currentTarget.style.background = "var(--surface-sunken)"; }} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <Icon name="package" size={15} color="var(--text-tertiary)" />
                  <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{p.name}</span>
                  <span className="data" style={{ fontSize: "var(--text-xs)", color: out ? "var(--error)" : "var(--text-tertiary)" }}>{out ? "Agotado" : `${RecepData.COP(p.price)} · ${p.stock}u`}</span>
                </button>
              );
            })}
          </div>
        </Popover>
      </div>
    </div>
  );
}

// ───────────────────────── 7.3 · Modal de Cita ──────────────────────
const APPT_STATES = ["Solicitada", "Confirmada", "En progreso", "Completada", "Cancelada", "No asistió"];

function ApptModal({ modal, vertical, branch, inventoryOn, onClose, onSave }) {
  if (!modal) return null;
  const editing = modal.mode === "edit";
  const a = modal.appt;
  const data = OrkData.get(vertical);
  const specialists = data.specialists; // válidos de la sucursal

  const [client, setClient] = React.useState(() => editing ? { name: a.clientName, phone: a.clientPhone || "", email: "", pro: false } : { name: "", phone: "", email: "", pro: false });
  const [date, setDate] = React.useState("2026-06-09");
  const [time, setTime] = React.useState(editing ? a.time : "12:00");
  const [services, setServices] = React.useState(() => editing ? a.services.map((s) => ({ id: s.id, name: s.name, original: s.price, price: s.price, min: s.min })) : []);
  const [specialistId, setSpecialistId] = React.useState(editing ? a.specialistId : specialists[0].id);
  const [status, setStatus] = React.useState(editing ? a.status : "Confirmada");
  const [payment, setPayment] = React.useState(editing && a.payment ? a.payment : "");
  const [receipt, setReceipt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [products, setProducts] = React.useState([]);
  const [touched, setTouched] = React.useState(false);

  const totalPrice = services.reduce((a, it) => a + (Number(it.price) || 0), 0)
    + products.reduce((a, it) => a + it.price * it.qty, 0);
  const stockError = products.some((it) => it.qty > it.stock);
  const completing = status === "Completada";
  const noServices = services.length === 0;
  const needPayment = completing && !payment;
  const canSave = !noServices && !stockError && !needPayment;

  const trySave = () => { setTouched(true); if (canSave) onSave({ editing, status, completing }); };

  const pickClient = (c) => setClient({ name: c.name, phone: c.phone || "", email: c.email || "", pro: !!c.pro });

  return (
    <Dialog open onClose={onClose} width={620}
      title={editing ? "Editar cita" : "Nueva cita"}
      subtitle={editing ? `${a.clientName} · ${a.time}` : `Agenda una cita en ${branch || "la sucursal"}.`}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" iconLeft="check" disabled={!canSave} onClick={trySave}>{editing ? "Guardar cambios" : "Crear cita"}</Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "8px 0 16px" }}>
        {/* Cliente */}
        <GField label="Cliente" hint={client.pro ? "Cliente profesional — afecta el reparto del servicio." : "Busca un cliente existente o escribe uno nuevo."}>
          <ClientAutocomplete vertical={vertical} value={client.name} pro={client.pro}
            onChange={(v) => setClient((c) => ({ ...c, name: v, pro: v === c.name ? c.pro : false }))} onPick={pickClient} />
        </GField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Teléfono" optional><GInput value={client.phone} onChange={(v) => setClient((c) => ({ ...c, phone: v }))} placeholder="300 000 0000" /></GField>
          <GField label="Correo" optional><GInput value={client.email} onChange={(v) => setClient((c) => ({ ...c, email: v }))} type="email" placeholder="nombre@correo.com" /></GField>
        </div>

        {/* Fecha / hora / especialista */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <GField label="Fecha"><GInput value={date} onChange={setDate} type="date" /></GField>
          <GField label="Hora"><GSelect value={time} onChange={setTime} options={RecepData.TIMES} /></GField>
          <GField label="Especialista" hint="Solo válidos de esta sucursal.">
            <GSelect value={specialistId} onChange={setSpecialistId} options={specialists.map((s) => ({ value: s.id, label: s.name }))} />
          </GField>
        </div>

        {/* Servicios */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Servicios</div>
          <ServicePicker vertical={vertical} items={services} onChange={setServices} />
          {touched && noServices && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6 }}><Icon name="alert-circle" size={13} color="var(--error)" />Agrega al menos un servicio.</span>}
        </div>

        {/* Productos (si inventario activo) */}
        {inventoryOn && (
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Productos utilizados <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}>· opcional</span></div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "0 0 8px" }}>Se pueden registrar incluso en citas programadas. El stock se descuenta al completar.</p>
            <ProductPicker vertical={vertical} items={products} onChange={setProducts} />
            {stockError && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Hay productos con cantidad mayor al stock disponible.</span>}
          </div>
        )}

        {/* Estado + pago */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Estado"><GSelect value={status} onChange={setStatus} options={APPT_STATES} /></GField>
          <GField label="Número de recibo" optional><GInput value={receipt} onChange={setReceipt} placeholder="Ej.: 0042" /></GField>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Método de pago {completing && <span style={{ color: "var(--error)" }}>· requerido para completar</span>}
          </div>
          <PaymentPicker value={payment} onChange={setPayment} invalid={touched && needPayment} />
          {touched && needPayment && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Selecciona un método de pago para marcar la cita como completada.</span>}
        </div>

        <GField label="Notas" optional><GArea value={notes} onChange={setNotes} rows={2} placeholder="Observaciones de la cita…" /></GField>

        {/* Microcopy de efectos al completar */}
        {completing && (
          <div style={{ display: "flex", gap: 11, padding: 13, borderRadius: "var(--radius-sm)", background: "var(--info-tint)", border: "1px solid rgba(59,130,246,0.22)" }}>
            <Icon name="info" size={17} color="var(--info)" style={{ flex: "none", marginTop: 1 }} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>Al guardar como <strong>Completada</strong> se calculan las ganancias y se descuenta el stock de los productos usados.</span>
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--navy)", color: "#fff" }}>
          <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Total de la cita</span>
          <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "-0.02em" }}>{RecepData.COP(totalPrice)}</span>
        </div>
      </div>
    </Dialog>
  );
}

// ───────────────────────── 7.4 · Cambiar estado / Completar ─────────
function StatusModal({ modal, vertical, onClose, onApply }) {
  if (!modal) return null;
  const a = modal.appt;
  const wasCompleted = a.status === "Completada";
  const [status, setStatus] = React.useState(modal.target || a.status);
  const [payment, setPayment] = React.useState(a.payment || "");
  const [touched, setTouched] = React.useState(false);

  const completing = status === "Completada";
  const reverting = wasCompleted && status !== "Completada";
  const needPayment = completing && !payment;
  const isPro = false;
  const split = completing && payment ? RecepData.splitService({ total: a.total, payment, vertical, isPro }) : null;

  const apply = () => { setTouched(true); if (!needPayment) onApply(a, status, { payment }); };

  return (
    <Dialog open onClose={onClose} width={520}
      title="Cambiar estado de la cita"
      subtitle={`${a.clientName} · ${a.time} · ${a.specialistName}`}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant={reverting ? "danger" : "primary"} size="md" iconLeft={reverting ? "rotate-ccw" : "check"} disabled={needPayment} onClick={apply}>
          {reverting ? "Revertir y deshacer" : completing ? "Completar cita" : "Guardar estado"}
        </Button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 16px" }}>
        {/* Segmented de estados */}
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Estado</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {APPT_STATES.map((st) => {
              const on = st === status;
              const tone = STATUS_TONE[st] || "neutral";
              const c = tone === "neutral" ? "var(--text-secondary)" : `var(--${tone})`;
              return (
                <button key={st} type="button" onClick={() => setStatus(st)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", cursor: "pointer",
                  border: `1px solid ${on ? c : "var(--border-default)"}`, borderRadius: "var(--radius-pill)",
                  background: on ? (tone === "neutral" ? "var(--surface-sunken)" : `var(--${tone}-tint)`) : "var(--surface-card)",
                  color: on ? c : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: c }} />{st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guard de pago al completar */}
        {completing && (
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Método de pago <span style={{ color: "var(--error)" }}>· requerido</span>
            </div>
            <PaymentPicker value={payment} onChange={setPayment} invalid={touched && needPayment} />
            {touched && needPayment && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Selecciona un método de pago para completar la cita.</span>}
          </div>
        )}

        {/* Desglose de ganancias */}
        {split && (
          <div style={{ padding: "4px 16px 8px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ padding: "12px 0 2px", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Desglose de la atención</div>
            <GSummaryRow first label="Total del servicio" value={RecepData.COP(split.total)} strong />
            {split.comisionBancaria > 0 && <GSummaryRow label="Comisión bancaria" sub={`${String(split.comisionPct).replace(".", ",")}%`} value={`– ${RecepData.COP(split.comisionBancaria)}`} tone="neg" />}
            <GSummaryRow label="Deducción administrativa" sub={`${String(split.deduccionPct).replace(".", ",")}%`} value={`– ${RecepData.COP(split.deduccion)}`} tone="neg" />
            <GSummaryRow label="Ganancia del profesional" sub={`${split.repartoPro}%`} value={RecepData.COP(split.profesional)} tone="pos" />
            <GSummaryRow label="Ganancia del negocio" sub={`${split.repartoSalon}%`} value={RecepData.COP(split.salon)} />
          </div>
        )}

        {/* Aviso de reversión */}
        {reverting && (
          <div style={{ display: "flex", gap: 11, padding: 14, borderRadius: "var(--radius-sm)", background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.24)" }}>
            <Icon name="alert-triangle" size={18} color="var(--error)" style={{ flex: "none", marginTop: 1 }} />
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>
              <strong style={{ color: "var(--text-primary)" }}>Revertir una cita completada deshace sus efectos.</strong> Se eliminan las ganancias calculadas y se devuelve el stock de los productos usados. No se borra la cita.
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

Object.assign(window, { PaymentPicker, ClientAutocomplete, ServicePicker, ProductPicker, ApptModal, StatusModal, APPT_STATES });
