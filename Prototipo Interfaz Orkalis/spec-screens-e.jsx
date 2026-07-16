/* Orkalis — app del especialista (parte E): 2.7 Mis ganancias · 2.8 Perfil */

// ════════════════════════ 2.7 MIS GANANCIAS ════════════════════════
function ScreenGanancias({ data, turnos, partitionOn, period, onPeriod, earnState }) {
  const split = SpecData.SPLIT;
  const completed = turnos.filter((t) => t.status === "Completada");
  const todayTotal = completed.reduce((a, t) => a + Math.round(t.total * split.service), 0);
  const agg = SpecData.earnings(data.vertical);
  const periodData = period === "hoy"
    ? { total: todayTotal, servicios: completed.length, comisiones: 0, list: completed }
    : period === "semana" ? { ...agg.semana, list: completed }
    : { ...agg.mes, list: completed };

  const avg = periodData.servicios ? Math.round((periodData.total - (periodData.comisiones || 0)) / periodData.servicios) : 0;

  // Variante sin reparto individual
  if (!partitionOn) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <SpecHeader title="Mis ganancias" />
        <ScrollArea>
          <div style={{ padding: 20 }}>
            <EmptyState icon="building" title="Este negocio no maneja reparto individual"
              body={`${data.business.name} no tiene activada la partición de ganancias por especialista, así que aquí no se muestran montos individuales. Tu actividad sí queda registrada para el negocio.`} />
            <Card padding={16} style={{ marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 10, flex: "none", background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check-circle" size={20} color="var(--brand)" /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{completed.length} turnos completados hoy</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Tu desempeño del día queda registrado</div>
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SpecHeader title="Mis ganancias" />
      <div style={{ flex: "none", padding: "14px 20px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        <Segmented options={[{ value: "hoy", label: "Hoy" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }]} value={period} onChange={onPeriod} />
      </div>

      <ScrollArea>
        {earnState === "cargando" ? (
          <div style={{ padding: 20 }}><Skeleton h={130} r={16} style={{ marginBottom: 18 }} /><div style={{ display: "flex", gap: 10, marginBottom: 18 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={8} style={{ flex: 1 }} />)}</div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={60} r={8} />)}</div></div>
        ) : (period === "hoy" && completed.length === 0) ? (
          <EmptyState icon="dollar-sign" title="Aún sin ganancias hoy" body="Cuando completes tu primer turno del día verás aquí tu total y el desglose." />
        ) : (
          <div style={{ padding: 20 }}>
            {/* Total destacado */}
            <div style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", background: "var(--navy)", padding: "22px 20px", marginBottom: 18, position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.6 }} />
              <div style={{ position: "relative" }}>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Tus ganancias · {period === "hoy" ? "hoy" : period === "semana" ? "esta semana" : "este mes"}</div>
                <div className="data" style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-4xl)", letterSpacing: "-0.03em", marginTop: 6 }}>{OrkData.COP(periodData.total)}</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "var(--text-xs)", marginTop: 6 }}>Servicios (60%) + comisiones por venta de productos</div>
              </div>
            </div>

            {/* Desglose */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
              <DayStat value={periodData.servicios} label="Servicios" />
              <DayStat value={OrkData.COP(avg)} label="Prom./serv." mono />
              <DayStat value={OrkData.COP(periodData.comisiones || 0)} label="Comisiones" mono accent />
            </div>

            {/* Lista de turnos completados */}
            <SectionLabel>Turnos completados {period === "hoy" ? "hoy" : `· ${periodData.servicios}`}</SectionLabel>
            {completed.length === 0 ? (
              <Card padding={18}><div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>El detalle por turno del período aparece aquí.</div></Card>
            ) : (
              <Card padding={0}>
                {completed.map((t, i) => (
                  <React.Fragment key={t.id}>
                    {i > 0 && <div style={{ height: 1, background: "var(--border-subtle)" }} />}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                      <span className="data" style={{ flex: "none", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-tertiary)", minWidth: 42 }}>{t.time}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.clientName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.services.map((s) => s.name).join(" · ")}</div>
                      </div>
                      <span className="data" style={{ flex: "none", fontWeight: 700, fontSize: "var(--text-sm)", color: "#0A8F5B" }}>+{OrkData.COP(Math.round(t.total * split.service))}</span>
                    </div>
                  </React.Fragment>
                ))}
              </Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ════════════════════════ 2.8 PERFIL ════════════════════════
function ScreenPerfil({ data, me, available, branch, branches, onToggleAvailable, onPickBranch, onLogout, onOpenPublic }) {
  const [confirmBranch, setConfirmBranch] = React.useState(null);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SpecHeader title="Perfil" />
      <ScrollArea>
        <div style={{ padding: 20 }}>
          {/* Identidad */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <Avatar name={me.name} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{me.name}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{me.role} · {data.business.name}</div>
            </div>
          </div>

          {/* Disponibilidad */}
          <SectionLabel>Disponibilidad</SectionLabel>
          <Card padding={16} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{available ? "Disponible" : "Ocupado"}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: "17px", marginTop: 2 }}>{available ? "Tus franjas libres se ofrecen en el enlace de reservas." : "Tus franjas dejan de ofrecerse en el enlace público."}</div>
              </div>
              <Switch checked={available} onChange={onToggleAvailable} tone="success" />
            </div>
          </Card>

          {/* Sucursal activa */}
          {branches.length > 1 && (
            <>
              <SectionLabel>Sucursal activa</SectionLabel>
              <Card padding={0} style={{ marginBottom: 18 }}>
                {branches.map((b, i) => {
                  const on = b === branch;
                  return (
                    <React.Fragment key={b}>
                      {i > 0 && <div style={{ height: 1, background: "var(--border-subtle)" }} />}
                      <button type="button" onClick={() => !on && setConfirmBranch(b)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", border: "none", background: "transparent", cursor: on ? "default" : "pointer", textAlign: "left", fontFamily: "var(--font-body)" }}>
                        <Icon name="building" size={18} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
                        <span style={{ flex: 1, fontWeight: on ? 600 : 500, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{b}</span>
                        {on ? <Badge tone="brand" dot>Activa</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />}
                      </button>
                    </React.Fragment>
                  );
                })}
              </Card>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: -8, marginBottom: 18, paddingLeft: 2 }}>Tu agenda y disponibilidad se gestionan para la sede activa.</div>
            </>
          )}

          {/* Atajo al enlace público */}
          <SectionLabel>Enlace de reservas</SectionLabel>
          <Card interactive padding={14} onClick={onOpenPublic} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 9, flex: "none", background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="navigation" size={18} color="var(--brand)" /></span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>Ver el enlace público</div><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Así reservan tus clientes (Lote 1)</div></div>
              <Icon name="arrow-right" size={18} color="var(--text-tertiary)" />
            </div>
          </Card>

          {/* Cerrar sesión */}
          <Button variant="secondary" size="lg" fullWidth iconLeft="log-out" onClick={onLogout}>Cerrar sesión</Button>
        </div>
      </ScrollArea>

      <Sheet open={!!confirmBranch} onClose={() => setConfirmBranch(null)} title="¿Cambiar de sucursal?"
        footer={<div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setConfirmBranch(null)}>Volver</Button>
          <Button size="lg" style={{ flex: 1 }} onClick={() => { onPickBranch(confirmBranch); setConfirmBranch(null); }}>Cambiar</Button>
        </div>}>
        <p style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: "22px" }}>Vas a operar en <strong style={{ color: "var(--text-primary)" }}>{confirmBranch}</strong>. Tu agenda y disponibilidad cambiarán a esta sede.</p>
      </Sheet>
    </div>
  );
}

Object.assign(window, { ScreenGanancias, ScreenPerfil });
