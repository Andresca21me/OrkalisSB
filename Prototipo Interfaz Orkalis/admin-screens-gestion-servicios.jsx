/* Orkalis — Panel Admin · Gestión 4.2 Servicios.
   Catálogo (con repartición) + Registro de servicios realizados. */

// ── Tarjeta de servicio ──────────────────────────────────────────────
function ServiceCard({ s, onEdit, onDelete }) {
  return (
    <Card padding={0} interactive style={{ display: "flex", flexDirection: "column", opacity: s.active ? 1 : 0.72 }}>
      <div style={{ padding: "16px 16px 0", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)", lineHeight: 1.2 }}>{s.name}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>{s.cat}</div>
          </div>
          <Badge tone={s.active ? "success" : "neutral"} dot>{s.active ? "Activo" : "Inactivo"}</Badge>
        </div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "12px 0 0", lineHeight: "20px", minHeight: 40 }}>{s.desc}</p>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 14 }}>
          <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{AdminData.COP(s.price)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}><Icon name="clock" size={14} color="var(--text-tertiary)" />{s.min} min</span>
        </div>

        {(s.custom || s.surcharge > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {s.surcharge > 0 && <Badge tone="warning"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={11} color="#B45309" />{`$${Math.round(s.surcharge / 1000)}k de back`}</span></Badge>}
            {s.custom && <Badge tone="brand"><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="percent" size={11} color="var(--brand)" />{`Reparto ${s.splitLabel}`}</span></Badge>}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 16px", marginTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
        <Button variant="secondary" size="sm" iconLeft="edit" onClick={() => onEdit(s)} style={{ flex: 1 }}>Editar</Button>
        <Button variant="secondary" size="sm" onClick={() => onDelete(s)} aria-label="Eliminar servicio" style={{ width: 40, padding: 0, color: "var(--error)" }}><Icon name="trash-2" size={16} color="var(--error)" /></Button>
      </div>
    </Card>
  );
}

// ── Editor de repartición (dentro del modal) ─────────────────────────
function SplitEditor({ price, split, onChange }) {
  const custom = split.mode !== "default";
  const setMode = (mode) => {
    if (mode === "off") return onChange({ mode: "default" });
    if (mode === "pct") return onChange({ mode: "pct", prof: split.prof != null ? split.prof : AdminData.DEFAULT_SPLIT, salon: split.salon != null ? split.salon : 100 - AdminData.DEFAULT_SPLIT });
    return onChange({ mode: "fijo", prof: split.prof != null && split.mode === "fijo" ? split.prof : Math.round((price || 0) * 0.6) });
  };
  const sum = (Number(split.prof) || 0) + (Number(split.salon) || 0);
  const pctInvalid = split.mode === "pct" && sum !== 100;
  const preview = AdminData.resolveSplit(price || 0, pctInvalid ? { mode: "default" } : split);

  return (
    <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: custom ? 16 : 0 }}>
        <GSwitch checked={custom} onChange={(v) => setMode(v ? "pct" : "off")} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Repartición personalizada</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{custom ? "Define cómo se reparte este servicio." : `Usa el reparto estándar ${AdminData.DEFAULT_SPLIT}% / ${100 - AdminData.DEFAULT_SPLIT}% (profesional / salón).`}</div>
        </div>
      </label>

      {custom && (
        <>
          <GSegmented size="sm" value={split.mode} onChange={(m) => setMode(m)} options={[
            { value: "pct", label: "Por porcentaje" },
            { value: "fijo", label: "Valor fijo" },
          ]} />

          {split.mode === "pct" ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <GField label="% Profesional"><GNumber value={split.prof} onChange={(v) => onChange({ ...split, prof: v, salon: 100 - (Number(v) || 0) })} min={0} suffix="%" invalid={pctInvalid} /></GField>
                <GField label="% Salón"><GNumber value={split.salon} onChange={(v) => onChange({ ...split, salon: v, prof: 100 - (Number(v) || 0) })} min={0} suffix="%" invalid={pctInvalid} /></GField>
              </div>
              {pctInvalid && <div style={{ fontSize: "var(--text-xs)", color: "var(--error)", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8 }}><Icon name="alert-circle" size={13} color="var(--error)" />Los porcentajes deben sumar 100% (actual: {sum}%).</div>}
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <GField label="Valor fijo al profesional" hint="El resto queda para el salón."><GMoney value={split.prof} onChange={(v) => onChange({ ...split, prof: v })} /></GField>
            </div>
          )}

          {/* preview de montos */}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius-xs)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Profesional</div>
              <div className="data" style={{ fontWeight: 700, color: "var(--brand)" }}>{AdminData.COP(preview.prof)}</div>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius-xs)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Salón</div>
              <div className="data" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{AdminData.COP(preview.salon)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal: Servicio ──────────────────────────────────────────────────
function ServiceModal({ open, service, vertical, onClose, onSave }) {
  const cats = AdminData.serviceCategories(vertical);
  const blank = { name: "", desc: "", cat: cats[0], min: 30, price: "", active: true, split: { mode: "default" }, surcharge: 0 };
  const [f, setF] = React.useState(blank);
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => { if (open) { setTouched(false); setF(service ? { ...blank, ...service, split: service.split || { mode: "default" } } : { ...blank, cat: cats[0] }); } }, [open, service]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const nameErr = touched && !f.name.trim() ? "Escribe un nombre" : null;
  const priceErr = touched && (f.price === "" || f.price == null) ? "Indica un precio" : null;
  const splitInvalid = f.split.mode === "pct" && ((Number(f.split.prof) || 0) + (Number(f.split.salon) || 0)) !== 100;
  const valid = f.name.trim() && f.price !== "" && f.price != null && !splitInvalid;
  const save = () => { setTouched(true); if (valid) onSave(f); };

  return (
    <Dialog open={open} onClose={onClose} width={580}
      title={service ? "Editar servicio" : "Nuevo servicio"}
      subtitle={service ? service.name : "Define el servicio, su precio y cómo se reparte."}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" disabled={touched && !valid} onClick={save}>{service ? "Guardar cambios" : "Crear servicio"}</Button>
      </>}>
      <div style={{ padding: "8px 0 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Nombre del servicio" span={2} error={nameErr}><GInput value={f.name} onChange={set("name")} placeholder="Ej.: Corte + barba" invalid={!!nameErr} /></GField>
          <GField label="Descripción" span={2} optional><GArea value={f.desc} onChange={set("desc")} placeholder="Qué incluye el servicio…" rows={2} /></GField>
          <GField label="Categoría"><GSelect value={f.cat} onChange={set("cat")} options={cats} /></GField>
          <GField label="Duración"><GNumber value={f.min} onChange={set("min")} min={5} step={5} suffix="min" /></GField>
          <GField label="Precio" error={priceErr}><GMoney value={f.price} onChange={set("price")} invalid={!!priceErr} /></GField>
          <GField label="Sobrecargo de back" optional hint="Recargo fijo (servicios de back)"><GMoney value={f.surcharge} onChange={set("surcharge")} /></GField>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <GSwitch checked={f.active} onChange={set("active")} accent />
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Servicio activo</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Disponible para agendar y reservar en línea.</div>
          </div>
        </label>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Repartición</div>
          <SplitEditor price={Number(f.price) || 0} split={f.split} onChange={set("split")} />
        </div>
      </div>
    </Dialog>
  );
}

// ── Registro de servicios realizados ─────────────────────────────────
function RegistroTable({ rows }) {
  const th = { textAlign: "left", padding: "0 14px 10px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
  const td = { padding: "13px 14px", fontSize: "var(--text-sm)", color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>
            <th style={{ ...th, paddingLeft: 18 }}>Servicio</th>
            <th style={th}>Cliente</th>
            <th style={th}>Especialista</th>
            <th style={th}>Fecha</th>
            <th style={th}>Notas</th>
            <th style={{ ...th, textAlign: "right", paddingRight: 18 }}>Precio</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, paddingLeft: 18, fontWeight: 600 }}>{r.service}</td>
                <td style={td}>{r.client}</td>
                <td style={{ ...td, color: "var(--text-secondary)" }}>{r.specialist}</td>
                <td style={{ ...td, color: "var(--text-secondary)", whiteSpace: "nowrap" }}><span className="data">{AdminData.fmtDate(r.date)}</span> · {r.time}</td>
                <td style={{ ...td, color: "var(--text-tertiary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</td>
                <td style={{ ...td, textAlign: "right", paddingRight: 18 }}><span className="data" style={{ fontWeight: 700 }}>{AdminData.COP(r.price)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Pantalla Servicios ───────────────────────────────────────────────
function ScreenServicios({ vertical, consolidated, branch, state, onToast, onRetry }) {
  const [sub, setSub] = React.useState("catalogo");
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState("todas");
  const [list, setList] = React.useState(() => AdminData.servicesCatalog(vertical));
  const [formOpen, setFormOpen] = React.useState(false);
  const [editS, setEditS] = React.useState(null);
  const [delS, setDelS] = React.useState(null);

  React.useEffect(() => { setList(AdminData.servicesCatalog(vertical)); setQuery(""); setCat("todas"); }, [vertical]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const cats = AdminData.serviceCategories(vertical);
  const active = forceEmpty ? [] : list.filter((s) => !s.deleted);
  const stats = { total: active.length, active: active.filter((s) => s.active).length, avg: active.filter((s) => s.active).length ? Math.round(active.filter((s) => s.active).reduce((a, s) => a + s.price, 0) / active.filter((s) => s.active).length) : 0 };

  const q = query.trim().toLowerCase();
  let filtered = active;
  if (cat !== "todas") filtered = filtered.filter((s) => s.cat === cat);
  if (q) filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));

  const registry = forceEmpty ? [] : AdminData.serviceRegistry(vertical);
  const scope = consolidated ? "Todo el negocio" : branch;

  const openCreate = () => { setEditS(null); setFormOpen(true); };
  const openEdit = (s) => { setEditS(s); setFormOpen(true); };
  const saveService = (form) => {
    const splitLabel = form.split.mode === "pct" ? `${form.split.prof}% / ${form.split.salon}%` : form.split.mode === "fijo" ? `Fijo ${AdminData.COP(form.split.prof)}` : `${AdminData.DEFAULT_SPLIT}% / ${100 - AdminData.DEFAULT_SPLIT}%`;
    const decorated = { ...form, custom: form.split.mode !== "default", splitLabel };
    if (editS) { setList((l) => l.map((s) => s.id === editS.id ? { ...s, ...decorated } : s)); onToast({ tone: "success", msg: "Servicio actualizado" }); }
    else { setList((l) => [{ ...decorated, id: "svc-" + Date.now() }, ...l]); onToast({ tone: "success", msg: "Servicio creado" }); }
    setFormOpen(false); setEditS(null);
  };
  const doDelete = (s) => { setList((l) => l.map((x) => x.id === s.id ? { ...x, deleted: true } : x)); setDelS(null); onToast({ tone: "info", msg: `${s.name} dado de baja` }); };

  return (
    <div>
      <PageHeader eyebrow={scope} title="Servicios" sub="Catálogo del negocio y registro de lo realizado."
        right={sub === "catalogo" && <Button variant="primary" size="md" iconLeft="plus" onClick={openCreate}>Nuevo servicio</Button>} />

      <div style={{ marginBottom: 20 }}>
        <TabsUnderline tabs={[{ value: "catalogo", label: "Catálogo" }, { value: "registro", label: "Registro" }]} value={sub} onChange={setSub} />
      </div>

      {sub === "catalogo" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
            <StatTile label="Servicios" value={loading ? "—" : stats.total} icon="scissors" loading={loading} />
            <StatTile label="Activos" value={loading ? "—" : stats.active} icon="check-circle" loading={loading} accent />
            <StatTile label="Precio promedio" value={loading ? "—" : AdminData.COP(stats.avg)} icon="dollar-sign" loading={loading} />
          </div>

          {error ? <ErrorState onRetry={onRetry} /> : loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <Card key={i} padding={16}><Skeleton w="55%" h={16} /><div style={{ height: 14 }} /><Skeleton w="100%" h={36} /><div style={{ height: 14 }} /><Skeleton w="40%" h={22} /></Card>)}
            </div>
          ) : active.length === 0 ? (
            <Card padding={0}>
              <EmptyState icon="scissors" title="Aún no tienes servicios"
                desc="Crea tu primer servicio para poder agendarlo, cobrarlo y repartirlo."
                action={<Button variant="primary" size="md" iconLeft="plus" onClick={openCreate}>Nuevo servicio</Button>} />
            </Card>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ width: 220 }}><GSelect value={cat} onChange={setCat} options={[{ value: "todas", label: "Todas las categorías" }, ...cats.map((c) => ({ value: c, label: c }))]} /></div>
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar servicio…" width={300} />
              </div>
              {filtered.length === 0 ? (
                <Card padding={0}><EmptyState icon="search" title="Sin resultados" desc="Ningún servicio coincide con el filtro." action={<Button variant="secondary" size="md" onClick={() => { setQuery(""); setCat("todas"); }}>Limpiar filtros</Button>} /></Card>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {filtered.map((s) => <ServiceCard key={s.id} s={s} onEdit={openEdit} onDelete={(x) => setDelS(x)} />)}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* REGISTRO */
        error ? <ErrorState onRetry={onRetry} /> : loading ? (
          <Card padding={0}>{[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16, padding: "16px 18px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
              <Skeleton w="30%" h={14} /><Skeleton w="20%" h={14} /><Skeleton w="20%" h={14} /><div style={{ flex: 1 }} /><Skeleton w={70} h={14} />
            </div>
          ))}</Card>
        ) : registry.length === 0 ? (
          <Card padding={0}><EmptyState icon="list" title="Sin servicios registrados" desc="Cuando completes citas, el registro de servicios realizados aparecerá aquí en tiempo real." /></Card>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              <span style={{ display: "inline-flex", width: 7, height: 7, borderRadius: 999, background: "var(--success)" }} />
              Últimos {registry.length} servicios · se actualiza en tiempo real
            </div>
            <RegistroTable rows={registry} />
          </div>
        )
      )}

      <ServiceModal open={formOpen} service={editS} vertical={vertical} onClose={() => { setFormOpen(false); setEditS(null); }} onSave={saveService} />
      <GConfirm open={!!delS} title="Dar de baja el servicio" danger confirmLabel="Dar de baja" confirmIcon="trash-2"
        desc={delS ? <span><strong style={{ color: "var(--text-primary)" }}>{delS.name}</strong> dejará de estar disponible para agendar, pero su historial se conserva (borrado lógico).</span> : ""}
        onClose={() => setDelS(null)} onConfirm={() => doDelete(delS)} />
    </div>
  );
}

Object.assign(window, { ScreenServicios });
