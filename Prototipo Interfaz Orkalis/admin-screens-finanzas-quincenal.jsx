/* Orkalis — Panel Admin · Finanzas 5.2 Control Quincenal / Cierre (opcional).
   Gestiona quincenas y ejecuta el cierre mensual con archivado. */

function ScreenQuincenal({ vertical, consolidated, branch, state, onToast, onRetry }) {
  const [seg, setSeg] = React.useState("primera"); // quincena en curso detectada
  const [archiveMonth, setArchiveMonth] = React.useState("2026-06");
  const [resetOpen, setResetOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => { setSeg("primera"); setArchiveMonth("2026-06"); setDone(false); }, [vertical]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const COP = AdminData.COP;
  const q = AdminData.quincena(vertical, seg);
  const months = AdminData.archivableMonths();
  const scope = consolidated ? "Todo el negocio" : branch;
  const empty = forceEmpty || q.empty;

  const runReset = () => {
    setResetOpen(false); setArchiving(true); setDone(false);
    setTimeout(() => { setArchiving(false); setDone(true); onToast({ tone: "success", msg: `${AdminData.monthLabelFin(archiveMonth)} archivado · contadores reiniciados` }); }, 1900);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>Control quincenal</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="md" iconLeft="download" onClick={() => onToast({ tone: "success", msg: `${q.label} exportado (CSV)` })}>Exportar CSV</Button>
          <Button variant="secondary" size="md" iconLeft="file-text" onClick={() => onToast({ tone: "success", msg: `${q.label} exportado (PDF)` })}>Exportar PDF</Button>
        </div>
      </div>

      {error ? <ErrorState onRetry={onRetry} /> : (
        <>
          {/* selector quincena */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <GSegmented value={seg} onChange={setSeg} options={[
              { value: "primera", label: "1–15" },
              { value: "segunda", label: "16–fin" },
              { value: "mes", label: "Mes completo" },
            ]} />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {q.enCurso && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--brand)", fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--brand)" }} />En curso</span>}
              {q.label}
            </span>
          </div>

          {/* dashboard quincenal */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
              {[0, 1, 2].map((i) => <Card key={i} padding={18}><Skeleton w={90} h={12} /><div style={{ height: 12 }} /><Skeleton w={120} h={26} /></Card>)}
            </div>
          ) : empty ? (
            <Card padding={0} style={{ marginBottom: 24 }}>
              <EmptyState icon="calendar-x" title="Período sin actividad"
                desc={seg === "segunda" ? "La segunda quincena (16–30 jun) aún no ha comenzado. Cuando se registren citas, verás aquí sus métricas." : "No hay movimientos registrados en este período."} />
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
              <FinTile label="Ingresos del período" icon="trending-up" value={COP(q.ingresos)} />
              <FinTile label="Servicios realizados" icon="scissors" value={q.servicios} />
              <FinTile label="Ganancias del salón" icon="wallet" value={COP(q.ganancias)} />
            </div>
          )}

          {/* cierre mensual */}
          {!loading && (
            <Card padding={0} style={{ overflow: "hidden", borderColor: "rgba(245,158,11,0.35)" }}>
              <div style={{ padding: "16px 20px", background: "var(--warning-tint)", borderBottom: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="archive" size={18} color="#B45309" />
                <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "#92400E" }}>Cierre mensual</span>
                <span style={{ fontSize: "var(--text-sm)", color: "#B45309" }}>· zona de cuidado</span>
              </div>
              <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1.4fr auto", gap: 20, alignItems: "end" }}>
                <div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: "21px", maxWidth: 520 }}>
                    Exporta un mes específico y, cuando estés listo, ejecuta el cierre: se archivan los servicios, citas y gastos del mes en el histórico y se reinician los contadores del período en curso.
                  </p>
                  <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 220 }}>
                      <GField label="Mes a cerrar"><GSelect value={archiveMonth} onChange={setArchiveMonth} options={months.map((m) => ({ value: m.key, label: m.label + (m.current ? " · en curso" : "") }))} /></GField>
                    </div>
                    <Button variant="secondary" size="md" iconLeft="download" onClick={() => onToast({ tone: "success", msg: `${AdminData.monthLabelFin(archiveMonth)} exportado (mes completo)` })}>Exportar mes completo</Button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {done && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", color: "var(--success)", fontWeight: 600 }}><Icon name="check-circle" size={15} color="var(--success)" />Mes archivado</span>}
                  <Button variant="danger" size="md" iconLeft={archiving ? null : "rotate-ccw"} disabled={archiving} onClick={() => setResetOpen(true)}>
                    {archiving ? "Archivando…" : "Reiniciar mes"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* modal de reinicio (destructivo) */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} width={500}
        title="Reiniciar mes" subtitle={AdminData.monthLabelFin(archiveMonth)}
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setResetOpen(false)}>Cancelar</Button>
          <Button variant="danger" size="md" iconLeft="rotate-ccw" onClick={runReset}>Sí, archivar y reiniciar</Button>
        </>}>
        <div style={{ padding: "8px 0 18px" }}>
          <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--error-tint)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 16 }}>
            <Icon name="alert-octagon" size={20} color="var(--error)" style={{ flex: "none", marginTop: 1 }} />
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "21px" }}>
              Esta acción es <strong style={{ color: "var(--text-primary)" }}>sensible y no se puede deshacer</strong>. Asegúrate de haber exportado el mes antes de continuar.
            </div>
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0 0 10px" }}>Al reiniciar el mes:</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Se archivan servicios, citas y gastos del mes en el histórico.",
              "Los contadores del período vuelven a cero.",
              "El histórico queda consultable desde Agenda · Historial.",
            ].map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                <Icon name="check" size={16} color="var(--text-tertiary)" style={{ flex: "none", marginTop: 2 }} />{t}
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </div>
  );
}

Object.assign(window, { ScreenQuincenal });
