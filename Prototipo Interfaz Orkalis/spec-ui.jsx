/* Orkalis — primitivas específicas de la app del especialista (Lote 2) */

// Segmented control (Día|Semana, Hoy|Semana|Mes, modos walk-in)
function Segmented({ options, value, onChange, size = "md" }) {
  const h = size === "lg" ? 44 : 38;
  return (
    <div style={{ display: "flex", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", padding: 3, gap: 3 }}>
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        const on = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            flex: 1, height: h, border: "none", borderRadius: "var(--radius-xs)", cursor: "pointer",
            background: on ? "var(--surface-card)" : "transparent",
            color: on ? "var(--text-primary)" : "var(--text-secondary)",
            fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
            boxShadow: on ? "var(--shadow-xs)" : "none",
            transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// Switch (toggle)
function Switch({ checked, onChange, tone = "brand" }) {
  const onColor = tone === "success" ? "var(--success)" : "var(--brand)";
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={{
      width: 52, height: 32, borderRadius: 99, border: "none", cursor: "pointer", flex: "none",
      background: checked ? onColor : "var(--border-default)", padding: 3,
      display: "flex", justifyContent: checked ? "flex-end" : "flex-start", alignItems: "center",
      transition: "background var(--dur-base) var(--ease-out)",
    }}>
      <span style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", boxShadow: "var(--shadow-sm)", transition: "transform var(--dur-base) var(--ease-out)" }} />
    </button>
  );
}

// Alert / banner contextual
function Alert({ tone = "info", title, children, icon, style = {} }) {
  const map = {
    info: { fg: "var(--info)", bg: "var(--info-tint)", bd: "rgba(59,130,246,0.22)", icon: "info" },
    success: { fg: "var(--success)", bg: "var(--success-tint)", bd: "rgba(16,185,129,0.22)", icon: "check-circle" },
    warning: { fg: "#B45309", bg: "var(--warning-tint)", bd: "rgba(245,158,11,0.28)", icon: "alert-triangle" },
    error: { fg: "var(--error)", bg: "var(--error-tint)", bd: "rgba(239,68,68,0.22)", icon: "alert-octagon" },
  };
  const m = map[tone] || map.info;
  return (
    <div style={{ display: "flex", gap: 10, padding: 14, borderRadius: "var(--radius-md)", background: m.bg, border: `1px solid ${m.bd}`, ...style }}>
      <Icon name={icon || m.icon} size={18} color={m.fg} style={{ marginTop: 1, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: children ? 3 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: "18px" }}>{children}</div>}
      </div>
    </div>
  );
}

// Stepper de cantidad
function QtyStepper({ value, onChange, min = 0, max = 99 }) {
  const btn = (icon, fn, disabled) => (
    <button type="button" disabled={disabled} onClick={fn} style={{
      width: 32, height: 32, borderRadius: "var(--radius-xs)", border: "1px solid var(--border-default)",
      background: "var(--surface-card)", color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
      cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
    }}><Icon name={icon} size={16} /></button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {btn("minus", () => onChange(Math.max(min, value - 1)), value <= min)}
      <span className="data" style={{ minWidth: 20, textAlign: "center", fontWeight: 600, fontSize: "var(--text-base)" }}>{value}</span>
      {btn("plus", () => onChange(Math.min(max, value + 1)), value >= max)}
    </div>
  );
}

// Chip seleccionable (métodos de pago, filtros)
function Chip({ active, children, onClick, icon, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 7, height: 42, padding: "0 14px", cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: "var(--radius-sm)", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1,
      border: `1px solid ${active ? "var(--brand)" : "var(--border-default)"}`,
      background: active ? "var(--brand-tint)" : "var(--surface-card)",
      color: active ? "var(--brand)" : "var(--text-secondary)",
      fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
      transition: "all var(--dur-fast) var(--ease-out)",
    }}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

// Tab bar inferior (5 ítems, walk-in central destacado)
const TABS = [
  { id: "miDia", label: "Mi día", icon: "home" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "walkin", label: "Walk-in", icon: "plus", center: true },
  { id: "ganancias", label: "Ganancias", icon: "dollar-sign" },
  { id: "perfil", label: "Perfil", icon: "user" },
];
function TabBar({ active, onChange }) {
  return (
    <nav style={{
      flex: "none", display: "flex", alignItems: "flex-start", justifyContent: "space-around",
      background: "var(--surface-card)", borderTop: "1px solid var(--border-subtle)",
      paddingTop: 8, paddingBottom: 22, position: "relative", zIndex: 6,
    }}>
      {TABS.map((tab) => {
        if (tab.center) {
          return (
            <button key={tab.id} type="button" onClick={() => onChange(tab.id)} aria-label="Registrar walk-in" style={{
              flex: "none", width: 56, height: 56, marginTop: -22, borderRadius: "9999px", border: "3px solid var(--surface-card)",
              background: active === tab.id ? "var(--brand-pressed)" : "var(--brand)", color: "#fff", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-lg)",
            }}><Icon name="plus" size={26} color="#fff" strokeWidth={2.5} /></button>
          );
        }
        const on = active === tab.id;
        return (
          <button key={tab.id} type="button" onClick={() => onChange(tab.id)} style={{
            flex: 1, maxWidth: 80, border: "none", background: "transparent", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 0",
            color: on ? "var(--brand)" : "var(--text-tertiary)",
          }}>
            <Icon name={tab.icon} size={22} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-body)" }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Cabecera de pantalla del especialista (título grande + acción opcional)
function SpecHeader({ title, right }) {
  return (
    <header style={{ flex: "none", paddingTop: STATUS_TOP + 6, padding: `${STATUS_TOP + 6}px 20px 14px`, background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", lineHeight: 1.12, whiteSpace: "nowrap" }}>{title}</h1>
        {right}
      </div>
    </header>
  );
}

// Fila de turno compacta (lista)
function TurnoRow({ turno, data, onClick }) {
  const c = STATUS_TONE[turno.status] || "neutral";
  return (
    <Card interactive padding={0} onClick={onClick} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 4, flex: "none", background: `var(--${c === "neutral" ? "gray-400" : c})`, opacity: 0.9 }} />
        <div style={{ flex: 1, minWidth: 0, padding: "13px 14px 13px 13px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: "none", textAlign: "center", minWidth: 52 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{turno.time}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{turno.dur}m</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{turno.clientName}</span>
              {turno.isNew && <Badge tone="brand">Nuevo</Badge>}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{turno.services.map((s) => s.name).join(" · ")}</div>
          </div>
          <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className="data" style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{OrkData.COP(turno.total)}</span>
            <StatusBadge status={turno.status} />
          </div>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { Segmented, Switch, Alert, QtyStepper, Chip, TabBar, TABS, SpecHeader, TurnoRow });
