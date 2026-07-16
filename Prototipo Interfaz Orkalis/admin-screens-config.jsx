/* Orkalis — Configuración: contenedor + Módulos (6.4) + Reglas de agendamiento
   (6.6) + Notificaciones (6.7). Lote 6. */

// ───────────────────────── Contenedor / router ──────────────────────
const CONFIG_META = {
  modulos:     { title: "Módulos", desc: "Enciende o apaga funcionalidades por negocio o por sucursal. Los módulos esenciales vienen activos." },
  financieros: { title: "Parámetros financieros", desc: "Define el reparto, las comisiones y las deducciones. El reparto profesional y del negocio debe sumar 100%." },
  agenda:      { title: "Reglas de agendamiento", desc: "Ajusta cómo se confirman, recuerdan y cancelan las citas, sin tocar código." },
  notif:       { title: "Notificaciones", desc: "Elige el canal de cada evento y edita el remitente y las plantillas de mensaje." },
  sucursales:  { title: "Sucursales", desc: "Administra las sedes del negocio. El cobro de la suscripción depende de las sucursales activas." },
  usuarios:    { title: "Usuarios y roles", desc: "Gestiona el personal con acceso, su rol y su alcance de sucursales." },
  suscripcion: { title: "Suscripción", desc: "Estado de tu cuenta y método de pago. Se cobra por número de sucursales activas." },
  developer:   { title: "Developer · Mantenimiento", desc: "Retención de datos y limpieza. Zona de operaciones avanzadas, solo para administradores." },
};

function ScreenConfig({ vertical, section, onSection, state, onToast, admin, account }) {
  const branches = ConfigData.branchDetail(vertical);
  const [scope, setScope] = React.useState("negocio");
  const [branchId, setBranchId] = React.useState(branches[0].id);
  const sec = SECTION_BY_ID[section] || SECTION_BY_ID.modulos;
  const meta = CONFIG_META[section] || CONFIG_META.modulos;
  React.useEffect(() => { if (!branches.some((b) => b.id === branchId)) setBranchId(branches[0].id); }, [vertical]);

  const branchIndex = Math.max(0, branches.findIndex((b) => b.id === branchId));
  const branch = branches[branchIndex];
  const loading = state === "cargando";
  const error = state === "error";
  const empty = state === "vacio";
  const key = `${section}-${scope}-${branchId}-${vertical}`;

  let body;
  if (loading) body = <ConfigSkeleton rows={section === "financieros" ? 5 : 5} />;
  else if (error) body = <ErrorState onRetry={() => onToast({ tone: "success", msg: "Configuración actualizada" })} title="No pudimos cargar la configuración" />;
  else {
    const common = { key, vertical, scope, branch, branchIndex, branches, empty, onToast };
    if (section === "modulos") body = <ConfigModulos {...common} />;
    else if (section === "financieros") body = <ConfigFinancieros {...common} />;
    else if (section === "agenda") body = <ConfigAgenda {...common} />;
    else if (section === "notif") body = <ConfigNotif {...common} />;
    else if (section === "sucursales") body = <ConfigSucursales {...common} />;
    else if (section === "usuarios") body = <ConfigUsuarios {...common} admin={admin} />;
    else if (section === "suscripcion") body = <ScreenSuscripcion {...common} account={account} />;
    else if (section === "developer") body = <ScreenDeveloper {...common} admin={admin} />;
  }

  return (
    <ConfigShell active={section} onSection={onSection} scope={scope} onScope={setScope}
      branchId={branchId} onBranch={setBranchId} branches={branches}
      title={meta.title} desc={meta.desc}>
      {body}
    </ConfigShell>
  );
}

// ───────────────────────── 6.4 · Módulos ────────────────────────────
function ConfigModulos({ vertical, scope, branch, branchIndex, onToast }) {
  const mods = ConfigData.modules(vertical);
  const scoped = scope === "sucursal";
  const [biz, setBiz] = React.useState(() => Object.fromEntries(mods.map((m) => [m.id, m.default])));
  const [freq, setFreq] = React.useState("quincenal");
  // overrides para esta sucursal (presencia = sobrescrito)
  const [over, setOver] = React.useState({});
  const [confirm, setConfirm] = React.useState(null); // {mod, next}

  const isOver = (id) => Object.prototype.hasOwnProperty.call(over, id);
  const valueOf = (id) => (scoped && isOver(id) ? over[id] : biz[id]);

  const doSet = (m, next) => {
    if (scoped) setOver((o) => ({ ...o, [m.id]: next }));
    else setBiz((b) => ({ ...b, [m.id]: next }));
    onToast({ tone: next ? "success" : "info", msg: `${m.name} · ${next ? "activado" : "desactivado"}` });
  };
  const request = (m, next) => {
    if (!next && m.hasData) setConfirm({ mod: m, next });   // desactivar con datos → confirmar
    else doSet(m, next);
  };
  const override = (m) => { setOver((o) => ({ ...o, [m.id]: biz[m.id] })); onToast({ tone: "info", msg: `${m.name} · ahora se define en ${branch.name.split(" · ").pop()}` }); };
  const inherit = (m) => { setOver((o) => { const n = { ...o }; delete n[m.id]; return n; }); onToast({ tone: "info", msg: `${m.name} · vuelve a heredar del negocio` }); };

  const DATA_HINT = {
    inventario: "Dejarás de ver el stock y las alertas. Tus productos y movimientos no se borran.",
    particion: "Dejarás de ver el reparto por especialista. Los datos históricos se conservan.",
    cierre: "Dejarás de ver liquidaciones por corte. Los cierres ya generados se conservan.",
    productos: "Dejarás de registrar ventas de productos. El historial de ventas se conserva.",
  };

  return (
    <div>
      {scoped && (
        <div style={{ marginBottom: 18 }}>
          <ConfigBanner tone="info" title={`Estás configurando ${branch.name}`}>
            Cada módulo hereda del negocio salvo que lo sobrescribas aquí. Sobrescribir solo afecta a esta sucursal.
          </ConfigBanner>
        </div>
      )}
      <ConfigCard pad={22}>
        {mods.map((m, i) => {
          const on = valueOf(m.id);
          const cierreExtra = m.id === "cierre" && on ? (
            <div style={{ width: 150, marginRight: 4 }}>
              <GSelect value={freq} onChange={setFreq} options={ConfigData.CIERRE_FREQ} />
            </div>
          ) : null;
          return (
            <SettingRow key={m.id} first={i === 0} icon={m.icon} title={m.name} desc={m.desc}
              scoped={scoped} overridden={isOver(m.id)} onOverride={() => override(m)} onInherit={() => inherit(m)}
              badge={m.hasData && on ? <Badge tone="neutral" size="md">Con datos</Badge> : null}>
              {cierreExtra}
              <GSwitch checked={on} onChange={(v) => request(m, v)} />
            </SettingRow>
          );
        })}
      </ConfigCard>

      <GConfirm open={!!confirm}
        title={confirm ? `Desactivar ${confirm.mod.name}` : ""}
        desc={confirm ? (DATA_HINT[confirm.mod.id] || "Esta funcionalidad dejará de mostrarse. No se borra ningún dato.") : ""}
        confirmLabel="Desactivar módulo" confirmIcon="eye-off" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => { doSet(confirm.mod, confirm.next); setConfirm(null); }} />
    </div>
  );
}

// ───────────────────────── 6.6 · Reglas de agendamiento ─────────────
function ConfigAgenda({ vertical, scope, branch, branchIndex, onToast }) {
  const base = ConfigData.schedBusiness();
  const scoped = scope === "sucursal";
  // overrides de ejemplo: la segunda sede acorta la antelación de cancelación
  const sample = branchIndex === 1 ? { antelacionCancelacion: 4 } : {};
  const [biz, setBiz] = React.useState(base);
  const [over, setOver] = React.useState(() => ({ ...sample }));

  const isOver = (id) => Object.prototype.hasOwnProperty.call(over, id);
  const val = (id) => (scoped && isOver(id) ? over[id] : biz[id]);
  const set = (id, v) => { if (scoped) setOver((o) => ({ ...o, [id]: v })); else setBiz((b) => ({ ...b, [id]: v })); };
  const override = (id) => setOver((o) => ({ ...o, [id]: biz[id] }));
  const inherit = (id) => setOver((o) => { const n = { ...o }; delete n[id]; return n; });
  const confirmOn = val("confirmacionAuto");

  const numField = (id, label, hint, suffix, step = 1, min = 0) => (
    <ProvField label={label} hint={hint} suffix={suffix} scoped={scoped} overridden={isOver(id)}
      onOverride={() => override(id)} onInherit={() => inherit(id)}>
      <GNumber value={val(id)} onChange={(v) => set(id, v)} suffix={suffix} step={step} min={min} />
    </ProvField>
  );

  return (
    <div>
      <ConfigCard title="Confirmación de reservas" desc="Define si las reservas del enlace público se confirman solas." pad={22}>
        <SettingRow first icon="shield-check" title="Confirmación automática"
          desc="Activa: las reservas quedan Confirmadas de inmediato. Inactiva: entran como Solicitada y el equipo las aprueba."
          scoped={scoped} overridden={isOver("confirmacionAuto")} onOverride={() => override("confirmacionAuto")} onInherit={() => inherit("confirmacionAuto")}>
          <GSwitch checked={confirmOn} onChange={(v) => set("confirmacionAuto", v)} />
        </SettingRow>
        {!confirmOn && (
          <div style={{ marginTop: 4 }}>
            <ConfigBanner tone="warning" title="La aprobación manual añade trabajo al equipo">
              Con la confirmación automática desactivada, cada reserva del enlace público requiere que alguien la apruebe antes de bloquear la franja.
            </ConfigBanner>
          </div>
        )}
      </ConfigCard>

      <ConfigCard title="Tiempos y ventanas" desc="Valores en horas y minutos que rigen recordatorios, retención y antelación." pad={22}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 28px" }}>
          {numField("antelacionCancelacion", "Antelación mínima para cancelar o reagendar", "El cliente no puede modificar la cita por debajo de este margen.", "horas")}
          {numField("antelacionReserva", "Antelación mínima para reservar", "Tiempo mínimo entre la reserva y la cita.", "min", 15)}
          {numField("recordatorio1", "Primer recordatorio", "Horas antes de la cita.", "h antes")}
          {numField("recordatorio2", "Segundo recordatorio", "Horas antes de la cita.", "h antes")}
          {numField("retencionFranja", "Retención de franja", "Minutos que se reserva la franja mientras el cliente confirma.", "min", 5)}
        </div>
      </ConfigCard>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="secondary" size="md">Descartar cambios</Button>
        <Button variant="primary" size="md" iconLeft="check" onClick={() => onToast({ tone: "success", msg: "Reglas de agendamiento guardadas" })}>Guardar cambios</Button>
      </div>
    </div>
  );
}

// ───────────────────────── 6.7 · Notificaciones ─────────────────────
function ConfigNotif({ vertical, scope, branch, branchIndex, onToast }) {
  const events = ConfigData.NOTIF_EVENTS;
  const channels = ConfigData.NOTIF_CHANNELS;
  const scoped = scope === "sucursal";
  const tpl = ConfigData.notifTemplates(vertical);
  const [matrix, setMatrix] = React.useState(() => ConfigData.notifDefaults());
  const sampleOver = branchIndex === 1 ? { recordatorio: true } : {};
  const [over, setOver] = React.useState(() => ({ ...sampleOver }));
  const [templates, setTemplates] = React.useState(tpl);

  const isOver = (id) => Object.prototype.hasOwnProperty.call(over, id);
  const toggle = (ev, ch) => {
    setMatrix((m) => ({ ...m, [ev]: { ...m[ev], [ch]: !m[ev][ch] } }));
  };
  const override = (id) => setOver((o) => ({ ...o, [id]: true }));
  const inherit = (id) => setOver((o) => { const n = { ...o }; delete n[id]; return n; });

  // ¿algún evento editable sin ningún canal? → aviso
  const sinCanal = events.filter((e) => { const r = matrix[e.id]; return !r.sms && !r.email && !r.whatsapp; });

  return (
    <div>
      {!!sinCanal.length && (
        <div style={{ marginBottom: 18 }}>
          <ConfigBanner tone="warning" title="Hay eventos sin canal configurado">
            {sinCanal.map((e) => e.name).join(", ")} no se enviará por ningún canal. Activa al menos uno.
          </ConfigBanner>
        </div>
      )}
      <ConfigCard pad={0}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={thNotif}>Evento</th>
              {channels.map((c) => (
                <th key={c.id} style={{ ...thNotif, textAlign: "center", width: 120 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <Icon name={c.icon} size={15} color="var(--text-tertiary)" />{c.label}
                    {c.status === "soon" && <Badge tone="neutral" size="md" style={{ marginLeft: 2 }}>Pronto</Badge>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const row = matrix[e.id];
              const empty = !row.sms && !row.email && !row.whatsapp;
              return (
                <tr key={e.id} style={{ borderBottom: i < events.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <td style={{ padding: "16px 22px", verticalAlign: "top" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</span>
                      {empty && <Badge tone="warning" size="md" dot>Sin canal</Badge>}
                      {scoped && <ProvTag overridden={isOver(e.id)} />}
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "3px 0 0", maxWidth: 380 }}>{e.desc}</p>
                    {scoped && <div style={{ marginTop: 6, marginLeft: -6 }}><ProvAction overridden={isOver(e.id)} onOverride={() => override(e.id)} onInherit={() => inherit(e.id)} /></div>}
                  </td>
                  {channels.map((c) => {
                    const soon = c.status === "soon";
                    const on = row[c.id];
                    const dim = scoped && !isOver(e.id);
                    return (
                      <td key={c.id} style={{ padding: "16px 0", textAlign: "center", verticalAlign: "top" }}>
                        <div style={{ display: "inline-flex", justifyContent: "center", opacity: soon ? 0.4 : dim ? 0.55 : 1, pointerEvents: soon || dim ? "none" : "auto" }}>
                          <GSwitch checked={!soon && on} onChange={() => toggle(e.id, c.id)} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ConfigCard>

      <ConfigCard title="Remitente y plantillas" desc="Texto que verá el cliente. Usa {cliente}, {fecha} y {especialista} como variables." pad={22}>
        <div style={{ display: "grid", gap: 18 }}>
          <GField label="Nombre del remitente" hint="Aparece como origen del SMS y firma del email.">
            <GInput value={templates.remitente} onChange={(v) => setTemplates((t) => ({ ...t, remitente: v }))} />
          </GField>
          {[["confirmacion", "Plantilla · Confirmación"], ["recordatorio", "Plantilla · Recordatorio"], ["cambio", "Plantilla · Cambio o cancelación"]].map(([id, label]) => (
            <GField key={id} label={label}>
              <GArea value={templates[id]} onChange={(v) => setTemplates((t) => ({ ...t, [id]: v }))} rows={2} />
            </GField>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Button variant="primary" size="md" iconLeft="check" onClick={() => onToast({ tone: "success", msg: "Notificaciones guardadas" })}>Guardar cambios</Button>
        </div>
      </ConfigCard>
    </div>
  );
}
const thNotif = { textAlign: "left", padding: "14px 22px", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)" };

Object.assign(window, { ScreenConfig, ConfigModulos, ConfigAgenda, ConfigNotif, CONFIG_META });
