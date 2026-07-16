/* Orkalis — app del especialista (parte A): 2.1 Acceso · 2.2 Mi día */

// Marca Orkalis (cuadro redondeado + círculo en órbita)
function OrkMark({ size = 40, color = "var(--navy)" }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, border: `${Math.max(2, size * 0.07)}px solid ${color}`, position: "relative", display: "inline-block", flex: "none" }}>
      <span style={{ position: "absolute", right: size * 0.13, bottom: size * 0.13, width: size * 0.34, height: size * 0.34, borderRadius: "9999px", background: color }} />
    </span>
  );
}

// ════════════════════════ 2.1 ACCESO ════════════════════════
function ScreenLogin({ data, authState, onLogin, onChangeAuth }) {
  const [email, setEmail] = React.useState("andres@lanavaja.co");
  const [pass, setPass] = React.useState("");
  const [show, setShow] = React.useState(false);
  const suspended = authState === "suspended";
  const loading = authState === "loading";
  const error = authState === "error";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--surface-page)", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(15,25,35,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", paddingTop: STATUS_TOP }}>
        <div style={{ position: "relative" }}>
          {/* Marca + negocio */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
            <OrkMark size={48} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "-0.04em", marginTop: 14, textTransform: "uppercase" }}>Orkalis</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>{data.business.name}</div>
          </div>

          {suspended ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Alert tone="error" title="Cuenta del negocio suspendida">
                La suscripción de {data.business.name} está suspendida. No es posible iniciar sesión ni operar hasta que el administrador regularice el pago.
              </Alert>
              <Button variant="secondary" size="lg" fullWidth iconLeft="phone" onClick={() => onChangeAuth("idle")}>Contactar al administrador</Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Correo o usuario">
                <input value={email} onChange={(e) => { setEmail(e.target.value); error && onChangeAuth("idle"); }} inputMode="email" autoCapitalize="none" style={inputStyle(false)} />
              </Field>
              <Field label="Contraseña" error={error ? "Correo o contraseña incorrectos" : null}>
                <div style={{ position: "relative" }}>
                  <input value={pass} onChange={(e) => { setPass(e.target.value); error && onChangeAuth("idle"); }} type={show ? "text" : "password"} placeholder="••••••••" style={{ ...inputStyle(error), paddingRight: 44 }} />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar" : "Mostrar"} style={{ position: "absolute", right: 6, top: 6, width: 36, height: 36, border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={show ? "eye-off" : "eye"} size={18} />
                  </button>
                </div>
              </Field>
              <Button size="lg" fullWidth disabled={loading} onClick={() => onLogin(email, pass)} style={{ marginTop: 4 }}>
                {loading ? "Entrando…" : "Entrar"}
              </Button>
              <button type="button" onClick={() => onChangeAuth("idle")} style={{ border: "none", background: "transparent", color: "var(--text-link)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", padding: 6, alignSelf: "center" }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: "none", padding: "16px 24px calc(20px + env(safe-area-inset-bottom))", textAlign: "center" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Acceso exclusivo del equipo · sin registro público</span>
      </div>
    </div>
  );
}

// ════════════════════════ 2.2 MI DÍA ════════════════════════
function ScreenMiDia({ data, me, turnos, current, available, branch, branches, dayState, onToggleAvailable, onPickBranch, onOpenTurno, onStartTurno, onCompleteTurno, onSecondary, onWalkin }) {
  const completados = turnos.filter((t) => t.status === "Completada").length;
  const gananciasHoy = turnos.filter((t) => t.status === "Completada").reduce((a, t) => a + Math.round(t.total * SpecData.SPLIT.service), 0);
  const upcoming = turnos.filter((t) => t !== current && t.status !== "Completada" && t.status !== "Cancelada");
  const nextTurno = upcoming[0];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Cabecera con saludo + sucursal + disponibilidad */}
      <header style={{ flex: "none", padding: `${STATUS_TOP + 8}px 20px 16px`, background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: "var(--text-xl)", letterSpacing: "-0.02em", lineHeight: 1.15, whiteSpace: "nowrap" }}>Hola, {me.first}</h1>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>Martes 9 de junio</div>
          </div>
          <Avatar name={me.name} size={44} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          {branches.length > 1 && (
            <button type="button" onClick={onPickBranch} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: "9999px", border: "1px solid var(--border-default)", background: "var(--surface-card)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", maxWidth: 200, overflow: "hidden" }}>
              <Icon name="building" size={15} color="var(--text-tertiary)" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{branch}</span>
              <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
            </button>
          )}
          <button type="button" onClick={() => onToggleAvailable(!available)} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px", borderRadius: "9999px", border: "none", cursor: "pointer", background: available ? "var(--success-tint)" : "var(--surface-sunken)", color: available ? "#0A8F5B" : "var(--text-secondary)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: available ? "var(--success)" : "var(--gray-400)" }} />
            {available ? "Disponible" : "Ocupado"}
          </button>
        </div>
      </header>

      <ScrollArea>
        {dayState === "cargando" ? (
          <div style={{ padding: 20 }}>
            <Skeleton h={188} r={16} style={{ marginBottom: 20 }} />
            <Skeleton w={120} h={12} style={{ marginBottom: 14 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={70} r={8} />)}</div>
          </div>
        ) : dayState === "vacio" ? (
          <EmptyState icon="calendar" title="No tienes turnos hoy"
            body="Tu agenda está libre. Si llega un cliente sin reserva, regístralo como walk-in para empezar."
            action={<Button size="md" iconLeft="plus" onClick={onWalkin}>Registrar walk-in</Button>} />
        ) : (
          <div style={{ padding: 20 }}>
            {/* Turno actual protagónico */}
            {current ? (
              <CurrentTurnoHero data={data} turno={current} onOpen={() => onOpenTurno(current)} onStart={() => onStartTurno(current)} onComplete={() => onCompleteTurno(current)} onSecondary={onSecondary} />
            ) : (
              <Card padding={18} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 12, flex: "none", background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clock" size={22} color="var(--text-tertiary)" /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Sin turno en curso</div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>
                      {nextTurno ? `Próximo turno a las ${nextTurno.time}` : "Nada más por hoy"}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Tira-resumen del día */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
              <DayStat value={turnos.length} label="Turnos" />
              <DayStat value={completados} label="Completados" />
              <DayStat value={OrkData.COP(gananciasHoy)} label="Hoy" accent mono />
            </div>

            {/* Próximos turnos */}
            <SectionLabel>Próximos hoy · {upcoming.length}</SectionLabel>
            {upcoming.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcoming.map((t) => <TurnoRow key={t.id} turno={t} data={data} onClick={() => onOpenTurno(t)} />)}
              </div>
            ) : (
              <Card padding={20}><div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>No quedan más turnos por hoy.</div></Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function DayStat({ value, label, accent, mono }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "12px 10px", textAlign: "center" }}>
      <div className={mono ? "data" : ""} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: mono ? "var(--text-base)" : "var(--text-xl)", color: accent ? "#0A8F5B" : "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Tarjeta protagónica del turno actual (estilo conductor)
function CurrentTurnoHero({ data, turno, onOpen, onStart, onComplete, onSecondary }) {
  const enProgreso = turno.status === "En progreso";
  return (
    <div style={{ borderRadius: "var(--radius-xl)", overflow: "hidden", background: "var(--navy)", marginBottom: 22, boxShadow: "var(--shadow-lg)", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.6 }} />
      <div style={{ position: "relative", padding: "18px 18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{enProgreso ? "En progreso ahora" : "Turno actual"}</span>
          <StatusBadge status={turno.status} size="lg" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span className="data" style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-3xl)", letterSpacing: "-0.03em" }}>{turno.time}</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "var(--text-sm)" }}>– {turno.endLabel} · {turno.dur} min</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ color: "#fff", fontSize: "var(--text-lg)", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", lineHeight: 1.15, whiteSpace: "nowrap" }}>{turno.clientName}</span>
          {turno.isNew && <Badge tone="brand" solid>Nuevo</Badge>}
        </div>
        <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "var(--text-sm)", marginBottom: 18 }}>{turno.services.map((s) => s.name).join(" · ")} · {OrkData.COP(turno.total)}</div>

        {enProgreso ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button size="lg" fullWidth iconLeft="check" onClick={onComplete}>Completar turno</Button>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => onSecondary("cancelar", turno)} style={ghostDarkBtn}>Cancelar (incidente)</button>
              <button type="button" onClick={onOpen} style={ghostDarkBtn}>Ver detalle</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button size="lg" fullWidth iconLeft="play" onClick={onStart}>Iniciar turno</Button>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => onSecondary("noasistio", turno)} style={ghostDarkBtn}>No asistió</button>
              <button type="button" onClick={() => onSecondary("cancelar", turno)} style={ghostDarkBtn}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ghostDarkBtn = {
  flex: 1, height: 44, borderRadius: "var(--radius-sm)", border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)", cursor: "pointer",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600,
};

Object.assign(window, { OrkMark, ScreenLogin, ScreenMiDia, CurrentTurnoHero, DayStat });
