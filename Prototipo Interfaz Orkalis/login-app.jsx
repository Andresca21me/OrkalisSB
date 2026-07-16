/* Orkalis — Login del Panel de Administración (Lote 6 · 6.1).
   Pantalla dividida: panel de marca (navy) + tarjeta de ingreso. Estados:
   normal, error de credenciales, cargando, cuenta suspendida, bloqueo. */

function LoginLogo({ color = "#fff", size = 30 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <span style={{ display: "inline-flex", width: size, height: size, flex: "none" }}
        dangerouslySetInnerHTML={{ __html:
          `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
             <rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="${color}" stroke-width="2.4"/>
             <circle cx="14.5" cy="14.5" r="4.2" fill="${color}"/>
           </svg>` }} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em", color, textTransform: "uppercase" }}>Orkalis</span>
    </span>
  );
}

// Campo con label arriba (patrón de la casa)
function LoginField({ label, type = "text", value, onChange, placeholder, invalid, autoFocus, icon, trailing, disabled }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 9, height: 48, padding: "0 12px",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-card)", borderRadius: "var(--radius-sm)",
        border: `1px solid ${invalid ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)"}`,
        boxShadow: focus ? `0 0 0 3px ${invalid ? "var(--error-tint)" : "var(--brand-tint)"}` : "none",
        transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)" }}>
        {icon && <Icon name={icon} size={18} color="var(--text-tertiary)" />}
        <input type={type} value={value} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
        {trailing}
      </div>
    </label>
  );
}

function Spinner({ size = 18, color = "#fff" }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%",
    border: `2px solid ${color}`, borderTopColor: "transparent", animation: "ork-spin 0.7s linear infinite" }} />;
}

const LOGIN_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "estado": "normal"
}/*EDITMODE-END*/;

function LoginApp() {
  const [t, setTweak] = useTweaks(LOGIN_DEFAULTS);
  const data = OrkData.get(t.vertical);
  const biz = data.business;
  const state = t.estado;

  const [email, setEmail] = React.useState("catalina@" + (t.vertical === "salon" ? "estudioaura" : "lanavaja") + ".co");
  const [pass, setPass] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { setEmail("catalina@" + (t.vertical === "salon" ? "estudioaura" : "lanavaja") + ".co"); }, [t.vertical]);

  const isError = state === "error";
  const loading = state === "cargando" || busy;
  const suspended = state === "suspendida";
  const locked = state === "bloqueo";
  const blocked = suspended || locked;

  const submit = () => {
    if (blocked) return;
    setBusy(true);
    setTimeout(() => setBusy(false), 1800);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>
      {/* ── Panel de marca ── */}
      <aside className="brandpane" style={{
        position: "relative", flex: "0 0 46%", maxWidth: 620, background: "var(--navy)", color: "#fff",
        padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden",
      }}>
        {/* motivo geométrico abstracto */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.5,
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        <div style={{ position: "absolute", right: -120, bottom: -120, width: 380, height: 380, pointerEvents: "none", opacity: 0.16 }}
          dangerouslySetInnerHTML={{ __html: `<svg width="380" height="380" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="#fff" stroke-width="1"/><circle cx="14.5" cy="14.5" r="4.2" stroke="#fff" stroke-width="1"/></svg>` }} />
        <div style={{ position: "relative" }}><LoginLogo /></div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,0.10)", marginBottom: 20 }}>
            <Icon name="store" size={14} color="var(--accent)" />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>Panel de administración</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, letterSpacing: "-0.03em", lineHeight: 1.06, margin: 0 }}>{biz.name}</h1>
          <p style={{ fontSize: "var(--text-md)", color: "rgba(255,255,255,0.72)", margin: "14px 0 0", maxWidth: 380, lineHeight: 1.5 }}>{biz.tagline}. Gestiona tu agenda, tu equipo y tus finanzas desde un solo lugar.</p>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", color: "rgba(255,255,255,0.6)" }}>
          <Icon name="shield-check" size={16} color="rgba(255,255,255,0.6)" />
          Acceso seguro · solo personal autorizado
        </div>
      </aside>

      {/* ── Tarjeta de ingreso ── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div className="mobilelogo" style={{ display: "none", marginBottom: 28 }}>
            <span style={{ display: "inline-flex" }}><LoginLogoDark /></span>
          </div>

          {suspended ? <SuspendedNotice biz={biz} /> : locked ? <LockedNotice /> : (
            <>
              <h2 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", margin: 0 }}>Ingresa a tu panel</h2>
              <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "8px 0 26px" }}>Usa el correo con el que te invitaron al negocio.</p>

              {isError && (
                <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.24)", marginBottom: 18 }}>
                  <Icon name="alert-circle" size={18} color="var(--error)" style={{ flex: "none", marginTop: 1 }} />
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: "20px" }}>
                    <strong>Correo o contraseña incorrectos.</strong> Te quedan 2 intentos antes del bloqueo temporal.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <LoginField label="Correo" type="email" icon="mail" value={email} onChange={setEmail} invalid={isError} disabled={loading} />
                <LoginField label="Contraseña" type={show ? "text" : "password"} icon="lock" value={pass} onChange={setPass}
                  placeholder="Tu contraseña" invalid={isError} disabled={loading}
                  trailing={
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar" : "Mostrar"}
                      style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", padding: 2 }}>
                      <Icon name={show ? "eye-off" : "eye"} size={18} color="var(--text-tertiary)" />
                    </button>
                  } />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0 22px" }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--brand)" }}>¿Olvidaste tu contraseña?</a>
              </div>

              <Button variant="primary" size="lg" fullWidth disabled={loading} onClick={submit}>
                {loading ? <><Spinner /> Entrando…</> : "Entrar"}
              </Button>

              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textAlign: "center", margin: "22px 0 0", lineHeight: "18px" }}>
                No hay registro público. El acceso es solo para el personal del negocio.<br />¿Problemas para entrar? Escribe a <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--text-secondary)", fontWeight: 600 }}>soporte@orkalis.co</a>
              </p>
            </>
          )}
        </div>
      </main>

      <LoginTweaks t={t} setTweak={setTweak} />

      <style>{`
        @media (max-width: 860px) {
          .brandpane { display: none !important; }
          .mobilelogo { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function LoginLogoDark() { return <LoginLogo color="var(--navy)" />; }

// Aviso de cuenta suspendida por pago
function SuspendedNotice({ biz }) {
  return (
    <div>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "var(--radius-lg)", background: "var(--error-tint)", marginBottom: 18 }}>
        <Icon name="alert-octagon" size={26} color="var(--error)" />
      </span>
      <h2 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", margin: 0 }}>Cuenta suspendida</h2>
      <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "10px 0 0", lineHeight: 1.5 }}>
        El acceso al panel de <strong>{biz.name}</strong> está suspendido por un pago pendiente de la suscripción. Mientras tanto, el equipo no puede agendar ni cobrar.
      </p>
      <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", margin: "22px 0" }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>¿Cómo reactivarla?</div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, lineHeight: "20px" }}>
          El administrador de la cuenta puede regularizar el pago desde Suscripción. Si crees que es un error, contáctanos.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="primary" size="lg" fullWidth iconLeft="mail">Contactar a soporte</Button>
        <Button variant="ghost" size="lg" fullWidth>Volver al ingreso</Button>
      </div>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textAlign: "center", margin: "18px 0 0" }}>soporte@orkalis.co · +57 601 432 0099</p>
    </div>
  );
}

// Bloqueo por intentos
function LockedNotice() {
  const [secs, setSecs] = React.useState(294);
  React.useEffect(() => { const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <div>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "var(--radius-lg)", background: "var(--warning-tint)", marginBottom: 18 }}>
        <Icon name="lock" size={24} color="#B45309" />
      </span>
      <h2 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", margin: 0 }}>Acceso bloqueado temporalmente</h2>
      <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "10px 0 22px", lineHeight: 1.5 }}>
        Detectamos demasiados intentos fallidos. Por seguridad, espera antes de volver a intentar.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
        <Icon name="clock" size={20} color="var(--text-tertiary)" />
        <div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Podrás intentar de nuevo en</div>
          <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{mm}:{ss}</div>
        </div>
      </div>
      <div style={{ marginTop: 22 }}>
        <Button variant="secondary" size="lg" fullWidth iconLeft="mail">¿Olvidaste tu contraseña?</Button>
      </div>
    </div>
  );
}

function LoginTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Negocio" />
      <TweakRadio label="Vertical" value={t.vertical} options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]} onChange={(v) => setTweak("vertical", v)} />
      <TweakSection label="Estado de la pantalla" />
      <TweakSelect label="Estado" value={t.estado} options={[
        { value: "normal", label: "Normal" },
        { value: "error", label: "Error de credenciales" },
        { value: "cargando", label: "Cargando (entrando…)" },
        { value: "suspendida", label: "Cuenta suspendida" },
        { value: "bloqueo", label: "Bloqueo por intentos" },
      ]} onChange={(v) => setTweak("estado", v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LoginApp />);
