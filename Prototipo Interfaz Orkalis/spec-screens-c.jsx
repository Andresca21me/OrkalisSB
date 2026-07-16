/* Orkalis — app del especialista (parte C): 2.5 Completar turno (cobro) · 2.6 Walk-in */

// ════════════════════════ 2.5 COMPLETAR TURNO (COBRO) ════════════════════════
function ScreenCobro({ data, turno, inventoryOn, partitionOn, saving, onBack, onConfirm, onToast }) {
  const [services, setServices] = React.useState(() => turno.services.map((s) => ({ ...s, price: s.price })));
  const [products, setProducts] = React.useState([]); // {id,name,price,qty,stock}
  const [payment, setPayment] = React.useState(null);
  const [receipt, setReceipt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const [addSheet, setAddSheet] = React.useState(null); // 'service' | 'product'

  const total = services.reduce((a, s) => a + s.price, 0) + products.reduce((a, p) => a + p.price * p.qty, 0);
  const split = SpecData.SPLIT;
  const yourCut = Math.round(services.reduce((a, s) => a + s.price, 0) * split.service) + Math.round(products.reduce((a, p) => a + p.price * p.qty, 0) * split.product);

  const editPrice = (i, v) => setServices((arr) => arr.map((s, idx) => idx === i ? { ...s, price: Math.max(0, parseInt(String(v).replace(/\D/g, "") || "0")) } : s));
  const removeService = (i) => setServices((arr) => arr.filter((_, idx) => idx !== i));
  const allServices = data.services.filter((s) => !services.some((x) => x.id === s.id));
  const allProducts = SpecData.products(data.vertical);

  const addProduct = (p) => {
    if (p.stock <= 0) { onToast({ tone: "warning", msg: `Sin stock de ${p.name}` }); return; }
    setProducts((arr) => arr.some((x) => x.id === p.id) ? arr.map((x) => x.id === p.id ? { ...x, qty: Math.min(x.stock, x.qty + 1) } : x) : [...arr, { ...p, qty: 1 }]);
    setAddSheet(null);
  };
  const setQty = (id, qty) => setProducts((arr) => qty <= 0 ? arr.filter((x) => x.id !== id) : arr.map((x) => x.id === id ? { ...x, qty } : x));

  const confirm = () => { setTried(true); if (!payment) { onToast({ tone: "warning", msg: "Elige un método de pago" }); return; } onConfirm({ total, payment, yourCut }); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Completar turno" sub={`${turno.clientName} · ${turno.time}`} onBack={onBack} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          {/* Servicios realizados */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="eyebrow">Servicios realizados</span>
            <button type="button" onClick={() => setAddSheet("service")} style={addLink}><Icon name="plus" size={14} /> Agregar</button>
          </div>
          <Card padding={0} style={{ marginBottom: 16 }}>
            {services.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && <div style={{ height: 1, background: "var(--border-subtle)" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{s.min} min</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", height: 38, padding: "0 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xs)", background: "var(--surface-card)" }}>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>$</span>
                    <input value={s.price.toLocaleString("es-CO")} onChange={(e) => editPrice(i, e.target.value)} inputMode="numeric" className="data" style={{ width: 72, border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }} />
                  </div>
                  {services.length > 1 && <button type="button" onClick={() => removeService(i)} aria-label="Quitar" style={iconGhost}><Icon name="x" size={16} color="var(--text-tertiary)" /></button>}
                </div>
              </React.Fragment>
            ))}
          </Card>

          {/* Productos (si inventario activo) */}
          {inventoryOn && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="eyebrow">Productos usados</span>
                <button type="button" onClick={() => setAddSheet("product")} style={addLink}><Icon name="plus" size={14} /> Agregar</button>
              </div>
              <Card padding={products.length ? 0 : 14} style={{ marginBottom: 16 }}>
                {products.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Sin productos. Agrega si usaste alguno.</div>
                ) : products.map((p, i) => (
                  <React.Fragment key={p.id}>
                    {i > 0 && <div style={{ height: 1, background: "var(--border-subtle)" }} />}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{p.name}</div>
                        <div className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{OrkData.COP(p.price)} c/u · stock {p.stock}</div>
                      </div>
                      <QtyStepper value={p.qty} onChange={(q) => setQty(p.id, Math.min(p.stock, q))} max={p.stock} />
                    </div>
                  </React.Fragment>
                ))}
              </Card>
            </>
          )}

          {/* Método de pago */}
          <div style={{ marginBottom: 10 }}><span className="eyebrow">Método de pago</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: tried && !payment ? 8 : 16 }}>
            {SpecData.PAYMENTS.map((p) => <Chip key={p.id} active={payment === p.id} icon={p.icon} onClick={() => setPayment(p.id)}>{p.label}</Chip>)}
          </div>
          {tried && !payment && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--error)", fontSize: "var(--text-xs)", marginBottom: 16 }}><Icon name="alert-circle" size={14} color="var(--error)" /> Selecciona un método de pago para completar.</div>}

          {/* Recibo + notas */}
          <Field label="Número de recibo (opcional)" style={{ marginBottom: 16 }}>
            <input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Ej. 0042" className="data" style={inputStyle(false)} />
          </Field>

          {/* Resumen + reparto */}
          <Card padding={0}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>Total a cobrar</span>
              <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)" }}>{OrkData.COP(total)}</span>
            </div>
            {partitionOn && (
              <>
                <div style={{ height: 1, background: "var(--border-subtle)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", background: "var(--surface-sunken)" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Tu parte estimada</span>
                  <span className="data" style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "#0A8F5B" }}>{OrkData.COP(yourCut)}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      </ScrollArea>

      <FooterBar>
        <Button size="lg" fullWidth disabled={saving} iconLeft={saving ? null : "check"} onClick={confirm}>{saving ? "Guardando…" : "Confirmar cobro y completar"}</Button>
      </FooterBar>

      {/* Sheet agregar servicio */}
      <Sheet open={addSheet === "service"} onClose={() => setAddSheet(null)} title="Agregar servicio">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
          {allServices.length === 0 ? <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", padding: 8 }}>Ya agregaste todos los servicios.</div>
            : allServices.map((s) => (
              <button key={s.id} type="button" onClick={() => { setServices((arr) => [...arr, { ...s }]); setAddSheet(null); }} style={pickRow}>
                <div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</div><div className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{OrkData.COP(s.price)} · {s.min} min</div></div>
                <Icon name="plus" size={18} color="var(--brand)" />
              </button>
            ))}
        </div>
      </Sheet>

      {/* Sheet agregar producto */}
      <Sheet open={addSheet === "product"} onClose={() => setAddSheet(null)} title="Agregar producto">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
          {allProducts.map((p) => (
            <button key={p.id} type="button" disabled={p.stock <= 0} onClick={() => addProduct(p)} style={{ ...pickRow, opacity: p.stock <= 0 ? 0.5 : 1, cursor: p.stock <= 0 ? "not-allowed" : "pointer" }}>
              <div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div><div className="data" style={{ fontSize: "var(--text-xs)", color: p.stock <= 0 ? "var(--error)" : "var(--text-tertiary)" }}>{OrkData.COP(p.price)} · {p.stock <= 0 ? "sin stock" : `stock ${p.stock}`}</div></div>
              {p.stock > 0 && <Icon name="plus" size={18} color="var(--brand)" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

const addLink = { display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--text-link)", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", fontFamily: "var(--font-body)" };
const iconGhost = { width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
const pickRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "12px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-body)" };

Object.assign(window, { ScreenCobro });
