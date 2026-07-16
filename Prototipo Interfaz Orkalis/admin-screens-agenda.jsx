/* Orkalis — Panel Admin · 3.2 Agenda / Calendario (Agenda + Historial) */

// Mini-calendario (junio 2026, semana inicia lunes)
const WD = ["L", "M", "X", "J", "V", "S", "D"];
function MiniCalendar({ vertical, selected, onPick }) {
  // junio 2026: 1 = lunes, 30 días
  const firstDow = 0; // lunes = índice 0
  const days = 30;
  const closedDow = vertical === "barberia" ? 6 : 0; // dom (idx6) barbería / lun (idx0) salón
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const dowOf = (d) => (firstDow + d - 1) % 7;
  return (
    <Card padding={16}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>Junio 2026</span>
        <div style={{ display: "flex", gap: 2 }}>
          <IconBtn icon="chevron-left" label="Mes anterior" />
          <IconBtn icon="chevron-right" label="Mes siguiente" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {WD.map((w, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)" }}>{w}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const isToday = d === 9;
          const isSel = d === selected;
          const closed = dowOf(d) === closedDow;
          return (
            <button key={i} type="button" disabled={closed} onClick={() => onPick(d)} style={{
              aspectRatio: "1", border: "none", borderRadius: "var(--radius-sm)", cursor: closed ? "default" : "pointer",
              background: isSel ? "var(--brand)" : isToday ? "var(--brand-tint)" : "transparent",
              color: isSel ? "#fff" : closed ? "var(--text-disabled)" : isToday ? "var(--brand)" : "var(--text-primary)",
              fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: isToday || isSel ? 700 : 500,
              position: "relative", opacity: closed ? 0.5 : 1,
            }}>
              {d}
              {d === 9 && !isSel && <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 99, background: "var(--brand)" }} />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SpecialistLegend({ vertical }) {
  const sps = OrkData.get(vertical).specialists;
  return (
    <Card padding={16}>
      <SectionLabel style={{ marginBottom: 12 }}>{OrkData.get(vertical).specialistLabelPlural}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sps.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: AdminData.specialistColor(vertical, s.id), flex: "none" }} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{s.role}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DayCounters({ totals, loading }) {
  const items = [
    { label: "Total citas", value: totals.total, icon: "calendar" },
    { label: "Programadas", value: totals.programadas, icon: "clock" },
    { label: "Completadas", value: totals.completadas, icon: "check-circle" },
    { label: "Ingresos", value: AdminData.COP(totals.ingresosReal), icon: "dollar-sign", accent: true },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      {items.map((it) => <StatTile key={it.label} {...it} loading={loading} />)}
    </div>
  );
}

// ── Historial ──
function PeriodSection({ period, vertical, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const rows = AdminData.currentPeriodAppointments(vertical);
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", border: "none",
        background: "transparent", cursor: "pointer", textAlign: "left",
      }}>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={18} color="var(--text-tertiary)" />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)", flex: 1 }}>{period.label}</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{period.citas} citas</span>
        <span className="data" style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", minWidth: 110, textAlign: "right" }}>{AdminData.COP(period.ingresos)}</span>
        <Badge tone="neutral" dot>{period.estado}</Badge>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "4px 18px 12px" }}>
          <ArchiveTable rows={rows} vertical={vertical} />
        </div>
      )}
    </Card>
  );
}

function ArchiveTable({ rows, vertical }) {
  const th = { textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
  const td = { padding: "12px 12px", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead><tr>
          <th style={th}>Hora</th><th style={th}>Cliente</th><th style={th}>Servicios</th>
          <th style={th}>Especialista</th><th style={{ ...th, textAlign: "right" }}>Total</th><th style={{ ...th, textAlign: "right" }}>Estado</th>
        </tr></thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.id} style={{ background: i % 2 ? "var(--gray-50)" : "transparent" }}>
              <td style={{ ...td }}><span className="data" style={{ fontWeight: 600 }}>{a.time}</span></td>
              <td style={td}>{a.clientName}</td>
              <td style={{ ...td, color: "var(--text-secondary)" }}>{a.services.map((s) => s.name).join(" · ")}</td>
              <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: a.color }} />{a.specialistName}</span></td>
              <td style={{ ...td, textAlign: "right" }}><span className="data" style={{ fontWeight: 600 }}>{AdminData.COP(a.total)}</span></td>
              <td style={{ ...td, textAlign: "right" }}><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScreenAgenda({ vertical, consolidated, branch, state, cierreOn, appts, onStatus, onEdit, onDelete, onNewAppt, onSale, onToast, onRetry }) {
  const [view, setView] = React.useState("agenda");
  const [day, setDay] = React.useState(9);
  const loading = state === "cargando";
  const error = state === "error";
  const empty = state === "vacio" || day !== 9;
  const scope = consolidated ? "Todo el negocio" : branch;

  const shown = empty ? [] : AdminData.sortAppointments(appts || [], "prioridad");
  const totals = AdminData.computeTotals(shown);
  const periods = AdminData.periods(vertical);

  const topActions = (
    <>
      <Button variant="secondary" size="md" iconLeft="package" onClick={onSale}>Venta de productos</Button>
      <Button variant="primary" size="md" iconLeft="plus" onClick={onNewAppt}>Nueva cita</Button>
    </>
  );

  return (
    <div>
      <PageHeader eyebrow={scope} title="Agenda" sub="Gestiona las citas de la sucursal y consulta el historial de cierres." right={topActions} />

      <div style={{ marginBottom: 22 }}>
        <TabsUnderline tabs={[{ value: "agenda", label: "Agenda" }, { value: "historial", label: "Historial" }]} value={view} onChange={setView} />
      </div>

      {view === "agenda" ? (
        <div style={{ display: "grid", gridTemplateColumns: "264px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 88 }}>
            <MiniCalendar vertical={vertical} selected={day} onPick={setDay} />
            <SpecialistLegend vertical={vertical} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}>
                {day === 9 ? "Hoy · martes 9 jun" : `${WD2(day)} ${day} jun 2026`}
              </h2>
              <Button variant="ghost" size="sm" iconLeft="download" onClick={() => onToast({ tone: "info", msg: "Generando resumen diario (PDF)…" })}>Exportar día (PDF)</Button>
            </div>

            {error ? <ErrorState onRetry={onRetry} /> : (
              <>
                <DayCounters totals={totals} loading={loading} />
                {loading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[0, 1, 2, 3, 4].map((i) => <Card key={i} padding={16}><div style={{ display: "flex", gap: 16, alignItems: "center" }}><Skeleton w={48} h={28} /><div style={{ flex: 1 }}><Skeleton w="50%" h={14} /><div style={{ height: 8 }} /><Skeleton w="36%" h={11} /></div><Skeleton w={90} h={22} r={11} /></div></Card>)}
                  </div>
                ) : empty ? (
                  <Card padding={0}>
                    <EmptyState icon="calendar-x" title={day === 9 ? "No hay citas para hoy" : "No hay citas para este día"}
                      desc="Cuando agendes una cita aparecerá aquí, ordenada por estado y hora."
                      action={<Button variant="primary" size="md" iconLeft="plus" onClick={onNewAppt}>Nueva cita</Button>} />
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {shown.map((a) => <AppointmentRow key={a.id} appt={a} showPrice onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        // ── Historial ──
        <div style={{ maxWidth: 980 }}>
          {cierreOn ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Alert tone="info">El periodo <strong>1–15 jun 2026</strong> está en curso. Al cerrarlo, sus citas se archivarán aquí.</Alert>
              {periods.map((p, i) => <PeriodSection key={p.id} period={p} vertical={vertical} defaultOpen={i === 0} />)}
            </div>
          ) : (
            <Card padding={0}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <Icon name="archive" size={18} color="var(--text-tertiary)" />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-base)" }}>Historial acumulado</span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginLeft: "auto" }}>Sin cierre de periodo · todo en una sola vista</span>
              </div>
              <div style={{ padding: "4px 18px 14px" }}>
                <ArchiveTable rows={AdminData.currentPeriodAppointments(vertical)} vertical={vertical} />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// etiqueta de día de la semana para junio 2026 (1=lun)
function WD2(d) {
  const names = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  return names[(d - 1) % 7];
}

// Alert local (banner contextual) — no cargamos spec-ui en este deliverable
function Alert({ tone = "info", children }) {
  const map = {
    info: { fg: "var(--info)", bg: "var(--info-tint)", bd: "rgba(59,130,246,0.22)", icon: "info" },
    warning: { fg: "#B45309", bg: "var(--warning-tint)", bd: "rgba(245,158,11,0.28)", icon: "alert-triangle" },
  };
  const m = map[tone] || map.info;
  return (
    <div style={{ display: "flex", gap: 10, padding: 14, borderRadius: "var(--radius-md)", background: m.bg, border: `1px solid ${m.bd}` }}>
      <Icon name={m.icon} size={18} color={m.fg} style={{ marginTop: 1, flex: "none" }} />
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>{children}</div>
    </div>
  );
}

Object.assign(window, { ScreenAgenda, MiniCalendar });
