/* Orkalis — páginas de apoyo (Lote 8.8): FAQ, Contacto/ventas, Legales
   (Términos, Privacidad · Habeas Data Ley 1581). Las landings por vertical
   reutilizan 8.1 cambiando el conmutador (manejado en el router). */

// ───────────────────────── FAQ ──────────────────────────────────────
function FAQPage({ go }) {
  const [open, setOpen] = React.useState(0);
  return (
    <Section>
      <SectionHead center eyebrow="Preguntas frecuentes" eyebrowTone="brand" title="Resolvemos tus dudas" sub="Lo que más preguntan los dueños de salones y barberías antes de empezar." />
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {SiteData.FAQ.map((f, i) => {
          const on = open === i;
          return (
            <div key={i} style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", overflow: "hidden" }}>
              <button type="button" onClick={() => setOpen(on ? -1 : i)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "18px 20px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{f.q}</span>
                <Icon name={on ? "minus" : "plus"} size={18} color="var(--text-tertiary)" />
              </button>
              {on && <div style={{ padding: "0 20px 18px", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 620 }}>{f.a}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: 14 }}>¿Tienes otra pregunta?</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="secondary" size="md" iconLeft="mail" onClick={() => go("contacto")}>Hablar con ventas</Button>
          <Button variant="primary" size="md" iconRight="arrow-right" onClick={() => go("registro")}>Empieza gratis</Button>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── Contacto / ventas ────────────────────────
function ContactPage({ go }) {
  const [form, setForm] = React.useState({ nombre: "", empresa: "", sedes: "3", esp: "12", email: "", tel: "", msg: "" });
  const [sent, setSent] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.nombre.trim() && form.empresa.trim() && /.+@.+\..+/.test(form.email);
  const submit = () => { setTouched(true); if (valid) setSent(true); };

  if (sent) return (
    <Section>
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 999, background: "var(--teal-tint)", marginBottom: 18 }}><Icon name="check-circle" size={32} color="var(--success)" /></span>
        <h1 className="mkt-h2" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em", margin: 0, color: "var(--text-primary)" }}>Gracias, te contactaremos pronto</h1>
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", margin: "12px 0 24px", lineHeight: 1.5 }}>Un asesor de Orkalis se comunicará contigo en menos de un día hábil para diseñar un plan a la medida de tu cadena.</p>
        <Button variant="secondary" size="md" onClick={() => go("landing")}>Volver al inicio</Button>
      </div>
    </Section>
  );

  return (
    <Section>
      <div className="mkt-funnel" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 40, maxWidth: 940, margin: "0 auto", alignItems: "start" }}>
        <div>
          <Pill tone="brand" icon="building">Plan Empresarial</Pill>
          <h1 className="mkt-h2" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em", margin: "16px 0 0", color: "var(--text-primary)" }}>Hablemos de tu cadena</h1>
          <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", margin: "14px 0 0", lineHeight: 1.5 }}>Para negocios con varias sedes o necesidades especiales: roles avanzados, acompañamiento de implementación y soporte dedicado.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
            {[["users", "Sucursales ilimitadas y roles a la medida"], ["shield-check", "SLA y soporte dedicado"], ["bar-chart-2", "Reportes consolidados de toda la cadena"]].map(([ic, t]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}><Icon name={ic} size={18} color="var(--brand)" />{t}</div>
            ))}
          </div>
        </div>
        <div style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="mkt-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <SField label="Nombre" error={touched && !form.nombre.trim() ? "Requerido" : null}><SInput value={form.nombre} onChange={set("nombre")} placeholder="Tu nombre" invalid={touched && !form.nombre.trim()} /></SField>
              <SField label="Empresa / cadena" error={touched && !form.empresa.trim() ? "Requerido" : null}><SInput value={form.empresa} onChange={set("empresa")} placeholder="Nombre del negocio" invalid={touched && !form.empresa.trim()} /></SField>
            </div>
            <div className="mkt-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <SField label="N.º de sedes"><SInput value={form.sedes} onChange={set("sedes")} placeholder="3" /></SField>
              <SField label="N.º de especialistas"><SInput value={form.esp} onChange={set("esp")} placeholder="12" /></SField>
            </div>
            <SField label="Correo" error={touched && !/.+@.+\..+/.test(form.email) ? "Correo no válido" : null}><SInput value={form.email} onChange={set("email")} type="email" placeholder="nombre@empresa.co" invalid={touched && !/.+@.+\..+/.test(form.email)} /></SField>
            <SField label="Teléfono" optional><SInput value={form.tel} onChange={set("tel")} placeholder="300 000 0000" /></SField>
            <SField label="Cuéntanos de tu operación" optional>
              <textarea value={form.msg} onChange={(e) => set("msg")(e.target.value)} rows={3} placeholder="N.º de citas al mes, retos actuales, etc." style={{ width: "100%", padding: "11px 13px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", outline: "none", resize: "vertical", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)", background: "var(--surface-card)", lineHeight: 1.5 }} />
            </SField>
            <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={submit}>Enviar y agendar una llamada</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────── Legales ──────────────────────────────────
const LEGAL = {
  terminos: {
    title: "Términos y condiciones",
    updated: "Última actualización · 1 de junio de 2026",
    sections: [
      { h: "1. Objeto", p: "Estos términos regulan el acceso y uso de la plataforma Orkalis, un servicio de software como servicio (SaaS) para la gestión de salones de belleza y barberías. Al crear una cuenta aceptas estos términos en su totalidad." },
      { h: "2. Cuenta y suscripción", p: "La suscripción se cobra por especialista activo, según el plan elegido, en ciclos mensuales o anuales. El cliente es responsable de la veracidad de los datos de su negocio y de mantener la confidencialidad de sus credenciales." },
      { h: "3. Cobro y facturación", p: "Orkalis cobra únicamente la suscripción a la plataforma. El cobro de los servicios a los clientes finales del negocio es presencial y ajeno a Orkalis. Los precios incluyen IVA cuando aplica. La falta de pago puede suspender el acceso a la cuenta sin pérdida de datos." },
      { h: "4. Uso aceptable", p: "El cliente se compromete a no usar la plataforma para fines ilícitos ni a vulnerar derechos de terceros. Orkalis puede suspender cuentas que incumplan estos términos." },
      { h: "5. Disponibilidad y soporte", p: "Orkalis procura la mayor disponibilidad del servicio y ofrece soporte según el plan contratado. Podrán existir mantenimientos programados notificados con antelación." },
      { h: "6. Cancelación", p: "El cliente puede cancelar su suscripción en cualquier momento desde su cuenta. La cancelación surte efecto al final del ciclo facturado. Los datos se conservan según la política de retención configurada." },
      { h: "7. Limitación de responsabilidad", p: "Orkalis no será responsable por pérdidas derivadas del uso indebido de la plataforma o de decisiones operativas del negocio. La responsabilidad se limita al valor de la suscripción del periodo correspondiente." },
    ],
  },
  privacidad: {
    title: "Política de privacidad y tratamiento de datos",
    updated: "Habeas Data · Ley 1581 de 2012 · Decreto 1377 de 2013",
    sections: [
      { h: "1. Responsable del tratamiento", p: "Orkalis Software Solutions, con domicilio en Colombia, es responsable del tratamiento de los datos personales recolectados a través de la plataforma. Contacto: datos@orkalis.co." },
      { h: "2. Datos que recolectamos", p: "Recolectamos datos del negocio y del responsable (nombre, correo, teléfono), datos de los especialistas y datos de contacto de los clientes finales necesarios para agendar y enviar recordatorios. No almacenamos datos sensibles innecesarios." },
      { h: "3. Finalidad", p: "Los datos se usan para prestar el servicio: gestionar reservas, enviar confirmaciones y recordatorios por WhatsApp y SMS, procesar la suscripción y mejorar la plataforma. No vendemos datos a terceros." },
      { h: "4. Autorización", p: "Al usar Orkalis, el negocio declara contar con la autorización de sus clientes para el tratamiento de sus datos con fines de agendamiento y recordatorios, conforme a la Ley 1581 de 2012." },
      { h: "5. Derechos del titular", p: "Como titular de datos puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización otorgada, escribiendo a datos@orkalis.co. Atenderemos tu solicitud en los términos de ley." },
      { h: "6. Seguridad", p: "Aplicamos medidas técnicas y administrativas razonables para proteger los datos contra acceso no autorizado, pérdida o alteración. La información se transmite cifrada." },
      { h: "7. Conservación", p: "Conservamos los datos mientras la cuenta esté activa y según las reglas de retención configuradas por cada negocio, salvo obligación legal de conservarlos por más tiempo." },
    ],
  },
};
function LegalPage({ kind, go }) {
  const doc = LEGAL[kind] || LEGAL.terminos;
  return (
    <Section>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button type="button" onClick={() => go("landing")} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 18, padding: 0 }}><Icon name="arrow-left" size={16} color="var(--text-secondary)" />Volver al inicio</button>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-3xl)", letterSpacing: "-0.025em", color: "var(--text-primary)", margin: 0 }}>{doc.title}</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "8px 0 0" }}>{doc.updated}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 32 }}>
          {doc.sections.map((s) => (
            <div key={s.h}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-md)", letterSpacing: "-0.01em", color: "var(--text-primary)", margin: "0 0 8px" }}>{s.h}</h2>
              <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>{s.p}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 36, padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={() => go("terminos")} style={{ border: "none", background: "transparent", cursor: "pointer", color: kind === "terminos" ? "var(--brand)" : "var(--text-secondary)", fontWeight: 600, fontSize: "var(--text-sm)" }}>Términos y condiciones</button>
          <button type="button" onClick={() => go("privacidad")} style={{ border: "none", background: "transparent", cursor: "pointer", color: kind === "privacidad" ? "var(--brand)" : "var(--text-secondary)", fontWeight: 600, fontSize: "var(--text-sm)" }}>Privacidad · Habeas Data</button>
        </div>
      </div>
    </Section>
  );
}

Object.assign(window, { FAQPage, ContactPage, LegalPage });
