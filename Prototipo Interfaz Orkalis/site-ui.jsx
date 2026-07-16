/* Orkalis — primitivas del sitio de marketing (Lote 8).
   Nav translúcida con toggle de vertical + menú móvil, footer, secciones,
   mockups de producto (navegador + teléfono), tarjeta de plan, toggles y
   tarjetas de función/paso/testimonio. Reutiliza Icon/Button/Badge de ork-ui. */

// ── Logo ──────────────────────────────────────────────────────────
function SiteLogo({ color = "var(--navy)", onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 9, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
      <span style={{ display: "inline-flex", width: 28, height: 28 }}
        dangerouslySetInnerHTML={{ __html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="${color}" stroke-width="2.4"/><circle cx="14.5" cy="14.5" r="4.2" fill="${color}"/></svg>` }} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, letterSpacing: "-0.04em", color, textTransform: "uppercase" }}>Orkalis</span>
    </button>
  );
}

// ── Pill (eyebrow) ────────────────────────────────────────────────
function Pill({ children, tone = "teal", icon }) {
  const map = { teal: { c: "#0A8F76", bg: "var(--teal-tint)", dot: "var(--accent)" }, brand: { c: "var(--brand)", bg: "var(--brand-tint)", dot: "var(--brand)" } };
  const m = map[tone] || map.teal;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: "var(--radius-pill)", background: m.bg, color: m.c, fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
      {icon ? <Icon name={icon} size={13} color={m.c} /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot }} />}
      {children}
    </span>
  );
}

// ── Conmutador Salón / Barbería ───────────────────────────────────
function VerticalToggle({ vertical, onChange, light }) {
  const opts = [{ v: "salon", l: "Salón" }, { v: "barberia", l: "Barbería" }];
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--radius-pill)", background: light ? "rgba(255,255,255,0.12)" : "var(--surface-sunken)", border: `1px solid ${light ? "rgba(255,255,255,0.18)" : "var(--border-subtle)"}` }}>
      {opts.map((o) => {
        const on = o.v === vertical;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{
            height: 32, padding: "0 14px", border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)",
            background: on ? (light ? "#fff" : "var(--surface-card)") : "transparent",
            color: on ? (light ? "var(--navy)" : "var(--text-primary)") : (light ? "rgba(255,255,255,0.8)" : "var(--text-secondary)"),
            boxShadow: on ? "var(--shadow-xs)" : "none", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
            transition: "background var(--dur-fast) var(--ease-out)",
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

// ── Barra superior ────────────────────────────────────────────────
function MktNav({ vertical, onVertical, go, onLogin }) {
  const [open, setOpen] = React.useState(false);
  const links = [
    { id: "landing", label: "Funciones", hash: "funciones" },
    { id: "precios", label: "Precios" },
    { id: vertical === "salon" ? "para-salones" : "para-barberias", label: vertical === "salon" ? "Para salones" : "Para barberías" },
    { id: "faq", label: "FAQ" },
  ];
  return (
    <header className="mkt-nav" style={{
      position: "sticky", top: 0, zIndex: 40, height: 64, display: "flex", alignItems: "center", gap: 28, padding: "0 24px",
      background: "color-mix(in srgb, var(--surface-page) 82%, transparent)", backdropFilter: "saturate(180%) blur(12px)",
      WebkitBackdropFilter: "saturate(180%) blur(12px)", borderBottom: "1px solid var(--border-subtle)",
    }}>
      <SiteLogo onClick={() => go("landing")} />
      <nav className="mkt-desktop" style={{ display: "flex", gap: 2 }}>
        {links.map((l) => (
          <button key={l.label} type="button" onClick={() => go(l.id)} style={{ padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)", borderRadius: "var(--radius-xs)" }}>{l.label}</button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div className="mkt-desktop" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <VerticalToggle vertical={vertical} onChange={onVertical} />
        <button type="button" onClick={onLogin} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Iniciar sesión</button>
        <Button variant="primary" size="sm" iconRight="arrow-right" onClick={() => go("registro")}>Empieza gratis</Button>
      </div>
      <button type="button" className="mkt-mobile" aria-label="Menú" onClick={() => setOpen((o) => !o)} style={{ display: "none", border: "none", background: "transparent", cursor: "pointer", padding: 6 }}>
        <Icon name={open ? "x" : "list"} size={24} color="var(--text-primary)" />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 64, left: 0, right: 0, display: "block", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-lg)", padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
            {links.map((l) => (
              <button key={l.label} type="button" onClick={() => { go(l.id); setOpen(false); }} style={{ textAlign: "left", padding: "12px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", borderRadius: "var(--radius-sm)" }}>{l.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Tipo de negocio</span>
            <VerticalToggle vertical={vertical} onChange={onVertical} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="secondary" size="md" fullWidth onClick={() => { onLogin(); setOpen(false); }}>Iniciar sesión</Button>
            <Button variant="primary" size="md" fullWidth iconRight="arrow-right" onClick={() => { go("registro"); setOpen(false); }}>Empieza gratis</Button>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Sección + cabecera de sección ─────────────────────────────────
function Section({ children, tone, id, style = {} }) {
  const bg = tone === "navy" ? "var(--navy)" : tone === "sunken" ? "var(--surface-sunken)" : "transparent";
  return <section id={id} className="mkt-section" style={{ background: bg, ...style }}><div className="mkt-wrap">{children}</div></section>;
}
function SectionHead({ eyebrow, title, sub, center, light, eyebrowTone }) {
  return (
    <div style={{ maxWidth: 680, margin: center ? "0 auto" : 0, textAlign: center ? "center" : "left", marginBottom: 44 }}>
      {eyebrow && <div style={{ marginBottom: 16 }}><Pill tone={eyebrowTone}>{eyebrow}</Pill></div>}
      <h2 className="mkt-h2" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em", color: light ? "#fff" : "var(--text-primary)", margin: 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: "var(--text-md)", lineHeight: 1.5, color: light ? "rgba(255,255,255,0.72)" : "var(--text-secondary)", margin: "16px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ── Decoración geométrica ─────────────────────────────────────────
function Deco({ style = {} }) {
  return (
    <svg style={{ position: "absolute", pointerEvents: "none", ...style }} width="520" height="520" viewBox="0 0 520 520" fill="none" aria-hidden="true">
      <rect x="60" y="60" width="400" height="400" rx="120" stroke="var(--border-subtle)" strokeWidth="1.5" />
      <rect x="140" y="140" width="240" height="240" rx="72" stroke="var(--border-subtle)" strokeWidth="1.5" />
      <circle cx="360" cy="360" r="60" fill="var(--brand-tint)" />
    </svg>
  );
}

// ── Mockup: navegador (enlace público de reservas) ────────────────
function BrowserMock({ vertical }) {
  const data = OrkData.get(vertical);
  const vv = SiteData.v(vertical);
  const services = data.services.slice(0, 3);
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-sunken)" }}>
        {["var(--gray-300)", "var(--gray-300)", "var(--gray-300)"].map((c, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 99, background: c }} />)}
        <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}><Icon name="lock" size={11} color="var(--text-tertiary)" />{vv.bookingHost}</span>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--navy)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="scissors" size={19} color="#fff" /></span>
          <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{vv.sample}</div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Reserva en línea</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {services.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: `1px solid ${i === 0 ? "var(--brand)" : "var(--border-subtle)"}`, background: i === 0 ? "var(--brand-tint)" : "var(--surface-card)" }}>
              <div><div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.min} min</div></div>
              <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{SiteData.COP(s.price)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, height: 44, borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
          <Icon name="calendar" size={16} color="#fff" />Elegir horario
        </div>
      </div>
    </div>
  );
}

// ── Mockup: teléfono (app del especialista) ───────────────────────
function PhoneMock({ vertical }) {
  const data = OrkData.get(vertical);
  const sp = data.specialists[0];
  const turns = [
    { t: "9:00", c: "Mateo H.", s: "Completada", tone: "neutral" },
    { t: "11:30", c: "Daniel R.", s: "En progreso", tone: "info" },
    { t: "13:30", c: "Camilo R.", s: "Confirmada", tone: "success" },
  ];
  return (
    <div style={{ width: 210, borderRadius: 30, background: "var(--navy)", padding: 8, boxShadow: "var(--shadow-xl)" }}>
      <div style={{ borderRadius: 23, background: "var(--surface-page)", overflow: "hidden" }}>
        <div style={{ background: "var(--navy)", color: "#fff", padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hoy · mar 9 jun</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{sp.name.split(" ")[0]}</div>
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {turns.map((tr, i) => (
            <div key={i} style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "9px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="data" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{tr.t}</span>
                <Badge tone={tr.tone} size="md" dot>{tr.s}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{tr.c}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de función ────────────────────────────────────────────
function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{ padding: 22, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-xs)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--brand-tint)", marginBottom: 14 }}><Icon name={icon} size={22} color="var(--brand)" /></span>
      <h3 style={{ fontSize: "var(--text-md)", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{title}</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "6px 0 0", lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

// ── Conmutador de facturación ─────────────────────────────────────
function BillingToggle({ cycle, onChange }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
        {[{ v: "mensual", l: "Mensual" }, { v: "anual", l: "Anual" }].map((o) => {
          const on = o.v === cycle;
          return (
            <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{ height: 36, padding: "0 18px", border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", background: on ? "var(--surface-card)" : "transparent", boxShadow: on ? "var(--shadow-xs)" : "none", color: on ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{o.l}</button>
          );
        })}
      </div>
      <Badge tone="accent" size="lg" dot>2 meses gratis</Badge>
    </div>
  );
}

// ── Tarjeta de plan ───────────────────────────────────────────────
function PlanCard({ plan, cycle, specialists, onChoose, compact }) {
  const price = SiteData.displayMonthly(plan, specialists || plan.included, cycle);
  const hi = plan.highlight;
  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column", padding: 24, borderRadius: "var(--radius-lg)",
      background: hi ? "var(--navy)" : "var(--surface-card)", color: hi ? "#fff" : "var(--text-primary)",
      border: `1px solid ${hi ? "var(--navy)" : "var(--border-subtle)"}`, boxShadow: hi ? "var(--shadow-lg)" : "var(--shadow-xs)",
    }}>
      {hi && <span style={{ position: "absolute", top: 16, right: 16 }}><Badge tone="accent" solid size="md">Recomendado</Badge></span>}
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", letterSpacing: "-0.01em" }}>{plan.name}</div>
      <p style={{ fontSize: "var(--text-sm)", color: hi ? "rgba(255,255,255,0.7)" : "var(--text-secondary)", margin: "6px 0 16px", minHeight: 40 }}>{plan.blurb}</p>
      {plan.contact ? (
        <div style={{ marginBottom: 18 }}>
          <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>Desde {SiteData.COP(plan.base)}</div>
          <div style={{ fontSize: "var(--text-xs)", color: hi ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)", marginTop: 4 }}>/mes · hablemos de tu cadena</div>
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: "var(--text-sm)", color: hi ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)" }}>desde</span>
            <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em" }}>{SiteData.COP(price)}</span>
            <span style={{ fontSize: "var(--text-sm)", color: hi ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)" }}>/mes</span>
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: hi ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)", marginTop: 4 }}>
            {cycle === "anual"
              ? `Facturado anual · ${SiteData.COP(SiteData.annualTotal(plan, specialists || plan.included))}/año`
              : `Incluye ${plan.included} especialistas · +${SiteData.COP(plan.perExtra)} por especialista`}
          </div>
        </div>
      )}
      <Button variant={hi ? "primary" : "secondary"} size="md" fullWidth iconRight={plan.contact ? "mail" : "arrow-right"} onClick={() => onChoose(plan)}
        style={hi ? { background: "var(--brand)", color: "#fff", border: "none" } : {}}>{plan.cta}</Button>
      <div style={{ height: 1, background: hi ? "rgba(255,255,255,0.12)" : "var(--border-subtle)", margin: "20px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plan.perks.map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "var(--text-sm)", color: hi ? "rgba(255,255,255,0.86)" : "var(--text-secondary)" }}>
            <Icon name="check" size={16} color={hi ? "var(--accent)" : "var(--success)"} style={{ flex: "none", marginTop: 1 }} />{p}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────
function SiteFooter({ go }) {
  const cols = [
    { h: "Producto", items: [["Funciones", "landing"], ["Precios", "precios"], ["Comparar planes", "comparar"], ["Calculadora", "calculadora"]] },
    { h: "Soluciones", items: [["Para barberías", "para-barberias"], ["Para salones", "para-salones"], ["Preguntas frecuentes", "faq"]] },
    { h: "Empresa", items: [["Contacto / ventas", "contacto"], ["Iniciar sesión", "login"]] },
    { h: "Legal", items: [["Términos", "terminos"], ["Privacidad · Habeas Data", "privacidad"]] },
  ];
  return (
    <footer style={{ background: "var(--navy)", color: "#fff", padding: "56px 24px 32px" }}>
      <div className="mkt-wrap">
        <div className="mkt-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 32, marginBottom: 40 }}>
          <div>
            <SiteLogo color="#fff" onClick={() => go("landing")} />
            <p style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.6)", margin: "14px 0 0", maxWidth: 260, lineHeight: 1.5 }}>La plataforma de operaciones para salones y barberías en Colombia.</p>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>{c.h}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {c.items.map(([l, id]) => (
                  <button key={l} type="button" onClick={() => go(id)} style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: 0, fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.78)" }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.5)" }}>© 2026 Orkalis · Hecho en Colombia · contacto@orkalis.co</span>
          <span style={{ display: "flex", gap: 14 }}>
            {["smartphone", "mail", "external-link"].map((ic) => <Icon key={ic} name={ic} size={17} color="rgba(255,255,255,0.6)" />)}
          </span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { SiteLogo, Pill, VerticalToggle, MktNav, Section, SectionHead, Deco, BrowserMock, PhoneMock, FeatureCard, BillingToggle, PlanCard, SiteFooter });
