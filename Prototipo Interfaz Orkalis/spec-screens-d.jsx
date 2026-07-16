/* Orkalis — app del especialista (parte D): 2.6 Registrar walk-in */

function ScreenWalkin({ data, saving, onCreate, onToast }) {
  const [mode, setMode] = React.useState("vivo"); // vivo | retro
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [picked, setPicked] = React.useState([]); // service ids
  const [cat, setCat] = React.useState(data.categories[0]);
  const [date, setDate] = React.useState("9 jun 2026");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [payment, setPayment] = React.useState(null);
  const [tried, setTried] = React.useState(false);

  React.useEffect(() => { setCat(data.categories[0]); setPicked([]); }, [data.vertical]);

  // cliente existente (demo): coincide con clientes frecuentes
  const KNOWN = ["Mateo Herrera", "Felipe Cano", "Carolina Mesa", "Camila Soto", "Lucía Naranjo"];
  const existing = name.trim().length >= 3 && KNOWN.some((k) => k.toLowerCase().includes(name.trim().toLowerCase()));

  const list = data.services.filter((s) => s.cat === cat);
  const chosen = data.services.filter((s) => picked.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price, 0);
  const toggle = (id) => setPicked((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  const minOf = (t) => { const m = String(t).match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
  const sMin = minOf(start), eMin = minOf(end);
  const timeInvalid = mode === "retro" && start && end && sMin != null && eMin != null && eMin < sMin;

  const canSubmit = picked.length > 0 && (mode === "vivo" || (start && end && payment && !timeInvalid));

  const submit = () => {
    setTried(true);
    if (!picked.length) { onToast({ tone: "warning", msg: "Elige al menos un servicio" }); return; }
    if (mode === "retro") {
      if (!start || !end) { onToast({ tone: "warning", msg: "Indica hora de inicio y fin" }); return; }
      if (timeInvalid) { onToast({ tone: "error", msg: "La hora de fin no puede ser antes del inicio" }); return; }
      if (!payment) { onToast({ tone: "warning", msg: "Elige un método de pago" }); return; }
    }
    onCreate({ mode, name: name.trim() || "Cliente walk-in", phone, serviceIds: picked, start, end, payment, total });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SpecHeader title="Walk-in" />
      <div style={{ flex: "none", padding: "14px 20px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        <Segmented options={[{ value: "vivo", label: "Atender ahora" }, { value: "retro", label: "Atención pasada" }]} value={mode} onChange={setMode} size="lg" />
      </div>

      <ScrollArea>
        <div style={{ padding: 16 }}>
          <Alert tone="info" style={{ marginBottom: 18 }} icon={mode === "vivo" ? "zap" : "rotate-ccw"}>
            {mode === "vivo"
              ? "Crea el turno y empiézalo de inmediato (queda En progreso). No necesitas fijar una hora."
              : "Registra una atención ya realizada. Se crea como Completada; solo validamos que las horas tengan sentido."}
          </Alert>

          {/* Cliente */}
          <SectionLabel>Cliente</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <Field label="Nombre (opcional, recomendado para historial)" hint={existing ? null : "Captúralo para guardar su historial"} >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Gómez" style={inputStyle(false)} />
            </Field>
            {existing && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -6 }}><Badge tone="success" dot>Cliente existente</Badge><span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Se vinculará a su historial</span></div>}
            <Field label="Teléfono (opcional)">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...inputStyle(false), width: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontWeight: 600, flex: "none" }}>+57</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))} inputMode="numeric" placeholder="3xx xxx xxxx" className="data" style={{ ...inputStyle(false), flex: 1 }} />
              </div>
            </Field>
          </div>

          {/* Servicios */}
          <SectionLabel>Servicios</SectionLabel>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 2, scrollbarWidth: "none" }}>
            {data.categories.map((c) => {
              const on = c === cat;
              return <button key={c} type="button" onClick={() => setCat(c)} style={{ flex: "none", height: 34, padding: "0 13px", borderRadius: 99, border: `1px solid ${on ? "var(--brand)" : "var(--border-subtle)"}`, background: on ? "var(--brand)" : "var(--surface-card)", color: on ? "#fff" : "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>;
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {list.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer", textAlign: "left", border: `1px solid ${on ? "var(--brand)" : "var(--border-subtle)"}`, background: on ? "var(--brand-tint)" : "var(--surface-card)", fontFamily: "var(--font-body)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div><div className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{OrkData.COP(s.price)} · {s.min} min</div></div>
                  <span style={{ width: 24, height: 24, borderRadius: 7, flex: "none", border: `2px solid ${on ? "var(--brand)" : "var(--border-default)"}`, background: on ? "var(--brand)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Icon name="check" size={15} color="#fff" strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>

          {/* Campos retroactivos */}
          {mode === "retro" && (
            <>
              <SectionLabel>Cuándo se atendió</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
                <Field label="Fecha"><input value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(false)} /></Field>
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Inicio" style={{ flex: 1 }} error={timeInvalid ? " " : null}><input value={start} onChange={(e) => setStart(e.target.value)} placeholder="14:00" inputMode="numeric" className="data" style={inputStyle(timeInvalid)} /></Field>
                  <Field label="Fin" style={{ flex: 1 }} error={timeInvalid ? "Fin antes del inicio" : null}><input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="14:40" inputMode="numeric" className="data" style={inputStyle(timeInvalid)} /></Field>
                </div>
              </div>
              <SectionLabel>Método de pago</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {SpecData.PAYMENTS.map((p) => <Chip key={p.id} active={payment === p.id} icon={p.icon} onClick={() => setPayment(p.id)}>{p.label}</Chip>)}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <FooterBar>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {picked.length > 0 && (
            <div style={{ flex: "none" }}>
              <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>{OrkData.COP(total)}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: -2 }}>{picked.length} serv.</div>
            </div>
          )}
          <Button size="lg" style={{ flex: 1 }} disabled={saving} iconLeft={mode === "vivo" ? "play" : "check"} onClick={submit}>
            {saving ? "Guardando…" : mode === "vivo" ? "Iniciar atención" : "Registrar atención"}
          </Button>
        </div>
      </FooterBar>
    </div>
  );
}

Object.assign(window, { ScreenWalkin });
