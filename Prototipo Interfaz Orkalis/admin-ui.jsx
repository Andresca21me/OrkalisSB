/* Orkalis — primitivas del Panel de Administración (Lote 3, escritorio/tablet).
   Reutiliza Icon/Button/Badge/StatusBadge/Avatar/Card/Skeleton de ork-ui. */

// ───────────────────────── Logo (marca "O" geométrica) ───────────────
function Logo({ size = 26, color = "var(--navy)", word = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span style={{ display: "inline-flex", width: size, height: size, flex: "none" }}
        dangerouslySetInnerHTML={{ __html:
          `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
             <rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="${color}" stroke-width="2.4"/>
             <circle cx="14.5" cy="14.5" r="4.2" fill="${color}"/>
           </svg>` }} />
      {word && <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.04em", color, textTransform: "uppercase" }}>Orkalis</span>}
    </span>
  );
}

// ───────────────────────── Popover (menú/selector) ───────────────────
function Popover({ open, onClose, children, align = "left", top = "calc(100% + 6px)", width, style = {} }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div role="menu" style={{
        position: "absolute", top, [align]: 0, zIndex: 41, width, minWidth: 200,
        background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", padding: 6,
        animation: "ork-pop var(--dur-base) var(--ease-out)", ...style,
      }}>{children}</div>
    </>
  );
}

function MenuItem({ icon, children, onClick, danger, active, hint }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", height: 38, padding: "0 10px",
        border: "none", borderRadius: "var(--radius-xs)", cursor: "pointer", textAlign: "left",
        background: hover ? (danger ? "var(--error-tint)" : "var(--surface-sunken)") : "transparent",
        color: danger ? "var(--error)" : active ? "var(--brand)" : "var(--text-primary)",
        fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 500,
      }}>
      {icon && <Icon name={icon} size={16} color={danger ? "var(--error)" : active ? "var(--brand)" : "var(--text-tertiary)"} />}
      <span style={{ flex: 1 }}>{children}</span>
      {hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{hint}</span>}
      {active && <Icon name="check" size={15} color="var(--brand)" />}
    </button>
  );
}

// ───────────────────────── Selector de sucursal ──────────────────────
function BranchSelector({ branch, branches, onPick, consolidated, onConsolidated }) {
  const [open, setOpen] = React.useState(false);
  const label = consolidated ? "Todo el negocio" : branch;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 9, height: 38, padding: "0 12px",
        background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
        cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)",
        boxShadow: "var(--shadow-xs)", maxWidth: 240,
      }}>
        <Icon name={consolidated ? "layout-grid" : "store"} size={16} color="var(--text-tertiary)" />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <Icon name="chevrons-up-down" size={15} color="var(--text-tertiary)" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={248}>
        <div className="eyebrow" style={{ padding: "6px 10px 4px" }}>Vista</div>
        <MenuItem icon="layout-grid" active={consolidated} onClick={() => { onConsolidated(); setOpen(false); }}>Todo el negocio</MenuItem>
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />
        <div className="eyebrow" style={{ padding: "2px 10px 4px" }}>Sucursales</div>
        {branches.map((b) => (
          <MenuItem key={b} icon="store" active={!consolidated && b === branch} onClick={() => { onPick(b); setOpen(false); }}>{b}</MenuItem>
        ))}
      </Popover>
    </div>
  );
}

// ───────────────────────── Cabecera superior fija ────────────────────
const NAV_ITEMS = [
  { id: "panel", label: "Panel", icon: "layout-grid" },
  { id: "agenda", label: "Agenda", icon: "calendar" },
  { id: "clientes", label: "Clientes", icon: "users" },
  { id: "gestion", label: "Gestión", icon: "package" },
  { id: "finanzas", label: "Finanzas", icon: "bar-chart-2" },
];

function TopNav({ active, onNav, branch, branches, consolidated, onPick, onConsolidated, admin, onToast, onConfig, onDeveloper, configActive }) {
  const [userOpen, setUserOpen] = React.useState(false);
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30, flex: "none", height: 64,
      background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)",
      display: "flex", alignItems: "center", gap: 18, padding: "0 24px",
    }}>
      <Logo />
      <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
      <BranchSelector branch={branch} branches={branches} consolidated={consolidated} onPick={onPick} onConsolidated={onConsolidated} />

      <nav style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 8 }}>
        {NAV_ITEMS.map((it) => {
          const on = active === it.id;
          return (
            <button key={it.id} type="button" onClick={() => onNav(it.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px",
              border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
              background: on ? "var(--brand-tint)" : "transparent",
              color: on ? "var(--brand)" : "var(--text-secondary)",
              fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
              transition: "background var(--dur-fast) var(--ease-out)",
            }}>
              <Icon name={it.icon} size={18} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
              {it.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <IconBtn icon="settings" label="Configuración" active={configActive} onClick={onConfig} />
      <IconBtn icon="code" label="Developer" onClick={onDeveloper} />
      <div style={{ width: 1, height: 28, background: "var(--border-subtle)", margin: "0 4px" }} />

      <div style={{ position: "relative" }}>
        <button type="button" onClick={() => setUserOpen((o) => !o)} style={{
          display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 6px 0 4px",
          border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--radius-sm)",
        }}>
          <Avatar name={admin.name} size={34} />
          <div style={{ textAlign: "left", lineHeight: 1.15 }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{admin.name}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{admin.role}</div>
          </div>
          <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
        </button>
        <Popover open={userOpen} onClose={() => setUserOpen(false)} align="right" width={210}>
          <MenuItem icon="user" onClick={() => setUserOpen(false)}>Mi perfil</MenuItem>
          <MenuItem icon="settings" onClick={() => { setUserOpen(false); onConfig && onConfig(); }}>Configuración</MenuItem>
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />
          <MenuItem icon="log-out" danger onClick={() => setUserOpen(false)}>Cerrar sesión</MenuItem>
        </Popover>
      </div>
    </header>
  );
}

function IconBtn({ icon, label, onClick, tone, active }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, flex: "none",
        border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
        background: active ? "var(--brand-tint)" : hover ? "var(--surface-sunken)" : "transparent",
        color: tone === "danger" ? "var(--error)" : active ? "var(--brand)" : "var(--text-secondary)",
      }}>
      <Icon name={icon} size={19} color={tone === "danger" ? "var(--error)" : active ? "var(--brand)" : "var(--text-secondary)"} />
    </button>
  );
}

// ───────────────────────── KPI card ──────────────────────────────────
function KpiCard({ label, value, icon, trend, sub, loading }) {
  if (loading) return (
    <Card padding={18} style={{ minHeight: 116 }}>
      <Skeleton w={120} h={13} /><div style={{ height: 14 }} />
      <Skeleton w={96} h={28} /><div style={{ height: 12 }} /><Skeleton w={80} h={12} />
    </Card>
  );
  const up = trend && trend.dir === "up";
  const down = trend && trend.dir === "down";
  const trendColor = trend ? (trend.tone === "neutral" ? "var(--text-tertiary)" : up ? "var(--accent)" : down ? "var(--error)" : "var(--text-secondary)") : null;
  return (
    <Card padding={18} style={{ minHeight: 116, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
        {icon && (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", flex: "none" }}>
            <Icon name={icon} size={17} color="var(--text-tertiary)" />
          </span>
        )}
      </div>
      <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text-primary)", marginTop: 8, lineHeight: 1.1 }}>{value}</div>
      <div style={{ flex: 1 }} />
      {(trend || sub) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          {trend && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: trendColor }}>
              {(up || down) && <span style={{ fontSize: 13 }}>{up ? "↑" : "↓"}</span>}{trend.value}
            </span>
          )}
          {sub && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{sub}</span>}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── Diálogo (modal escritorio) ────────────────
function Dialog({ open, onClose, title, subtitle, children, footer, width = 520 }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,15,20,0.5)", animation: "ork-fade var(--dur-base) var(--ease-out)" }} />
      <div role="dialog" aria-modal="true" style={{
        position: "relative", width: "100%", maxWidth: width, maxHeight: "calc(100vh - 48px)",
        background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column", animation: "ork-pop var(--dur-slow) var(--ease-out)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "20px 22px 14px" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", letterSpacing: "-0.02em" }}>{title}</h2>
            {subtitle && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
          <IconBtn icon="x" label="Cerrar" onClick={onClose} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 22px 4px", flex: 1 }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px 20px", borderTop: "1px solid var(--border-subtle)", marginTop: 8 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ───────────────────────── Estado vacío ──────────────────────────────
function EmptyState({ icon = "inbox", title, desc, action, compact }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: compact ? "40px 24px" : "72px 24px", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)", marginBottom: 8 }}>
        <Icon name={icon} size={26} color="var(--text-tertiary)" />
      </span>
      <h3 style={{ fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{title}</h3>
      {desc && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 340, margin: 0 }}>{desc}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

// ───────────────────────── Input de búsqueda ─────────────────────────
function SearchInput({ value, onChange, placeholder = "Buscar…", width }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", width,
      background: "var(--surface-card)", borderRadius: "var(--radius-sm)",
      border: `1px solid ${focus ? "var(--brand)" : "var(--border-default)"}`,
      boxShadow: focus ? "0 0 0 3px var(--brand-tint)" : "var(--shadow-xs)",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
    }}>
      <Icon name="search" size={17} color="var(--text-tertiary)" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }} />
      {value && <button type="button" onClick={() => onChange("")} style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", padding: 2 }}><Icon name="x" size={15} color="var(--text-tertiary)" /></button>}
    </div>
  );
}

// ───────────────────────── Pestañas subrayadas ───────────────────────
function TabsUnderline({ tabs, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)" }}>
      {tabs.map((tab) => {
        const v = typeof tab === "object" ? tab.value : tab;
        const l = typeof tab === "object" ? tab.label : tab;
        const on = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            position: "relative", height: 40, padding: "0 4px", marginRight: 14, border: "none", background: "transparent", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
            color: on ? "var(--text-primary)" : "var(--text-tertiary)",
          }}>
            {l}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, borderRadius: 2, background: on ? "var(--brand)" : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Stat compacto (filas de estadística) ──────
function StatTile({ label, value, icon, accent, loading }) {
  if (loading) return <Card padding={16}><Skeleton w={90} h={12} /><div style={{ height: 10 }} /><Skeleton w={70} h={24} /></Card>;
  return (
    <Card padding={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {icon && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "var(--radius-sm)", flex: "none",
          background: accent ? "var(--brand-tint)" : "var(--surface-sunken)" }}>
          <Icon name={icon} size={19} color={accent ? "var(--brand)" : "var(--text-tertiary)"} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</div>
        <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.2 }}>{value}</div>
      </div>
    </Card>
  );
}

// ───────────────────────── Toast escritorio ──────────────────────────
function ToastDesktop({ toast }) {
  if (!toast) return null;
  const toneColor = { success: "var(--success)", error: "var(--error)", info: "var(--brand)", warning: "var(--warning)" }[toast.tone || "info"];
  const iconName = { success: "check-circle", error: "alert-circle", info: "info", warning: "alert-triangle" }[toast.tone || "info"];
  return (
    <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 70, pointerEvents: "none" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10, background: "var(--navy)", color: "#fff",
        padding: "13px 18px", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xl)",
        fontSize: "var(--text-sm)", fontWeight: 500, animation: "ork-toast var(--dur-slow) var(--ease-out)",
      }}>
        <Icon name={iconName} size={18} color={toneColor} />
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}

// ───────────────────────── Cabecera de página ────────────────────────
function PageHeader({ eyebrow, title, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 style={{ fontSize: "var(--text-3xl)", letterSpacing: "-0.02em", lineHeight: 1.08 }}>{title}</h1>
        {sub && <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "6px 0 0" }}>{sub}</p>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div>}
    </div>
  );
}

// ───────────────────────── Inset de error ────────────────────────────
function ErrorState({ onRetry, title = "No pudimos cargar la información", desc = "Revisa tu conexión e inténtalo de nuevo." }) {
  return (
    <Card padding={0}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "64px 24px", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "var(--radius-lg)", background: "var(--error-tint)", marginBottom: 8 }}>
          <Icon name="alert-octagon" size={26} color="var(--error)" />
        </span>
        <h3 style={{ fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 340, margin: 0 }}>{desc}</p>
        <div style={{ marginTop: 12 }}><Button variant="secondary" size="md" iconLeft="refresh-cw" onClick={onRetry}>Reintentar</Button></div>
      </div>
    </Card>
  );
}

Object.assign(window, {
  Logo, Popover, MenuItem, BranchSelector, TopNav, NAV_ITEMS, IconBtn, KpiCard,
  Dialog, EmptyState, SearchInput, TabsUnderline, StatTile, ToastDesktop, PageHeader, ErrorState,
});
