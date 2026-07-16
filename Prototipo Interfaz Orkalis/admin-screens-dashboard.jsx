/* Orkalis — Panel Admin · 3.1 Dashboard (Panel principal) */

const APPT_STATUSES = ["Solicitada", "Confirmada", "En progreso", "Completada", "Cancelada", "No asistió"];

// Menú de cambio de estado + acciones (reutilizado por Dashboard y Agenda)
function ApptActionsMenu({ appt, onStatus, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <IconBtn icon="more-vertical" label="Acciones" onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} align="right" width={216}>
        <div className="eyebrow" style={{ padding: "6px 10px 4px" }}>Cambiar estado</div>
        {APPT_STATUSES.map((st) => (
          <MenuItem key={st} active={st === appt.status}
            onClick={() => { onStatus(appt, st); setOpen(false); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: `var(--${STATUS_TONE[st] === "neutral" ? "gray-400" : STATUS_TONE[st]})` }} />
              {st}
            </span>
          </MenuItem>
        ))}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />
        <MenuItem icon="edit" onClick={() => { onEdit(appt); setOpen(false); }}>Editar cita</MenuItem>
        {onDelete && <MenuItem icon="trash-2" danger onClick={() => { onDelete(appt); setOpen(false); }}>Eliminar</MenuItem>}
      </Popover>
    </div>
  );
}

// Fila de cita (lista del día)
function AppointmentRow({ appt, showPrice, onStatus, onEdit, onDelete, onOpen }) {
  const dim = appt.status === "Cancelada" || appt.status === "No asistió";
  return (
    <Card interactive padding={0} onClick={onOpen ? () => onOpen(appt) : undefined} style={{ overflow: "hidden", opacity: dim ? 0.72 : 1 }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 4, flex: "none", background: appt.color }} />
        <div style={{ flex: 1, minWidth: 0, padding: "14px 14px 14px 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: "none", width: 58, textAlign: "left" }}>
            <div className="data" style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", lineHeight: 1.1 }}>{appt.time}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{appt.dur} min</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.clientName}</span>
              {appt.source === "publico" && appt.status === "Solicitada" && <Badge tone="brand">En línea</Badge>}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {appt.services.map((s) => s.name).join(" · ")}
              <span style={{ color: "var(--border-strong)" }}>  ·  </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: appt.color, display: "inline-block" }} />
                {appt.specialistName}
              </span>
            </div>
          </div>
          {showPrice && <span className="data" style={{ flex: "none", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{AdminData.COP(appt.total)}</span>}
          <div style={{ flex: "none", width: 116, display: "flex", justifyContent: "flex-end" }}><StatusBadge status={appt.status} /></div>
          <div onClick={(e) => e.stopPropagation()} style={{ flex: "none" }}>
            <ApptActionsMenu appt={appt} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Tarjeta de resumen financiero del mes (cifras tabulares)
function FinanceSummary({ vertical, loading }) {
  if (loading) return (
    <Card padding={18}><Skeleton w={160} h={14} /><div style={{ height: 16 }} />
      {[0, 1, 2, 3].map((i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><Skeleton w={120} h={13} /><Skeleton w={80} h={13} /></div>)}
    </Card>
  );
  const f = AdminData.monthlyFinance(vertical);
  const rows = [
    { label: "Ingresos totales", value: f.ingresos, strong: true },
    { label: "Ganancias de profesionales", value: f.profesionales, icon: "users" },
    { label: "Ganancias del salón", value: f.salon, icon: "store" },
    { label: "Valor de productos", value: f.productos, icon: "package" },
  ];
  return (
    <Card padding={18}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <SectionLabel style={{ marginBottom: 0 }}>Resumen del mes · {f.mes}</SectionLabel>
        <Badge tone="accent" dot>En curso</Badge>
      </div>
      <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "8px 0 16px" }}>{AdminData.COP(f.ingresos)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.slice(1).map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderTop: "1px solid var(--border-subtle)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              <Icon name={r.icon} size={16} color="var(--text-tertiary)" />{r.label}
            </span>
            <span className="data" style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{AdminData.COP(r.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScreenDashboard({ vertical, consolidated, branch, state, inventoryOn, appts, onNav, onStatus, onEdit, onNewAppt, onQuickAction, onRetry }) {
  const loading = state === "cargando";
  const empty = state === "vacio";
  const error = state === "error";
  const meta = AdminData.dayMeta(vertical);
  const shown = empty ? [] : (appts || []);
  const totals = AdminData.computeTotals(shown);
  const scope = consolidated ? "Todo el negocio" : branch;
  const stock = AdminData.lowStock(vertical);
  const next = empty ? null : AdminData.computeNext(shown);

  if (error) {
    return (
      <div>
        <DashHeader scope={scope} consolidated={consolidated} onNav={onNav} />
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div>
      <DashHeader scope={scope} consolidated={consolidated} onNav={onNav} />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 22 }}>
        {loading ? [0, 1, 2, 3].map((i) => <KpiCard key={i} loading />) : (
          <>
            <KpiCard label="Citas hoy" value={totals.total} icon="calendar"
              trend={empty ? null : { dir: meta.citasTrendUp ? "up" : "down", value: meta.citasTrend }} sub={empty ? "Sin citas" : "vs. ayer"} />
            <KpiCard label="Ingresos estimados de hoy" value={AdminData.COP(totals.ingresosEst)} icon="dollar-sign"
              sub="servicios activos" />
            <KpiCard label="Especialistas activos" value={`${meta.disponibles}/${meta.especialistas}`} icon="users" sub="disponibles ahora" />
            <KpiCard label="Próxima cita" value={next ? next.time : "—"} icon="clock"
              sub={next ? `en ${next.inMin} min · ${next.clientName.split(" ")[0]}` : "nada pendiente"} />
          </>
        )}
      </div>

      {/* Main + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <FinanceSummary vertical={vertical} loading={loading} />

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}>Citas de hoy</h2>
              {!loading && !empty && <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNav("agenda")}>Ver todo</Button>}
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[0, 1, 2, 3].map((i) => <Card key={i} padding={16}><div style={{ display: "flex", gap: 16, alignItems: "center" }}><Skeleton w={48} h={28} /><div style={{ flex: 1 }}><Skeleton w="55%" h={14} /><div style={{ height: 8 }} /><Skeleton w="40%" h={11} /></div><Skeleton w={90} h={22} r={11} /></div></Card>)}
              </div>
            ) : empty ? (
              <Card padding={0}>
                <EmptyState icon="calendar-x" title="No hay citas para hoy"
                  desc={`Aún no se han agendado citas en ${scope.toLowerCase()}. Crea la primera para empezar el día.`}
                  action={<Button variant="primary" size="md" iconLeft="plus" onClick={onNewAppt}>Nueva cita</Button>} />
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {shown.map((a) => <AppointmentRow key={a.id} appt={a} onStatus={onStatus} onEdit={onEdit} />)}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar derecho */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 88 }}>
          {inventoryOn && (
            <Card padding={18}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <SectionLabel style={{ marginBottom: 0 }}>Stock bajo</SectionLabel>
                <Icon name="alert-triangle" size={16} color="var(--warning)" />
              </div>
              {loading ? [0, 1, 2].map((i) => <div key={i} style={{ marginBottom: 12 }}><Skeleton w="70%" h={13} /></div>) : stock.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: 0 }}>Todo en niveles saludables.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {stock.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <Badge tone={p.stock === 0 ? "error" : "warning"} dot>{p.stock === 0 ? "Agotado" : `${p.stock} rest.`}</Badge>
                    </div>
                  ))}
                  <button type="button" onClick={() => onNav("gestion", "inventario")} style={{ marginTop: 12, border: "none", background: "transparent", color: "var(--brand)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0 }}>Ir a inventario →</button>
                </div>
              )}
            </Card>
          )}

          <Card padding={18}>
            <SectionLabel style={{ marginBottom: 14 }}>Acciones rápidas</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button variant="primary" size="md" fullWidth iconLeft="plus" onClick={onNewAppt}>Nueva cita</Button>
              <Button variant="secondary" size="md" fullWidth iconLeft="users" onClick={() => onNav("clientes")}>Clientes</Button>
              <Button variant="secondary" size="md" fullWidth iconLeft="bar-chart-2" onClick={() => onNav("finanzas")}>Finanzas</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DashHeader({ scope, consolidated, onNav }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{AdminData.todayLabel()}</div>
        <h1 style={{ fontSize: "var(--text-3xl)", letterSpacing: "-0.02em", lineHeight: 1.08 }}>{AdminData.greeting()}, {AdminData.admin.name.split(" ")[0]}</h1>
        <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "6px 0 0", display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name={consolidated ? "layout-grid" : "store"} size={16} color="var(--text-tertiary)" />
          Mostrando <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{scope}</strong>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenDashboard, AppointmentRow, ApptActionsMenu, FinanceSummary, APPT_STATUSES });
