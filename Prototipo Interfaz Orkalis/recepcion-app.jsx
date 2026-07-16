/* Orkalis — Recepción (Lote 7 · 7.1 Agenda del día + 7.2 walk-in/cobro).
   Superficie de operación diaria del recepcionista de una sucursal: board del
   día por especialista, acción contextual (Iniciar / Cobrar), reasignación con
   validación de conflicto, y accesos a Nueva cita / Walk-in / Venta de productos.
   Reutiliza modales y primitivas de los lotes anteriores. */

const RECEP_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "estado": "datos"
}/*EDITMODE-END*/;

// ── Cabecera de recepción ────────────────────────────────────────────
function RecepHeader({ branch, branches, onBranch, onNewAppt, onWalkIn, onSale, onExport, recep }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 24px", height: 64 }}>
        <Logo />
        <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px", borderRadius: "var(--radius-pill)", background: "var(--brand-tint)" }}>
          <Icon name="store" size={15} color="var(--brand)" />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--brand)" }}>Recepción</span>
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Avatar name={recep.name} size={34} />
          <div style={{ textAlign: "left", lineHeight: 1.15 }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{recep.name}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{recep.role}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 24px", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 5 }}>{AdminData.todayLabel()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>Agenda del día</h1>
            <div style={{ width: 220 }}>
              <GSelect value={branch.id} onChange={onBranch} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" size="md" iconLeft="download" onClick={onExport}>Resumen diario (PDF)</Button>
          <Button variant="secondary" size="md" iconLeft="package" onClick={onSale}>Venta de productos</Button>
          <Button variant="secondary" size="md" iconLeft="user" onClick={onWalkIn}>Walk-in</Button>
          <Button variant="primary" size="md" iconLeft="plus" onClick={onNewAppt}>Nueva cita</Button>
        </div>
      </div>
    </header>
  );
}

// ── Tarjeta de turno en el board ─────────────────────────────────────
function BoardCard({ appt, color, onQuick, onStatus, onEdit, onReassign }) {
  const dim = appt.status === "Cancelada" || appt.status === "No asistió";
  const qa = RecepData.quickAction(appt.status);
  return (
    <div style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", boxShadow: "var(--shadow-xs)", overflow: "hidden", opacity: dim ? 0.66 : 1 }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 3, flex: "none", background: color }} />
        <div style={{ flex: 1, minWidth: 0, padding: "11px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="data" style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{appt.time}<span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}> · {appt.dur}m</span></span>
            <StatusBadge status={appt.status} size="md" />
          </div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {appt.clientName}
            {appt.source === "publico" && appt.status === "Solicitada" && <Badge tone="brand" size="md" style={{ marginLeft: 6 }}>En línea</Badge>}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {appt.services.map((s) => s.name).join(" · ")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
            <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{RecepData.COP(appt.total)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {qa && <Button variant={qa.cobro ? "primary" : "secondary"} size="sm" iconLeft={qa.icon} onClick={() => onQuick(appt, qa)}>{qa.label}</Button>}
              <RowMenu items={[
                { icon: "edit", label: "Editar cita", onClick: () => onEdit(appt) },
                { icon: "repeat", label: "Reasignar especialista", onClick: () => onReassign(appt) },
                { divider: true },
                { icon: "check-circle", label: "Cambiar estado", onClick: () => onStatus(appt) },
              ]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Columna de especialista ──────────────────────────────────────────
function SpecialistColumn({ col, onQuick, onStatus, onEdit, onReassign, onNewFor }) {
  const sp = col.specialist;
  const active = col.appts.filter((a) => !["Cancelada", "No asistió"].includes(a.status));
  const sum = active.filter((a) => a.status === "Completada").reduce((s, a) => s + a.total, 0);
  return (
    <div style={{ flex: "0 0 290px", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", marginBottom: 12 }}>
        <span style={{ position: "relative", flex: "none" }}>
          <Avatar name={sp.name} size={38} />
          <span style={{ position: "absolute", bottom: -1, right: -1, width: 11, height: 11, borderRadius: 99, background: col.color, border: "2px solid var(--surface-card)" }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.name}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{col.appts.length} {col.appts.length === 1 ? "turno" : "turnos"} · {RecepData.COP(sum)}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {col.appts.length === 0 ? (
          <button type="button" onClick={() => onNewFor(sp)} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, padding: "28px 16px", borderRadius: "var(--radius-md)", border: "1.5px dashed var(--border-default)", background: "transparent", cursor: "pointer", color: "var(--text-tertiary)" }}>
            <Icon name="plus" size={20} color="var(--text-tertiary)" />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Sin turnos</span>
            <span style={{ fontSize: "var(--text-xs)" }}>Agendar para {sp.name.split(" ")[0]}</span>
          </button>
        ) : (
          col.appts.map((a) => <BoardCard key={a.id} appt={a} color={col.color} onQuick={onQuick} onStatus={onStatus} onEdit={onEdit} onReassign={onReassign} />)
        )}
      </div>
    </div>
  );
}

// ── Diálogo de reasignación (con validación de conflicto) ────────────
function ReassignDialog({ open, appt, vertical, onClose, onConfirm }) {
  const specialists = OrkData.get(vertical).specialists;
  const [target, setTarget] = React.useState("");
  React.useEffect(() => { if (open && appt) setTarget(""); }, [open, appt]);
  if (!open || !appt) return null;

  const all = AdminData.dayAppointments(vertical, { sort: "hora" });
  // conflicto: el destino ya tiene un turno que se solapa con el horario del appt
  const overlaps = (spId) => all.some((a) => a.id !== appt.id && a.specialistId === spId
    && !["Cancelada", "No asistió"].includes(a.status)
    && a.startMin < appt.endMin && appt.startMin < a.endMin);
  const conflict = target && overlaps(target);
  const sameSpecialist = target === appt.specialistId;
  const canConfirm = target && !conflict && !sameSpecialist;

  return (
    <Dialog open onClose={onClose} width={460}
      title="Reasignar especialista" subtitle={`${appt.clientName} · ${appt.time} · ${appt.dur} min`}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" iconLeft="repeat" disabled={!canConfirm} onClick={() => onConfirm(appt, target)}>Reasignar</Button>
      </>}>
      <div style={{ padding: "6px 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Mueve este turno a otro especialista de la sucursal. Solo se permiten especialistas sin conflicto de horario.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {specialists.map((sp) => {
            const isCurrent = sp.id === appt.specialistId;
            const hasConflict = overlaps(sp.id);
            const disabled = isCurrent || hasConflict;
            const on = target === sp.id;
            return (
              <button key={sp.id} type="button" disabled={disabled} onClick={() => setTarget(sp.id)} style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
                border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)",
                background: on ? "var(--brand-tint)" : "var(--surface-card)", opacity: disabled ? 0.55 : 1,
              }}>
                <Avatar name={sp.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{sp.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: hasConflict ? "var(--error)" : "var(--text-tertiary)" }}>
                    {isCurrent ? "Especialista actual" : hasConflict ? "Conflicto: ya tiene un turno a esa hora" : sp.role}
                  </div>
                </div>
                {on && <Icon name="check" size={18} color="var(--brand)" />}
                {hasConflict && !isCurrent && <Icon name="alert-triangle" size={16} color="var(--error)" />}
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}

// ── App de Recepción ─────────────────────────────────────────────────
function RecepcionApp() {
  const [t, setTweak] = useTweaks(RECEP_DEFAULTS);
  const branches = ConfigData.branchDetail(t.vertical);
  const [branchId, setBranchId] = React.useState(branches[0].id);
  const branch = branches.find((b) => b.id === branchId) || branches[0];
  const [appts, setAppts] = React.useState(() => AdminData.dayAppointments(t.vertical, { sort: "hora" }));
  const [toast, setToast] = React.useState(null);

  const [apptModal, setApptModal] = React.useState(null);
  const [statusModal, setStatusModal] = React.useState(null);
  const [saleModal, setSaleModal] = React.useState(false);
  const [walkInModal, setWalkInModal] = React.useState(false);
  const [reassign, setReassign] = React.useState(null);

  React.useEffect(() => { setAppts(AdminData.dayAppointments(t.vertical, { sort: "hora" })); setBranchId(ConfigData.branchDetail(t.vertical)[0].id); }, [t.vertical]);

  const fire = (o) => { setToast(o); clearTimeout(fire._t); fire._t = setTimeout(() => setToast(null), 2600); };

  const loading = t.estado === "cargando";
  const empty = t.estado === "vacio";

  // agrupar por especialista
  const sps = OrkData.get(t.vertical).specialists;
  const board = sps.map((sp) => ({ specialist: sp, color: AdminData.specialistColor(t.vertical, sp.id), appts: appts.filter((a) => a.specialistId === sp.id) }));
  const dayTotals = AdminData.computeTotals(appts);

  const applyStatus = (appt, status, extra) => {
    setAppts((arr) => arr.map((a) => a.id === appt.id ? { ...a, status, ...(extra && extra.payment ? { payment: extra.payment } : {}) } : a));
    fire(status === "Completada" ? { tone: "success", msg: "Ganancias calculadas" } : { tone: status === "Cancelada" || status === "No asistió" ? "warning" : "info", msg: `${appt.clientName.split(" ")[0]} · ${status}` });
  };
  const onQuick = (appt, qa) => {
    if (qa.cobro) { setStatusModal({ appt, target: "Completada" }); return; }
    applyStatus(appt, qa.next);
  };
  const onStatusMenu = (appt) => setStatusModal({ appt, target: appt.status });
  const doReassign = (appt, targetId) => {
    const sp = sps.find((s) => s.id === targetId);
    setAppts((arr) => arr.map((a) => a.id === appt.id ? { ...a, specialistId: targetId, specialistName: sp.name, specialist: sp, color: AdminData.specialistColor(t.vertical, targetId) } : a));
    setReassign(null);
    fire({ tone: "success", msg: `Turno reasignado a ${sp.name.split(" ")[0]}` });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", display: "flex", flexDirection: "column" }}>
      <RecepHeader branch={branch} branches={branches} onBranch={setBranchId} recep={RecepData.recepcionist}
        onNewAppt={() => setApptModal({ mode: "new" })} onWalkIn={() => setWalkInModal(true)} onSale={() => setSaleModal(true)}
        onExport={() => fire({ tone: "info", msg: "Generando resumen diario (PDF)…" })} />

      <main style={{ flex: 1, padding: "22px 24px 64px" }}>
        {/* Contadores del día */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22, maxWidth: 760 }}>
          <StatTile label="Turnos del día" value={loading ? "—" : empty ? 0 : dayTotals.total} icon="calendar" loading={loading} />
          <StatTile label="En progreso" value={loading ? "—" : empty ? 0 : dayTotals.enProgreso} icon="play" loading={loading} />
          <StatTile label="Completadas" value={loading ? "—" : empty ? 0 : dayTotals.completadas} icon="check-circle" loading={loading} />
          <StatTile label="Cobrado hoy" value={loading ? "—" : RecepData.COP(empty ? 0 : dayTotals.ingresosReal)} icon="dollar-sign" loading={loading} accent />
        </div>

        {loading ? (
          <div style={{ display: "flex", gap: 18, overflowX: "auto" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ flex: "0 0 290px" }}>
                <Card padding={12} style={{ marginBottom: 12 }}><div style={{ display: "flex", gap: 11, alignItems: "center" }}><Skeleton w={38} h={38} r={99} /><div style={{ flex: 1 }}><Skeleton w="70%" h={14} /><div style={{ height: 6 }} /><Skeleton w="50%" h={11} /></div></div></Card>
                {[0, 1, 2].map((j) => <Card key={j} padding={12} style={{ marginBottom: 10 }}><Skeleton w="40%" h={13} /><div style={{ height: 8 }} /><Skeleton w="80%" h={13} /><div style={{ height: 8 }} /><Skeleton w="100%" h={30} /></Card>)}
              </div>
            ))}
          </div>
        ) : empty ? (
          <Card padding={0}>
            <EmptyState icon="calendar-x" title="No hay turnos para hoy"
              desc="Cuando agendes una cita o registres un walk-in aparecerá aquí, en la columna del especialista."
              action={<div style={{ display: "flex", gap: 10 }}>
                <Button variant="secondary" size="md" iconLeft="user" onClick={() => setWalkInModal(true)}>Walk-in</Button>
                <Button variant="primary" size="md" iconLeft="plus" onClick={() => setApptModal({ mode: "new" })}>Nueva cita</Button>
              </div>} />
          </Card>
        ) : (
          <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
            {board.map((col) => (
              <SpecialistColumn key={col.specialist.id} col={col} onQuick={onQuick} onStatus={onStatusMenu} onEdit={(a) => setApptModal({ mode: "edit", appt: a })}
                onReassign={(a) => setReassign(a)} onNewFor={() => setApptModal({ mode: "new" })} />
            ))}
          </div>
        )}
      </main>

      <ToastDesktop toast={toast} />
      <ApptModal modal={apptModal} vertical={t.vertical} branch={branch.name} inventoryOn={true}
        onClose={() => setApptModal(null)} onSave={({ editing }) => { setApptModal(null); fire({ tone: "success", msg: editing ? "Cita actualizada" : "Cita creada" }); }} />
      <StatusModal modal={statusModal} vertical={t.vertical} onClose={() => setStatusModal(null)}
        onApply={(a, s, e) => { applyStatus(a, s, e); setStatusModal(null); }} />
      <ProductSaleModal open={saleModal} vertical={t.vertical} onClose={() => setSaleModal(false)}
        onConfirm={() => { setSaleModal(false); fire({ tone: "success", msg: "Venta registrada · stock actualizado" }); }} />
      <WalkInModal open={walkInModal} vertical={t.vertical} branch={branch.name} inventoryOn={true}
        onClose={() => setWalkInModal(false)} onConfirm={() => { setWalkInModal(false); fire({ tone: "success", msg: "Walk-in cobrado · ganancias calculadas" }); }} />
      <ReassignDialog open={!!reassign} appt={reassign} vertical={t.vertical} onClose={() => setReassign(null)} onConfirm={doReassign} />

      <TweaksPanel>
        <TweakSection label="Negocio" />
        <TweakRadio label="Vertical" value={t.vertical} options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]} onChange={(v) => setTweak("vertical", v)} />
        <TweakSection label="Estado de la pantalla" />
        <TweakSelect label="Datos" value={t.estado} options={[
          { value: "datos", label: "Con datos" },
          { value: "cargando", label: "Cargando (skeleton)" },
          { value: "vacio", label: "Día sin turnos" },
        ]} onChange={(v) => setTweak("estado", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RecepcionApp />);
