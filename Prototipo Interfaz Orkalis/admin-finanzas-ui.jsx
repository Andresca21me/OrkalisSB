/* Orkalis — primitivas del módulo Finanzas (Lote 5).
   Gráficos ligeros (barras verticales/horizontales, dona) y widgets:
   parámetro aplicado, badge de salud financiera, fila/modal de gasto.
   Data es el héroe: colores de marca, números tabulares, sin decoración. */

// ── Barras verticales (tendencias) ────────────────────────────────
function VBars({ data, height = 180, color = "var(--brand)", money = true, accentLast }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const h = max ? Math.max(2, (d.value / max) * (height - 28)) : 2;
        const isLast = accentLast && i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span className="data" style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{d.value > 0 ? (money ? compactCOP(d.value) : d.value) : ""}</span>
            <div title={money ? AdminData.COP(d.value) : String(d.value)} style={{
              width: "100%", maxWidth: 46, height: h, borderRadius: "4px 4px 0 0",
              background: isLast ? "var(--brand)" : d.value === 0 ? "var(--gray-200)" : "var(--brand-tint)",
              border: `1px solid ${isLast ? "var(--brand)" : "color-mix(in srgb, var(--brand) 26%, transparent)"}`,
              transition: "height var(--dur-slow) var(--ease-out)",
            }} />
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Barras horizontales (ranking) ─────────────────────────────────
function HBars({ data, money = true, valueFmt }) {
  const max = Math.max(1, ...data.map((d) => d.value != null ? d.value : d.ingresos));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => {
        const v = d.value != null ? d.value : d.ingresos;
        const pct = Math.max(2, (v / max) * 100);
        return (
          <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 116, flex: "none", fontSize: "var(--text-sm)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name || d.label}</span>
            <div style={{ flex: 1, height: 22, background: "var(--surface-sunken)", borderRadius: "var(--radius-xs)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: d.color || "var(--brand)", borderRadius: "var(--radius-xs)", transition: "width var(--dur-slow) var(--ease-out)" }} />
            </div>
            <span className="data" style={{ width: 96, flex: "none", textAlign: "right", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
              {valueFmt ? valueFmt(d) : money ? AdminData.COP(v) : v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Dona (distribución) ───────────────────────────────────────────
function Donut({ data, size = 168, thickness = 26, center }) {
  const total = data.reduce((a, d) => a + d.pct, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const len = (d.pct / total) * c;
            const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len; return seg;
          })}
        </svg>
        {center && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{center.label}</span>
          <span className="data" style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>{center.value}</span>
        </div>}
      </div>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 9 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: "none" }} />
            <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{d.label}</span>
            {d.monto != null && <span className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{compactCOP(d.monto)}</span>}
            <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", width: 42, textAlign: "right" }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// COP compacto para ejes/etiquetas ($ 1,3M / $ 845k)
function compactCOP(n) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000000) return `$ ${(n / 1000000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1000) return `$ ${Math.round(n / 1000)}k`;
  return AdminData.COP(n);
}

// ── Badge de salud financiera ─────────────────────────────────────
const HEALTH = {
  saludable: { tone: "success", label: "Saludable", icon: "trending-up", color: "var(--success)" },
  baja: { tone: "warning", label: "Rentabilidad baja", icon: "alert-triangle", color: "#B45309" },
  perdidas: { tone: "error", label: "Pérdidas", icon: "trending-down", color: "var(--error)" },
};
function HealthBadge({ health, size = "md" }) {
  const h = HEALTH[health] || HEALTH.saludable;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: size === "lg" ? 28 : 24, padding: "0 11px", borderRadius: "var(--radius-pill)",
      background: `var(--${h.tone}-tint)`, color: h.color, fontSize: "var(--text-sm)", fontWeight: 700 }}>
      <Icon name={h.icon} size={14} color={h.color} />{h.label}
    </span>
  );
}

// ── Tarjeta de parámetro aplicado (solo lectura) ──────────────────
function ParamCard({ params, onEdit }) {
  return (
    <Card padding={18} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={15} color="var(--text-tertiary)" />
          <span className="eyebrow">Parámetros aplicados</span>
        </div>
        <button type="button" onClick={onEdit} style={{ border: "none", background: "transparent", color: "var(--brand)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}>
          Editar en Configuración<Icon name="external-link" size={13} color="var(--brand)" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 0, borderTop: "1px solid var(--border-subtle)" }}>
        {params.map((p, i) => (
          <div key={p.key} style={{ padding: "13px 16px 13px 0", borderRight: (i % 4 !== 3) ? "1px solid var(--border-subtle)" : "none", paddingLeft: i === 0 ? 0 : 16 }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 5 }}>{p.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="data" style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
              <SourceTag source={p.source} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// indicador heredado / propio (sobrescrito)
function SourceTag({ source }) {
  const propio = source === "propio";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, padding: "0 7px", borderRadius: "var(--radius-pill)",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase",
      background: propio ? "var(--brand-tint)" : "var(--surface-sunken)", color: propio ? "var(--brand)" : "var(--text-tertiary)" }}>
      {propio ? "Propio" : "Heredado"}
    </span>
  );
}

// ── Fila de gasto ─────────────────────────────────────────────────
function ExpenseRow({ g, kind, onDelete, COP }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 4px", borderTop: "1px solid var(--border-subtle)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{g.name}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
          {g.cat} · {kind === "fijo" ? g.freq : AdminData.fmtDate(g.fecha)} · {g.metodo}
        </div>
      </div>
      <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{COP(g.monto)}</span>
      <IconBtn icon="trash-2" label="Eliminar gasto" tone="danger" onClick={() => onDelete(g)} />
    </div>
  );
}

// ── Modal: Gasto ──────────────────────────────────────────────────
const GASTO_METODOS = ["Efectivo", "Transferencia", "T. débito", "T. crédito", "Débito automático", "Nequi"];
function GastoModal({ open, kind, onClose, onSave }) {
  const blank = { name: "", desc: "", cat: "Operativos", monto: "", freq: "Mensual", fecha: "2026-06-09", metodo: "Efectivo" };
  const [f, setF] = React.useState(blank);
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => { if (open) { setTouched(false); setF({ ...blank, cat: kind === "fijo" ? "Arriendo" : "Compra de productos" }); } }, [open, kind]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const nameErr = touched && !f.name.trim() ? "Escribe un nombre" : null;
  const montoErr = touched && (f.monto === "" || f.monto == null) ? "Indica el monto" : null;
  const valid = f.name.trim() && f.monto !== "" && f.monto != null;
  const save = () => { setTouched(true); if (valid) onSave({ ...f, monto: Number(f.monto) }); };
  if (!open) return null;
  return (
    <Dialog open={open} onClose={onClose} width={520}
      title={kind === "fijo" ? "Nuevo gasto fijo" : "Nuevo gasto variable"}
      subtitle={kind === "fijo" ? "Recurrente: arriendo, nómina, software…" : "Puntual del período: insumos, publicidad…"}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={save}>Agregar gasto</Button>
      </>}>
      <div style={{ padding: "8px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        <GField label="Nombre del gasto" error={nameErr}><GInput value={f.name} onChange={set("name")} placeholder={kind === "fijo" ? "Ej.: Arriendo del local" : "Ej.: Compra de insumos"} invalid={!!nameErr} /></GField>
        <GField label="Descripción" optional><GArea value={f.desc} onChange={set("desc")} rows={2} placeholder="Detalle del gasto, proveedor, observaciones…" /></GField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Categoría"><GSelect value={f.cat} onChange={set("cat")} options={AdminData.GASTO_CATS} /></GField>
          <GField label="Monto" error={montoErr}><GMoney value={f.monto} onChange={set("monto")} invalid={!!montoErr} /></GField>
          {kind === "fijo"
            ? <GField label="Frecuencia"><GSelect value={f.freq} onChange={set("freq")} options={AdminData.GASTO_FREQS} /></GField>
            : <GField label="Fecha"><GInput value={f.fecha} onChange={set("fecha")} placeholder="aaaa-mm-dd" /></GField>}
          <GField label="Método de pago"><GSelect value={f.metodo} onChange={set("metodo")} options={GASTO_METODOS} /></GField>
        </div>
      </div>
    </Dialog>
  );
}

Object.assign(window, { VBars, HBars, Donut, compactCOP, HealthBadge, ParamCard, SourceTag, ExpenseRow, GastoModal });
