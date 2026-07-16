/* Orkalis — páginas del sitio (Lote 8): 8.1 Landing, 8.2 Precios,
   8.3 Comparación de funciones, 8.4 Calculadora. */

// ───────────────────────── 8.1 · Landing ────────────────────────────
function LandingPage({ vertical, go, funnel, setFunnel }) {
  const vv = SiteData.v(vertical);
  const tst = SiteData.TESTIMONIALS[vertical] || SiteData.TESTIMONIALS.barberia;
  return (
    <div>
      {/* Hero */}
      <section className="mkt-section" style={{ position: "relative", overflow: "hidden", paddingBottom: 48 }}>
        <Deco style={{ top: -120, right: -80, opacity: 0.6 }} />
        <div className="mkt-wrap mkt-hero" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center", position: "relative" }}>
          <div>
            <Pill icon="zap">Para {vv.label.toLowerCase()}s</Pill>
            <h1 className="mkt-h1" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "20px 0 0" }}>{vv.heroTitle}</h1>
            <p style={{ fontSize: "var(--text-lg)", lineHeight: 1.5, color: "var(--text-secondary)", margin: "20px 0 0", maxWidth: 520 }}>{vv.heroSub}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go("registro")}>Empieza gratis</Button>
              <Button variant="secondary" size="lg" onClick={() => go("precios")}>Ver planes</Button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 26, flexWrap: "wrap" }}>
              {["Sin tarjeta para empezar", "Implementación en 1 día", "Soporte en español"].map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}><Icon name="check" size={15} color="var(--success)" />{t}</span>
              ))}
            </div>
          </div>
          <div className="mkt-hero-art" style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}><BrowserMock vertical={vertical} /></div>
            <div className="mkt-phone" style={{ marginLeft: -56, marginBottom: -16, position: "relative", zIndex: 2 }}><PhoneMock vertical={vertical} /></div>
          </div>
        </div>
      </section>

      {/* Problema → solución */}
      <Section tone="sunken">
        <SectionHead center eyebrow="El problema" title="Dejas de operar en el caos" sub="Tres dolores que viven todos los días los salones y barberías — y cómo Orkalis los resuelve." />
        <div className="mkt-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {SiteData.PAINS.map((p) => (
            <div key={p.pain} style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--error-tint)", marginBottom: 14 }}><Icon name={p.icon} size={22} color="var(--error)" /></span>
              <h3 style={{ fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{p.pain}</h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>{p.sol}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Funciones clave */}
      <Section id="funciones">
        <SectionHead eyebrow="Funciones" title="Todo lo que tu negocio necesita, en un lugar" sub="Desde la reserva del cliente hasta la liquidación de tu equipo." eyebrowTone="brand" />
        <div className="mkt-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {SiteData.FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
        </div>
      </Section>

      {/* Cómo funciona */}
      <Section tone="navy">
        <SectionHead center light eyebrow="Cómo funciona" title="Listo para operar en tres pasos" />
        <div className="mkt-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {SiteData.STEPS.map((s) => (
            <div key={s.n} style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--brand)", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800 }}>{s.n}</span>
                <Icon name={s.icon} size={20} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: "var(--text-md)", color: "#fff" }}>{s.title}</h3>
              <p style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.72)", margin: "8px 0 0", lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Prueba social */}
      <Section>
        <div style={{ display: "flex", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
          {SiteData.METRICS.map((m) => (
            <div key={m.label} style={{ flex: "1 1 160px", padding: 20, borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)", textAlign: "center" }}>
              <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em", color: "var(--brand)" }}>{m.value}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <SectionHead eyebrow="Confían en Orkalis" title={`Negocios como el tuyo, ya organizados`} />
        <div className="mkt-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {tst.map((t) => (
            <div key={t.name} style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-xs)", display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1.55, margin: 0, flex: 1 }}>“{t.quote}”</p>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 18 }}>
                <Avatar name={t.name} size={40} />
                <div><div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{t.role} · {t.city}</div></div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Franja de precios */}
      <Section tone="sunken">
        <SectionHead center eyebrow="Precios" title="Paga por lo que usas: por especialista" sub="Planes desde $80.000/mes con 2 especialistas incluidos. Mensajería por WhatsApp + SMS." eyebrowTone="brand" />
        <div className="mkt-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "stretch" }}>
          {SiteData.PLANS.map((p) => (
            <div key={p.id} style={{ padding: 18, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: `1px solid ${p.highlight ? "var(--brand)" : "var(--border-subtle)"}`, boxShadow: p.highlight ? "0 0 0 1px var(--brand)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{p.name}</span>
                {p.highlight && <Badge tone="brand" size="md">Popular</Badge>}
              </div>
              <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", color: "var(--text-primary)", marginTop: 10 }}>{p.contact ? "A medida" : SiteData.COP(p.base)}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{p.contact ? "cadenas y franquicias" : "/mes · 2 especialistas"}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 28 }}><Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go("precios")}>Ver planes y precios</Button></div>
      </Section>

      {/* CTA final */}
      <Section>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-xl, 16px)", background: "var(--navy)", color: "#fff", padding: "56px 40px", textAlign: "center" }}>
          <Deco style={{ bottom: -200, left: -120, opacity: 0.18 }} />
          <h2 className="mkt-h2" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em", margin: 0, position: "relative" }}>Empieza hoy. Tu agenda se llena sola.</h2>
          <p style={{ fontSize: "var(--text-md)", color: "rgba(255,255,255,0.72)", margin: "14px auto 0", maxWidth: 520, position: "relative" }}>Crea tu negocio, comparte tu enlace y deja que tus clientes reserven. Sin tarjeta para empezar.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, position: "relative", flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go("registro")} style={{ background: "var(--brand)", border: "none" }}>Empieza gratis</Button>
            <Button variant="secondary" size="lg" onClick={() => go("precios")} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>Ver planes</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── 8.2 · Precios ────────────────────────────
function PricingPage({ vertical, go, funnel, setFunnel }) {
  const cycle = funnel.cycle;
  const choose = (plan) => { if (plan.contact) { go("contacto"); return; } setFunnel((f) => ({ ...f, planId: plan.id })); go("registro"); };
  return (
    <div>
      <Section>
        <SectionHead center eyebrow="Precios" eyebrowTone="brand" title="Paga por lo que usas: por especialista, sin sorpresas"
          sub="Cada plan incluye 2 especialistas y suma una tarifa por cada uno adicional. Mensajería por WhatsApp + SMS de respaldo." />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}><BillingToggle cycle={cycle} onChange={(c) => setFunnel((f) => ({ ...f, cycle: c }))} /></div>
        <div className="mkt-plans" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "stretch" }}>
          {SiteData.PLANS.map((p) => <PlanCard key={p.id} plan={p} cycle={cycle} specialists={p.included} onChoose={choose} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24, padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
          <Icon name="info" size={18} color="var(--text-tertiary)" style={{ flex: "none" }} />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>El cobro escala por especialista activo. Mensajería incluida por WhatsApp (recordatorios/confirmaciones) y SMS de respaldo. El cobro a tus clientes es presencial.</span>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          <Button variant="secondary" size="md" iconLeft="list" onClick={() => go("comparar")}>Comparar todas las funciones</Button>
          <Button variant="secondary" size="md" iconLeft="percent" onClick={() => go("calculadora")}>Calcular mi precio</Button>
        </div>
      </Section>
    </div>
  );
}

// ───────────────────────── 8.3 · Comparación ────────────────────────
function ComparePage({ vertical, go, funnel, setFunnel }) {
  const plans = SiteData.PLANS;
  const [openGroups, setOpenGroups] = React.useState(() => SiteData.FEATURE_GROUPS.map(() => true));
  const cell = (val) => {
    if (val === true) return <Icon name="check" size={18} color="var(--success)" />;
    if (val === "—" || val == null) return <span style={{ color: "var(--text-disabled)" }}>—</span>;
    return <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{val}</span>;
  };
  return (
    <Section>
      <SectionHead center eyebrow="Comparar" eyebrowTone="brand" title="Todas las funciones, plan por plan" sub="Mira las diferencias finas y elige con seguridad." />
      <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" }}>
        <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ position: "sticky", top: 64, zIndex: 5 }}>
              <th style={{ textAlign: "left", padding: "18px 20px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", minWidth: 240 }}>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Funciones</span>
              </th>
              {plans.map((p) => (
                <th key={p.id} style={{ padding: "16px 16px", background: p.highlight ? "var(--brand-tint)" : "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", textAlign: "center", minWidth: 150 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-base)", color: p.highlight ? "var(--brand)" : "var(--text-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "2px 0 10px" }}>{p.contact ? "A medida" : `${SiteData.COP(p.base)}/mes`}</div>
                  <Button variant={p.highlight ? "primary" : "secondary"} size="sm" onClick={() => p.contact ? go("contacto") : (setFunnel((f) => ({ ...f, planId: p.id })), go("registro"))}>{p.contact ? "Ventas" : "Empezar"}</Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SiteData.FEATURE_GROUPS.map((g, gi) => (
              <React.Fragment key={g.group}>
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <button type="button" onClick={() => setOpenGroups((o) => o.map((x, i) => i === gi ? !x : x))} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "12px 20px", border: "none", background: "var(--surface-sunken)", cursor: "pointer", textAlign: "left", borderTop: "1px solid var(--border-subtle)" }}>
                      <Icon name={openGroups[gi] ? "chevron-down" : "chevron-right"} size={16} color="var(--text-tertiary)" />
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{g.group}</span>
                    </button>
                  </td>
                </tr>
                {openGroups[gi] && g.rows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ padding: "13px 20px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{r.label}</td>
                    {r.vals.map((val, i) => (
                      <td key={i} style={{ padding: "13px 16px", borderTop: "1px solid var(--border-subtle)", textAlign: "center", background: plans[i].highlight ? "color-mix(in srgb, var(--brand-tint) 50%, transparent)" : "transparent" }}>{cell(val)}</td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: "center", marginTop: 28 }}><Button variant="secondary" size="md" iconLeft="percent" onClick={() => go("calculadora")}>Calcular mi precio exacto</Button></div>
    </Section>
  );
}

// ───────────────────────── 8.4 · Calculadora ────────────────────────
function CalculatorPage({ vertical, go, funnel, setFunnel }) {
  const [planId, setPlanId] = React.useState(funnel.planId || "pro");
  const [specialists, setSpecialists] = React.useState(funnel.specialists || 4);
  const [sucursales, setSucursales] = React.useState(funnel.sucursales || 1);
  const [cycle, setCycle] = React.useState(funnel.cycle || "mensual");
  const plan = SiteData.planById(planId);

  const base = plan.base;
  const extraCount = Math.max(0, specialists - plan.included);
  const extraCost = extraCount * plan.perExtra;
  const monthlyTotal = base + extraCost;
  const shown = cycle === "anual" ? Math.round(monthlyTotal * 10 / 12) : monthlyTotal;
  const annual = monthlyTotal * 10;
  const exceeds = sucursales > plan.sucursales;
  const suggested = SiteData.PLANS.find((p) => p.sucursales >= sucursales);

  const Stepper = ({ value, onChange, min, max, suffix }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 0, border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 42, height: 44, border: "none", background: "var(--surface-card)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="minus" size={16} color="var(--text-secondary)" /></button>
      <span className="data" style={{ minWidth: 64, textAlign: "center", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>{value}{value >= max ? "+" : ""}{suffix || ""}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 42, height: 44, border: "none", background: "var(--surface-card)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid var(--border-subtle)" }}><Icon name="plus" size={16} color="var(--text-secondary)" /></button>
    </div>
  );

  return (
    <Section>
      <SectionHead center eyebrow="Calculadora" eyebrowTone="brand" title="¿Cuánto pagarías?" sub="Ajusta tu tamaño y mira tu precio exacto en vivo." />
      <div className="mkt-calc" style={{ display: "grid", gridTemplateColumns: "1fr 0.9fr", gap: 24, maxWidth: 920, margin: "0 auto", alignItems: "start" }}>
        {/* Controles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: 24, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Plan</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SiteData.PLANS.filter((p) => !p.contact).map((p) => {
                const on = p.id === planId;
                return (
                  <button key={p.id} type="button" onClick={() => setPlanId(p.id)} style={{ padding: "12px 14px", textAlign: "left", cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)", background: on ? "var(--brand-tint)" : "var(--surface-card)" }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: on ? "var(--brand)" : "var(--text-primary)" }}>{p.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{SiteData.sucursalLabel(p)}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Especialistas</span>
              <Stepper value={specialists} onChange={setSpecialists} min={1} max={16} />
            </div>
            <input type="range" min="1" max="16" value={specialists} onChange={(e) => setSpecialists(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>{plan.included} incluidos · {extraCount} adicionales × {SiteData.COP(plan.perExtra)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Sucursales</span>
            <Stepper value={sucursales} onChange={setSucursales} min={1} max={9} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Facturación</span>
            <BillingToggle cycle={cycle} onChange={setCycle} />
          </div>
        </div>

        {/* Resultado */}
        <div style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "var(--navy)", color: "#fff", position: "sticky", top: 84 }}>
          <div style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.6)" }}>Plan {plan.name} · {cycle === "anual" ? "anual" : "mensual"}</div>
          <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 6 }}>{SiteData.COP(shown)}<span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>/mes</span></div>
          {cycle === "anual" && <div style={{ fontSize: "var(--text-sm)", color: "var(--accent)", marginTop: 4 }}>{SiteData.COP(annual)}/año · 2 meses gratis</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "20px 0", padding: "4px 0", borderTop: "1px solid rgba(255,255,255,0.12)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            {[["Base del plan", SiteData.COP(base)], [`${extraCount} especialistas adicionales`, extraCount ? `+ ${SiteData.COP(extraCost)}` : SiteData.COP(0)], ["Total mensual", SiteData.COP(monthlyTotal)]].map(([k, val], i, arr) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <span style={{ fontSize: "var(--text-sm)", color: i === arr.length - 1 ? "#fff" : "rgba(255,255,255,0.72)", fontWeight: i === arr.length - 1 ? 700 : 400 }}>{k}</span>
                <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{val}</span>
              </div>
            ))}
          </div>
          {exceeds ? (
            <div style={{ display: "flex", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: 14 }}>
              <Icon name="alert-triangle" size={17} color="var(--warning)" style={{ flex: "none", marginTop: 1 }} />
              <span style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.86)", lineHeight: 1.45 }}>{plan.name} admite {SiteData.sucursalLabel(plan).toLowerCase()}. Para {sucursales} sedes te recomendamos <strong style={{ color: "#fff" }}>{suggested ? suggested.name : "Empresarial"}</strong>.</span>
            </div>
          ) : (
            <div style={{ fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.72)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="check-circle" size={16} color="var(--accent)" />Incluye mensajería WhatsApp + SMS para tu tamaño.
            </div>
          )}
          <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={() => { setFunnel((f) => ({ ...f, planId: exceeds && suggested ? suggested.id : planId, specialists, sucursales, cycle })); go("registro"); }} style={{ background: "var(--brand)", border: "none" }}>Empezar con este plan</Button>
        </div>
      </div>
    </Section>
  );
}

Object.assign(window, { LandingPage, PricingPage, ComparePage, CalculatorPage });
