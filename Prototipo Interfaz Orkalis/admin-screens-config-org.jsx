/* Orkalis — Configuración › Sucursales (6.8) + Usuarios y roles (6.9). Lote 6. */

// ───────────────────────── 6.8 · Sucursales ─────────────────────────
function ConfigSucursales({ vertical, empty, onToast }) {
  const all = ConfigData.branchDetail(vertical);
  const [branches, setBranches] = React.useState(() => empty ? all.slice(0, 1) : all);
  const [confirm, setConfirm] = React.useState(null); // branch a desactivar
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", address: "", hours: "", init: "negocio", from: all[0].id });

  const activeCount = branches.filter((b) => b.estado === "Activa").length;
  const cost = ConfigData.PLAN.pricePerBranch * activeCount;

  const setEstado = (id, estado) => { setBranches((arr) => arr.map((b) => b.id === id ? { ...b, estado } : b));
    onToast({ tone: estado === "Activa" ? "success" : "warning", msg: `Sucursal ${estado === "Activa" ? "activada" : "desactivada"} · suscripción ajustada` }); };
  const toggle = (b) => { if (b.estado === "Activa") setConfirm(b); else setEstado(b.id, "Activa"); };

  const createBranch = () => {
    const id = "b" + (branches.length + 1);
    const src = all.find((x) => x.id === form.from) || all[0];
    setBranches((arr) => [...arr, { id, name: form.name || "Nueva sucursal", address: form.address || "—", hours: form.hours || src.hours, estado: "Activa", especialistas: 0, principal: false }]);
    setCreateOpen(false); setForm({ name: "", address: "", hours: "", init: "negocio", from: all[0].id });
    onToast({ tone: "success", msg: "Sucursal creada · suscripción ajustada" });
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <ConfigBanner tone="brand" icon="credit-card" title="El cobro depende de las sucursales activas">
          Tienes <strong>{activeCount} {activeCount === 1 ? "sucursal activa" : "sucursales activas"}</strong>. Tu suscripción es de <strong className="data">{ConfigData.COP(cost)}</strong>/mes ({ConfigData.COP(ConfigData.PLAN.pricePerBranch)} por sucursal). Activar o desactivar una sede ajusta el cobro.
        </ConfigBanner>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{branches.length} {branches.length === 1 ? "sucursal" : "sucursales"}</span>
        <Button variant="primary" size="md" iconLeft="plus" onClick={() => setCreateOpen(true)}>Crear sucursal</Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {branches.map((b) => {
          const inactive = b.estado !== "Activa";
          return (
            <Card key={b.id} padding={18} style={{ opacity: inactive ? 0.72 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", flex: "none" }}>
                  <Icon name="store" size={21} color="var(--text-secondary)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>{b.name}</span>
                    {b.principal && <Badge tone="neutral" size="md">Principal</Badge>}
                    <Badge tone={inactive ? "neutral" : "success"} size="md" dot>{b.estado}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}><Icon name="map-pin" size={14} color="var(--text-tertiary)" />{b.address}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}><Icon name="clock" size={14} color="var(--text-tertiary)" />{b.hours}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}><Icon name="users" size={14} color="var(--text-tertiary)" />{b.especialistas} {b.especialistas === 1 ? "especialista" : "especialistas"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{inactive ? "Inactiva" : "Activa"}</span>
                    <GSwitch checked={!inactive} onChange={() => toggle(b)} />
                  </div>
                  <RowMenu items={[
                    { icon: "edit", label: "Editar sucursal", onClick: () => onToast({ tone: "info", msg: "Editar sucursal" }) },
                    { icon: inactive ? "check-circle" : "x-circle", label: inactive ? "Activar" : "Desactivar", onClick: () => toggle(b) },
                  ]} />
                </div>
              </div>
            </Card>
          );
        })}

        {/* Acción de añadir / estado de sede única */}
        <button type="button" onClick={() => setCreateOpen(true)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 64, width: "100%",
          border: "1.5px dashed var(--border-default)", borderRadius: "var(--radius-md)", background: "transparent", cursor: "pointer",
          color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
        }}>
          <Icon name="plus" size={18} color="var(--text-tertiary)" />
          {branches.length === 1 ? "Tienes una sola sede. Agrega otra sucursal" : "Agregar otra sucursal"}
        </button>
      </div>

      <GConfirm open={!!confirm}
        title={confirm ? `Desactivar ${confirm.name}` : ""}
        desc={confirm ? <>La sucursal dejará de operar y de aparecer en la agenda. Tu suscripción bajará a <strong className="data">{ConfigData.COP(ConfigData.PLAN.pricePerBranch * (activeCount - 1))}</strong>/mes. Puedes reactivarla cuando quieras; no se borra ningún dato.</> : ""}
        confirmLabel="Desactivar sucursal" confirmIcon="x-circle" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => { setEstado(confirm.id, "Inactiva"); setConfirm(null); }} />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} width={520}
        title="Crear sucursal" subtitle="Cada sucursal activa se suma a tu suscripción."
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="primary" size="md" iconLeft="plus" onClick={createBranch}>Crear sucursal</Button>
        </>}>
        <div style={{ padding: "6px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <GField label="Nombre de la sucursal">
            <GInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ej.: Estudio Aura · Usaquén" />
          </GField>
          <GField label="Dirección">
            <GInput value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Calle, número, barrio, ciudad" />
          </GField>
          <GField label="Horario base" optional>
            <GInput value={form.hours} onChange={(v) => setForm((f) => ({ ...f, hours: v }))} placeholder="Ej.: Mar a Dom · 9:00–19:00" />
          </GField>
          <div>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Configuración inicial</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {[{ v: "negocio", l: "Heredar configuración del negocio", d: "Toma todos los valores del negocio. Es lo recomendado." },
                { v: "clonar", l: "Clonar de otra sucursal", d: "Copia los parámetros de una sede existente." }].map((o) => {
                const on = form.init === o.v;
                return (
                  <button key={o.v} type="button" onClick={() => setForm((f) => ({ ...f, init: o.v }))} style={{
                    display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left", padding: 12, cursor: "pointer",
                    border: `1px solid ${on ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-sm)",
                    background: on ? "var(--brand-tint)" : "var(--surface-card)", boxShadow: on ? "0 0 0 1px var(--brand)" : "none",
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? "var(--brand)" : "var(--border-strong)"}`, flex: "none", marginTop: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {on && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand)" }} />}
                    </span>
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{o.l}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 2 }}>{o.d}</div>
                    </div>
                  </button>
                );
              })}
              {form.init === "clonar" && (
                <div style={{ marginTop: 2 }}>
                  <GSelect value={form.from} onChange={(v) => setForm((f) => ({ ...f, from: v }))} options={all.map((b) => ({ value: b.id, label: b.name }))} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ───────────────────────── 6.9 · Usuarios y roles ───────────────────
const ROLE_TONE = { "Administrador": "brand", "Recepcionista": "info", "Especialista": "neutral" };
function ConfigUsuarios({ vertical, empty, onToast }) {
  const branches = ConfigData.branchDetail(vertical);
  const branchName = (id) => { const b = branches.find((x) => x.id === id); return b ? b.name.split(" · ").pop() : id; };
  const allUsers = ConfigData.users(vertical);
  const [users, setUsers] = React.useState(() => empty ? allUsers.filter((u) => u.self) : allUsers);
  const [edit, setEdit] = React.useState(null);   // usuario en edición
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [invite, setInvite] = React.useState({ name: "", email: "", role: "Especialista", scope: "b1" });
  const [confirmRole, setConfirmRole] = React.useState(null);

  const scopeLabel = (u) => u.scope === "all" ? "Todas las sucursales" : (Array.isArray(u.scope) ? u.scope.map(branchName).join(", ") : branchName(u.scope));
  const setActivo = (id, activo) => { setUsers((arr) => arr.map((u) => u.id === id ? { ...u, activo } : u)); onToast({ tone: activo ? "success" : "warning", msg: `Usuario ${activo ? "reactivado" : "desactivado"}` }); };

  const saveEdit = () => {
    // si cambia el rol → confirmar
    const orig = allUsers.find((u) => u.id === edit.id);
    if (orig && orig.role !== edit.role) { setConfirmRole(edit); return; }
    applyEdit(edit);
  };
  const applyEdit = (u) => { setUsers((arr) => arr.map((x) => x.id === u.id ? { ...x, role: u.role, scope: u.scope } : x)); setEdit(null); setConfirmRole(null); onToast({ tone: "success", msg: "Usuario actualizado" }); };

  const sendInvite = () => {
    const id = "u" + (users.length + 10);
    setUsers((arr) => [...arr, { id, name: invite.name || "Nuevo usuario", email: invite.email || "—", role: invite.role, scope: invite.role === "Administrador" ? "all" : [invite.scope], activo: true, pending: true }]);
    setInviteOpen(false); setInvite({ name: "", email: "", role: "Especialista", scope: "b1" });
    onToast({ tone: "success", msg: "Invitación enviada por correo" });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{users.length} {users.length === 1 ? "usuario" : "usuarios"} con acceso</span>
        <Button variant="primary" size="md" iconLeft="user-plus" onClick={() => setInviteOpen(true)}>Invitar usuario</Button>
      </div>

      {users.length === 1 && users[0].self ? (
        <Card padding={0}>
          <EmptyState icon="users" title="Eres el único usuario con acceso"
            desc="Invita a recepcionistas y especialistas para que trabajen contigo. Cada uno verá solo lo que su rol permite."
            action={<Button variant="primary" size="md" iconLeft="user-plus" onClick={() => setInviteOpen(true)}>Invitar al primer usuario</Button>} />
        </Card>
      ) : (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={thU}>Usuario</th><th style={thU}>Rol</th><th style={thU}>Alcance</th><th style={{ ...thU, textAlign: "right" }}>Estado</th><th style={{ ...thU, width: 52 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: u.activo ? 1 : 0.6 }}>
                  <td style={{ padding: "14px 22px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.name} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{u.name}</span>
                          {u.self && <Badge tone="neutral" size="md">Tú</Badge>}
                          {u.pending && <Badge tone="warning" size="md" dot>Invitación pendiente</Badge>}
                        </div>
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 22px" }}><Badge tone={ROLE_TONE[u.role] || "neutral"} size="md">{u.role}</Badge></td>
                  <td style={{ padding: "14px 22px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{scopeLabel(u)}</td>
                  <td style={{ padding: "14px 22px", textAlign: "right" }}>
                    <Badge tone={u.activo ? "success" : "neutral"} size="md" dot>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td style={{ padding: "14px 16px 14px 0", textAlign: "right" }}>
                    {!u.self && <RowMenu items={[
                      { icon: "edit", label: "Editar rol y alcance", onClick: () => setEdit({ ...u, scope: u.scope }) },
                      { divider: true },
                      { icon: u.activo ? "user-x" : "check-circle", label: u.activo ? "Desactivar" : "Reactivar", danger: u.activo, onClick: () => setActivo(u.id, !u.activo) },
                    ]} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Editar rol y alcance */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} width={480}
        title={edit ? `Editar ${edit.name.split(" ")[0]}` : ""} subtitle={edit ? edit.email : ""}
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setEdit(null)}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={saveEdit}>Guardar cambios</Button>
        </>}>
        {edit && (
          <div style={{ padding: "6px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
            <GField label="Rol" hint={(ConfigData.ROLES.find((r) => r.value === edit.role) || {}).desc}>
              <GSelect value={edit.role} onChange={(v) => setEdit((e) => ({ ...e, role: v, scope: v === "Administrador" ? "all" : (Array.isArray(e.scope) ? e.scope : ["b1"]) }))} options={ConfigData.ROLES.map((r) => r.value)} />
            </GField>
            <GField label="Alcance de sucursales" hint={edit.role === "Administrador" ? "Los administradores acceden a todas las sucursales." : "Sucursales donde este usuario puede trabajar."}>
              {edit.role === "Administrador"
                ? <GInput value="Todas las sucursales" onChange={() => {}} />
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {branches.map((b) => {
                      const sel = Array.isArray(edit.scope) && edit.scope.includes(b.id);
                      return (
                        <button key={b.id} type="button" onClick={() => setEdit((e) => { const s = Array.isArray(e.scope) ? [...e.scope] : []; const i = s.indexOf(b.id); if (i >= 0) s.splice(i, 1); else s.push(b.id); return { ...e, scope: s }; })}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", textAlign: "left",
                            border: `1px solid ${sel ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-xs)", background: sel ? "var(--brand-tint)" : "var(--surface-card)" }}>
                          <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${sel ? "var(--brand)" : "var(--border-strong)"}`, background: sel ? "var(--brand)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                            {sel && <Icon name="check" size={12} color="#fff" />}
                          </span>
                          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
            </GField>
          </div>
        )}
      </Dialog>

      <GConfirm open={!!confirmRole}
        title={confirmRole ? "Cambiar el rol de acceso" : ""}
        desc={confirmRole ? <>Vas a cambiar el rol de <strong>{confirmRole.name}</strong> a <strong>{confirmRole.role}</strong>. Esto modifica de inmediato lo que puede ver y hacer en la plataforma.</> : ""}
        confirmLabel="Cambiar rol" confirmIcon="shield-check"
        onClose={() => setConfirmRole(null)} onConfirm={() => applyEdit(confirmRole)} />

      {/* Invitar usuario */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} width={480}
        title="Invitar usuario" subtitle="Recibirá un correo para crear su contraseña."
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setInviteOpen(false)}>Cancelar</Button>
          <Button variant="primary" size="md" iconLeft="mail" onClick={sendInvite}>Enviar invitación</Button>
        </>}>
        <div style={{ padding: "6px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <GField label="Nombre completo"><GInput value={invite.name} onChange={(v) => setInvite((f) => ({ ...f, name: v }))} placeholder="Ej.: Mariana Ruiz" /></GField>
          <GField label="Correo"><GInput value={invite.email} onChange={(v) => setInvite((f) => ({ ...f, email: v }))} type="email" placeholder="nombre@negocio.co" /></GField>
          <GField label="Rol" hint={(ConfigData.ROLES.find((r) => r.value === invite.role) || {}).desc}>
            <GSelect value={invite.role} onChange={(v) => setInvite((f) => ({ ...f, role: v }))} options={ConfigData.ROLES.map((r) => r.value)} />
          </GField>
          {invite.role !== "Administrador" && (
            <GField label="Sucursal">
              <GSelect value={invite.scope} onChange={(v) => setInvite((f) => ({ ...f, scope: v }))} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
            </GField>
          )}
        </div>
      </Dialog>
    </div>
  );
}
const thU = { textAlign: "left", padding: "13px 22px", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)" };

Object.assign(window, { ConfigSucursales, ConfigUsuarios });
