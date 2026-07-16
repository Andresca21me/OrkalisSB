/* Orkalis — Panel Admin · Finanzas 5.1 Análisis Financiero.
   Foto financiera del período: ingresos del salón, egresos, ganancia neta,
   salud financiera, métodos de pago, gráficos y gestión de gastos. */

function PeriodSwitch({ value, onChange }) {
  return (
    <GSegmented value={value} onChange={onChange} options={[
      { value: "semana", label: "Esta semana" },
      { value: "mes", label: "Este mes" },
      { value: "ano", label: "Este año" },
    ]} />
  );
}

// Tarjeta de resumen financiero (KPI compacto)
function FinTile({ label, value, icon, tone, sub, loading, big }) {
  if (loading) return <Card padding={18}><Skeleton w={100} h={12} /><div style={{ height: 12 }} /><Skeleton w={120} h={26} /></Card>;
  const color = tone === "neg" ? "var(--error)" : tone === "pos" ? "var(--text-primary)" : "var(--text-primary)";
  return (
    <Card padding={18} style={{ minHeight: 116, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "18px" }}>{label}</span>
        {icon && <span style={{ display: "inline-flex", width: 30, height: 30, flex: "none", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} color="var(--text-tertiary)" /></span>}
      </div>
      <div style={{ marginTop: "auto" }}>
        <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: big ? "var(--text-2xl)" : "var(--text-xl)", letterSpacing: "-0.02em", color, lineHeight: 1.05 }}>{value}</div>
        {sub && <div style={{ marginTop: 8 }}>{sub}</div>}
      </div>
    </Card>
  );
}

// Bloque de desglose (ingresos / egresos)
function BreakdownBlock({ title, icon, iconColor, rows, total, totalLabel, totalTone }) {
  return (
    <Card padding={18}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span style={{ display: "inline-flex", width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} color={iconColor} /></span>
        <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div>
        {rows.map((r, i) => <GSummaryRow key={i} first={i === 0} label={r.label} sub={r.sub} value={r.value} tone={r.tone} />)}
        <GSummaryRow strong label={totalLabel} value={total} tone={totalTone} />
      </div>
    </Card>
  );
}

function ScreenAnalisis({ vertical, consolidated, branch, state, inventoryOn, scenario, onNav, onToast, onRetry }) {
  const [period, setPeriod] = React.useState("mes");
  const [g, setG] = React.useState(() => AdminData.gastos(vertical));
  const [gastoModal, setGastoModal] = React.useState(null); // "fijo" | "variable"
  const [delG, setDelG] = React.useState(null); // {g, kind}

  React.useEffect(() => { setG(AdminData.gastos(vertical)); setPeriod("mes"); }, [vertical]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const COP = AdminData.COP;
  const a = AdminData.analysis(vertical, period, scenario);
  const empty = forceEmpty;
  const params = AdminData.finParams(vertical, branch, consolidated);
  const payDist = AdminData.payDistribution(vertical, period);
  const earn = AdminData.earningsBySpecialist(vertical, period);
  const invTrend = AdminData.inventoryTrend(vertical);
  const scope = consolidated ? "Todo el negocio" : branch;

  const addGasto = (form) => {
    if (gastoModal === "fijo") setG((s) => ({ ...s, fijos: [{ ...form, id: "gf-" + Date.now(), activo: true }, ...s.fijos] }));
    else setG((s) => ({ ...s, variables: [{ ...form, id: "gv-" + Date.now() }, ...s.variables] }));
    setGastoModal(null); onToast({ tone: "success", msg: "Gasto agregado" });
  };
  const doDeleteGasto = () => {
    const { g: item, kind } = delG;
    if (kind === "fijo") setG((s) => ({ ...s, fijos: s.fijos.map((x) => x.id === item.id ? { ...x, activo: false } : x) }));
    else setG((s) => ({ ...s, variables: s.variables.filter((x) => x.id !== item.id) }));
    setDelG(null); onToast({ tone: "info", msg: kind === "fijo" ? "Gasto fijo inactivado" : "Gasto variable eliminado" });
  };

  const fijosActivos = g.fijos.filter((x) => x.activo);

  if (error) return <div><AnalisisHeader scope={scope} period={period} setPeriod={setPeriod} onToast={onToast} /><ErrorState onRetry={onRetry} /></div>;

  return (
    <div>
      <AnalisisHeader scope={scope} period={period} setPeriod={setPeriod} onToast={onToast} />
      <ParamCard params={params} onEdit={() => onToast({ tone: "info", msg: "Configuración de parámetros · llega en el Lote 6" })} />

      {/* resumen */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${inventoryOn ? 4 : 3}, 1fr)`, gap: 14, marginBottom: 20 }}>
        {inventoryOn && <FinTile loading={loading} label="Inventario actual" icon="package" value={empty ? COP(0) : COP(a.inventarioValor)} sub={<span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>valor invertido</span>} />}
        <FinTile loading={loading} label="Ingresos del salón" icon="trending-up" value={empty ? COP(0) : COP(a.ingresosSalon)} />
        <FinTile loading={loading} label="Total gastos" icon="arrow-down-circle" value={empty ? COP(0) : COP(a.egresos)} tone="neg" />
        <FinTile loading={loading} big label="Ganancia neta" icon="wallet" value={empty ? COP(0) : COP(a.neta)} tone={a.neta < 0 ? "neg" : "pos"}
          sub={empty ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Sin datos del período</span> : <HealthBadge health={a.health} />} />
      </div>

      {loading ? (
        <Card padding={18}><Skeleton w="40%" h={16} /><div style={{ height: 16 }} /><Skeleton w="100%" h={120} /></Card>
      ) : empty ? (
        <Card padding={0}>
          <EmptyState icon="bar-chart-2" title="Sin movimientos en el período"
            desc={`No hay ingresos ni gastos registrados para “${AdminData.PERIOD_LABEL[period]}”. Cuando se registren citas y gastos, verás aquí el desglose.`} />
        </Card>
      ) : (
        <>
          {/* desglose ingresos / egresos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <BreakdownBlock title="Ingresos del salón" icon="trending-up" iconColor="var(--success)"
              rows={[
                { label: "Reparto neto de servicios", value: COP(a.repartoNetoSalon) },
                { label: "Valor de productos utilizados", value: COP(a.productosUsados) },
                { label: "Comisiones administrativas", value: COP(a.comisionesAdmin) },
              ]} total={COP(a.ingresosSalon)} totalLabel="Total ingresos" />
            <BreakdownBlock title="Egresos operativos" icon="arrow-down-circle" iconColor="var(--error)"
              rows={[
                { label: "Gastos fijos", value: `− ${COP(a.gastosFijos)}`, tone: "neg" },
                { label: "Gastos variables", value: `− ${COP(a.gastosVariables)}`, tone: "neg" },
                { label: "Comisiones bancarias", sub: "2%", value: `− ${COP(a.comisionesBancarias)}`, tone: "neg" },
              ]} total={`− ${COP(a.egresos)}`} totalLabel="Total egresos" totalTone="neg" />
          </div>

          {/* nota + ganancia neta destacada */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 24, alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 12, padding: "16px 18px", borderRadius: "var(--radius-md)", background: "var(--info-tint)", border: "1px solid rgba(59,130,246,0.22)" }}>
              <Icon name="info" size={18} color="var(--info)" style={{ flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "21px" }}>
                Los <strong style={{ color: "var(--text-primary)" }}>pagos a profesionales no se incluyen como egreso</strong>: su parte ({COP(a.profPayout)} este período) ya se separó en origen según la repartición. Aquí solo ves lo que corresponde al salón.
              </div>
            </div>
            <Card padding={18} style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: a.neta < 0 ? "var(--error-tint)" : "var(--surface-card)", borderColor: a.neta < 0 ? "rgba(239,68,68,0.3)" : "var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Ganancia neta</span>
                <HealthBadge health={a.health} />
              </div>
              <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: a.neta < 0 ? "var(--error)" : "var(--text-primary)", margin: "8px 0 2px" }}>{COP(a.neta)}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Margen de utilidad: <span className="data" style={{ fontWeight: 700, color: a.neta < 0 ? "var(--error)" : "var(--text-secondary)" }}>{a.margen.toFixed(1)}%</span></div>
            </Card>
          </div>

          {/* método de pago + ganancias por especialista */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Ingresos por método de pago</div>
              <Donut data={payDist} center={{ label: "Facturado", value: compactCOP(a.facturado) }} />
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Valor del inventario · tendencia</div>
              <VBars data={invTrend} accentLast />
            </Card>
          </div>

          <Card padding={18} style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Ganancias por especialista · {AdminData.PERIOD_LABEL[period].toLowerCase()}</div>
            <HBars data={earn} />
          </Card>

          {/* gestión de gastos */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: "var(--text-lg)", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Gestión de gastos</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card padding={18}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>Gastos fijos</span>
                <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setGastoModal("fijo")}>Agregar gasto</Button>
              </div>
              {fijosActivos.length === 0 ? <EmptyState compact icon="file-text" title="Sin gastos fijos" desc="Agrega tus gastos recurrentes." />
                : fijosActivos.map((x) => <ExpenseRow key={x.id} g={x} kind="fijo" COP={COP} onDelete={(item) => setDelG({ g: item, kind: "fijo" })} />)}
            </Card>
            <Card padding={18}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>Gastos variables</span>
                <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setGastoModal("variable")}>Agregar gasto</Button>
              </div>
              {g.variables.length === 0 ? <EmptyState compact icon="file-text" title="Sin gastos variables" desc="Agrega los gastos puntuales del período." />
                : g.variables.map((x) => <ExpenseRow key={x.id} g={x} kind="variable" COP={COP} onDelete={(item) => setDelG({ g: item, kind: "variable" })} />)}
            </Card>
          </div>
        </>
      )}

      <GastoModal open={!!gastoModal} kind={gastoModal} onClose={() => setGastoModal(null)} onSave={addGasto} />
      <GConfirm open={!!delG} danger
        title={delG && delG.kind === "fijo" ? "Inactivar gasto fijo" : "Eliminar gasto variable"}
        confirmLabel={delG && delG.kind === "fijo" ? "Inactivar" : "Eliminar"} confirmIcon="trash-2"
        desc={delG ? <span><strong style={{ color: "var(--text-primary)" }}>{delG.g.name}</strong> {delG.kind === "fijo" ? "se inactivará y dejará de sumar a los egresos (se conserva el historial)." : "se eliminará permanentemente del período."}</span> : ""}
        onClose={() => setDelG(null)} onConfirm={doDeleteGasto} />
    </div>
  );
}

function AnalisisHeader({ scope, period, setPeriod, onToast }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
        <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>Análisis financiero</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <PeriodSwitch value={period} onChange={setPeriod} />
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="md" iconLeft="download" onClick={() => onToast({ tone: "success", msg: "Análisis exportado (CSV)" })}>CSV</Button>
          <Button variant="secondary" size="md" iconLeft="file-text" onClick={() => onToast({ tone: "success", msg: "Análisis exportado (PDF)" })}>PDF</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenAnalisis, PeriodSwitch, FinTile });
