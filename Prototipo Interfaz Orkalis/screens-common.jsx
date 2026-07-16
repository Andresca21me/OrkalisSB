/* Orkalis — chrome compartido de las pantallas del flujo de reserva */

const STATUS_TOP = 54; // despeja la isla dinámica / barra de estado
const HOME_BOTTOM = 24;

// Cabecera de la app (no la nav de iOS): marca + atrás + paso
function AppHeader({ title, onBack, right, sub }) {
  return (
    <header style={{
      flex: "none", paddingTop: STATUS_TOP, background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-subtle)", position: "relative", zIndex: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 12px", minHeight: 44 }}>
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Volver" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40,
            border: "none", background: "transparent", color: "var(--text-primary)", cursor: "pointer",
            borderRadius: "var(--radius-sm)", flex: "none", marginLeft: -6,
          }}><Icon name="chevron-left" size={24} /></button>
        ) : <div style={{ width: 34, flex: "none" }} />}
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-md)", letterSpacing: "-0.02em", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {sub && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 1 }}>{sub}</div>}
        </div>
        <div style={{ width: 40, flex: "none", display: "flex", justifyContent: "flex-end" }}>{right}</div>
      </div>
    </header>
  );
}

// Barra de progreso por pasos
const FLOW_STEPS = ["servicios", "especialista", "horario", "identificacion"];
function ProgressBar({ step }) {
  const idx = FLOW_STEPS.indexOf(step);
  if (idx < 0) return null;
  return (
    <div style={{ flex: "none", display: "flex", gap: 5, padding: "12px 16px 4px", background: "var(--surface-card)" }}>
      {FLOW_STEPS.map((s, i) => (
        <div key={s} style={{
          flex: 1, height: 4, borderRadius: 99,
          background: i <= idx ? "var(--brand)" : "var(--surface-sunken)",
          transition: "background var(--dur-base) var(--ease-out)",
        }} />
      ))}
    </div>
  );
}

// Zona scrollable del contenido
function ScrollArea({ children, style = {} }) {
  return (
    <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", background: "var(--surface-page)", ...style }}>
      {children}
    </main>
  );
}

// Barra inferior de acción (CTA + resumen)
function FooterBar({ children }) {
  return (
    <footer style={{
      flex: "none", background: "var(--surface-card)", borderTop: "1px solid var(--border-subtle)",
      padding: `12px 16px ${HOME_BOTTOM + 8}px`, boxShadow: "0 -4px 16px rgba(15,25,35,0.05)", position: "relative", zIndex: 5,
    }}>{children}</footer>
  );
}

// Resumen de precio + CTA
function PriceCta({ label, sublabel, ctaLabel, onCta, disabled, ctaIcon = "arrow-right" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {label && (
        <div style={{ flex: "none" }}>
          <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{label}</div>
          {sublabel && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: -2 }}>{sublabel}</div>}
        </div>
      )}
      <Button fullWidth disabled={disabled} onClick={onCta} iconRight={ctaIcon} style={{ flex: 1 }}>{ctaLabel}</Button>
    </div>
  );
}

// Estado vacío con acción
function EmptyState({ icon = "inbox", title, body, action }) {
  return (
    <div style={{ padding: "56px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Icon name={icon} size={30} color="var(--text-tertiary)" />
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 260, lineHeight: "20px", marginBottom: action ? 22 : 0 }}>{body}</div>
      {action}
    </div>
  );
}

// Estado de error con reintento
function ErrorState({ title = "No pudimos cargar la información", body = "Revisa tu conexión e inténtalo de nuevo.", onRetry, icon = "wifi-off" }) {
  return (
    <div style={{ padding: "56px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", background: "var(--error-tint)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Icon name={icon} size={30} color="var(--error)" />
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 260, lineHeight: "20px", marginBottom: 22 }}>{body}</div>
      {onRetry && <Button variant="secondary" size="md" iconLeft="refresh-cw" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

// Skeleton de lista (estado cargando)
function LoadingList({ rows = 4, avatar = false }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
          {avatar && <Skeleton w={44} h={44} r={99} />}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
            <Skeleton w="60%" h={14} />
            <Skeleton w="85%" h={11} />
            <Skeleton w="35%" h={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  STATUS_TOP, HOME_BOTTOM, AppHeader, ProgressBar, ScrollArea, FooterBar, PriceCta,
  EmptyState, ErrorState, LoadingList, FLOW_STEPS,
});
