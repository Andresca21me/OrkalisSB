/* Orkalis — router del sitio de marketing y suscripción (Lote 8).
   Mantiene el estado de vertical, el funnel (plan/especialistas/sucursales/ciclo)
   y el escenario de pago. Persiste en localStorage para iterar sin perder lugar. */

const SITE_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "pago": "exitoso"
}/*EDITMODE-END*/;

const SITE_KEY = "orkalis_site_state";
function loadState() {
  try { const r = localStorage.getItem(SITE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}

function SiteApp() {
  const [t, setTweak] = useTweaks(SITE_DEFAULTS);
  const saved = React.useRef(loadState());
  const [page, setPage] = React.useState(() => (saved.current && saved.current.page) || "landing");
  const [vertical, setVertical] = React.useState(() => (saved.current && saved.current.vertical) || t.vertical);
  const [funnel, setFunnel] = React.useState(() => (saved.current && saved.current.funnel) || {
    planId: "pro", specialists: 4, sucursales: 1, cycle: "mensual", vertical: t.vertical, negocio: "",
  });

  // el tweak de vertical manda sobre el estado del sitio
  React.useEffect(() => { setVertical(t.vertical); setFunnel((f) => ({ ...f, vertical: t.vertical })); }, [t.vertical]);

  // persistir
  React.useEffect(() => {
    try { localStorage.setItem(SITE_KEY, JSON.stringify({ page, vertical, funnel })); } catch (e) {}
  }, [page, vertical, funnel]);

  // scroll arriba al cambiar de página
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [page]);

  const go = (target, opts) => {
    if (opts && typeof opts === "object") setFunnel((f) => ({ ...f, ...opts }));
    if (target === "login") { window.location.href = "Login Admin.html"; return; }
    if (target === "para-barberias") { setVertical("barberia"); setTweak("vertical", "barberia"); setPage("landing"); return; }
    if (target === "para-salones") { setVertical("salon"); setTweak("vertical", "salon"); setPage("landing"); return; }
    setPage(target);
  };
  const onVertical = (v) => { setVertical(v); setTweak("vertical", v); setFunnel((f) => ({ ...f, vertical: v })); };

  const shared = { vertical, go, funnel, setFunnel };
  let body;
  switch (page) {
    case "precios": body = <PricingPage {...shared} />; break;
    case "comparar": body = <ComparePage {...shared} />; break;
    case "calculadora": body = <CalculatorPage {...shared} />; break;
    case "registro": body = <SignupPage {...shared} />; break;
    case "pago": body = <CheckoutPage {...shared} payState={t.pago} />; break;
    case "bienvenida": body = <WelcomePage {...shared} payState={t.pago} />; break;
    case "faq": body = <FAQPage go={go} />; break;
    case "contacto": body = <ContactPage go={go} />; break;
    case "terminos": body = <LegalPage kind="terminos" go={go} />; break;
    case "privacidad": body = <LegalPage kind="privacidad" go={go} />; break;
    default: body = <LandingPage {...shared} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-page)" }}>
      <MktNav vertical={vertical} onVertical={onVertical} go={go} onLogin={() => go("login")} />
      <main style={{ flex: 1 }}>{body}</main>
      <SiteFooter go={go} />

      <TweaksPanel>
        <TweakSection label="Negocio" />
        <TweakRadio label="Vertical" value={t.vertical} options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]} onChange={(v) => setTweak("vertical", v)} />
        <TweakSection label="Ir a la página" />
        <TweakSelect label="Página" value={page} options={[
          { value: "landing", label: "8.1 · Landing" },
          { value: "precios", label: "8.2 · Planes y precios" },
          { value: "comparar", label: "8.3 · Comparación" },
          { value: "calculadora", label: "8.4 · Calculadora" },
          { value: "registro", label: "8.5 · Registro" },
          { value: "pago", label: "8.6 · Pago / checkout" },
          { value: "bienvenida", label: "8.7 · Bienvenida" },
          { value: "faq", label: "8.8 · FAQ" },
          { value: "contacto", label: "8.8 · Contacto / ventas" },
          { value: "terminos", label: "8.8 · Términos" },
          { value: "privacidad", label: "8.8 · Privacidad" },
        ]} onChange={(v) => setPage(v)} />
        <TweakSection label="Escenario de pago" />
        <TweakSelect label="Estado del pago" value={t.pago} options={[
          { value: "exitoso", label: "Exitoso → bienvenida" },
          { value: "rechazado", label: "Rechazado (reintentar)" },
          { value: "procesando", label: "PSE procesando" },
        ]} onChange={(v) => setTweak("pago", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SiteApp />);
