/* Orkalis — primitivas compartidas del módulo Gestión (Lote 4).
   Campos de formulario, controles segmentados, chips con contador, punto de
   estado de stock, diálogo de confirmación y menú de fila. Nombres con prefijo
   G/Stock para no colisionar con primitivas de otras pantallas. */

// ── Campo con label arriba (patrón de la casa) + error inline ────────
function GField({ label, hint, error, children, span = 1, optional }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: `span ${span}`, minWidth: 0 }}>
      {label && (
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
          {label}{optional && <span style={{ color: "var(--text-tertiary)", fontWeight: 500 }}> · opcional</span>}
        </span>
      )}
      {children}
      {error ? <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="alert-circle" size={13} color="var(--error)" />{error}</span>
        : hint ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{hint}</span> : null}
    </label>
  );
}

const G_INPUT_BASE = {
  height: 42, padding: "0 12px", borderRadius: "var(--radius-xs)", outline: "none", width: "100%",
  fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)", background: "var(--surface-card)",
  transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
};
function gBorder(focus, invalid) {
  return {
    border: `1px solid ${invalid ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)"}`,
    boxShadow: focus ? `0 0 0 3px ${invalid ? "var(--error-tint)" : "var(--brand-tint)"}` : "none",
  };
}

function GInput({ value, onChange, placeholder, type = "text", invalid }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input value={value == null ? "" : value} type={type} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ ...G_INPUT_BASE, ...gBorder(focus, invalid) }} />
  );
}

function GArea({ value, onChange, placeholder, rows = 3 }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea value={value == null ? "" : value} placeholder={placeholder} rows={rows}
      onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ ...G_INPUT_BASE, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: "21px", ...gBorder(focus) }} />
  );
}

// Dinero (COP) — prefijo $ y separador de miles en vivo
function GMoney({ value, onChange, placeholder = "0", invalid }) {
  const [focus, setFocus] = React.useState(false);
  const display = value === "" || value == null || isNaN(value) ? "" : Number(value).toLocaleString("es-CO");
  return (
    <div style={{ position: "relative", ...G_INPUT_BASE, padding: 0, display: "flex", alignItems: "center", ...gBorder(focus, invalid) }}>
      <span style={{ paddingLeft: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>$</span>
      <input value={display} inputMode="numeric" placeholder={placeholder}
        onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ""); onChange(raw === "" ? "" : Number(raw)); }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", height: 40, padding: "0 12px 0 8px",
          fontFamily: "var(--font-mono)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
    </div>
  );
}

// Número entero con sufijo (min, duración, cantidad…) + steppers
function GNumber({ value, onChange, suffix, min = 0, step = 1, invalid }) {
  const [focus, setFocus] = React.useState(false);
  const v = value === "" || value == null ? "" : value;
  const set = (n) => onChange(Math.max(min, n));
  return (
    <div style={{ position: "relative", ...G_INPUT_BASE, padding: 0, display: "flex", alignItems: "center", ...gBorder(focus, invalid) }}>
      <input value={v} inputMode="numeric"
        onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ""); onChange(raw === "" ? "" : Number(raw)); }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", height: 40, padding: "0 6px 0 12px",
          fontFamily: "var(--font-mono)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
      {suffix && <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", paddingRight: 8, whiteSpace: "nowrap" }}>{suffix}</span>}
      <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border-subtle)" }}>
        <button type="button" onClick={() => set(Number(v || 0) + step)} style={gStepBtn}><Icon name="chevron-down" size={13} color="var(--text-tertiary)" style={{ transform: "rotate(180deg)" }} /></button>
        <button type="button" onClick={() => set(Number(v || 0) - step)} style={{ ...gStepBtn, borderTop: "1px solid var(--border-subtle)" }}><Icon name="chevron-down" size={13} color="var(--text-tertiary)" /></button>
      </div>
    </div>
  );
}
const gStepBtn = { width: 30, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", padding: 0 };

// Select estilizado (chevron)
function GSelect({ value, onChange, options, invalid }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: "relative", ...G_INPUT_BASE, padding: 0, display: "flex", alignItems: "center", ...gBorder(focus, invalid) }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", height: 40, padding: "0 32px 0 12px",
          fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)", appearance: "none", cursor: "pointer" }}>
        {options.map((o) => { const val = typeof o === "object" ? o.value : o; const lab = typeof o === "object" ? o.label : o; return <option key={val} value={val}>{lab}</option>; })}
      </select>
      <span style={{ position: "absolute", right: 10, pointerEvents: "none", display: "inline-flex" }}><Icon name="chevron-down" size={16} color="var(--text-tertiary)" /></span>
    </div>
  );
}

// Toggle switch (Libre/Ocupado, modo retail…)
function GSwitch({ checked, onChange, accent }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 42, height: 24, flex: "none", borderRadius: 999, border: "none", cursor: "pointer", padding: 2,
        background: checked ? (accent ? "var(--accent)" : "var(--brand)") : "var(--gray-300)",
        transition: "background var(--dur-fast) var(--ease-out)" }}>
      <span style={{ display: "block", width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "var(--shadow-sm)",
        transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform var(--dur-base) var(--ease-out)" }} />
    </button>
  );
}

// Control segmentado — opciones [{value,label,count?}]
function GSegmented({ value, onChange, options, size = "md" }) {
  const h = size === "sm" ? 34 : 38;
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, height: h, padding: "0 14px", border: "none", cursor: "pointer",
            borderRadius: "var(--radius-xs)", background: on ? "var(--surface-card)" : "transparent",
            boxShadow: on ? "var(--shadow-xs)" : "none",
            color: on ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
            transition: "background var(--dur-fast) var(--ease-out)",
          }}>
            {o.icon && <Icon name={o.icon} size={15} color={on ? "var(--brand)" : "var(--text-tertiary)"} />}
            {o.label}
            {o.count != null && <span className="data" style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: "1px 6px", borderRadius: 999,
              background: on ? "var(--brand-tint)" : "var(--surface-card)", color: on ? "var(--brand)" : "var(--text-tertiary)" }}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Punto + etiqueta de estado de stock
const STOCK_TONE = { "En stock": { c: "var(--success)", t: "success" }, "Stock bajo": { c: "var(--warning)", t: "warning" }, "Agotado": { c: "var(--error)", t: "error" } };
function StockDot({ status, withLabel = true }) {
  const s = STOCK_TONE[status] || STOCK_TONE["En stock"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: s.c, flex: "none" }} />
      {withLabel && <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: status === "En stock" ? "var(--text-secondary)" : s.c }}>{status}</span>}
    </span>
  );
}

// Menú de fila (3 puntos) — items [{icon,label,danger,onClick}]
function RowMenu({ items, align = "right" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <IconBtn icon="more-vertical" label="Acciones" onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} align={align} width={196}>
        {items.map((it, i) => it.divider
          ? <div key={i} style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />
          : <MenuItem key={i} icon={it.icon} danger={it.danger} onClick={() => { it.onClick(); setOpen(false); }}>{it.label}</MenuItem>)}
      </Popover>
    </div>
  );
}

// Diálogo de confirmación genérico
function GConfirm({ open, title, desc, confirmLabel = "Confirmar", confirmIcon, danger, onClose, onConfirm, width = 440 }) {
  if (!open) return null;
  return (
    <Dialog open={open} onClose={onClose} title={title} width={width}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? "danger" : "primary"} size="md" iconLeft={confirmIcon} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <div style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", padding: "4px 0 16px", lineHeight: "24px" }}>{desc}</div>
    </Dialog>
  );
}

// Línea de resumen clave/valor (modales, liquidación)
function GSummaryRow({ label, value, strong, tone, sub, first }) {
  const color = tone === "pos" ? "var(--success)" : tone === "neg" ? "var(--error)" : strong ? "var(--text-primary)" : "var(--text-primary)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "11px 0", borderTop: first ? "none" : "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: strong ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: strong ? 600 : 400 }}>
        {label}{sub && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}> · {sub}</span>}
      </span>
      <span className="data" style={{ fontSize: strong ? "var(--text-md)" : "var(--text-sm)", fontWeight: strong ? 700 : 600, color, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

Object.assign(window, {
  GField, GInput, GArea, GMoney, GNumber, GSelect, GSwitch, GSegmented, StockDot, RowMenu, GConfirm, GSummaryRow,
});
