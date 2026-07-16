/* Orkalis — Onboarding del negocio (Lote 6 · 6.2).
   Asistente de alta guiada en 5 pasos con barra de progreso. Deja todo listo
   para operar con buenos valores por defecto. Estados: validación por paso,
   "Completar después", guardado de progreso, paso final con enlace público. */

const ONB_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paso": 1
}/*EDITMODE-END*/;

const STEPS = [
  { n: 1, label: "Negocio", icon: "store" },
  { n: 2, label: "Sucursal", icon: "map-pin" },
  { n: 3, label: "Módulos", icon: "package" },
  { n: 4, label: "Equipo", icon: "users", optional: true },
  { n: 5, label: "Listo", icon: "check-circle" },
];

function OnbLogo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", width: 26, height: 26 }}
        dangerouslySetInnerHTML={{ __html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="var(--navy)" stroke-width="2.4"/><circle cx="14.5" cy="14.5" r="4.2" fill="var(--navy)"/></svg>` }} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.04em", color: "var(--navy)", textTransform: "uppercase" }}>Orkalis</span>
    </span>
  );
}

// Tarjeta seleccionable de perfil/opción
function ChoiceCard({ selected, onClick, icon, title, desc, tag }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: 0, textAlign: "left", padding: 20, cursor: "pointer", position: "relative",
      border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-default)"}`, borderRadius: "var(--radius-lg)",
      background: selected ? "var(--brand-tint)" : "var(--surface-card)", boxShadow: selected ? "0 0 0 1px var(--brand)" : "var(--shadow-xs)",
      transition: "border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: "var(--radius-md)", background: selected ? "var(--brand)" : "var(--surface-sunken)" }}>
          <Icon name={icon} size={23} color={selected ? "#fff" : "var(--text-secondary)"} />
        </span>
        <span style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {selected && <span style={{ width: 11, height: 11, borderRadius: 999, background: "var(--brand)" }} />}
        </span>
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{title}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 }}>{desc}</span>
      {tag && <span style={{ marginTop: 12 }}><Badge tone="neutral" size="md">{tag}</Badge></span>}
    </button>
  );
}

function OnboardingApp() {
  const [t, setTweak] = useTweaks(ONB_DEFAULTS);
  const [step, setStep] = React.useState(t.paso || 1);
  React.useEffect(() => { setStep(t.paso || 1); }, [t.paso]);

  // ── Estado del asistente ──
  const [vertical, setVertical] = React.useState("barberia");
  const [bizName, setBizName] = React.useState("");
  const [branch, setBranch] = React.useState({ name: "", address: "", open: "09:00", close: "20:00" });
  const [mods, setMods] = React.useState(null);
  const [team, setTeam] = React.useState([]);
  const [errors, setErrors] = React.useState({});
  const [savedToast, setSavedToast] = React.useState(false);

  // módulos según perfil
  React.useEffect(() => {
    const list = ConfigData.modules(vertical);
    setMods(Object.fromEntries(list.map((m) => [m.id, m.default])));
  }, [vertical]);

  const espWord = vertical === "salon" ? "especialista" : "barbero";
  const espWordCap = vertical === "salon" ? "Especialista" : "Barbero";
  const placeholderBiz = vertical === "salon" ? "Ej.: Estudio Aura" : "Ej.: La Navaja";
  const slug = (bizName || placeholderBiz.replace("Ej.: ", "")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const publicUrl = `orkalis.co/r/${slug || "tu-negocio"}`;

  // validación por paso
  const validate = (s) => {
    const e = {};
    if (s === 1 && !bizName.trim()) e.bizName = "Ingresa el nombre de tu negocio.";
    if (s === 2) {
      if (!branch.name.trim()) e.branchName = "Ponle un nombre a la sucursal.";
      if (!branch.address.trim()) e.branchAddress = "Ingresa la dirección.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) { setStep((s) => Math.min(5, s + 1)); window.scrollTo(0, 0); } };
  const back = () => { setErrors({}); setStep((s) => Math.max(1, s - 1)); };
  const saveLater = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 2600); };

  const maxReached = step;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-page)" }}>
      {/* Encabezado */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)", position: "sticky", top: 0, zIndex: 10 }}>
        <OnbLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Configuración inicial</span>
          {step < 5 && <Button variant="ghost" size="sm" onClick={saveLater}>Completar después</Button>}
        </div>
      </header>

      {/* Barra de progreso por pasos */}
      {step < 5 && (
        <div style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 24px" }}>
            <Stepper steps={STEPS} current={step} maxReached={maxReached} onJump={(n) => { if (n < step) setStep(n); }} />
          </div>
        </div>
      )}

      {/* Cuerpo */}
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px 64px" }}>
        <div key={step} style={{ width: "100%", maxWidth: step === 5 ? 600 : 680 }}>
          {step === 1 && (
            <StepShell n={1} title="Cuéntanos de tu negocio" desc="Empecemos por lo esencial. Podrás cambiar todo esto más adelante.">
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <GField label="Nombre del negocio" error={errors.bizName}>
                  <GInput value={bizName} onChange={setBizName} placeholder={placeholderBiz} invalid={!!errors.bizName} />
                </GField>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Logo <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>· opcional</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px dashed var(--border-strong)", flex: "none" }}>
                      <Icon name="image" size={24} color="var(--text-tertiary)" />
                    </span>
                    <Button variant="secondary" size="md" iconLeft="upload">Subir logo</Button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Perfil del negocio</div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0 0 12px" }}>Ajusta la terminología (cómo llamamos a tu equipo y tus servicios) y las categorías por defecto.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <ChoiceCard selected={vertical === "salon"} onClick={() => setVertical("salon")} icon="scissors"
                      title="Salón de belleza" desc="Especialistas, servicios de cabello, color, uñas y estética." tag="Equipo: especialistas" />
                    <ChoiceCard selected={vertical === "barberia"} onClick={() => setVertical("barberia")} icon="scissors"
                      title="Barbería" desc="Barberos, cortes, barba y arreglo. Citas más cortas y frecuentes." tag="Equipo: barberos" />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell n={2} title="Tu primera sucursal" desc="Configura la sede principal. Podrás agregar más sucursales cuando quieras.">
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <GField label="Nombre de la sucursal" hint="Suele incluir el barrio o la zona." error={errors.branchName}>
                  <GInput value={branch.name} onChange={(v) => setBranch((b) => ({ ...b, name: v }))} placeholder={vertical === "salon" ? "Ej.: Estudio Aura · El Nogal" : "Ej.: La Navaja · Chapinero"} invalid={!!errors.branchName} />
                </GField>
                <GField label="Dirección" error={errors.branchAddress}>
                  <GInput value={branch.address} onChange={(v) => setBranch((b) => ({ ...b, address: v }))} placeholder="Calle, número, barrio, ciudad" invalid={!!errors.branchAddress} />
                </GField>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Horario base</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 130 }}><GSelect value={branch.open} onChange={(v) => setBranch((b) => ({ ...b, open: v }))} options={HOURS} /></div>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>a</span>
                    <div style={{ width: 130 }}><GSelect value={branch.close} onChange={(v) => setBranch((b) => ({ ...b, close: v }))} options={HOURS} /></div>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Lun a Sáb</span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "8px 0 0" }}>Podrás definir horarios distintos por día y por especialista más adelante.</p>
                </div>
                <div style={{ display: "flex", gap: 11, padding: 13, borderRadius: "var(--radius-sm)", background: "var(--brand-tint)" }}>
                  <Icon name="info" size={17} color="var(--brand)" style={{ flex: "none", marginTop: 1 }} />
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "20px" }}>¿Tienes más sedes? Termina esta primero; podrás agregar las demás desde <strong>Configuración › Sucursales</strong>. Cada sucursal activa se suma a tu suscripción.</span>
                </div>
              </div>
            </StepShell>
          )}

          {step === 3 && mods && (
            <StepShell n={3} title="Activa lo que necesitas" desc={`Preparamos los módulos recomendados para tu ${vertical === "salon" ? "salón" : "barbería"}. Los esenciales vienen activos; ajústalos a tu gusto.`}>
              <Card padding={4}>
                {ConfigData.modules(vertical).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 14px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", flex: "none", marginTop: 1 }}>
                      <Icon name={m.icon} size={19} color="var(--text-secondary)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 4 }}>
                        <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{m.name}</span>
                        {m.default && <Badge tone="brand" size="md">Recomendado</Badge>}
                      </div>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "3px 0 0", maxWidth: 460, lineHeight: "20px" }}>{m.desc}</p>
                    </div>
                    <div style={{ flex: "none", paddingTop: 4 }}>
                      <GSwitch checked={mods[m.id]} onChange={(v) => setMods((o) => ({ ...o, [m.id]: v }))} />
                    </div>
                  </div>
                ))}
              </Card>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell n={4} title={`Agrega tu equipo`} desc={`Suma a tus ${espWord}s y asígnalos a la sucursal. Este paso es opcional: puedes hacerlo después.`} optional>
              <TeamStep team={team} setTeam={setTeam} espWord={espWord} espWordCap={espWordCap} branchName={branch.name || (vertical === "salon" ? "Tu sucursal" : "Tu sucursal")} />
            </StepShell>
          )}

          {step === 5 && (
            <DoneStep bizName={bizName || placeholderBiz.replace("Ej.: ", "")} publicUrl={publicUrl} vertical={vertical} branch={branch} mods={mods} team={team} />
          )}

          {/* Navegación */}
          {step < 5 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
              <div>{step > 1 && <Button variant="ghost" size="lg" iconLeft="arrow-left" onClick={back}>Atrás</Button>}</div>
              <div style={{ display: "flex", gap: 10 }}>
                {STEPS[step - 1].optional && <Button variant="secondary" size="lg" onClick={next}>Omitir por ahora</Button>}
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={next}>{step === 4 ? "Finalizar" : "Continuar"}</Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast de progreso guardado */}
      {savedToast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: "var(--radius-md)", background: "var(--navy)", color: "#fff", boxShadow: "var(--shadow-lg)" }}>
            <Icon name="check-circle" size={18} color="var(--accent)" />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Progreso guardado. Puedes retomar cuando quieras.</span>
          </div>
        </div>
      )}

      <OnbTweaks t={t} setTweak={setTweak} step={step} />
    </div>
  );
}

const HOURS = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","18:00","19:00","20:00","21:00","22:00"].map((h) => ({ value: h, label: h }));

// Encabezado de paso
function StepShell({ n, title, desc, optional, children }) {
  return (
    <div>
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="eyebrow" style={{ whiteSpace: "nowrap" }}>Paso {n} de 5</span>
          {optional && <Badge tone="neutral" size="md">Opcional</Badge>}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-3xl)", letterSpacing: "-0.025em", margin: 0 }}>{title}</h1>
        {desc && <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", margin: "10px 0 0", lineHeight: 1.5, maxWidth: 560 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// Barra de progreso (puntos + conectores)
function Stepper({ steps, current, maxReached, onJump }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const reachable = s.n < current;
        return (
          <React.Fragment key={s.n}>
            <button type="button" onClick={() => reachable && onJump(s.n)} disabled={!reachable} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 7, border: "none", background: "transparent",
              cursor: reachable ? "pointer" : "default", padding: 0, flex: "none",
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, flex: "none",
                background: done ? "var(--brand)" : active ? "var(--brand-tint)" : "var(--surface-sunken)",
                border: `2px solid ${done || active ? "var(--brand)" : "var(--border-default)"}`,
                color: done ? "#fff" : active ? "var(--brand)" : "var(--text-tertiary)",
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)",
                transition: "all var(--dur-base) var(--ease-out)",
              }}>
                {done ? <Icon name="check" size={17} color="#fff" /> : s.n}
              </span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: active ? "var(--text-primary)" : "var(--text-tertiary)", whiteSpace: "nowrap" }}>{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <span style={{ flex: 1, height: 2, margin: "0 8px", marginBottom: 22, background: s.n < current ? "var(--brand)" : "var(--border-default)", transition: "background var(--dur-base) var(--ease-out)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Paso 4 — equipo
function TeamStep({ team, setTeam, espWord, espWordCap, branchName }) {
  const [name, setName] = React.useState("");
  const add = () => { if (name.trim()) { setTeam((arr) => [...arr, { id: Date.now(), name: name.trim() }]); setName(""); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <GField label={`Nombre del ${espWord}`}>
            <GInput value={name} onChange={setName} placeholder={`Ej.: ${espWord === "barbero" ? "Andrés Mejía" : "Valentina Gómez"}`} />
          </GField>
        </div>
        <Button variant="secondary" size="lg" iconLeft="plus" onClick={add}>Agregar</Button>
      </div>

      {team.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 20px", borderRadius: "var(--radius-lg)", border: "1.5px dashed var(--border-default)", textAlign: "center" }}>
          <Icon name="users" size={28} color="var(--text-tertiary)" />
          <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>Aún no agregas a nadie</div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0, maxWidth: 320 }}>Agrega a tu equipo ahora o invítalos después desde Configuración › Usuarios y roles.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {team.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
              <Avatar name={m.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{espWordCap} · {branchName}</div>
              </div>
              <button type="button" onClick={() => setTeam((arr) => arr.filter((x) => x.id !== m.id))} aria-label="Quitar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", padding: 6 }}>
                <Icon name="x" size={17} color="var(--text-tertiary)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Paso 5 — listo, con enlace público
function DoneStep({ bizName, publicUrl, vertical, branch, mods, team }) {
  const [copied, setCopied] = React.useState(false);
  const activeMods = mods ? Object.values(mods).filter(Boolean).length : 0;
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2200); };
  return (
    <div style={{ textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 999, background: "var(--success-tint, rgba(16,185,129,0.12))", marginBottom: 20 }}>
        <Icon name="check-circle" size={38} color="var(--success)" />
      </span>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-3xl)", letterSpacing: "-0.025em", margin: 0 }}>¡{bizName} está listo!</h1>
      <p style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", margin: "12px 0 0", lineHeight: 1.5 }}>Tu cuenta quedó configurada y lista para operar. Comparte tu enlace de reservas para empezar a recibir citas.</p>

      {/* Enlace público */}
      <div style={{ marginTop: 28, padding: 20, borderRadius: "var(--radius-lg)", background: "var(--navy)", color: "#fff", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Icon name="link" size={16} color="var(--accent)" />
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Tu enlace de reservas</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", padding: "11px 14px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
            <span className="data" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{publicUrl}</span>
          </div>
          <button type="button" onClick={copy} style={{
            display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", border: "none", cursor: "pointer", flex: "none",
            borderRadius: "var(--radius-sm)", background: copied ? "var(--success)" : "var(--brand)", color: "#fff",
            fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, transition: "background var(--dur-fast) var(--ease-out)",
          }}>
            <Icon name={copied ? "check" : "copy"} size={16} color="#fff" />{copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["share-2", "Compartir"], ["qr-code", "Código QR"], ["message-circle", "WhatsApp"]].map(([ic, lb]) => (
            <button key={lb} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "var(--radius-sm)", background: "transparent", color: "rgba(255,255,255,0.9)", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 500 }}>
              <Icon name={ic} size={15} color="rgba(255,255,255,0.85)" />{lb}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div style={{ marginTop: 18, padding: 18, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", textAlign: "left" }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Resumen de tu configuración</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
          {[
            ["store", "Perfil", vertical === "salon" ? "Salón de belleza" : "Barbería"],
            ["map-pin", "Sucursal", branch.name || "Sede principal"],
            ["package", "Módulos activos", `${activeMods} activos`],
            ["users", "Equipo", team.length ? `${team.length} ${team.length === 1 ? "persona" : "personas"}` : "Por agregar"],
          ].map(([ic, k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name={ic} size={17} color="var(--text-tertiary)" style={{ flex: "none" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{k}</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="primary" size="lg" fullWidth iconRight="arrow-right">Ir a mi panel</Button>
      </div>
    </div>
  );
}

function OnbTweaks({ t, setTweak, step }) {
  return (
    <TweaksPanel>
      <TweakSection label="Asistente" />
      <TweakSelect label="Ir al paso" value={step} options={[
        { value: 1, label: "1 · Datos del negocio" },
        { value: 2, label: "2 · Primera sucursal" },
        { value: 3, label: "3 · Módulos" },
        { value: 4, label: "4 · Equipo (opcional)" },
        { value: 5, label: "5 · Listo" },
      ]} onChange={(v) => setTweak("paso", Number(v))} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<OnboardingApp />);
