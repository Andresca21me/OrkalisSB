/* Orkalis — app del especialista (parte B): 2.3 Agenda · 2.4 Detalle del turno */

// ════════════════════════ 2.3 AGENDA ════════════════════════
const WEEK = [
  { dow: "Lun", day: 8 }, { dow: "Mar", day: 9, today: true }, { dow: "Mié", day: 10 },
  { dow: "Jue", day: 11 }, { dow: "Vie", day: 12 }, { dow: "Sáb", day: 13 }, { dow: "Dom", day: 14, closed: true },
];
function ScreenAgenda({ data, turnos, view, onView, agendaState, onOpenTurno }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SpecHeader title="Agenda" />
      <div style={{ flex: "none", padding: "14px 20px", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 12 }}>
        <Segmented options={[{ value: "dia", label: "Día" }, { value: "semana", label: "Semana" }]} value={view} onChange={onView} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" style={navArrow}><Icon name="chevron-left" size={20} /></button>
          <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{view === "dia" ? "Hoy · martes 9 jun" : "8 – 14 de junio"}</span>
          <button type="button" style={navArrow}><Icon name="chevron-right" size={20} /></button>
        </div>
      </div>

      <ScrollArea>
        {agendaState === "cargando" ? <TimelineSkeleton />
          : agendaState === "vacio" ? (
            <EmptyState icon="calendar" title={view === "dia" ? "Día sin turnos" : "Semana sin turnos"}
              body="No hay turnos en este período. Cuando se reserven citas o registres walk-ins aparecerán aquí." />
          ) : view === "dia" ? (
            <DayTimeline data={data} turnos={turnos} onOpenTurno={onOpenTurno} />
          ) : (
            <WeekView data={data} turnos={turnos} onOpenTurno={onOpenTurno} />
          )}
      </ScrollArea>
    </div>
  );
}
const navArrow = { width: 40, height: 40, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--surface-card)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

// Línea de tiempo del día (bloques proporcionales)
const T_START = 8 * 60, T_END = 19 * 60, PXM = 1.25, GUTTER = 52;
function DayTimeline({ data, turnos, onOpenTurno }) {
  const height = (T_END - T_START) * PXM;
  const hours = [];
  for (let h = 8; h <= 19; h++) hours.push(h);
  const nowTop = (SpecData.NOW_MIN - T_START) * PXM;
  const colorFor = (st) => ({ Confirmada: "var(--success)", "En progreso": "var(--info)", Completada: "var(--gray-400)", Cancelada: "var(--error)", "No asistió": "var(--warning)", Solicitada: "var(--warning)" }[st] || "var(--gray-400)");
  const tintFor = (st) => ({ Confirmada: "var(--success-tint)", "En progreso": "var(--info-tint)", Completada: "var(--surface-sunken)", Cancelada: "var(--error-tint)", "No asistió": "var(--warning-tint)", Solicitada: "var(--warning-tint)" }[st] || "var(--surface-sunken)");

  return (
    <div style={{ padding: "10px 16px 24px" }}>
      <div style={{ position: "relative", height }}>
        {hours.map((h) => {
          const top = (h * 60 - T_START) * PXM;
          return (
            <div key={h} style={{ position: "absolute", left: 0, right: 0, top }}>
              <span className="data" style={{ position: "absolute", left: 0, top: -7, width: GUTTER - 12, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{h}:00</span>
              <div style={{ position: "absolute", left: GUTTER, right: 0, top: 0, height: 1, background: "var(--border-subtle)" }} />
            </div>
          );
        })}
        {/* línea de ahora */}
        {nowTop > 0 && nowTop < height && (
          <div style={{ position: "absolute", left: GUTTER - 4, right: 0, top: nowTop, height: 2, background: "var(--brand)", zIndex: 4 }}>
            <span style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: 99, background: "var(--brand)" }} />
          </div>
        )}
        {/* bloques */}
        {turnos.map((t) => {
          const top = (t.startMin - T_START) * PXM;
          const h = Math.max((t.endMin - t.startMin) * PXM, 34);
          const done = t.status === "Completada" || t.status === "Cancelada";
          return (
            <button key={t.id} type="button" onClick={() => onOpenTurno(t)} style={{
              position: "absolute", left: GUTTER, right: 0, top, height: h - 4, textAlign: "left", cursor: "pointer",
              border: `1px solid ${colorFor(t.status)}`, borderLeft: `3px solid ${colorFor(t.status)}`,
              background: tintFor(t.status), borderRadius: "var(--radius-sm)", padding: "5px 10px", overflow: "hidden",
              opacity: done ? 0.72 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="data" style={{ fontWeight: 700, fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>{t.time}</span>
                <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.clientName}</span>
                {t.isNew && <Badge tone="brand">Nuevo</Badge>}
              </div>
              {h > 46 && <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.services.map((s) => s.name).join(" · ")}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Vista semana (columnas compactas)
function WeekView({ data, turnos, onOpenTurno }) {
  // bloques de muestra deterministas para los demás días + turnos reales en hoy
  const sample = { Lun: [["9:00", "Completada"], ["11:30", "Completada"], ["15:00", "Confirmada"]], "Mié": [["10:00", "Confirmada"], ["16:00", "Confirmada"]], Jue: [["9:30", "Confirmada"], ["13:00", "Confirmada"], ["17:30", "Confirmada"]], Vie: [["8:30", "Confirmada"], ["12:00", "Confirmada"], ["14:30", "Confirmada"], ["18:00", "Confirmada"]], "Sáb": [["10:00", "Confirmada"], ["11:00", "Confirmada"]] };
  const colorFor = (st) => ({ Confirmada: "var(--success)", "En progreso": "var(--info)", Completada: "var(--gray-400)" }[st] || "var(--gray-400)");
  return (
    <div style={{ display: "flex", gap: 4, padding: "12px 12px 24px", overflowX: "auto" }}>
      {WEEK.map((d) => {
        const blocks = d.today ? turnos.map((t) => [t.time, t.status, t]) : (sample[d.dow] || []).map((b) => [b[0], b[1], null]);
        return (
          <div key={d.dow} style={{ flex: 1, minWidth: 92 }}>
            <div style={{ textAlign: "center", padding: "6px 0 8px", borderRadius: "var(--radius-sm)", background: d.today ? "var(--brand-tint)" : "transparent", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: d.today ? "var(--brand)" : "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>{d.dow}</div>
              <div className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: d.today ? "var(--brand)" : "var(--text-primary)" }}>{d.day}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {d.closed ? <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-disabled)", padding: "12px 0" }}>Cerrado</div>
                : blocks.length === 0 ? <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-disabled)", padding: "8px 0" }}>—</div>
                : blocks.map(([time, st, t], i) => (
                  <button key={i} type="button" onClick={() => t && onOpenTurno(t)} style={{
                    textAlign: "left", cursor: t ? "pointer" : "default", border: "none", borderLeft: `3px solid ${colorFor(st)}`,
                    background: "var(--surface-sunken)", borderRadius: 4, padding: "5px 6px", overflow: "hidden",
                  }}>
                    <div className="data" style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)" }}>{time}</div>
                    {t && <div style={{ fontSize: 10, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.clientName.split(" ")[0]}</div>}
                  </button>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div style={{ padding: "16px 16px 16px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
      {[64, 110, 48, 90, 70, 56].map((h, i) => <Skeleton key={i} h={h} r={8} />)}
    </div>
  );
}

// ════════════════════════ 2.4 DETALLE DEL TURNO ════════════════════════
function ScreenDetalleTurno({ data, turno, onBack, onStart, onComplete, onAction, onToast }) {
  const [sheet, setSheet] = React.useState(null); // noasistio | cancelar | revertir
  if (!turno) return null;
  const st = turno.status;
  const split = SpecData.SPLIT;

  const confirmSheet = (kind) => {
    const cfg = {
      noasistio: { title: "¿Marcar como no asistió?", body: "El cliente no se presentó. El turno quedará registrado como “No asistió” y se liberará tu agenda.", cta: "Marcar no asistió", variant: "danger" },
      cancelar: { title: "¿Cancelar este turno?", body: "Se cancelará el turno y se liberará el horario. Avísale al cliente si es posible.", cta: "Cancelar turno", variant: "danger" },
      revertir: { title: "¿Revertir el cobro?", body: "Esto deshace las ganancias calculadas y devuelve el stock usado. El turno volverá a quedar pendiente de cobro.", cta: "Sí, revertir", variant: "danger" },
    }[kind];
    return (
      <Sheet open={sheet === kind} onClose={() => setSheet(null)} title={cfg.title}
        footer={<div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setSheet(null)}>Volver</Button>
          <Button variant={cfg.variant} size="lg" style={{ flex: 1 }} onClick={() => { setSheet(null); onAction(kind, turno); }}>{cfg.cta}</Button>
        </div>}>
        <p style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: "22px" }}>{cfg.body}</p>
      </Sheet>
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Turno" sub={`${turno.time} – ${turno.endLabel}`} onBack={onBack} right={<StatusBadge status={st} />} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          {/* Cliente */}
          <Card padding={0} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
              <Avatar name={turno.clientName} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{turno.clientName}</span>
                  {turno.isNew && <Badge tone="brand">Nuevo</Badge>}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{turno.source === "publico" ? "Reserva en línea" : turno.source === "walkin" ? "Walk-in" : "Agendado"}{turno.code ? ` · ${turno.code}` : ""}</div>
              </div>
              {turno.clientPhone ? (
                <button type="button" onClick={() => onToast({ tone: "info", msg: "Llamando al cliente…" })} style={{ ...navArrow, borderRadius: 99 }}><Icon name="phone" size={18} color="var(--brand)" /></button>
              ) : null}
            </div>
            {turno.clientPhone ? <><div style={{ height: 1, background: "var(--border-subtle)" }} /><DetailRow icon="phone" label="Teléfono" value={`+57 ${turno.clientPhone}`} /></> : null}
          </Card>

          {/* Servicios */}
          <SectionLabel>Servicios</SectionLabel>
          <Card padding={0} style={{ marginBottom: 14 }}>
            {turno.services.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && <div style={{ height: 1, background: "var(--border-subtle)" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{s.min} min</div>
                  </div>
                  <span className="data" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{OrkData.COP(s.price)}</span>
                </div>
              </React.Fragment>
            ))}
            <div style={{ height: 1, background: "var(--border-subtle)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 14px", background: "var(--surface-sunken)" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{st === "Completada" ? "Total cobrado" : "Total estimado"}</span>
              <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{OrkData.COP(turno.total)}</span>
            </div>
          </Card>

          {/* Resumen de cobro/reparto (solo lectura, Completada) */}
          {st === "Completada" && (
            <>
              <SectionLabel>Cobro y reparto</SectionLabel>
              <Card padding={0} style={{ marginBottom: 14 }}>
                <DetailRow icon="wallet" label="Método de pago" value={(SpecData.PAYMENTS.find((p) => p.id === turno.payment) || { label: "Efectivo" }).label} />
                <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
                <DetailRow icon="user" label="Tu parte (60%)" value={OrkData.COP(Math.round(turno.total * split.service))} />
                <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
                <DetailRow icon="building" label="Salón (40%)" value={OrkData.COP(turno.total - Math.round(turno.total * split.service))} />
              </Card>
            </>
          )}

          {/* Notas */}
          <SectionLabel>Notas del turno</SectionLabel>
          <Card padding={14} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: "var(--text-sm)", color: turno.status === "Completada" ? "var(--text-secondary)" : "var(--text-tertiary)", lineHeight: "20px" }}>
              {turno.source === "publico" ? "Cliente nuevo del enlace de reservas. Confirmar preferencia de largo en los lados." : "Sin notas. Toca para agregar una nota antes o durante el turno."}
            </div>
          </Card>

          {(st === "Cancelada" || st === "No asistió") && (
            <Alert tone={st === "Cancelada" ? "error" : "warning"} title={st === "Cancelada" ? "Turno cancelado" : "Cliente no asistió"} style={{ marginTop: 8 }}>
              Este turno está cerrado. El horario quedó libre en tu agenda.
            </Alert>
          )}
        </div>
      </ScrollArea>

      {/* Acción primaria por estado */}
      {(st === "Confirmada" || st === "Solicitada") && (
        <FooterBar>
          <Button size="lg" fullWidth iconLeft="play" onClick={() => onStart(turno)}>Iniciar turno</Button>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={() => setSheet("noasistio")}>No asistió</Button>
            <Button variant="dangerGhost" size="md" style={{ flex: 1, border: "1px solid var(--border-default)" }} onClick={() => setSheet("cancelar")}>Cancelar</Button>
          </div>
        </FooterBar>
      )}
      {st === "En progreso" && (
        <FooterBar>
          <Button size="lg" fullWidth iconLeft="check" onClick={() => onComplete(turno)}>Completar turno</Button>
          <Button variant="dangerGhost" size="md" fullWidth style={{ marginTop: 10, border: "1px solid var(--border-default)" }} onClick={() => setSheet("cancelar")}>Cancelar (incidente)</Button>
        </FooterBar>
      )}
      {st === "Completada" && (
        <FooterBar>
          <button type="button" onClick={() => setSheet("revertir")} style={{ width: "100%", height: 44, border: "1px solid var(--border-default)", background: "var(--surface-card)", color: "var(--text-secondary)", borderRadius: "var(--radius-sm)", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="rotate-ccw" size={16} /> Revertir cobro
          </button>
        </FooterBar>
      )}

      {confirmSheet("noasistio")}
      {confirmSheet("cancelar")}
      {confirmSheet("revertir")}
    </div>
  );
}

Object.assign(window, { ScreenAgenda, DayTimeline, WeekView, ScreenDetalleTurno });
