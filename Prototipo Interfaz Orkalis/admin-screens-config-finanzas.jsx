/* Orkalis — Configuración › Parámetros financieros (6.5). Lote 6.
   Reparto con validación en vivo (suma 100%), herencia por campo, clonado
   puntual desde otra sucursal y vista previa del reparto. */

// Input de porcentaje (admite decimales con coma es-CO)
function PctInput({ value, onChange, invalid }) {
  const [focus, setFocus] = React.useState(false);
  const display = value === "" || value == null || isNaN(value) ? "" : String(value).replace(".", ",");
  return (
    <div style={{ position: "relative", height: 42, display: "flex", alignItems: "center", width: "100%",
      background: "var(--surface-card)", borderRadius: "var(--radius-xs)",
      border: `1px solid ${invalid ? "var(--error)" : focus ? "var(--brand)" : "var(--border-default)"}`,
      boxShadow: focus ? `0 0 0 3px ${invalid ? "var(--error-tint)" : "var(--brand-tint)"}` : "none",
      transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)" }}>
      <input value={display} inputMode="decimal"
        onChange={(e) => {
          let raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
          const parts = raw.split("."); if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
          onChange(raw === "" ? "" : Number(raw));
        }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", height: 40, padding: "0 6px 0 12px",
          fontFamily: "var(--font-mono)", fontSize: "var(--text-base)", color: "var(--text-primary)" }} />
      <span style={{ paddingRight: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>%</span>
    </div>
  );
}

// valores de override de ejemplo por sucursal (para herencia y clonado)
function finSampleValues(vertical, branchIndex) {
  const biz = ConfigData.finBusiness(vertical);
  if (branchIndex === 1) return { repartoPro: 55, repartoSalon: 45 };          // 2ª sede reparte distinto
  return {};
}

function ConfigFinancieros({ vertical, scope, branch, branchIndex, branches, onToast }) {
  const biz = ConfigData.finBusiness(vertical);
  const fields = ConfigData.FIN_FIELDS;
  const scoped = scope === "sucursal";
  const [base, setBase] = React.useState(biz);
  const [over, setOver] = React.useState(() => ({ ...finSampleValues(vertical, branchIndex) }));
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [cloneFrom, setCloneFrom] = React.useState((branches.find((b) => b.id !== branch.id) || branches[0]).id);

  const isOver = (id) => Object.prototype.hasOwnProperty.call(over, id);
  const val = (id) => (scoped && isOver(id) ? over[id] : base[id]);
  const set = (id, v) => { if (scoped) setOver((o) => ({ ...o, [id]: v })); else setBase((b) => ({ ...b, [id]: v })); };
  const override = (id) => setOver((o) => ({ ...o, [id]: base[id] }));
  const inherit = (id) => setOver((o) => { const n = { ...o }; delete n[id]; return n; });

  // efectivo de otra sucursal (para clonar)
  const effectiveFor = (idx) => ({ ...biz, ...finSampleValues(vertical, idx) });
  const doClone = () => {
    const idx = Math.max(0, branches.findIndex((b) => b.id === cloneFrom));
    const eff = effectiveFor(idx);
    setOver({ ...eff });   // clona TODO como overrides de esta sede
    setCloneOpen(false);
    onToast({ tone: "success", msg: `Valores copiados de ${branches[idx].name.split(" · ").pop()}` });
  };

  const pro = Number(val("repartoPro")) || 0;
  const sal = Number(val("repartoSalon")) || 0;
  const sum = pro + sal;
  const sumOk = Math.abs(sum - 100) < 0.001;

  // vista previa
  const PREVIEW = 40000;
  const proAmt = Math.round(PREVIEW * pro / 100);
  const salAmt = PREVIEW - proAmt;

  const fieldNode = (f) => {
    const repartoErr = f.group === "reparto" && !sumOk;
    return (
      <ProvField key={f.id} label={f.label} hint={f.hint} error={repartoErr ? "El reparto debe sumar 100%." : null}
        scoped={scoped} overridden={isOver(f.id)} onOverride={() => override(f.id)} onInherit={() => inherit(f.id)}
        span={f.group === "reparto" ? 1 : 1}>
        <PctInput value={val(f.id)} onChange={(v) => set(f.id, v)} invalid={repartoErr} />
      </ProvField>
    );
  };

  return (
    <div>
      {scoped && (
        <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <ConfigBanner tone="info" title={`Estás configurando ${branch.name}`}
            action={branch.id !== branches[0].id || branches.length > 1
              ? <Button variant="secondary" size="sm" iconLeft="copy" onClick={() => setCloneOpen(true)}>Heredar de otra sucursal</Button>
              : null}>
            Cada parámetro hereda del negocio salvo que lo sobrescribas. Puedes clonar de otra sede como punto de partida.
          </ConfigBanner>
        </div>
      )}

      <ConfigCard title="Reparto del servicio" desc="El reparto profesional y del negocio debe sumar 100%." pad={22}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 28px" }}>
          {fields.filter((f) => f.group === "reparto").map(fieldNode)}
        </div>
        {/* indicador de suma en vivo */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Suma del reparto</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: 700, color: sumOk ? "var(--success)" : "var(--error)" }}>
              <Icon name={sumOk ? "check-circle" : "alert-circle"} size={16} color={sumOk ? "var(--success)" : "var(--error)"} />
              {String(sum).replace(".", ",")}%{sumOk ? "" : " · debe ser 100%"}
            </span>
          </div>
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--border-subtle)" }}>
            <div style={{ width: `${Math.min(100, pro)}%`, background: "var(--brand)", transition: "width var(--dur-base) var(--ease-out)" }} />
            <div style={{ width: `${Math.min(100 - Math.min(100, pro), sal)}%`, background: "var(--navy)", transition: "width var(--dur-base) var(--ease-out)" }} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--brand)" }} />Profesional {String(pro).replace(".", ",")}%</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--navy)" }} />Negocio {String(sal).replace(".", ",")}%</span>
          </div>
        </div>
      </ConfigCard>

      <ConfigCard title="Deducciones y comisiones" desc="Se aplican según la operación de cada cobro." pad={22}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 28px" }}>
          {fields.filter((f) => f.group !== "reparto").map(fieldNode)}
        </div>
      </ConfigCard>

      {/* Vista previa */}
      <ConfigCard title="Vista previa del reparto" pad={22}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="scissors" size={18} color="var(--text-tertiary)" />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Un servicio de</span>
            <span className="data" style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>{ConfigData.COP(PREVIEW)}</span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>reparte:</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--radius-sm)", background: "var(--brand-tint)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--brand)", fontWeight: 600 }}>Profesional</span>
              <span className="data" style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--brand)" }}>{sumOk ? ConfigData.COP(proAmt) : "—"}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>Negocio</span>
              <span className="data" style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>{sumOk ? ConfigData.COP(salAmt) : "—"}</span>
            </span>
          </div>
        </div>
        {!sumOk && <p style={{ fontSize: "var(--text-sm)", color: "var(--error)", margin: "12px 0 0", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="alert-circle" size={14} color="var(--error)" />Corrige el reparto para ver la vista previa.</p>}
      </ConfigCard>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-sm)", color: sumOk ? "var(--text-tertiary)" : "var(--error)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {!sumOk && <Icon name="alert-triangle" size={14} color="var(--error)" />}
          {sumOk ? "Listo para guardar." : "No puedes guardar: el reparto no suma 100%."}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">Descartar cambios</Button>
          <Button variant="primary" size="md" iconLeft="check" disabled={!sumOk} onClick={() => onToast({ tone: "success", msg: "Parámetros financieros guardados" })}>Guardar cambios</Button>
        </div>
      </div>

      {/* Diálogo clonar de otra sucursal */}
      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} width={480}
        title="Heredar de otra sucursal"
        subtitle="Copia los parámetros de otra sede como punto de partida para esta."
        footer={<>
          <Button variant="ghost" size="md" onClick={() => setCloneOpen(false)}>Cancelar</Button>
          <Button variant="primary" size="md" iconLeft="copy" onClick={doClone}>Copiar valores</Button>
        </>}>
        <div style={{ padding: "6px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          <GField label="Sucursal origen">
            <GSelect value={cloneFrom} onChange={setCloneFrom}
              options={branches.filter((b) => b.id !== branch.id).map((b) => ({ value: b.id, label: b.name }))} />
          </GField>
          <ConfigBanner tone="warning" title="Es una copia puntual, no un vínculo">
            Se clonan los valores actuales como overrides de {branch.name.split(" · ").pop()}. Si la sucursal origen cambia después, esos cambios no se propagan aquí.
          </ConfigBanner>
        </div>
      </Dialog>
    </div>
  );
}

Object.assign(window, { ConfigFinancieros, PctInput });
