/* Orkalis — funnel de suscripción (Lote 8): 8.5 Registro, 8.6 Checkout,
   8.7 Bienvenida. Primitivas de formulario locales para mantener el sitio
   ligero. El estado del plan fluye desde precios/calculadora. */

// ── Primitivas de formulario ─────────────────────────────────────────
function SField({ label, hint, error, optional, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{label}{optional && <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}> · opcional</span>}</span>
      {children}
      {error ? <span style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="alert-circle" size={13} color="var(--error)" />{error}</span>
        : hint ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{hint}</span> : null}
    </label>
  );
}
function SInput({ value, onChange, type = "text", placeholder, invalid, trailing }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 13px", background: "var(--surface-card)", borderRadius: "var(--radius-sm)",
      border: `1px solid ${invalid ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)"}`, boxShadow: focus ? `0 0 0 3px ${invalid ? "var(--error-tint)" : "var(--brand-tint)"}` : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)" }}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
      {trailing}
    </div>
  );
}
function SSeg({ value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{ height: 38, padding: "0 16px", border: "none", cursor: "pointer", borderRadius: "var(--radius-xs)", background: on ? "var(--surface-card)" : "transparent", boxShadow: on ? "var(--shadow-xs)" : "none", color: on ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{o.label}</button>;
      })}
    </div>
  );
}

// ── Resumen del plan (lateral, editable) ─────────────────────────────
function PlanSummary({ funnel, setFunnel, editable }) {
  const plan = SiteData.planById(funnel.planId);
  const monthly = SiteData.monthly(plan, funnel.specialists);
  const shown = funnel.cycle === "anual" ? Math.round(monthly * 10 / 12) : monthly;
  const extra = Math.max(0, funnel.specialists - plan.included);
  const Step = ({ value, set, min, max }) => (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xs)", overflow: "hidden" }}>
      <button type="button" onClick={() => set(Math.max(min, value - 1))} style={{ width: 34, height: 36, border: "none", background: "var(--surface-card)", cursor: "pointer" }}><Icon name="minus" size={14} color="var(--text-secondary)" /></button>
      <span className="data" style={{ minWidth: 40, textAlign: "center", fontSize: "var(--text-sm)", fontWeight: 700 }}>{value}{value >= max ? "+" : ""}</span>
      <button type="button" onClick={() => set(Math.min(max, value + 1))} style={{ width: 34, height: 36, border: "none", background: "var(--surface-card)", cursor: "pointer", borderLeft: "1px solid var(--border-subtle)" }}><Icon name="plus" size={14} color="var(--text-secondary)" /></button>
    </div>
  );
  return (
    <div style={{ padding: 22, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="eyebrow">Tu plan</span>
        <Badge tone="brand" size="md">{plan.name}</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{SiteData.COP(shown)}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>/mes</span>
      </div>
      {funnel.cycle === "anual" && <div style={{ fontSize: "var(--text-xs)", color: "#0A8F76", marginTop: 2 }}>Facturado anual · 2 meses gratis</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "18px 0", padding: "16px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        {editable && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Plan</span>
            <SSeg value={funnel.planId} onChange={(v) => setFunnel((f) => ({ ...f, planId: v }))} options={SiteData.PLANS.filter((p) => !p.contact).map((p) => ({ value: p.id, label: p.name }))} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Especialistas</span>
          {editable ? <Step value={funnel.specialists} set={(v) => setFunnel((f) => ({ ...f, specialists: v }))} min={1} max={16} /> : <span className="data" style={{ fontWeight: 600 }}>{funnel.specialists}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Sucursales</span>
          {editable ? <Step value={funnel.sucursales} set={(v) => setFunnel((f) => ({ ...f, sucursales: v }))} min={1} max={9} /> : <span className="data" style={{ fontWeight: 600 }}>{funnel.sucursales}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Facturación</span>
          {editable ? <SSeg value={funnel.cycle} onChange={(v) => setFunnel((f) => ({ ...f, cycle: v }))} options={[{ value: "mensual", label: "Mensual" }, { value: "anual", label: "Anual" }]} /> : <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{funnel.cycle === "anual" ? "Anual" : "Mensual"}</span>}
        </div>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
        Base {SiteData.COP(plan.base)} + {extra} adicionales × {SiteData.COP(plan.perExtra)}. Mensajería WhatsApp + SMS incluida.
      </div>
    </div>
  );
}

// ───────────────────────── 8.5 · Registro ───────────────────────────
function SignupPage({ vertical, go, funnel, setFunnel }) {
  const [form, setForm] = React.useState({ negocio: "", tipo: vertical, responsable: "", email: "", tel: "", pass: "" });
  const [touched, setTouched] = React.useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const emailTaken = form.email.trim().toLowerCase() === "hola@orkalis.co";
  const emailValid = /.+@.+\..+/.test(form.email);
  const errs = {
    negocio: touched && !form.negocio.trim() ? "Escribe el nombre de tu negocio" : null,
    responsable: touched && !form.responsable.trim() ? "Escribe tu nombre" : null,
    email: touched && !emailValid ? "Correo no válido" : emailTaken ? "Este correo ya tiene una cuenta. Inicia sesión." : null,
    pass: touched && form.pass.length < 6 ? "Mínimo 6 caracteres" : null,
  };
  const valid = form.negocio.trim() && form.responsable.trim() && emailValid && !emailTaken && form.pass.length >= 6;
  const submit = () => { setTouched(true); if (valid) { setFunnel((f) => ({ ...f, vertical: form.tipo, negocio: form.negocio })); go("pago"); } };

  return (
    <Section>
      <div className="mkt-funnel" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, maxWidth: 940, margin: "0 auto", alignItems: "start" }}>
        <div>
          <SectionHead eyebrow="Crear cuenta" eyebrowTone="brand" title="Crea tu cuenta de Orkalis" sub="Solo lo mínimo para empezar. Configuras el resto después." />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <SField label="Nombre del negocio" error={errs.negocio}><SInput value={form.negocio} onChange={set("negocio")} placeholder={SiteData.v(vertical).sample} invalid={!!errs.negocio} /></SField>
            <SField label="Tipo de negocio">
              <SSeg value={form.tipo} onChange={set("tipo")} options={[{ value: "salon", label: "Salón de belleza" }, { value: "barberia", label: "Barbería" }]} />
            </SField>
            <div className="mkt-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <SField label="Nombre del responsable" error={errs.responsable}><SInput value={form.responsable} onChange={set("responsable")} placeholder="Ej.: Catalina Mejía" invalid={!!errs.responsable} /></SField>
              <SField label="Teléfono" optional><SInput value={form.tel} onChange={set("tel")} placeholder="300 000 0000" /></SField>
            </div>
            <SField label="Correo" error={errs.email}><SInput value={form.email} onChange={set("email")} type="email" placeholder="nombre@negocio.co" invalid={!!errs.email} /></SField>
            <SField label="Contraseña" hint="Mínimo 6 caracteres." error={errs.pass}><SInput value={form.pass} onChange={set("pass")} type="password" placeholder="Crea una contraseña" invalid={!!errs.pass} /></SField>
            <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={submit}>Crear cuenta y continuar al pago</Button>
            <p style={{ textAlign: "center", fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>¿Ya tienes cuenta? <button type="button" onClick={() => go("login")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", fontWeight: 600, fontSize: "var(--text-sm)" }}>Inicia sesión</button></p>
          </div>
        </div>
        <PlanSummary funnel={funnel} setFunnel={setFunnel} editable />
      </div>
    </Section>
  );
}

// ───────────────────────── 8.6 · Checkout ───────────────────────────
const PAY_METHODS = [
  { id: "tarjeta", label: "Tarjeta de crédito/débito", icon: "credit-card" },
  { id: "pse", label: "PSE · débito bancario", icon: "building" },
  { id: "nequi", label: "Nequi", icon: "smartphone" },
];
function CheckoutPage({ vertical, go, funnel, setFunnel, payState }) {
  const plan = SiteData.planById(funnel.planId);
  const monthly = SiteData.monthly(plan, funnel.specialists);
  const subtotal = funnel.cycle === "anual" ? monthly * 10 : monthly;
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const [method, setMethod] = React.useState("tarjeta");
  const [terms, setTerms] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const rejected = payState === "rechazado";
  const pay = () => {
    setTouched(true); if (!terms) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); if (!rejected) go("bienvenida"); }, 1600);
  };

  return (
    <Section>
      <div className="mkt-funnel" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, maxWidth: 940, margin: "0 auto", alignItems: "start" }}>
        <div>
          <SectionHead eyebrow="Pago" eyebrowTone="brand" title="Activa tu suscripción" sub="Pago seguro vía pasarela. El cobro a tus clientes sigue siendo presencial." />

          {/* Trial */}
          <div style={{ display: "flex", gap: 11, padding: 14, borderRadius: "var(--radius-md)", background: "var(--teal-tint)", border: "1px solid rgba(0,212,170,0.28)", marginBottom: 20 }}>
            <Icon name="sparkles" size={18} color="#0A8F76" style={{ flex: "none", marginTop: 1 }} />
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}><strong style={{ color: "var(--text-primary)" }}>Empieza tu prueba, sin cobro hoy.</strong> Tienes 14 días gratis. Te avisamos antes del primer cobro.</div>
          </div>

          {rejected && (
            <div style={{ display: "flex", gap: 11, padding: 14, borderRadius: "var(--radius-md)", background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.24)", marginBottom: 20 }}>
              <Icon name="alert-circle" size={18} color="var(--error)" style={{ flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}><strong style={{ color: "var(--text-primary)" }}>El pago fue rechazado.</strong> Revisa los datos de tu medio de pago o intenta con otro método.</div>
            </div>
          )}

          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Método de pago</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {PAY_METHODS.map((m) => {
              const on = m.id === method;
              return (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", textAlign: "left", cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)", background: on ? "var(--brand-tint)" : "var(--surface-card)" }}>
                  <Icon name={m.icon} size={20} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
                  <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{m.label}</span>
                  <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? "var(--brand)" : "var(--border-strong)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand)" }} />}</span>
                </button>
              );
            })}
          </div>

          {method === "tarjeta" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <SField label="Número de tarjeta"><SInput value="" onChange={() => {}} placeholder="1234 5678 9012 3456" trailing={<Icon name="credit-card" size={18} color="var(--text-tertiary)" />} /></SField>
              <div className="mkt-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SField label="Vencimiento"><SInput value="" onChange={() => {}} placeholder="MM/AA" /></SField>
                <SField label="CVV"><SInput value="" onChange={() => {}} placeholder="123" /></SField>
              </div>
            </div>
          )}
          {method === "pse" && <div style={{ marginBottom: 20 }}><SField label="Banco"><SInput value="" onChange={() => {}} placeholder="Selecciona tu banco" trailing={<Icon name="chevron-down" size={16} color="var(--text-tertiary)" />} /></SField></div>}
          {method === "nequi" && <div style={{ marginBottom: 20 }}><SField label="Celular Nequi"><SInput value="" onChange={() => {}} placeholder="300 000 0000" /></SField></div>}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 18 }}>
            <span onClick={() => setTerms((t) => !t)} style={{ width: 20, height: 20, borderRadius: "var(--radius-xs)", border: `2px solid ${terms ? "var(--brand)" : touched && !terms ? "var(--error)" : "var(--border-strong)"}`, background: terms ? "var(--brand)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>{terms && <Icon name="check" size={13} color="#fff" />}</span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.45 }}>Acepto los <button type="button" onClick={() => go("terminos")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", fontWeight: 600, padding: 0 }}>Términos</button> y el <button type="button" onClick={() => go("privacidad")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", fontWeight: 600, padding: 0 }}>tratamiento de datos</button> (Habeas Data).</span>
          </label>

          <Button variant="primary" size="lg" fullWidth iconLeft={loading ? null : "lock"} disabled={loading} onClick={pay}>
            {loading ? "Procesando…" : `Pagar y activar · ${SiteData.COP(total)}`}
          </Button>
          <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "12px 0 0" }}>Pago protegido. Puedes cancelar tu suscripción cuando quieras.</p>
        </div>

        {/* Resumen del pedido */}
        <div>
          <PlanSummary funnel={funnel} setFunnel={setFunnel} />
          <div style={{ marginTop: 16, padding: 20, borderRadius: "var(--radius-lg)", background: "var(--surface-sunken)" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Resumen del pedido</div>
            {[["Subtotal", SiteData.COP(subtotal)], ["IVA (19%)", SiteData.COP(iva)]].map(([k, val]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}><span>{k}</span><span className="data" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{val}</span></div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 2px", marginTop: 4, borderTop: "1.5px solid var(--border-default)" }}>
              <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>Total {funnel.cycle === "anual" ? "anual" : "hoy"}</span>
              <span className="data" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>{SiteData.COP(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── 8.7 · Bienvenida ─────────────────────────
function WelcomePage({ vertical, go, funnel, payState }) {
  const plan = SiteData.planById(funnel.planId);
  const monthly = SiteData.monthly(plan, funnel.specialists);
  const processing = payState === "procesando";
  const vv = SiteData.v(vertical);
  return (
    <Section>
      <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 999, background: processing ? "var(--warning-tint)" : "var(--teal-tint)", marginBottom: 20 }}>
          <Icon name={processing ? "clock" : "check-circle"} size={36} color={processing ? "#B45309" : "var(--success)"} />
        </span>
        <h1 className="mkt-h2" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em", margin: 0, color: "var(--text-primary)" }}>{processing ? "Estamos verificando tu pago" : "¡Bienvenido a Orkalis!"}</h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", margin: "12px 0 0", lineHeight: 1.5 }}>
          {processing ? "Tu pago por PSE puede tardar unos minutos. Te avisamos por correo apenas se confirme y tu cuenta quede activa." : `Tu suscripción está activa. Configura tu negocio y comparte tu enlace de reservas.`}
        </p>

        <div style={{ margin: "28px 0", padding: 22, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="eyebrow">Tu suscripción</span>
            <Badge tone={processing ? "warning" : "success"} size="lg" dot>{processing ? "Procesando" : "Activa"}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            {[["Plan", plan.name], ["Especialistas", funnel.specialists], ["Facturación", funnel.cycle === "anual" ? "Anual" : "Mensual"], ["Próximo cobro", processing ? "Al confirmar" : "En 14 días"]].map(([k, val]) => (
              <div key={k}><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{k}</div><div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{val}</div></div>
            ))}
          </div>
        </div>

        <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={() => { window.location.href = "Onboarding del negocio.html"; }}>Configurar mi negocio</Button>

        <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {[["file-text", "Guía rápida"], ["mail", "Contactar soporte"]].map(([ic, l]) => (
            <button key={l} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 14px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}><Icon name={ic} size={16} color="var(--text-tertiary)" />{l}</button>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 14, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Icon name="link" size={16} color="var(--brand)" />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Tu enlace de reservas: <span className="data" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{vv.bookingHost}</span></span>
        </div>
      </div>
    </Section>
  );
}

Object.assign(window, { SignupPage, CheckoutPage, WelcomePage, SField, SInput, SSeg, PlanSummary });
