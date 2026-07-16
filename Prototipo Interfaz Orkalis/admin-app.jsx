/* Orkalis — orquestador del Panel de Administración (Lote 3) */

const ADMIN_DEFAULTS = /*EDITMODE-BEGIN*/{
  "vertical": "barberia",
  "vista": "consolidada",
  "sucursales": "varias",
  "estado": "datos",
  "inventario": true,
  "cierre": true,
  "particion": true,
  "escenario": "saludable",
  "cuenta": "activa"
}/*EDITMODE-END*/;

function AdminApp() {
  const [t, setTweak] = useTweaks(ADMIN_DEFAULTS);
  const data = OrkData.get(t.vertical);
  const branchesAll = AdminData.branches(t.vertical);
  const branches = t.sucursales === "una" ? [branchesAll[0]] : branchesAll;

  const [tab, setTab] = React.useState("panel");
  const [gestionTab, setGestionTab] = React.useState(null);
  const [configSection, setConfigSection] = React.useState("modulos");
  const [branch, setBranch] = React.useState(branchesAll[0]);
  const [consolidated, setConsolidated] = React.useState(t.vista !== "sucursal");
  const [appts, setAppts] = React.useState(() => AdminData.dayAppointments(t.vertical, { sort: "hora" }));
  const [toast, setToast] = React.useState(null);
  const [apptModal, setApptModal] = React.useState(null); // {mode, appt}
  const [statusModal, setStatusModal] = React.useState(null); // {appt}
  const [saleModal, setSaleModal] = React.useState(false);

  React.useEffect(() => { setAppts(AdminData.dayAppointments(t.vertical, { sort: "hora" })); }, [t.vertical]);
  React.useEffect(() => { setConsolidated(t.vista !== "sucursal"); }, [t.vista]);
  React.useEffect(() => { if (!branches.includes(branch)) setBranch(branches[0]); }, [t.vertical, t.sucursales]);

  const fireToast = (o) => { setToast(o); clearTimeout(fireToast._t); fireToast._t = setTimeout(() => setToast(null), 2600); };

  // navegación con sub-pestaña opcional (deep-link a Gestión)
  const navTo = (tabId, sub) => { if (sub) setGestionTab(sub); setTab(tabId); };

  // ── selector de sucursal (cabecera) ──
  const onPick = (b) => { setBranch(b); setConsolidated(false); setTweak("vista", "sucursal"); };
  const onConsolidated = () => { setConsolidated(true); setTweak("vista", "consolidada"); };

  // ── acciones de cita ──
  const applyStatus = (appt, status, extra) => {
    setAppts((arr) => arr.map((a) => a.id === appt.id ? { ...a, status, ...(extra && extra.payment ? { payment: extra.payment } : {}) } : a));
    fireToast(status === "Completada"
      ? { tone: "success", msg: "Ganancias calculadas" }
      : { tone: status === "Cancelada" || status === "No asistió" ? "warning" : "info", msg: `Cita de ${appt.clientName.split(" ")[0]} · ${status}` });
  };
  // Interpone el modal de completar/revertir; los demás estados aplican directo.
  const patchStatus = (appt, status) => {
    if (status === appt.status) return;
    if (status === "Completada" || (appt.status === "Completada" && status !== "Completada")) { setStatusModal({ appt, target: status }); return; }
    applyStatus(appt, status);
  };
  const deleteAppt = (appt) => {
    setAppts((arr) => arr.filter((a) => a.id !== appt.id));
    fireToast({ tone: "info", msg: "Cita eliminada" });
  };
  const editAppt = (appt) => setApptModal({ mode: "edit", appt });
  const newAppt = () => setApptModal({ mode: "new" });
  const onSale = () => setSaleModal(true);
  const retry = () => fireToast({ tone: "success", msg: "Información actualizada" });

  const openConfig = (section) => { setConfigSection(section || "modulos"); setTab("config"); };

  const shared = { vertical: t.vertical, consolidated, branch, state: t.estado, onToast: fireToast, onRetry: retry };

  let body;
  if (tab === "panel")
    body = <ScreenDashboard {...shared} inventoryOn={t.inventario} appts={appts}
      onNav={navTo} onStatus={patchStatus} onEdit={editAppt} onNewAppt={newAppt} />;
  else if (tab === "agenda")
    body = <ScreenAgenda {...shared} cierreOn={t.cierre} appts={appts}
      onStatus={patchStatus} onEdit={editAppt} onDelete={deleteAppt} onNewAppt={newAppt} onSale={onSale} />;
  else if (tab === "clientes")
    body = <ScreenClientes {...shared} />;
  else if (tab === "gestion")
    body = <ScreenGestion {...shared} inventoryOn={t.inventario} particion={t.particion}
      initialTab={gestionTab} onTabChange={setGestionTab} />;
  else if (tab === "finanzas")
    body = <ScreenFinanzas {...shared} inventoryOn={t.inventario} cierreOn={t.cierre} particion={t.particion}
      scenario={t.escenario} onNav={navTo} />;
  else if (tab === "config")
    body = <ScreenConfig vertical={t.vertical} section={configSection} onSection={setConfigSection}
      state={t.estado} onToast={fireToast} admin={AdminData.admin} account={t.cuenta} />;
  else
    body = <ScreenSoon title="Finanzas" eyebrow={consolidated ? "Todo el negocio" : branch} icon="bar-chart-2"
      desc="Análisis, cierre quincenal y reportes." />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", display: "flex", flexDirection: "column" }}>
      <TopNav active={tab} onNav={setTab} branch={branch} branches={branches} consolidated={consolidated}
        onPick={onPick} onConsolidated={onConsolidated} admin={AdminData.admin} onToast={fireToast}
        onConfig={() => openConfig("modulos")} onDeveloper={() => openConfig("developer")} configActive={tab === "config"} />
      {t.cuenta === "suspendida" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "10px 24px", background: "var(--error)", color: "#fff", flexWrap: "wrap" }}>
          <Icon name="alert-octagon" size={18} color="#fff" />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Tu cuenta está suspendida por falta de pago. El equipo no puede agendar ni cobrar.</span>
          <button type="button" onClick={() => openConfig("suscripcion")} style={{ border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", height: 30, padding: "0 14px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}>Regularizar pago</button>
        </div>
      )}
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 32px 80px" }}>{body}</div>
      </main>

      <ToastDesktop toast={toast} />
      <ApptModal modal={apptModal} vertical={t.vertical} branch={consolidated ? branchesAll[0] : branch} inventoryOn={t.inventario}
        onClose={() => setApptModal(null)}
        onSave={({ editing }) => { setApptModal(null); fireToast({ tone: "success", msg: editing ? "Cita actualizada" : "Cita creada" }); }} />
      <StatusModal modal={statusModal} vertical={t.vertical}
        onClose={() => setStatusModal(null)}
        onApply={(appt, status, extra) => { applyStatus(appt, status, extra); setStatusModal(null); }} />
      <ProductSaleModal open={saleModal} vertical={t.vertical}
        onClose={() => setSaleModal(false)}
        onConfirm={() => { setSaleModal(false); fireToast({ tone: "success", msg: "Venta registrada · stock actualizado" }); }} />
      <AdminTweaks t={t} setTweak={setTweak} />
    </div>
  );
}

// Pantalla "próximamente" para módulos de lotes siguientes
function ScreenSoon({ title, eyebrow, desc, icon }) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} />
      <Card padding={0}>
        <EmptyState icon={icon} title={`${title} · próximamente`} desc={desc} />
      </Card>
    </div>
  );
}

// Modal de cita (crear/editar) y de cambio de estado viven en admin-modals.jsx (Lote 7)

function AdminTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Negocio" />
      <TweakRadio label="Vertical" value={t.vertical} options={[{ value: "barberia", label: "Barbería" }, { value: "salon", label: "Salón" }]} onChange={(v) => setTweak("vertical", v)} />
      <TweakRadio label="Sucursales" value={t.sucursales} options={[{ value: "una", label: "Una" }, { value: "varias", label: "Varias" }]} onChange={(v) => setTweak("sucursales", v)} />
      <TweakRadio label="Vista" value={t.vista} options={[{ value: "consolidada", label: "Negocio" }, { value: "sucursal", label: "Sucursal" }]} onChange={(v) => setTweak("vista", v)} />

      <TweakSection label="Estado de la pantalla" />
      <TweakSelect label="Datos" value={t.estado} options={[
        { value: "datos", label: "Con datos" },
        { value: "cargando", label: "Cargando (skeleton)" },
        { value: "vacio", label: "Vacío (empty state)" },
        { value: "error", label: "Error de carga" },
      ]} onChange={(v) => setTweak("estado", v)} />

      <TweakSection label="Módulos del negocio" />
      <TweakToggle label="Inventario activo" value={t.inventario} onChange={(v) => setTweak("inventario", v)} />
      <TweakToggle label="Cierre de periodo" value={t.cierre} onChange={(v) => setTweak("cierre", v)} />
      <TweakToggle label="Partición por especialista" value={t.particion} onChange={(v) => setTweak("particion", v)} />

      <TweakSection label="Finanzas" />
      <TweakSelect label="Escenario financiero" value={t.escenario} options={[
        { value: "saludable", label: "Saludable (margen ≥ 10%)" },
        { value: "baja", label: "Rentabilidad baja (< 10%)" },
        { value: "perdidas", label: "Pérdidas (margen < 0)" },
      ]} onChange={(v) => setTweak("escenario", v)} />

      <TweakSection label="Cuenta" />
      <TweakRadio label="Estado de la cuenta" value={t.cuenta} options={[{ value: "activa", label: "Activa" }, { value: "suspendida", label: "Suspendida" }]} onChange={(v) => setTweak("cuenta", v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AdminApp />);
