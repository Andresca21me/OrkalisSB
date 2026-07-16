/* Orkalis — orquestador de la app del especialista (Lote 2) */

const SPEC_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "acceso": "normal",
  "dia": "datos",
  "turnoActual": "confirmada",
  "reparto": true,
  "inventario": true,
  "sucursales": "varias"
}/*EDITMODE-END*/;

function buildTurnos(vertical, dia, turnoActual) {
  if (dia === "vacio") return [];
  let list = SpecData.dayTurnos(vertical);
  const curIdx = list.findIndex((t) => t.startMin === 12 * 60);
  if (curIdx >= 0) {
    if (turnoActual === "enprogreso") list[curIdx] = { ...list[curIdx], status: "En progreso" };
    else if (turnoActual === "ninguno") list = list.filter((_, i) => i !== curIdx);
    else list[curIdx] = { ...list[curIdx], status: list[curIdx].status === "Solicitada" ? "Solicitada" : "Confirmada" };
  }
  return list;
}

function SpecApp() {
  const [t, setTweak] = useTweaks(SPEC_DEFAULTS);
  const data = OrkData.get(t.vertical);
  const me = SpecData.me(t.vertical);
  const branchesAll = SpecData.branches(t.vertical);
  const branches = t.sucursales === "una" ? [branchesAll[0]] : branchesAll;

  const [loggedIn, setLoggedIn] = React.useState(false);
  const [loginUi, setLoginUi] = React.useState("idle");
  const [tab, setTab] = React.useState("miDia");
  const [overlay, setOverlay] = React.useState(null); // {type:'detalle'|'cobro', id}
  const [turnos, setTurnos] = React.useState(() => buildTurnos(t.vertical, t.dia, t.turnoActual));
  const [available, setAvailable] = React.useState(true);
  const [branch, setBranch] = React.useState(branches[0]);
  const [view, setView] = React.useState("dia");
  const [period, setPeriod] = React.useState("hoy");
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  // reconstrucción al cambiar tweaks de datos
  React.useEffect(() => { setTurnos(buildTurnos(t.vertical, t.dia, t.turnoActual)); setOverlay(null); }, [t.vertical, t.dia, t.turnoActual]);
  React.useEffect(() => { if (!loggedIn) setLoginUi(t.acceso === "suspendida" ? "suspended" : t.acceso === "error" ? "error" : "idle"); }, [t.acceso, loggedIn]);
  React.useEffect(() => { if (!branches.includes(branch)) setBranch(branches[0]); }, [t.vertical, t.sucursales]);

  const fireToast = (o) => { setToast(o); clearTimeout(fireToast._t); fireToast._t = setTimeout(() => setToast(null), 2600); };
  const patchTurno = (id, patch) => setTurnos((arr) => arr.map((x) => x.id === id ? { ...x, ...patch } : x));
  const byId = (id) => turnos.find((x) => x.id === id);

  // turno "actual" (en curso ahora)
  const NOW = SpecData.NOW_MIN;
  const current = turnos.find((x) => x.status === "En progreso") || turnos.find((x) => x.startMin <= NOW && NOW < x.endMin && (x.status === "Confirmada" || x.status === "Solicitada")) || null;

  // ── acciones de turno ──
  const startTurno = (turno) => { patchTurno(turno.id, { status: "En progreso" }); fireToast({ tone: "success", msg: "Turno iniciado" }); };
  const openCobro = (turno) => setOverlay({ type: "cobro", id: turno.id });
  const onSecondary = (kind, turno) => {
    if (kind === "noasistio") { patchTurno(turno.id, { status: "No asistió" }); fireToast({ tone: "warning", msg: "Marcado como no asistió" }); }
    else if (kind === "cancelar") { patchTurno(turno.id, { status: "Cancelada" }); fireToast({ tone: "info", msg: "Turno cancelado" }); }
  };
  const detalleAction = (kind, turno) => {
    if (kind === "noasistio") { patchTurno(turno.id, { status: "No asistió" }); fireToast({ tone: "warning", msg: "Marcado como no asistió" }); setOverlay(null); }
    else if (kind === "cancelar") { patchTurno(turno.id, { status: "Cancelada" }); fireToast({ tone: "info", msg: "Turno cancelado" }); setOverlay(null); }
    else if (kind === "revertir") { patchTurno(turno.id, { status: "En progreso", payment: null }); fireToast({ tone: "info", msg: "Cobro revertido" }); }
  };
  const confirmCobro = ({ total, payment }) => {
    setSaving(true);
    setTimeout(() => {
      patchTurno(overlay.id, { status: "Completada", payment, total });
      setSaving(false); setOverlay(null);
      fireToast({ tone: "success", msg: "Turno completado, ganancias calculadas" });
    }, 800);
  };

  // ── walk-in ──
  const createWalkin = ({ mode, name, phone, serviceIds, start, end, payment, total }) => {
    setSaving(true);
    setTimeout(() => {
      const id = "w" + Date.now();
      const raw = mode === "vivo"
        ? { id, time: SpecData.fmt(NOW), clientName: name, clientPhone: phone, serviceIds, status: "En progreso", source: "walkin" }
        : { id, time: start, clientName: name, clientPhone: phone, serviceIds, status: "Completada", source: "walkin", payment };
      const turno = SpecData.decorate(raw, t.vertical);
      if (mode === "retro" && total) turno.total = total;
      setTurnos((arr) => [...arr, turno].sort((a, b) => a.startMin - b.startMin));
      setSaving(false);
      if (mode === "vivo") { fireToast({ tone: "success", msg: "Atención iniciada" }); setTab("miDia"); setOverlay({ type: "detalle", id }); }
      else { fireToast({ tone: "success", msg: "Atención registrada" }); setTab("agenda"); }
    }, 800);
  };

  const goPublic = () => { window.location.href = "Reserva en línea.html"; };

  // ── render ──
  if (!loggedIn) {
    return (
      <Frame>
        <ScreenLogin data={data} authState={loginUi}
          onLogin={(email, pass) => { setLoginUi("loading"); setTimeout(() => { if (!pass || pass.length < 4) setLoginUi("error"); else { setLoggedIn(true); setLoginUi("idle"); } }, 750); }}
          onChangeAuth={setLoginUi} />
        <Toast toast={toast} />
        <SpecTweaks t={t} setTweak={setTweak} data={data} />
      </Frame>
    );
  }

  // overlays a pantalla completa (sin tab bar)
  if (overlay) {
    const turno = byId(overlay.id);
    if (turno && overlay.type === "detalle")
      return (
        <Frame>
          <ScreenDetalleTurno data={data} turno={turno} onBack={() => setOverlay(null)}
            onStart={(tt) => startTurno(tt)} onComplete={(tt) => openCobro(tt)} onAction={detalleAction} onToast={fireToast} />
          <Toast toast={toast} />
          <SpecTweaks t={t} setTweak={setTweak} data={data} />
        </Frame>
      );
    if (turno && overlay.type === "cobro")
      return (
        <Frame>
          <ScreenCobro data={data} turno={turno} inventoryOn={t.inventario} partitionOn={t.reparto} saving={saving}
            onBack={() => setOverlay(null)} onConfirm={confirmCobro} onToast={fireToast} />
          <Toast toast={toast} />
          <SpecTweaks t={t} setTweak={setTweak} data={data} />
        </Frame>
      );
  }

  let body;
  if (tab === "miDia")
    body = <ScreenMiDia data={data} me={me} turnos={turnos} current={current} available={available} branch={branch} branches={branches} dayState={t.dia}
      onToggleAvailable={(v) => { setAvailable(v); fireToast({ tone: v ? "success" : "info", msg: v ? "Estás disponible" : "Marcado como ocupado" }); }}
      onPickBranch={() => setTab("perfil")} onOpenTurno={(tt) => setOverlay({ type: "detalle", id: tt.id })}
      onStartTurno={startTurno} onCompleteTurno={openCobro} onSecondary={onSecondary} onWalkin={() => setTab("walkin")} />;
  else if (tab === "agenda")
    body = <ScreenAgenda data={data} turnos={turnos} view={view} onView={setView} agendaState={t.dia} onOpenTurno={(tt) => setOverlay({ type: "detalle", id: tt.id })} />;
  else if (tab === "walkin")
    body = <ScreenWalkin data={data} saving={saving} onCreate={createWalkin} onToast={fireToast} />;
  else if (tab === "ganancias")
    body = <ScreenGanancias data={data} turnos={turnos} partitionOn={t.reparto} period={period} onPeriod={setPeriod} earnState={t.dia === "cargando" ? "cargando" : "datos"} />;
  else
    body = <ScreenPerfil data={data} me={me} available={available} branch={branch} branches={branches}
      onToggleAvailable={(v) => { setAvailable(v); fireToast({ tone: v ? "success" : "info", msg: v ? "Estás disponible" : "Marcado como ocupado" }); }}
      onPickBranch={(b) => { setBranch(b); fireToast({ tone: "success", msg: `Operando en ${b}` }); }} onLogout={() => { setLoggedIn(false); setTab("miDia"); }} onOpenPublic={goPublic} />;

  return (
    <Frame>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{body}</div>
      <TabBar active={tab} onChange={setTab} />
      <Toast toast={toast} />
      <SpecTweaks t={t} setTweak={setTweak} data={data} />
    </Frame>
  );
}

function Frame({ children }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <IOSDevice width={402} height={874}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--surface-page)" }}>
          {children}
        </div>
      </IOSDevice>
    </div>
  );
}

function SpecTweaks({ t, setTweak, data }) {
  return (
    <TweaksPanel>
      <TweakSection label="Negocio" />
      <TweakRadio label="Vertical" value={t.vertical} options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]} onChange={(v) => setTweak("vertical", v)} />
      <TweakRadio label="Sucursales" value={t.sucursales} options={[{ value: "una", label: "Una" }, { value: "varias", label: "Varias" }]} onChange={(v) => setTweak("sucursales", v)} />

      <TweakSection label="Configuración del negocio" />
      <TweakToggle label="Reparto por especialista" value={t.reparto} onChange={(v) => setTweak("reparto", v)} />
      <TweakToggle label="Inventario activo" value={t.inventario} onChange={(v) => setTweak("inventario", v)} />

      <TweakSection label="Estado del día" />
      <TweakSelect label="Datos" value={t.dia} options={[{ value: "datos", label: "Con datos" }, { value: "cargando", label: "Cargando (skeleton)" }, { value: "vacio", label: "Día sin turnos" }]} onChange={(v) => setTweak("dia", v)} />
      <TweakSelect label="Turno actual" value={t.turnoActual} options={[{ value: "confirmada", label: "Confirmada (Iniciar)" }, { value: "enprogreso", label: "En progreso (Completar)" }, { value: "ninguno", label: "Sin turno actual" }]} onChange={(v) => setTweak("turnoActual", v)} />

      <TweakSection label="Acceso (al cerrar sesión)" />
      <TweakSelect label="Estado de login" value={t.acceso} options={[{ value: "normal", label: "Normal" }, { value: "error", label: "Credenciales inválidas" }, { value: "suspendida", label: "Cuenta suspendida" }]} onChange={(v) => setTweak("acceso", v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SpecApp />);
