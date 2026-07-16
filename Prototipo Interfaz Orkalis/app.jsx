/* Orkalis — orquestador del enlace público de reservas (Lote 1) */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "estado": "datos",
  "confirmacion": "automatica"
}/*EDITMODE-END*/;

const DOW_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function dateLabelFromKey(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date(2026, 5, 9);
  const isToday = key === `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const prefix = isToday ? "Hoy · " : "";
  return `${prefix}${DOW_LONG[dt.getDay()]} ${d} de ${MONTH_LONG[m - 1]}`;
}
function genCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const n = "0123456789";
  const p = Array.from({ length: 3 }, () => a[Math.floor(Math.random() * a.length)]).join("");
  const s = Array.from({ length: 4 }, () => n[Math.floor(Math.random() * n.length)]).join("");
  return `${p}-${s}`;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const data = OrkData.get(t.vertical);

  const [step, setStep] = React.useState("inicio"); // inicio servicios especialista horario identificacion confirmacion gestion
  const [services, setServices] = React.useState([]);
  const [specialistId, setSpecialistId] = React.useState(null);
  const [date, setDate] = React.useState(null);
  const [time, setTime] = React.useState(null);
  const [contact, setContact] = React.useState({ name: "", phone: "" });
  const [appointment, setAppointment] = React.useState(null);
  const [confirmPhase, setConfirmPhase] = React.useState("review");
  const [submitting, setSubmitting] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [gestionEmpty, setGestionEmpty] = React.useState(false);

  // reset al cambiar de vertical
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setStep("inicio"); setServices([]); setSpecialistId(null); setDate(null); setTime(null);
    setContact({ name: "", phone: "" }); setAppointment(null); setRescheduling(false); setGestionEmpty(false);
  }, [t.vertical]);

  const fireToast = (toastObj) => {
    setToast(toastObj);
    clearTimeout(fireToast._t);
    fireToast._t = setTimeout(() => setToast(null), 2600);
  };

  // resumen calculado
  const summary = React.useMemo(() => {
    const chosen = data.services.filter((s) => services.includes(s.id));
    const total = chosen.reduce((a, s) => a + s.price, 0);
    const totalMin = chosen.reduce((a, s) => a + s.min, 0);
    const sp = specialistId === "any"
      ? { name: "Cualquiera disponible" }
      : data.specialists.find((x) => x.id === specialistId) || { name: "—" };
    return { services: chosen, total, totalMin, specialistName: sp.name, dateLabel: dateLabelFromKey(date), time, contact };
  }, [data, services, specialistId, date, time, contact]);

  const toggleService = (id) => setServices((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const goConfirmReview = () => { setConfirmPhase("review"); setStep("confirmacion"); };

  const onConfirm = () => {
    if (t.estado === "conflicto") {
      fireToast({ tone: "error", msg: "Esa hora la acaban de reservar. Elige otra." });
      setTime(null); setStep("horario");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const status = t.confirmacion === "manual" ? "Solicitada" : "Confirmada";
      const code = appointment ? appointment.code : genCode();
      setAppointment((prev) => ({ code: prev ? prev.code : code, status }));
      // Puente con la app del especialista: guarda la reserva pública confirmada
      try {
        localStorage.setItem("orkalis_public_booking", JSON.stringify({
          code, status, vertical: t.vertical,
          serviceIds: services, specialistId, date, time,
          clientName: contact.name, clientPhone: contact.phone, source: "publico", createdAt: Date.now(),
        }));
      } catch (e) {}
      setSubmitting(false);
      setConfirmPhase("result");
      setRescheduling(false);
    }, 850);
  };

  const startReschedule = () => { setRescheduling(true); setTime(null); setStep("horario"); fireToast({ tone: "info", msg: "Elige tu nuevo horario" }); };
  const onCancel = () => {
    setAppointment((a) => ({ ...a, status: "Cancelada" }));
    try {
      const raw = localStorage.getItem("orkalis_public_booking");
      if (raw) { const o = JSON.parse(raw); o.status = "Cancelada"; localStorage.setItem("orkalis_public_booking", JSON.stringify(o)); }
    } catch (e) {}
    fireToast({ tone: "success", msg: "Tu cita fue cancelada" });
  };

  const resetFlow = () => {
    setStep("inicio"); setServices([]); setSpecialistId(null); setDate(null); setTime(null);
    setContact({ name: "", phone: "" }); setAppointment(null); setRescheduling(false); setGestionEmpty(false);
  };

  // navegación horario → continuar
  const horarioContinue = () => {
    if (rescheduling) goConfirmReview();
    else setStep("identificacion");
  };

  let screen;
  if (step === "inicio")
    screen = <ScreenInicio data={data} estado="datos" onReserve={() => { setGestionEmpty(false); setStep("servicios"); }} onManage={() => { setGestionEmpty(!appointment); setStep("gestion"); }} />;
  else if (step === "servicios")
    screen = <ScreenServicios data={data} estado={t.estado} selected={services} onToggle={toggleService} onBack={() => setStep("inicio")} onContinue={() => setStep("especialista")} />;
  else if (step === "especialista")
    screen = <ScreenEspecialista data={data} estado={t.estado} value={specialistId} onPick={setSpecialistId} onBack={() => setStep("servicios")} onContinue={() => setStep("horario")} />;
  else if (step === "horario")
    screen = <ScreenHorario data={data} estado={t.estado} specialistId={specialistId} date={date} time={time} onPickDate={(k) => { setDate(k); setTime(null); }} onPickTime={setTime} onBack={() => setStep(rescheduling ? "gestion" : "especialista")} onContinue={horarioContinue} />;
  else if (step === "identificacion")
    screen = <ScreenIdentificacion data={data} estado={t.estado} contact={contact} onChangeContact={setContact} onBack={() => setStep("horario")} onVerified={goConfirmReview} />;
  else if (step === "confirmacion")
    screen = <ScreenConfirmacion data={data} summary={summary} confirmMode={t.confirmacion} phase={confirmPhase} submitting={submitting} appointment={appointment}
      onBack={() => setStep("identificacion")} onConfirm={onConfirm} onManage={() => setStep("gestion")} onNew={resetFlow} onToast={fireToast} />;
  else if (step === "gestion")
    screen = <ScreenGestion data={data} appointment={gestionEmpty ? null : appointment} summary={summary}
      onBack={() => setStep(appointment && !gestionEmpty ? "confirmacion" : "inicio")} onReschedule={startReschedule} onCancel={onCancel} onNew={resetFlow} onToast={fireToast} />;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <IOSDevice width={402} height={874}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--surface-page)" }}>
          {screen}
          <Toast toast={toast} />
        </div>
      </IOSDevice>

      <TweaksPanel>
        <TweakSection label="Negocio" />
        <TweakRadio label="Vertical" value={t.vertical}
          options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]}
          onChange={(v) => setTweak("vertical", v)} />
        <TweakSelect label="Confirmación" value={t.confirmacion}
          options={[{ value: "automatica", label: "Automática (Confirmada)" }, { value: "manual", label: "Aprobación manual (Solicitada)" }]}
          onChange={(v) => setTweak("confirmacion", v)} />

        <TweakSection label="Estado de pantalla" />
        <TweakSelect label="Forzar estado" value={t.estado}
          options={[
            { value: "datos", label: "Con datos" },
            { value: "cargando", label: "Cargando (skeleton)" },
            { value: "vacio", label: "Vacío" },
            { value: "error", label: "Error" },
            { value: "conflicto", label: "Conflicto al confirmar" },
          ]}
          onChange={(v) => setTweak("estado", v)} />
        <div style={{ padding: "2px 14px 10px", fontSize: 11, color: "var(--text-tertiary)", lineHeight: "15px" }}>
          Afecta a las pantallas de servicios, {data.specialistLabelPlural.toLowerCase()} y horario. “Conflicto” se dispara al confirmar la reserva.
        </div>

        <TweakSection label="Demo" />
        <TweakButton label="Reiniciar flujo" secondary onClick={resetFlow} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
