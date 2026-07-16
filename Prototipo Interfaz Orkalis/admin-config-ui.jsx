/* Orkalis — primitivas de Configuración (Lote 6).
   Patrón transversal de PROCEDENCIA (heredado del negocio / definido en la
   sucursal) reutilizable, selector de ámbito, shell con navegación lateral,
   filas de ajuste y banners. Reutiliza Icon/Button/Badge/Card de ork-ui y
   GField/GInput… de admin-gestion-ui. */

// ── Etiqueta de procedencia ──────────────────────────────────────────
function ProvTag({ overridden }) {
  const c = overridden ? "var(--brand)" : "var(--text-tertiary)";
  const bg = overridden ? "var(--brand-tint)" : "var(--surface-sunken)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 9px",
      borderRadius: "var(--radius-pill)", background: bg, flex: "none",
      fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 600, color: c, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, flex: "none" }} />
      {overridden ? "Definido en esta sucursal" : "Heredado del negocio"}
    </span>
  );
}

// ── Acción de procedencia (sobrescribir / volver a heredar) ──────────
function ProvAction({ overridden, onOverride, onInherit }) {
  return overridden
    ? <Button variant="ghost" size="sm" iconLeft="rotate-ccw" onClick={onInherit}>Volver a heredar</Button>
    : <Button variant="ghost" size="sm" iconLeft="edit" onClick={onOverride}>Sobrescribir</Button>;
}

// ── Campo de formulario con procedencia (para parámetros con herencia) ──
// scoped=false → modo negocio (sin procedencia, control activo).
// scoped=true  → modo sucursal: heredado (atenuado) o sobrescrito (editable).
function ProvField({ label, hint, error, scoped, overridden, onOverride, onInherit, span = 1, children }) {
  const inherited = scoped && !overridden;
  return (
    <div style={{ gridColumn: `span ${span}`, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        {scoped && <ProvTag overridden={overridden} />}
      </div>
      <div style={{ position: "relative", opacity: inherited ? 0.55 : 1, pointerEvents: inherited ? "none" : "auto", transition: "opacity var(--dur-base) var(--ease-out)" }}>
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 20 }}>
        <span style={{ fontSize: "var(--text-xs)", color: error ? "var(--error)" : "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          {error && <Icon name="alert-circle" size={13} color="var(--error)" />}
          {error || hint}
        </span>
        {scoped && <div style={{ flex: "none", marginRight: -6 }}><ProvAction overridden={overridden} onOverride={onOverride} onInherit={onInherit} /></div>}
      </div>
    </div>
  );
}

// ── Fila de ajuste (lista) con control a la derecha + procedencia ────
function SettingRow({ icon, title, desc, children, scoped, overridden, onOverride, onInherit, first, danger, badge }) {
  const inherited = scoped && !overridden;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 4px", borderTop: first ? "none" : "1px solid var(--border-subtle)" }}>
      {icon && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "var(--radius-sm)", flex: "none", marginTop: 1,
          background: danger ? "var(--error-tint)" : "var(--surface-sunken)" }}>
          <Icon name={icon} size={19} color={danger ? "var(--error)" : "var(--text-secondary)"} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
          {badge}
          {scoped && <ProvTag overridden={overridden} />}
        </div>
        {desc && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "4px 0 0", maxWidth: 560, lineHeight: "20px" }}>{desc}</p>}
        {scoped && (
          <div style={{ marginTop: 8, marginLeft: -6 }}>
            <ProvAction overridden={overridden} onOverride={onOverride} onInherit={onInherit} />
          </div>
        )}
      </div>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, paddingTop: 2, opacity: inherited ? 0.55 : 1, pointerEvents: inherited ? "none" : "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ── Selector de ámbito (Negocio / Sucursal específica) ───────────────
function ScopeSelector({ scope, onScope, branchId, onBranch, branches }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
        {[{ v: "negocio", l: "Negocio", icon: "layout-grid" }, { v: "sucursal", l: "Sucursal", icon: "store" }].map((o) => {
          const on = o.v === scope;
          return (
            <button key={o.v} type="button" onClick={() => onScope(o.v)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 14px", border: "none", cursor: "pointer",
              borderRadius: "var(--radius-xs)", background: on ? "var(--surface-card)" : "transparent",
              boxShadow: on ? "var(--shadow-xs)" : "none", color: on ? "var(--text-primary)" : "var(--text-secondary)",
              fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, transition: "background var(--dur-fast) var(--ease-out)",
            }}>
              <Icon name={o.icon} size={15} color={on ? "var(--brand)" : "var(--text-tertiary)"} />{o.l}
            </button>
          );
        })}
      </div>
      {scope === "sucursal" && (
        <div style={{ width: 250 }}>
          <GSelect value={branchId} onChange={onBranch} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
        </div>
      )}
    </div>
  );
}

// ── Banner contextual (info / warning) ───────────────────────────────
function ConfigBanner({ tone = "info", icon, title, children, action }) {
  const map = {
    info: { c: "var(--info)", bg: "var(--info-tint)", bd: "rgba(59,130,246,0.22)", i: "info" },
    warning: { c: "var(--warning)", bg: "var(--warning-tint)", bd: "rgba(245,158,11,0.28)", i: "alert-triangle" },
    brand: { c: "var(--brand)", bg: "var(--brand-tint)", bd: "rgba(26,115,232,0.22)", i: "info" },
    danger: { c: "var(--error)", bg: "var(--error-tint)", bd: "rgba(239,68,68,0.24)", i: "alert-octagon" },
  };
  const m = map[tone] || map.info;
  return (
    <div style={{ display: "flex", gap: 12, padding: 14, borderRadius: "var(--radius-md)", background: m.bg, border: `1px solid ${m.bd}` }}>
      <Icon name={icon || m.i} size={18} color={m.c} style={{ marginTop: 1, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>{children}</div>
      </div>
      {action && <div style={{ flex: "none", alignSelf: "center" }}>{action}</div>}
    </div>
  );
}

// ── Definición de secciones del centro de configuración ──────────────
const CONFIG_SECTIONS = [
  { group: "Operación", items: [
    { id: "modulos", label: "Módulos", icon: "package", scoped: true },
    { id: "financieros", label: "Parámetros financieros", icon: "percent", scoped: true },
    { id: "agenda", label: "Reglas de agendamiento", icon: "calendar", scoped: true },
    { id: "notif", label: "Notificaciones", icon: "bell", scoped: true },
  ] },
  { group: "Organización", items: [
    { id: "sucursales", label: "Sucursales", icon: "store", scoped: false },
    { id: "usuarios", label: "Usuarios y roles", icon: "users", scoped: false },
  ] },
  { group: "Cuenta", items: [
    { id: "suscripcion", label: "Suscripción", icon: "credit-card", scoped: false },
  ] },
  { group: "Avanzado", items: [
    { id: "developer", label: "Developer", icon: "code", scoped: false, danger: true },
  ] },
];
const SECTION_BY_ID = {};
CONFIG_SECTIONS.forEach((g) => g.items.forEach((it) => { SECTION_BY_ID[it.id] = it; }));

// ── Shell de Configuración (sidebar + scope + cuerpo) ────────────────
function ConfigShell({ active, onSection, scope, onScope, branchId, onBranch, branches, title, desc, children, hideScope }) {
  const sec = SECTION_BY_ID[active] || {};
  const scoped = !!sec.scoped;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", gap: 28, alignItems: "start" }}>
      {/* Rail lateral */}
      <aside style={{ position: "sticky", top: 88, alignSelf: "start" }}>
        <div className="eyebrow" style={{ marginBottom: 12, paddingLeft: 4 }}>Configuración</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CONFIG_SECTIONS.map((g) => (
            <div key={g.group}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase", padding: "0 4px 6px" }}>{g.group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {g.items.map((it) => {
                  const on = it.id === active;
                  const col = on ? (it.danger ? "var(--error)" : "var(--brand)") : "var(--text-secondary)";
                  return (
                    <button key={it.id} type="button" onClick={() => onSection(it.id)} style={{
                      display: "flex", alignItems: "center", gap: 11, height: 40, padding: "0 12px", border: "none", cursor: "pointer", textAlign: "left",
                      borderRadius: "var(--radius-sm)", background: on ? (it.danger ? "var(--error-tint)" : "var(--brand-tint)") : "transparent",
                      color: col, fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
                      transition: "background var(--dur-fast) var(--ease-out)",
                    }}>
                      <Icon name={it.icon} size={17} color={on ? col : "var(--text-tertiary)"} />
                      <span style={{ flex: 1 }}>{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Cuerpo */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: scoped && !hideScope ? 16 : 22 }}>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</h1>
            {desc && <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "6px 0 0", maxWidth: 640 }}>{desc}</p>}
          </div>
        </div>
        {scoped && !hideScope && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 20px", marginBottom: 20, borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>Configurando:</span>
            <ScopeSelector scope={scope} onScope={onScope} branchId={branchId} onBranch={onBranch} branches={branches} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Tarjeta de sección dentro del cuerpo ─────────────────────────────
function ConfigCard({ title, desc, action, children, pad = 22 }) {
  return (
    <Card padding={0} style={{ marginBottom: 18 }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: `18px ${pad}px ${desc ? 14 : 14}px`, borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <h3 style={{ fontSize: "var(--text-md)", letterSpacing: "-0.01em" }}>{title}</h3>
            {desc && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "3px 0 0" }}>{desc}</p>}
          </div>
          {action && <div style={{ flex: "none" }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: `${title ? 8 : pad}px ${pad}px ${pad}px` }}>{children}</div>
    </Card>
  );
}

// ── Skeleton de configuración (estado cargando) ──────────────────────
function ConfigSkeleton({ rows = 5 }) {
  return (
    <Card padding={22}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
          <Skeleton w={38} h={38} r={8} />
          <div style={{ flex: 1 }}>
            <Skeleton w={200} h={15} /><div style={{ height: 8 }} /><Skeleton w={320} h={12} />
          </div>
          <Skeleton w={42} h={24} r={999} />
        </div>
      ))}
    </Card>
  );
}

Object.assign(window, {
  ProvTag, ProvAction, ProvField, SettingRow, ScopeSelector, ConfigBanner,
  CONFIG_SECTIONS, SECTION_BY_ID, ConfigShell, ConfigCard, ConfigSkeleton,
});
