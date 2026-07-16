/* Orkalis — pantallas del flujo (parte A): 1.1 Inicio · 1.2 Servicios · 1.3 Especialista */

// hook: estado efectivo de pantalla (sigue al tweak, pero "reintentar" lo limpia localmente)
function useScreenState(estado) {
  const [eff, setEff] = React.useState(estado);
  React.useEffect(() => { setEff(estado); }, [estado]);
  return [eff, () => setEff("datos")];
}

// Chips de categoría (segmentado scrollable)
function CategoryChips({ items, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 2px", scrollbarWidth: "none" }}>
      {items.map((c) => {
        const on = c === value;
        return (
          <button key={c} type="button" onClick={() => onChange(c)} style={{
            flex: "none", height: 36, padding: "0 14px", borderRadius: "9999px", cursor: "pointer",
            border: `1px solid ${on ? "var(--brand)" : "var(--border-subtle)"}`,
            background: on ? "var(--brand)" : "var(--surface-card)",
            color: on ? "#fff" : "var(--text-secondary)",
            fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap",
            transition: "background var(--dur-fast) var(--ease-out)",
          }}>{c}</button>
        );
      })}
    </div>
  );
}

// ════════════════════════ 1.1 INICIO ════════════════════════
function ScreenInicio({ data, estado, onReserve, onManage }) {
  const [eff, reset] = useScreenState(estado === "vacio" ? "datos" : estado); // inicio nunca vacío
  const b = data.business;
  const populares = data.services.filter((s) => s.popular).slice(0, 3);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScrollArea style={{ paddingTop: STATUS_TOP }}>
        {/* Banner navy con malla geométrica + marca */}
        <div style={{ position: "relative", margin: 16, borderRadius: "var(--radius-xl)", overflow: "hidden", background: "var(--navy)", padding: "26px 22px 24px" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.5 }} />
          <div style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 28, border: "1px solid rgba(255,255,255,0.12)" }} />
          <div style={{ position: "absolute", right: 6, top: 18, width: 84, height: 84, borderRadius: "9999px", border: "1px solid rgba(0,212,170,0.35)" }} />
          {eff === "cargando" ? (
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
              <Skeleton w={120} h={13} style={{ opacity: 0.4 }} />
              <Skeleton w="80%" h={26} style={{ opacity: 0.4 }} />
              <Skeleton w="55%" h={13} style={{ opacity: 0.4 }} />
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #fff", position: "relative", display: "inline-block" }}>
                  <span style={{ position: "absolute", right: 2, bottom: 2, width: 9, height: 9, borderRadius: "9999px", background: "#fff" }} />
                </span>
                <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Reserva en línea</span>
              </div>
              <h1 style={{ color: "#fff", fontSize: "var(--text-2xl)", lineHeight: "34px", marginBottom: 8 }}>{b.name}</h1>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--text-sm)", margin: 0, marginBottom: 16 }}>{b.tagline}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.10)", padding: "7px 12px", borderRadius: "9999px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon name="star" size={14} color="#F59E0B" style={{ fill: "#F59E0B" }} />
                  <span className="data" style={{ color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600 }}>{b.rating}</span>
                </span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "var(--text-xs)" }}>{b.reviews} reseñas</span>
              </div>
            </div>
          )}
        </div>

        {eff === "error" ? (
          <ErrorState onRetry={reset} />
        ) : (
          <div style={{ padding: "0 16px 24px" }}>
            {/* Datos del local */}
            <Card style={{ marginBottom: 16 }} padding={0}>
              <InfoRow icon="map-pin" title={b.address} action="Cómo llegar" loading={eff === "cargando"} />
              <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 52 }} />
              <InfoRow icon="clock" title={b.hours} sub="Abierto ahora" loading={eff === "cargando"} />
              <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 52 }} />
              <InfoRow icon="phone" title={b.phone} action="Llamar" loading={eff === "cargando"} />
            </Card>

            {/* Servicios populares */}
            <SectionLabel>Lo más reservado</SectionLabel>
            {eff === "cargando" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} h={56} r={8} />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {populares.map((s) => (
                  <Card key={s.id} padding={14} interactive onClick={onReserve}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 9, background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <Icon name="scissors" size={18} color="var(--brand)" />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{s.min} min</div>
                      </div>
                      <div className="data" style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{OrkData.COP(s.price)}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        <Button fullWidth size="lg" iconRight="arrow-right" onClick={onReserve} disabled={eff !== "datos"}>Reservar una cita</Button>
        <button type="button" onClick={onManage} style={{ width: "100%", marginTop: 10, border: "none", background: "transparent", color: "var(--text-link)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", padding: 6 }}>
          Ya tengo una cita
        </button>
      </FooterBar>
    </div>
  );
}

function InfoRow({ icon, title, sub, action, loading }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <span style={{ width: 24, flex: "none", display: "flex", justifyContent: "center" }}><Icon name={icon} size={18} color="var(--text-tertiary)" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? <Skeleton w="70%" h={13} /> : <>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>{title}</div>
          {sub && <div style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 600, marginTop: 1 }}>{sub}</div>}
        </>}
      </div>
      {action && !loading && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-link)", fontWeight: 600, flex: "none" }}>{action}</span>}
    </div>
  );
}

// ════════════════════════ 1.2 SERVICIOS ════════════════════════
function ScreenServicios({ data, estado, selected, onToggle, onBack, onContinue }) {
  const [eff, reset] = useScreenState(estado);
  const [cat, setCat] = React.useState(data.categories[0]);
  React.useEffect(() => { setCat(data.categories[0]); }, [data.vertical]);

  const list = data.services.filter((s) => s.cat === cat);
  const chosen = data.services.filter((s) => selected.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price, 0);
  const totalMin = chosen.reduce((a, s) => a + s.min, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Elige tus servicios" sub={data.business.name} onBack={onBack} />
      <ProgressBar step="servicios" />
      <div style={{ flex: "none", paddingTop: 12, paddingBottom: 12, background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        <CategoryChips items={data.categories} value={cat} onChange={setCat} />
      </div>

      <ScrollArea>
        {eff === "cargando" ? <LoadingList rows={4} />
          : eff === "error" ? <ErrorState onRetry={reset} />
          : eff === "vacio" || list.length === 0 ? (
            <EmptyState icon="scissors" title="Sin servicios en esta categoría"
              body="Prueba con otra categoría o vuelve más tarde; el negocio está actualizando su carta."
              action={<Button variant="secondary" size="md" onClick={() => setCat(data.categories[0])}>Ver todos</Button>} />
          ) : (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <Card key={s.id} interactive selected={on} padding={14} onClick={() => onToggle(s.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</span>
                          {s.popular && <Badge tone="accent">Popular</Badge>}
                        </div>
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "19px", marginBottom: 8 }}>{s.desc}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="data" style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{OrkData.COP(s.price)}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                            <Icon name="clock" size={13} color="var(--text-tertiary)" />{s.min} min
                          </span>
                        </div>
                      </div>
                      <span style={{
                        width: 26, height: 26, borderRadius: 8, flex: "none", marginTop: 2,
                        border: `2px solid ${on ? "var(--brand)" : "var(--border-default)"}`,
                        background: on ? "var(--brand)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all var(--dur-fast) var(--ease-out)",
                      }}>{on && <Icon name="check" size={16} color="#fff" strokeWidth={3} />}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      </ScrollArea>

      <FooterBar>
        <PriceCta
          label={chosen.length ? OrkData.COP(total) : null}
          sublabel={chosen.length ? `${chosen.length} ${chosen.length === 1 ? "servicio" : "servicios"} · ${totalMin} min` : null}
          ctaLabel={chosen.length ? "Continuar" : "Selecciona un servicio"}
          disabled={!chosen.length || eff !== "datos"}
          onCta={onContinue}
        />
      </FooterBar>
    </div>
  );
}

// ════════════════════════ 1.3 ESPECIALISTA ════════════════════════
function ScreenEspecialista({ data, estado, value, onPick, onBack, onContinue }) {
  const [eff, reset] = useScreenState(estado);
  const label = data.specialistLabelPlural.toLowerCase();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title={`Elige tu ${data.specialistLabel.toLowerCase()}`} sub={data.business.name} onBack={onBack} />
      <ProgressBar step="especialista" />

      <ScrollArea>
        {eff === "cargando" ? <LoadingList rows={3} avatar />
          : eff === "error" ? <ErrorState onRetry={reset} />
          : eff === "vacio" ? (
            <EmptyState icon="users" title={`Sin ${label} disponibles`}
              body="Nadie tiene agenda abierta para los servicios elegidos. Puedes elegir “cualquiera disponible” o cambiar de servicio."
              action={<Button size="md" onClick={() => onPick("any")}>Cualquiera disponible</Button>} />
          ) : (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Cualquiera disponible */}
              <Card interactive selected={value === "any"} padding={14} onClick={() => onPick("any")}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: "9999px", flex: "none", background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="sparkles" size={20} color="var(--brand)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>Cualquiera disponible</span>
                      <Badge tone="brand">Más rápido</Badge>
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}>Te asignamos el primero que se libere</div>
                  </div>
                  <RadioDot on={value === "any"} />
                </div>
              </Card>

              {data.specialists.map((sp) => (
                <Card key={sp.id} interactive selected={value === sp.id} padding={14} onClick={() => onPick(sp.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={sp.name} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{sp.name}</div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 1 }}>{sp.role}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                        <Stars value={sp.rating} />
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{sp.years} años de exp.</span>
                      </div>
                    </div>
                    <RadioDot on={value === sp.id} />
                  </div>
                </Card>
              ))}
            </div>
          )}
      </ScrollArea>

      <FooterBar>
        <Button fullWidth iconRight="arrow-right" disabled={!value || eff !== "datos"} onClick={onContinue}>
          {value ? "Ver disponibilidad" : `Elige un ${data.specialistLabel.toLowerCase()}`}
        </Button>
      </FooterBar>
    </div>
  );
}

function RadioDot({ on }) {
  return (
    <span style={{
      width: 24, height: 24, borderRadius: "9999px", flex: "none",
      border: `2px solid ${on ? "var(--brand)" : "var(--border-default)"}`,
      background: on ? "var(--brand)" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center", transition: "all var(--dur-fast) var(--ease-out)",
    }}>{on && <span style={{ width: 8, height: 8, borderRadius: "9999px", background: "#fff" }} />}</span>
  );
}

Object.assign(window, { useScreenState, CategoryChips, RadioDot, ScreenInicio, ScreenServicios, ScreenEspecialista });
