/* Orkalis — Panel Admin · Gestión 4.3 Equipo (especialistas, disponibilidad,
   ganancias y liquidación). La liquidación y las ganancias individuales sólo
   se muestran si la partición por especialista está activa. */

// ── Tarjeta de especialista ──────────────────────────────────────────
function SpecialistCard({ s, particion, onToggle, onEdit, onDelete, COP }) {
  return (
    <Card padding={0} interactive style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={s.name} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{s.specialty}</div>
        </div>
        <RowMenu items={[
          { icon: "edit", label: "Editar", onClick: () => onEdit(s) },
          { divider: true },
          { icon: "trash-2", label: "Eliminar", danger: true, onClick: () => onDelete(s) },
        ]} />
      </div>

      {/* sucursales */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "12px 16px 0" }}>
        {s.branches && s.branches.map((b) => (
          <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 9px", borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>
            <Icon name="store" size={12} color="var(--text-tertiary)" />{b.split(" · ")[1] || b}
          </span>
        ))}
      </div>

      {/* disponibilidad */}
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "14px 16px 0", padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", cursor: "pointer" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: s.available ? "var(--success)" : "var(--warning)" }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{s.available ? "Libre" : "Ocupado"}</span>
        </span>
        <GSwitch checked={s.available} onChange={() => onToggle(s)} accent />
      </label>

      {/* ganancias / servicios */}
      {particion ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, margin: "14px 16px 0", borderTop: "1px solid var(--border-subtle)" }}>
          {[["Hoy", s.earn && s.earn.hoy], ["Semana", s.earn && s.earn.semana], ["Mes", s.earn && s.earn.mes]].map(([k, v], i) => (
            <div key={k} style={{ padding: "12px 0", borderLeft: i ? "1px solid var(--border-subtle)" : "none", paddingLeft: i ? 12 : 0 }}>
              <div className="data" style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{COP(v || 0)}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{k}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ margin: "14px 16px 0", padding: "12px 0", borderTop: "1px solid var(--border-subtle)" }}>
          <div className="data" style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{s.serviciosHoy || 0}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Servicios hoy</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 16px", marginTop: 8 }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{particion ? `${s.serviciosHoy || 0} servicios hoy` : ""}</span>
        <Button variant="secondary" size="sm" iconLeft="edit" onClick={() => onEdit(s)}>Editar</Button>
      </div>
    </Card>
  );
}

// ── Modal: Especialista ──────────────────────────────────────────────
function SpecialistModal({ open, specialist, vertical, onClose, onSave }) {
  const allBranches = SpecData.branches(vertical);
  const blank = { name: "", phone: "", email: "", specialty: "", hired: "", branches: [allBranches[0]], available: true, notes: "" };
  const [f, setF] = React.useState(blank);
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => { if (open) { setTouched(false); setF(specialist ? { notes: "", ...specialist, branches: specialist.branches || [allBranches[0]] } : blank); } }, [open, specialist]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const toggleBranch = (b) => setF((s) => ({ ...s, branches: s.branches.includes(b) ? s.branches.filter((x) => x !== b) : [...s.branches, b] }));
  const nameErr = touched && !f.name.trim() ? "Escribe un nombre" : null;
  const branchErr = touched && f.branches.length === 0 ? "Asigna al menos una sucursal" : null;
  const valid = f.name.trim() && f.branches.length > 0;
  const save = () => { setTouched(true); if (valid) onSave(f); };

  return (
    <Dialog open={open} onClose={onClose} width={580}
      title={specialist ? "Editar especialista" : "Nuevo especialista"}
      subtitle={specialist ? specialist.name : "Registra a un miembro del equipo y asígnalo a una o varias sucursales."}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={save}>{specialist ? "Guardar cambios" : "Crear especialista"}</Button>
      </>}>
      <div style={{ padding: "8px 0 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Nombre completo" span={2} error={nameErr}><GInput value={f.name} onChange={set("name")} placeholder="Ej.: Andrés Mejía" invalid={!!nameErr} /></GField>
          <GField label="Teléfono"><GInput value={f.phone} onChange={set("phone")} placeholder="300 000 0000" /></GField>
          <GField label="Correo" optional><GInput value={f.email} onChange={set("email")} type="email" placeholder="nombre@orkalis.co" /></GField>
          <GField label="Especialidad"><GInput value={f.specialty} onChange={set("specialty")} placeholder={vertical === "salon" ? "Ej.: Colorista" : "Ej.: Barbero senior"} /></GField>
          <GField label="Fecha de contratación" optional><GInput value={f.hired} onChange={set("hired")} placeholder="aaaa-mm-dd" /></GField>
        </div>

        <GField label="Asignación a sucursales" error={branchErr}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allBranches.map((b) => {
              const on = f.branches.includes(b);
              return (
                <button key={b} type="button" onClick={() => toggleBranch(b)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", cursor: "pointer", textAlign: "left",
                  borderRadius: "var(--radius-sm)", background: on ? "var(--brand-tint)" : "var(--surface-card)",
                  border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: "var(--radius-xs)", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: on ? "var(--brand)" : "var(--surface-card)", border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}` }}>{on && <Icon name="check" size={13} color="#fff" />}</span>
                  <Icon name="store" size={15} color="var(--text-tertiary)" />
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>{b}</span>
                </button>
              );
            })}
          </div>
        </GField>

        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <GSwitch checked={f.available} onChange={set("available")} accent />
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Disponible (libre)</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Aparece como libre para recibir citas.</div>
          </div>
        </label>

        <GField label="Notas" optional><GArea value={f.notes} onChange={set("notes")} placeholder="Horario, especialidades, observaciones…" rows={2} /></GField>
      </div>
    </Dialog>
  );
}

// ── Calculadora de liquidación ───────────────────────────────────────
function LiquidationPanel({ vertical, onToast }) {
  const teamList = AdminData.team(vertical);
  const months = AdminData.liquidationMonths();
  const [spId, setSpId] = React.useState(teamList[0].id);
  const [month, setMonth] = React.useState(months[0].key);
  const [pay, setPay] = React.useState("efectivo");
  React.useEffect(() => { setSpId(teamList[0].id); setMonth(months[0].key); setPay("efectivo"); }, [vertical]);

  const liq = AdminData.liquidation(vertical, spId, month, pay);
  const COP = AdminData.COP;

  const th = { textAlign: "left", padding: "0 12px 9px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
  const td = { padding: "11px 12px", fontSize: "var(--text-sm)", color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };
  const numTd = { ...td, textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" };

  return (
    <div>
      {/* selección */}
      <Card padding={18} style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr auto", gap: 16, alignItems: "end" }}>
          <GField label="Especialista"><GSelect value={spId} onChange={setSpId} options={teamList.map((s) => ({ value: s.id, label: s.name }))} /></GField>
          <GField label="Mes"><GSelect value={month} onChange={setMonth} options={months.map((m) => ({ value: m.key, label: m.label }))} /></GField>
          <GField label="Forma de pago">
            <GSegmented value={pay} onChange={setPay} options={[{ value: "efectivo", label: "Efectivo" }, { value: "transferencia", label: "Transferencia" }]} />
          </GField>
        </div>
      </Card>

      {liq.empty ? (
        <Card padding={0}>
          <EmptyState icon="calendar-x" title="Sin actividad este mes"
            desc={`${liq.sp.name} no tiene servicios registrados en ${AdminData.monthLabel(month)}. Elige otro mes para liquidar.`} />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: 20, alignItems: "start" }}>
          {/* resumen */}
          <Card padding={20}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div className="eyebrow">Resumen · {AdminData.monthLabel(month)}</div>
              {pay === "transferencia" && <Badge tone="info">−2% transfer.</Badge>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "10px 0 6px" }}>
              <Avatar name={liq.sp.name} size={40} />
              <div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{liq.sp.name}</div><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{liq.sp.specialty}</div></div>
            </div>

            <div style={{ marginTop: 8 }}>
              <GSummaryRow first label="Ganancias brutas" value={COP(liq.summary.brutas)} />
              <GSummaryRow label="Costo de productos" value={`− ${COP(liq.summary.costoProductos)}`} tone="neg" />
              <GSummaryRow label="Comisión back" value={`− ${COP(liq.summary.comisionBack)}`} tone="neg" />
              <GSummaryRow label="Comisión bancaria" sub="2,5%" value={`− ${COP(liq.summary.comisionBancaria)}`} tone="neg" />
              <GSummaryRow label="Deducción administrativa" value={`− ${COP(liq.summary.deduccionAdmin)}`} tone="neg" />
              {liq.summary.descTransfer > 0 && <GSummaryRow label="Descuento por transferencia" sub="2%" value={`− ${COP(liq.summary.descTransfer)}`} tone="neg" />}
              <GSummaryRow label="Comisión por ventas" value={`+ ${COP(liq.summary.comisionVentas)}`} tone="pos" />
              <GSummaryRow strong label="Total neto a pagar" value={COP(liq.summary.neto)} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ flex: 1 }}><div className="data" style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{liq.summary.totalServicios}</div><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Servicios</div></div>
              <div style={{ flex: 1 }}><div className="data" style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{COP(liq.summary.promedio)}</div><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Promedio</div></div>
            </div>

            <Button variant="primary" size="md" iconLeft="download" fullWidth style={{ marginTop: 18 }}
              onClick={() => onToast({ tone: "success", msg: `Liquidación de ${liq.sp.name.split(" ")[0]} exportada (PDF)` })}>Exportar liquidación (PDF)</Button>
          </Card>

          {/* detalle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Detalle de servicios</div>
              <Card padding={0} style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                    <thead><tr>
                      <th style={{ ...th, paddingLeft: 16 }}>Fecha</th><th style={th}>Servicio</th><th style={th}>Reparto</th>
                      <th style={{ ...th, textAlign: "right" }}>Profesional</th><th style={{ ...th, textAlign: "right" }}>Salón</th><th style={{ ...th, textAlign: "right", paddingRight: 16 }}>Productos</th>
                    </tr></thead>
                    <tbody>
                      {liq.rows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...td, paddingLeft: 16, whiteSpace: "nowrap" }}><span className="data" style={{ color: "var(--text-secondary)" }}>{AdminData.fmtDate(r.date)}</span></td>
                          <td style={{ ...td, fontWeight: 500 }}>{r.service}</td>
                          <td style={td}><Badge tone={r.repLabel === "Estándar" ? "neutral" : "brand"}>{r.repLabel}</Badge></td>
                          <td style={{ ...numTd, color: "var(--brand)", fontWeight: 700 }}>{COP(r.prof)}</td>
                          <td style={numTd}>{COP(r.salon)}</td>
                          <td style={{ ...numTd, paddingRight: 16, color: r.productCost ? "var(--text-primary)" : "var(--text-tertiary)" }}>{r.productCost ? `− ${COP(r.productCost)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Ventas de productos · comisión 10%</div>
              <Card padding={0} style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 16 }}>Producto</th><th style={{ ...th, textAlign: "right" }}>Cant.</th>
                    <th style={{ ...th, textAlign: "right" }}>Total</th><th style={{ ...th, textAlign: "right", paddingRight: 16 }}>Comisión</th>
                  </tr></thead>
                  <tbody>
                    {liq.ventas.map((v, i) => (
                      <tr key={i}>
                        <td style={{ ...td, paddingLeft: 16, fontWeight: 500 }}>{v.product}</td>
                        <td style={numTd}>{v.qty}</td>
                        <td style={numTd}>{COP(v.total)}</td>
                        <td style={{ ...numTd, paddingRight: 16, color: "var(--success)", fontWeight: 700 }}>+ {COP(v.comision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pantalla Equipo ──────────────────────────────────────────────────
function ScreenEquipo({ vertical, consolidated, branch, state, particion, onToast, onRetry }) {
  const [filter, setFilter] = React.useState("todos");
  const [list, setList] = React.useState(() => AdminData.team(vertical));
  const [formOpen, setFormOpen] = React.useState(false);
  const [editS, setEditS] = React.useState(null);
  const [delS, setDelS] = React.useState(null);
  const COP = AdminData.COP;

  React.useEffect(() => { setList(AdminData.team(vertical)); setFilter("todos"); }, [vertical]);
  React.useEffect(() => { if (!particion && filter === "liquidacion") setFilter("todos"); }, [particion]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const all = forceEmpty ? [] : list.filter((s) => !s.deleted);
  const libres = all.filter((s) => s.available).length;
  const stats = {
    activos: all.length, libres,
    serviciosHoy: all.reduce((a, s) => a + (s.serviciosHoy || 0), 0),
    gananciasHoy: all.reduce((a, s) => a + ((s.earn && s.earn.hoy) || 0), 0),
    gananciasMes: all.reduce((a, s) => a + ((s.earn && s.earn.mes) || 0), 0),
  };
  let filtered = all;
  if (filter === "libres") filtered = all.filter((s) => s.available);
  else if (filter === "ocupados") filtered = all.filter((s) => !s.available);

  const scope = consolidated ? "Todo el negocio" : branch;
  const toggleAvail = (s) => { setList((l) => l.map((x) => x.id === s.id ? { ...x, available: !x.available } : x)); onToast({ tone: "info", msg: `${s.name.split(" ")[0]} ahora está ${s.available ? "ocupado" : "libre"}` }); };
  const openCreate = () => { setEditS(null); setFormOpen(true); };
  const openEdit = (s) => { setEditS(s); setFormOpen(true); };
  const saveSpec = (form) => {
    if (editS) { setList((l) => l.map((s) => s.id === editS.id ? { ...s, ...form } : s)); onToast({ tone: "success", msg: "Especialista actualizado" }); }
    else { setList((l) => [{ id: "sp-" + Date.now(), serviciosHoy: 0, earn: { hoy: 0, semana: 0, mes: 0 }, picks: [], ...form }, ...l]); onToast({ tone: "success", msg: "Especialista creado" }); }
    setFormOpen(false); setEditS(null);
  };
  const doDelete = (s) => { setList((l) => l.map((x) => x.id === s.id ? { ...x, deleted: true } : x)); setDelS(null); onToast({ tone: "info", msg: `${s.name} dado de baja` }); };

  const filterTabs = [
    { value: "todos", label: "Todos" }, { value: "libres", label: "Libres" }, { value: "ocupados", label: "Ocupados" },
    ...(particion ? [{ value: "liquidacion", label: "Liquidación" }] : []),
  ];
  const specLabel = vertical === "salon" ? "Especialistas" : "Barberos";

  return (
    <div>
      <PageHeader eyebrow={scope} title="Equipo" sub={`Gestiona a tu equipo, su disponibilidad${particion ? ", ganancias y liquidaciones" : ""}.`}
        right={<Button variant="primary" size="md" iconLeft="user-plus" onClick={openCreate}>Nuevo {specLabel.toLowerCase().slice(0, -1)}</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${particion ? 4 : 2}, 1fr)`, gap: 14, marginBottom: 20 }}>
        <StatTile label={`${specLabel} activos`} value={loading ? "—" : `${stats.activos}`} icon="users" loading={loading} />
        <StatTile label="Libres ahora" value={loading ? "—" : `${stats.libres} de ${stats.activos}`} icon="check-circle" loading={loading} accent={stats.libres > 0} />
        {particion && <StatTile label="Ganancias de hoy" value={loading ? "—" : COP(stats.gananciasHoy)} icon="dollar-sign" loading={loading} />}
        {particion && <StatTile label="Ganancias del mes" value={loading ? "—" : COP(stats.gananciasMes)} icon="trending-up" loading={loading} />}
      </div>

      <div style={{ marginBottom: 20 }}>
        <TabsUnderline tabs={filterTabs} value={filter} onChange={setFilter} />
      </div>

      {filter === "liquidacion" ? (
        <LiquidationPanel vertical={vertical} onToast={onToast} />
      ) : error ? <ErrorState onRetry={onRetry} /> : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {[0, 1, 2].map((i) => <Card key={i} padding={16}><div style={{ display: "flex", gap: 12 }}><Skeleton w={46} h={46} r={99} /><div style={{ flex: 1 }}><Skeleton w="60%" h={15} /><div style={{ height: 8 }} /><Skeleton w="40%" h={12} /></div></div><div style={{ height: 16 }} /><Skeleton w="100%" h={44} /></Card>)}
        </div>
      ) : all.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon="users" title={`Aún no tienes ${specLabel.toLowerCase()}`}
            desc="Agrega a tu equipo para asignar citas, medir su desempeño y liquidar sus ganancias."
            action={<Button variant="primary" size="md" iconLeft="user-plus" onClick={openCreate}>Nuevo {specLabel.toLowerCase().slice(0, -1)}</Button>} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding={0}><EmptyState icon="users" title="Sin coincidencias" desc={`No hay ${specLabel.toLowerCase()} ${filter === "libres" ? "libres" : "ocupados"} en este momento.`} action={<Button variant="secondary" size="md" onClick={() => setFilter("todos")}>Ver todos</Button>} /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map((s) => <SpecialistCard key={s.id} s={s} particion={particion} COP={COP} onToggle={toggleAvail} onEdit={openEdit} onDelete={(x) => setDelS(x)} />)}
        </div>
      )}

      <SpecialistModal open={formOpen} specialist={editS} vertical={vertical} onClose={() => { setFormOpen(false); setEditS(null); }} onSave={saveSpec} />
      <GConfirm open={!!delS} title="Dar de baja al especialista" danger confirmLabel="Dar de baja" confirmIcon="user-x"
        desc={delS ? <span><strong style={{ color: "var(--text-primary)" }}>{delS.name}</strong> dejará de aparecer en el equipo, pero su historial de servicios y liquidaciones se conserva (borrado lógico).</span> : ""}
        onClose={() => setDelS(null)} onConfirm={() => doDelete(delS)} />
    </div>
  );
}

Object.assign(window, { ScreenEquipo, LiquidationPanel });
