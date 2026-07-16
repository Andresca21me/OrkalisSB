/* Orkalis — Panel Admin · 3.3 Clientes (directorio + CRM básico) */

// Campo de formulario (label arriba — patrón de la casa)
function Field({ label, hint, children, half }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: half ? "span 1" : "1 / -1" }}>
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{hint}</span>}
    </label>
  );
}
function TextField({ value, onChange, placeholder, type = "text" }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input value={value} type={type} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        height: 42, padding: "0 12px", borderRadius: "var(--radius-xs)", outline: "none",
        border: `1px solid ${focus ? "var(--brand)" : "var(--border-default)"}`,
        boxShadow: focus ? "0 0 0 3px var(--brand-tint)" : "none",
        fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-primary)", background: "var(--surface-card)",
        transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
      }} />
  );
}

function ClientCard({ c, vertical, onEdit, onHistory, onDelete }) {
  const [menu, setMenu] = React.useState(false);
  return (
    <Card padding={0} interactive style={{ overflow: "visible", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={c.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
            {c.pro && <Badge tone="brand">Profesional</Badge>}
            {c.nuevo && !c.pro && <Badge tone="accent">Nuevo</Badge>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              <Icon name="phone" size={13} color="var(--text-tertiary)" />{c.phone}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Icon name="mail" size={13} color="var(--text-tertiary)" />{c.email || "Sin correo"}
            </span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <IconBtn icon="more-vertical" label="Acciones" onClick={() => setMenu((o) => !o)} />
          <Popover open={menu} onClose={() => setMenu(false)} align="right" width={196}>
            <MenuItem icon="edit" onClick={() => { onEdit(c); setMenu(false); }}>Editar</MenuItem>
            <MenuItem icon="clock" onClick={() => { onHistory(c); setMenu(false); }}>Ver historial</MenuItem>
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 4px" }} />
            <MenuItem icon="trash-2" danger onClick={() => { onDelete(c); setMenu(false); }}>Eliminar</MenuItem>
          </Popover>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, margin: "16px 16px 0", borderTop: "1px solid var(--border-subtle)" }}>
        {[
          { k: "Servicios", v: c.servicios },
          { k: "Gastado", v: AdminData.COP(c.gastado) },
          { k: "Última visita", v: c.ultima ? AdminData.fmtDate(c.ultima) : "—" },
        ].map((s, i) => (
          <div key={s.k} style={{ padding: "12px 0", borderLeft: i ? "1px solid var(--border-subtle)" : "none", paddingLeft: i ? 12 : 0 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.k}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 16px 16px" }}>
        <Button variant="secondary" size="sm" iconLeft="clock" onClick={() => onHistory(c)} style={{ flex: 1 }}>Historial</Button>
        <Button variant="secondary" size="sm" iconLeft="edit" onClick={() => onEdit(c)} style={{ flex: 1 }}>Editar</Button>
      </div>
    </Card>
  );
}

function ClientHistoryDialog({ open, client, vertical, onClose }) {
  if (!open || !client) return null;
  const rows = AdminData.clientHistory(vertical, client.id);
  const td = { padding: "12px 0", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)" };
  return (
    <Dialog open={open} onClose={onClose} width={580}
      title={client.name} subtitle={`${client.servicios} servicios · ${AdminData.COP(client.gastado)} en total`}
      footer={<Button variant="secondary" size="md" onClick={onClose}>Cerrar</Button>}>
      {rows.length === 0 ? (
        <EmptyState compact icon="clock" title="Sin servicios registrados" desc="Este cliente aún no tiene visitas en el historial." />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <thead><tr>
            {["Fecha", "Servicio", "Especialista", "Pago", "Monto"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 4 ? "right" : "left", padding: "0 0 8px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, whiteSpace: "nowrap" }}><span className="data">{AdminData.fmtDate(r.date)}</span></td>
                <td style={td}>{r.service}</td>
                <td style={{ ...td, color: "var(--text-secondary)" }}>{r.specialist}</td>
                <td style={{ ...td, color: "var(--text-secondary)" }}>{r.payment}</td>
                <td style={{ ...td, textAlign: "right" }}><span className="data" style={{ fontWeight: 600 }}>{AdminData.COP(r.amount)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}

function ClientFormDialog({ open, client, onClose, onSave }) {
  const blank = { name: "", phone: "", email: "", address: "", birth: "", notes: "", pro: false };
  const [form, setForm] = React.useState(blank);
  React.useEffect(() => { if (open) setForm(client ? { address: "", birth: "", notes: "", ...client } : blank); }, [open, client]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.phone.trim();
  return (
    <Dialog open={open} onClose={onClose} width={560}
      title={client ? "Editar cliente" : "Nuevo cliente"}
      subtitle={client ? "Actualiza los datos de contacto y notas." : "Registra un cliente para empezar a medir su actividad."}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" disabled={!valid} onClick={() => onSave(form)}>{client ? "Guardar cambios" : "Crear cliente"}</Button>
      </>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "8px 0 16px" }}>
        <Field label="Nombre completo"><TextField value={form.name} onChange={set("name")} placeholder="Ej.: Valentina Gómez" /></Field>
        <Field label="Teléfono" half><TextField value={form.phone} onChange={set("phone")} placeholder="300 000 0000" /></Field>
        <Field label="Correo (opcional)" half><TextField value={form.email} onChange={set("email")} type="email" placeholder="nombre@correo.com" /></Field>
        <Field label="Dirección (opcional)"><TextField value={form.address} onChange={set("address")} placeholder="Cra. 00 #00-00" /></Field>
        <Field label="Fecha de nacimiento (opcional)" half><TextField value={form.birth} onChange={set("birth")} placeholder="dd/mm/aaaa" /></Field>
        <Field label="Notas (opcional)"><TextField value={form.notes} onChange={set("notes")} placeholder="Preferencias, alergias, observaciones…" /></Field>
        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0" }}>
          <span onClick={() => set("pro")(!form.pro)} style={{
            width: 22, height: 22, borderRadius: "var(--radius-xs)", border: `1px solid ${form.pro ? "var(--brand)" : "var(--border-default)"}`,
            background: form.pro ? "var(--brand)" : "var(--surface-card)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
          }}>{form.pro && <Icon name="check" size={15} color="#fff" />}</span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>Es profesional del negocio (especialista)</span>
        </label>
      </div>
    </Dialog>
  );
}

function ConfirmDeleteDialog({ open, client, onClose, onConfirm }) {
  if (!open || !client) return null;
  return (
    <Dialog open={open} onClose={onClose} width={440}
      title="Marcar cliente como inactivo"
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="md" iconLeft="user-x" onClick={() => onConfirm(client)}>Marcar inactivo</Button>
      </>}>
      <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", padding: "4px 0 16px", lineHeight: "24px" }}>
        <strong style={{ color: "var(--text-primary)" }}>{client.name}</strong> dejará de aparecer en el directorio, pero su historial de servicios y montos se conserva (borrado lógico). Podrás reactivarlo más adelante.
      </p>
    </Dialog>
  );
}

function ScreenClientes({ vertical, consolidated, branch, state, onToast, onRetry }) {
  const [tab, setTab] = React.useState("todos");
  const [query, setQuery] = React.useState("");
  const [list, setList] = React.useState(() => AdminData.clients(vertical).map((c) => ({ ...c })));
  const [histClient, setHistClient] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editClient, setEditClient] = React.useState(null);
  const [delClient, setDelClient] = React.useState(null);

  React.useEffect(() => { setList(AdminData.clients(vertical).map((c) => ({ ...c }))); setQuery(""); setTab("todos"); }, [vertical]);

  const loading = state === "cargando";
  const error = state === "error";
  const forceEmpty = state === "vacio";
  const scope = consolidated ? "Todo el negocio" : branch;
  const stats = AdminData.clientStats(vertical);

  const active = list.filter((c) => !c.inactive);
  let filtered = active.filter((c) => !c.pro || true); // pros incluidos pero marcados
  if (tab === "recientes") filtered = [...filtered].filter((c) => c.ultima).sort((a, b) => (b.ultima || "").localeCompare(a.ultima || ""));
  else if (tab === "frecuentes") filtered = filtered.filter((c) => c.freq).sort((a, b) => b.servicios - a.servicios);
  const q = query.trim().toLowerCase();
  if (q) filtered = filtered.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || "").toLowerCase().includes(q));
  if (forceEmpty) filtered = [];

  const saveClient = (form) => {
    if (editClient) {
      setList((l) => l.map((c) => c.id === editClient.id ? { ...c, ...form } : c));
      onToast({ tone: "success", msg: "Cliente actualizado" });
    } else {
      const id = "c" + Date.now();
      setList((l) => [{ id, servicios: 0, gastado: 0, ultima: null, nuevo: true, freq: false, ...form }, ...l]);
      onToast({ tone: "success", msg: "Cliente creado" });
    }
    setFormOpen(false); setEditClient(null);
  };
  const doDelete = (c) => { setList((l) => l.map((x) => x.id === c.id ? { ...x, inactive: true } : x)); setDelClient(null); onToast({ tone: "info", msg: `${c.name.split(" ")[0]} marcado como inactivo` }); };

  const openCreate = () => { setEditClient(null); setFormOpen(true); };
  const openEdit = (c) => { setEditClient(c); setFormOpen(true); };

  return (
    <div>
      <PageHeader eyebrow={scope} title="Clientes" sub="Directorio y CRM básico del negocio."
        right={<Button variant="primary" size="md" iconLeft="user-plus" onClick={openCreate}>Nuevo cliente</Button>} />

      {/* Estadísticas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <StatTile label="Total de clientes" value={loading ? "—" : stats.total} icon="users" loading={loading} />
        <StatTile label="Nuevos este mes" value={loading ? "—" : stats.nuevos} icon="user-plus" loading={loading} accent />
        <StatTile label="Ingresos generados" value={loading ? "—" : AdminData.COP(stats.ingresos)} icon="dollar-sign" loading={loading} />
        <StatTile label="Gasto promedio" value={loading ? "—" : AdminData.COP(stats.promedio)} icon="trending-up" loading={loading} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <TabsUnderline tabs={[{ value: "todos", label: "Todos" }, { value: "recientes", label: "Recientes" }, { value: "frecuentes", label: "Frecuentes" }]} value={tab} onChange={setTab} />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, teléfono o correo…" width={340} />
      </div>

      {error ? <ErrorState onRetry={onRetry} /> : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} padding={16}><div style={{ display: "flex", gap: 12 }}><Skeleton w={44} h={44} r={99} /><div style={{ flex: 1 }}><Skeleton w="60%" h={15} /><div style={{ height: 10 }} /><Skeleton w="80%" h={12} /></div></div><div style={{ height: 16 }} /><Skeleton w="100%" h={48} /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding={0}>
          {forceEmpty || (active.filter((c) => !c.pro).length === 0) ? (
            <EmptyState icon="users" title="Aún no tienes clientes"
              desc="Crea tu primer cliente para empezar a medir visitas, gasto y frecuencia."
              action={<Button variant="primary" size="md" iconLeft="user-plus" onClick={openCreate}>Nuevo cliente</Button>} />
          ) : (
            <EmptyState icon="search" title="Sin resultados"
              desc={`No encontramos clientes que coincidan con “${query}”. Prueba con otro nombre o número.`}
              action={<Button variant="secondary" size="md" onClick={() => { setQuery(""); setTab("todos"); }}>Limpiar búsqueda</Button>} />
          )}
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map((c) => (
            <ClientCard key={c.id} c={c} vertical={vertical} onEdit={openEdit} onHistory={setHistClient} onDelete={setDelClient} />
          ))}
        </div>
      )}

      <ClientHistoryDialog open={!!histClient} client={histClient} vertical={vertical} onClose={() => setHistClient(null)} />
      <ClientFormDialog open={formOpen} client={editClient} onClose={() => { setFormOpen(false); setEditClient(null); }} onSave={saveClient} />
      <ConfirmDeleteDialog open={!!delClient} client={delClient} onClose={() => setDelClient(null)} onConfirm={doDelete} />
    </div>
  );
}

Object.assign(window, { ScreenClientes });
