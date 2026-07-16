/* Orkalis — pantallas del flujo (parte B):
   1.4 Horario · 1.5 Identificación+OTP · 1.6 Confirmación · 1.7 Gestión */

// ════════════════════════ 1.4 HORARIO ════════════════════════
function ScreenHorario({ data, estado, specialistId, date, time, onPickDate, onPickTime, onBack, onContinue }) {
  const [eff, reset] = useScreenState(estado);
  const days = React.useMemo(() => OrkData.buildDays(data), [data.vertical]);
  const openDays = days.filter((d) => !d.closed);
  const activeKey = date || (openDays[0] && openDays[0].key);
  // asegura que el día visible por defecto quede registrado en el estado
  React.useEffect(() => { if (!date && activeKey) onPickDate(activeKey); }, [date, activeKey]);
  const slots = React.useMemo(
    () => (activeKey ? OrkData.slotsFor(activeKey, specialistId) : []),
    [activeKey, specialistId]
  );
  // estado "vacio": simula día totalmente reservado
  const allTaken = eff === "vacio";
  const freeSlots = allTaken ? [] : slots;
  const am = freeSlots.filter((s) => parseInt(s.time) < 13);
  const pm = freeSlots.filter((s) => parseInt(s.time) >= 13);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Elige fecha y hora" sub={data.business.name} onBack={onBack} />
      <ProgressBar step="horario" />

      {/* Tira de días */}
      <div style={{ flex: "none", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", padding: "14px 0 16px" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
          {days.map((d) => {
            const on = d.key === activeKey;
            return (
              <button key={d.key} type="button" disabled={d.closed} onClick={() => onPickDate(d.key)} style={{
                flex: "none", width: 54, height: 68, borderRadius: "var(--radius-md)", cursor: d.closed ? "not-allowed" : "pointer",
                border: `1px solid ${on ? "var(--brand)" : "var(--border-subtle)"}`,
                background: on ? "var(--brand)" : "var(--surface-card)", opacity: d.closed ? 0.4 : 1,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                transition: "all var(--dur-fast) var(--ease-out)",
              }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: on ? "rgba(255,255,255,0.8)" : "var(--text-tertiary)", textTransform: "uppercase" }}>{d.isToday ? "Hoy" : d.dow}</span>
                <span className="data" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: on ? "#fff" : "var(--text-primary)", lineHeight: 1 }}>{d.day}</span>
                <span style={{ fontSize: 10, color: on ? "rgba(255,255,255,0.7)" : "var(--text-tertiary)" }}>{d.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea>
        {eff === "cargando" ? (
          <div style={{ padding: 16 }}>
            <Skeleton w={90} h={12} style={{ marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} h={48} r={8} />)}
            </div>
          </div>
        ) : eff === "error" ? <ErrorState onRetry={reset} title="No pudimos cargar la agenda" />
          : freeSlots.length === 0 ? (
            <EmptyState icon="calendar-x" title="No quedan horas libres este día"
              body="Esta fecha está completa. Elige otro día en la tira de arriba para ver disponibilidad."
              action={<Button variant="secondary" size="md" onClick={() => { const nxt = openDays.find((d) => d.key !== activeKey); if (nxt) onPickDate(nxt.key); }}>Ver otro día</Button>} />
          ) : (
            <div style={{ padding: 16 }}>
              <SlotGroup label="Mañana" slots={am} time={time} onPickTime={onPickTime} />
              <SlotGroup label="Tarde" slots={pm} time={time} onPickTime={onPickTime} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                <Icon name="info" size={14} color="var(--text-tertiary)" />
                Las horas en gris ya están reservadas.
              </div>
            </div>
          )}
      </ScrollArea>

      <FooterBar>
        <Button fullWidth iconRight="arrow-right" disabled={!time || eff !== "datos"} onClick={onContinue}>
          {time ? `Continuar · ${time}` : "Elige una hora"}
        </Button>
      </FooterBar>
    </div>
  );
}

function SlotGroup({ label, slots, time, onPickTime }) {
  if (!slots.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {slots.map((s) => {
          const on = time === s.time;
          return (
            <button key={s.time} type="button" disabled={s.taken} onClick={() => onPickTime(s.time)} className="data" style={{
              height: 48, borderRadius: "var(--radius-sm)", cursor: s.taken ? "not-allowed" : "pointer",
              border: `1px solid ${on ? "var(--brand)" : "var(--border-subtle)"}`,
              background: on ? "var(--brand)" : s.taken ? "var(--surface-sunken)" : "var(--surface-card)",
              color: on ? "#fff" : s.taken ? "var(--text-disabled)" : "var(--text-primary)",
              textDecoration: s.taken ? "line-through" : "none",
              fontSize: "var(--text-base)", fontWeight: 600, fontFamily: "var(--font-mono)",
              transition: "all var(--dur-fast) var(--ease-out)",
            }}>{s.time}</button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════ 1.5 IDENTIFICACIÓN + OTP ════════════════════════
function ScreenIdentificacion({ data, estado, contact, onChangeContact, onBack, onVerified }) {
  const [phase, setPhase] = React.useState("datos"); // datos | otp
  const [name, setName] = React.useState(contact.name || "");
  const [phone, setPhone] = React.useState(contact.phone || "");
  const [touched, setTouched] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [code, setCode] = React.useState(["", "", "", ""]);
  const [codeErr, setCodeErr] = React.useState(false);
  const [secs, setSecs] = React.useState(0);
  const refs = [React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length === 10;
  const nameOk = name.trim().length >= 3;

  React.useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const send = () => {
    setTouched(true);
    if (!nameOk || !phoneOk) return;
    setSending(true);
    onChangeContact({ name: name.trim(), phone });
    setTimeout(() => { setSending(false); setPhase("otp"); setSecs(30); setTimeout(() => refs[0].current && refs[0].current.focus(), 60); }, 700);
  };

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...code]; next[i] = d; setCode(next); setCodeErr(false);
    if (d && i < 3) refs[i + 1].current && refs[i + 1].current.focus();
    const full = next.join("");
    if (full.length === 4) verify(full);
  };
  const onKey = (i, e) => { if (e.key === "Backspace" && !code[i] && i > 0) refs[i - 1].current && refs[i - 1].current.focus(); };

  const verify = (full) => {
    if (full === "1234") { onVerified(); }
    else { setCodeErr(true); setCode(["", "", "", ""]); setTimeout(() => refs[0].current && refs[0].current.focus(), 40); }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title={phase === "datos" ? "Tus datos" : "Verifica tu número"} sub={data.business.name}
        onBack={phase === "otp" ? () => setPhase("datos") : onBack} />
      <ProgressBar step="identificacion" />

      <ScrollArea>
        {phase === "datos" ? (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 0, marginBottom: 22, lineHeight: "20px" }}>
              Necesitamos tu nombre y celular para confirmar la cita y avisarte de cualquier cambio.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Nombre completo" error={touched && !nameOk ? "Escribe tu nombre (mín. 3 letras)" : null}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Daniel Ríos"
                  style={inputStyle(touched && !nameOk)} />
              </Field>
              <Field label="Celular" hint="Te enviaremos un código por WhatsApp o SMS." error={touched && !phoneOk ? "Debe tener 10 dígitos" : null}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ ...inputStyle(false), width: 64, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--text-secondary)", fontWeight: 600, flex: "none" }}>
                    🇨🇴 +57
                  </div>
                  <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
                    inputMode="numeric" placeholder="311 845 2210" style={{ ...inputStyle(touched && !phoneOk), flex: 1 }} className="data" />
                </div>
              </Field>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 22, padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }}>
              <Icon name="shield" size={16} color="var(--text-tertiary)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: "17px" }}>
                Usamos tu número solo para esta reserva. Al continuar aceptas la política de tratamiento de datos.
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 0, marginBottom: 24, lineHeight: "20px" }}>
              Escribe el código de 4 dígitos que enviamos al <strong className="data" style={{ color: "var(--text-primary)" }}>+57 {phone}</strong>.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
              {code.map((d, i) => (
                <input key={i} ref={refs[i]} value={d} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
                  inputMode="numeric" maxLength={1} className="data" style={{
                    width: 56, height: 64, textAlign: "center", fontSize: "var(--text-2xl)", fontWeight: 700,
                    fontFamily: "var(--font-mono)", color: "var(--text-primary)",
                    border: `1.5px solid ${codeErr ? "var(--error)" : d ? "var(--brand)" : "var(--border-default)"}`,
                    borderRadius: "var(--radius-md)", outline: "none", background: "var(--surface-card)",
                    boxShadow: "var(--shadow-xs)", transition: "border-color var(--dur-fast) var(--ease-out)",
                  }} />
              ))}
            </div>
            {codeErr && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--error)", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 12 }}>
                <Icon name="alert-circle" size={15} color="var(--error)" /> Código incorrecto. Inténtalo de nuevo.
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              {secs > 0 ? (
                <span className="data" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Reenviar código en {secs}s</span>
              ) : (
                <button type="button" onClick={() => { setSecs(30); setCode(["", "", "", ""]); setCodeErr(false); }} style={{ border: "none", background: "transparent", color: "var(--text-link)", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", fontFamily: "var(--font-body)" }}>Reenviar código</button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 28, color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
              <Icon name="info" size={13} color="var(--text-tertiary)" /> Demo: el código es 1234
            </div>
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        {phase === "datos" ? (
          <Button fullWidth iconRight="arrow-right" disabled={sending} onClick={send}>
            {sending ? "Enviando código…" : "Enviar código"}
          </Button>
        ) : (
          <Button fullWidth disabled={code.join("").length !== 4} onClick={() => verify(code.join(""))}>Verificar y continuar</Button>
        )}
      </FooterBar>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {(error || hint) && <span style={{ fontSize: "var(--text-xs)", color: error ? "var(--error)" : "var(--text-tertiary)" }}>{error || hint}</span>}
    </div>
  );
}
function inputStyle(err) {
  return {
    height: 48, padding: "0 14px", width: "100%", boxSizing: "border-box",
    border: `1px solid ${err ? "var(--error)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)",
    background: "var(--surface-card)", fontFamily: "var(--font-body)", fontSize: "var(--text-md)",
    color: "var(--text-primary)", outline: "none", boxShadow: "var(--shadow-xs)",
  };
}

Object.assign(window, { ScreenHorario, SlotGroup, ScreenIdentificacion, Field, inputStyle });
