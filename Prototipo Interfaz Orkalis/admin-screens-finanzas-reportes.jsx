/* Orkalis — Panel Admin · Finanzas 5.3 Reportes y Gráficos.
   Administrativo (implementado) | Por profesional (en desarrollo). */

function ScreenReportes({ vertical, consolidated, branch, state, particion, onToast, onRetry }) {
  const [tipo, setTipo] = React.useState("admin");
  const [period, setPeriod] = React.useState("mes");
  const [resetOpen, setResetOpen] = React.useState(false);

  React.useEffect(() => { setTipo("admin"); setPeriod("mes"); }, [vertical]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const COP = AdminData.COP;
  const rep = AdminData.adminReport(vertical, period);
  const trend = AdminData.revenueTrend(vertical, period);
  const svcDist = AdminData.serviceDistribution(vertical);
  const payDist = AdminData.payDistribution(vertical, period);
  const ranking = AdminData.specialistRanking(vertical, period);
  const scope = consolidated ? "Todo el negocio" : branch;
  const empty = forceEmpty;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>Reportes y gráficos</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="md" iconLeft="refresh-cw" onClick={() => onToast({ tone: "success", msg: "Reporte actualizado" })}>Refrescar</Button>
          <Button variant="secondary" size="md" iconLeft="download" onClick={() => onToast({ tone: "success", msg: "Reporte exportado (CSV)" })}>CSV</Button>
          <Button variant="secondary" size="md" iconLeft="file-text" onClick={() => onToast({ tone: "success", msg: "Reporte exportado (PDF)" })}>PDF</Button>
        </div>
      </div>

      {/* controles */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600 }}>Tipo de reporte</div>
          <GSegmented value={tipo} onChange={setTipo} options={[
            { value: "admin", label: "Administrativo" },
            { value: "profesional", label: "Por profesional" },
          ]} />
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600 }}>Período</div>
          <GSegmented value={period} onChange={setPeriod} options={[
            { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }, { value: "ano", label: "Año" },
          ]} />
        </div>
      </div>

      {error ? <ErrorState onRetry={onRetry} /> : tipo === "profesional" ? (
        <Card padding={0}>
          <div style={{ padding: "64px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", width: 56, height: 56, borderRadius: "var(--radius-lg)", background: "var(--brand-tint)", alignItems: "center", justifyContent: "center", marginBottom: 6 }}><Icon name="users" size={26} color="var(--brand)" /></span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <h3 style={{ fontSize: "var(--text-md)", color: "var(--text-primary)" }}>Reporte por profesional</h3>
              <Badge tone="warning">En desarrollo</Badge>
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 420, margin: 0, lineHeight: "21px" }}>
              {particion ? "Estamos construyendo el análisis individual por profesional (servicios, ganancias y comisiones). Estará disponible próximamente."
                : "Este reporte requiere la partición por especialista, que está desactivada. Actívala en Configuración para habilitar el desglose individual."}
            </p>
          </div>
        </Card>
      ) : loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            {[0, 1, 2, 3].map((i) => <Card key={i} padding={18}><Skeleton w={90} h={12} /><div style={{ height: 12 }} /><Skeleton w={110} h={24} /></Card>)}
          </div>
          <Card padding={18}><Skeleton w="40%" h={16} /><div style={{ height: 16 }} /><Skeleton w="100%" h={140} /></Card>
        </>
      ) : empty ? (
        <Card padding={0}>
          <EmptyState icon="bar-chart-2" title="Sin datos en el período"
            desc={`No hay actividad registrada para “${AdminData.PERIOD_LABEL[period]}”. Los gráficos aparecerán cuando se registren servicios.`} />
        </Card>
      ) : (
        <>
          {/* resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            <FinTile label="Ingresos totales" icon="dollar-sign" value={COP(rep.ingresosTotales)} sub={<span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{rep.servicios} servicios</span>} />
            <FinTile label="Ganaron los profesionales" icon="users" value={COP(rep.profesionales)} />
            <FinTile label="Ganó el salón" icon="wallet" value={COP(rep.salon)} />
            <FinTile label="Productos usados" icon="package" value={COP(rep.productosUsados)} />
          </div>

          {/* desglose ganancias del salón */}
          <Card padding={18} style={{ marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Desglose de ganancias del salón</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              <div>
                <GSummaryRow first label="Porción del valor neto" value={COP(rep.breakdown.valorNeto)} />
                <GSummaryRow label="Valor de productos" value={COP(rep.breakdown.productos)} />
                <GSummaryRow label="Comisión administrativa" value={COP(rep.breakdown.comisionAdmin)} />
              </div>
              <div>
                <GSummaryRow first label="Comisiones bancarias" value={`− ${COP(rep.breakdown.comisionBancaria)}`} tone="neg" />
                <GSummaryRow strong label="Total neto del salón" value={COP(rep.breakdown.totalNeto)} />
              </div>
            </div>
          </Card>

          {/* gráficos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Tendencia de ingresos · {AdminData.PERIOD_LABEL[period].toLowerCase()}</div>
              <VBars data={trend} accentLast />
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Distribución por tipo de servicio</div>
              <Donut data={svcDist} center={{ label: "Servicios", value: rep.servicios }} />
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Distribución por método de pago</div>
              <Donut data={payDist} center={{ label: "Facturado", value: compactCOP(rep.ingresosTotales) }} />
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Ranking de profesionales</div>
              {particion ? <HBars data={ranking} valueFmt={(d) => compactCOP(d.ingresos)} />
                : <div style={{ padding: "20px 8px", fontSize: "var(--text-sm)", color: "var(--text-tertiary)", textAlign: "center" }}>El ranking por profesional requiere la partición por especialista (desactivada).</div>}
            </Card>
          </div>

          {/* reinicio administrativo protegido */}
          <Card padding={0} style={{ overflow: "hidden", borderColor: "rgba(239,68,68,0.28)" }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ display: "inline-flex", width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--error-tint)", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="alert-octagon" size={18} color="var(--error)" /></span>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Reinicio administrativo</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Archiva el reporte actual y pone los acumulados en cero. Acción protegida.</div>
                </div>
              </div>
              <Button variant="danger" size="md" iconLeft="rotate-ccw" onClick={() => setResetOpen(true)}>Archivar y reiniciar</Button>
            </div>
          </Card>
        </>
      )}

      <GConfirm open={resetOpen} danger title="Reinicio administrativo" confirmLabel="Sí, archivar y reiniciar" confirmIcon="rotate-ccw"
        desc={<span>El reporte administrativo actual se archivará en el histórico y los acumulados volverán a cero. Esta acción no se puede deshacer; exporta antes si lo necesitas.</span>}
        onClose={() => setResetOpen(false)} onConfirm={() => { setResetOpen(false); onToast({ tone: "success", msg: "Reporte archivado · acumulados en cero" }); }} />
    </div>
  );
}

Object.assign(window, { ScreenReportes });
