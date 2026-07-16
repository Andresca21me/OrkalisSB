/* Orkalis — Configuración › Suscripción (6.10) + Developer / Mantenimiento (6.11). Lote 6. */

// ───────────────────────── 6.10 · Suscripción ───────────────────────
function ScreenSuscripcion({ vertical, account = "activa", onToast }) {
  const suspended = account === "suspendida";
  const sub = ConfigData.subscription(vertical, { activeBranches: 2, status: suspended ? "Suspendida" : "Activa" });
  const invoices = ConfigData.invoices(vertical);
  const [payOpen, setPayOpen] = React.useState(false);

  return (
    <div>
      {suspended && (
        <div style={{ marginBottom: 18 }}>
          <ConfigBanner tone="danger" icon="alert-octagon" title="Tu cuenta está suspendida por falta de pago"
            action={<Button variant="primary" size="sm" iconLeft="credit-card" onClick={() => setPayOpen(true)}>Regularizar pago</Button>}>
            El equipo no puede agendar ni cobrar mientras la cuenta esté suspendida. Regulariza el pago para restablecer el acceso de inmediato.
          </ConfigBanner>
        </div>
      )}

      {/* Estado de la cuenta */}
      <Card padding={0} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, padding: 22, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Plan actual</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{sub.plan}</span>
              <Badge tone={suspended ? "error" : "success"} size="lg" dot>{sub.status}</Badge>
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "8px 0 0" }}>
              {sub.activeBranches} sucursales activas · {ConfigData.COP(sub.pricePerBranch)} por sucursal/mes
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Cobro mensual</div>
            <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-3xl)", letterSpacing: "-0.02em", color: suspended ? "var(--error)" : "var(--text-primary)", lineHeight: 1 }}>{ConfigData.COP(sub.cost)}</div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "8px 0 0" }}>
              {suspended ? "Pago pendiente desde el 1 jun 2026" : `Próximo cobro · ${sub.nextBilling}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-sunken)", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <Icon name="credit-card" size={17} color="var(--text-tertiary)" />
            {sub.paymentMethod.brand} terminada en {sub.paymentMethod.last4} · vence {sub.paymentMethod.exp}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" size="md" iconLeft="credit-card" onClick={() => setPayOpen(true)}>Actualizar método de pago</Button>
            {suspended && <Button variant="primary" size="md" iconLeft="check" onClick={() => onToast({ tone: "success", msg: "Pago procesado · cuenta reactivada" })}>Regularizar pago</Button>}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 18, alignItems: "start" }}>
        {/* Desglose por sucursal */}
        <ConfigCard title="Desglose del cobro" desc="Una línea por cada sucursal activa." pad={22}>
          {sub.branches.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>
                <Icon name="store" size={16} color="var(--text-tertiary)" />{b.name}
              </span>
              <span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{ConfigData.COP(b.cost)}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0 2px", borderTop: "1.5px solid var(--border-default)", marginTop: 4 }}>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>Total mensual</span>
            <span className="data" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>{ConfigData.COP(sub.cost)}</span>
          </div>
        </ConfigCard>

        {/* Historial de pagos */}
        <ConfigCard title="Historial de pagos" desc="Facturas emitidas. Descárgalas para tu contabilidad."
          action={<Button variant="ghost" size="sm" iconLeft="download" onClick={() => onToast({ tone: "info", msg: "Descargando todas las facturas (.zip)" })}>Descargar todas</Button>} pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={thS}>Factura</th><th style={thS}>Fecha</th><th style={{ ...thS, textAlign: "right" }}>Monto</th><th style={thS}>Estado</th><th style={{ ...thS, width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((f, i) => (
                <tr key={f.id} style={{ borderBottom: i < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <td style={{ padding: "13px 22px" }}>
                    <div className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{f.id}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{f.period} · {f.method}</div>
                  </td>
                  <td style={{ padding: "13px 22px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{f.date}</td>
                  <td style={{ padding: "13px 22px", textAlign: "right" }}><span className="data" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{ConfigData.COP(f.amount)}</span></td>
                  <td style={{ padding: "13px 22px" }}><Badge tone="success" size="md" dot>{f.estado}</Badge></td>
                  <td style={{ padding: "13px 14px 13px 0", textAlign: "right" }}><IconBtn icon="download" label="Descargar factura" onClick={() => onToast({ tone: "info", msg: `Descargando ${f.id}.pdf` })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ConfigCard>
      </div>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} width={460}
        title="Actualizar método de pago" subtitle="Tus datos se procesan de forma segura."
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setPayOpen(false)}>Cancelar</Button>
          <Button variant="primary" size="md" iconLeft="lock" onClick={() => { setPayOpen(false); onToast({ tone: "success", msg: "Método de pago actualizado" }); }}>Guardar tarjeta</Button>
        </>}>
        <div style={{ padding: "6px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <GField label="Número de tarjeta"><GInput value="" onChange={() => {}} placeholder="1234 5678 9012 3456" /></GField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <GField label="Vencimiento"><GInput value="" onChange={() => {}} placeholder="MM/AA" /></GField>
            <GField label="CVV"><GInput value="" onChange={() => {}} placeholder="123" /></GField>
          </div>
          <GField label="Nombre en la tarjeta"><GInput value="" onChange={() => {}} placeholder="Como aparece en la tarjeta" /></GField>
        </div>
      </Dialog>
    </div>
  );
}
const thS = { textAlign: "left", padding: "12px 22px", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-tertiary)" };

// ───────────────────────── 6.11 · Developer / Mantenimiento ─────────
function ScreenDeveloper({ vertical, onToast }) {
  const [rules, setRules] = React.useState(() => ConfigData.retentionRules());
  const stats = ConfigData.dbStats();
  const [danger, setDanger] = React.useState(null); // {kind, title, desc, word, action}

  const setDays = (id, days) => setRules((arr) => arr.map((r) => r.id === id ? { ...r, days } : r));
  const setOn = (id, on) => setRules((arr) => arr.map((r) => r.id === id ? { ...r, on } : r));

  const cleanScope = (scope) => setDanger({
    title: `Limpiar datos de ${scope}`,
    desc: `Vas a eliminar las citas y movimientos de prueba ${scope === "el día" ? "de hoy" : scope === "la semana" ? "de esta semana" : "de este mes"}. Esta acción no se puede deshacer.`,
    word: "LIMPIAR",
    onConfirm: () => onToast({ tone: "success", msg: `Datos de ${scope} limpiados` }),
  });
  const dedupe = () => setDanger({
    title: "Limpiar duplicados de servicio",
    desc: "Se fusionarán los servicios con el mismo nombre y precio, conservando el más antiguo y reasignando sus citas. Esta acción no se puede deshacer.",
    word: "FUSIONAR",
    onConfirm: () => onToast({ tone: "success", msg: "3 duplicados fusionados" }),
  });

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <ConfigBanner tone="warning" icon="shield" title="Zona de operaciones avanzadas">
          Estas herramientas afectan datos de forma permanente y solo están disponibles para el rol Administrador. Procede con cuidado.
        </ConfigBanner>
      </div>

      {/* Estadísticas de la base */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        {stats.map((s) => <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      {/* Retención de datos */}
      <ConfigCard title="Retención de datos" desc="Define cuánto tiempo se conservan los datos de cada tabla antes de archivarse." pad={22}>
        {rules.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{r.table}</span>
                <span className="data" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{r.rows.toLocaleString("es-CO")} filas · desde {r.oldest}</span>
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "3px 0 0" }}>{r.desc}</p>
            </div>
            <div style={{ width: 150, flex: "none", opacity: r.on ? 1 : 0.5, pointerEvents: r.on ? "auto" : "none" }}>
              <GNumber value={r.days} onChange={(v) => setDays(r.id, v)} suffix="días" step={30} min={0} />
            </div>
            <GSwitch checked={r.on} onChange={(v) => setOn(r.id, v)} />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="primary" size="md" iconLeft="check" onClick={() => onToast({ tone: "success", msg: "Reglas de retención guardadas" })}>Guardar retención</Button>
        </div>
      </ConfigCard>

      {/* Limpieza manual de datos de prueba */}
      <ConfigCard title="Limpieza de datos de prueba" desc="Elimina citas y movimientos de demostración sin tocar tu configuración real." pad={22}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <Button variant="secondary" size="md" iconLeft="trash-2" onClick={() => cleanScope("el día")}>Limpiar el día actual</Button>
          <Button variant="secondary" size="md" iconLeft="trash-2" onClick={() => cleanScope("la semana")}>Limpiar la semana actual</Button>
          <Button variant="secondary" size="md" iconLeft="trash-2" onClick={() => cleanScope("el mes")}>Limpiar el mes actual</Button>
        </div>
        <div style={{ padding: 14, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Icon name="shield-check" size={16} color="var(--success)" />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>Esto se conserva siempre</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ConfigData.PRESERVED.map((p) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                <Icon name="check" size={12} color="var(--success)" />{p}
              </span>
            ))}
          </div>
        </div>
      </ConfigCard>

      {/* Duplicados de servicio */}
      <ConfigCard pad={22}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ fontSize: "var(--text-md)" }}>Limpieza de duplicados de servicio</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "4px 0 0" }}>Detectamos <strong>3 servicios</strong> con nombre y precio repetidos. Fusionarlos evita inconsistencias en los reportes.</p>
          </div>
          <Button variant="secondary" size="md" iconLeft="repeat" onClick={dedupe}>Revisar y fusionar</Button>
        </div>
      </ConfigCard>

      <DangerConfirm danger={danger} onClose={() => setDanger(null)} />
    </div>
  );
}

// Confirmación destructiva con doble verificación (escribir palabra)
function DangerConfirm({ danger, onClose }) {
  const [text, setText] = React.useState("");
  React.useEffect(() => { setText(""); }, [danger]);
  if (!danger) return null;
  const ok = text.trim().toUpperCase() === danger.word;
  return (
    <Dialog open onClose={onClose} width={460} title={danger.title}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="md" iconLeft="trash-2" disabled={!ok} onClick={() => { danger.onConfirm(); onClose(); }}>Confirmar</Button>
      </>}>
      <div style={{ padding: "4px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        <ConfigBanner tone="danger" title="Acción irreversible">{danger.desc}</ConfigBanner>
        <GField label={<>Escribe <span className="data" style={{ fontWeight: 700 }}>{danger.word}</span> para confirmar</>}>
          <GInput value={text} onChange={setText} placeholder={danger.word} invalid={text !== "" && !ok} />
        </GField>
      </div>
    </Dialog>
  );
}

Object.assign(window, { ScreenSuscripcion, ScreenDeveloper, DangerConfirm });
