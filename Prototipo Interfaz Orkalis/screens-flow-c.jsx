/* Orkalis — pantallas del flujo (parte C): 1.6 Confirmación · 1.7 Gestión */

// Resumen reutilizable de la reserva (servicios, especialista, fecha/hora, total)
function BookingSummary({ data, summary, compact }) {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {summary.services.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, flex: "none", background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="scissors" size={16} color="var(--brand)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{s.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{s.min} min</div>
            </div>
            <div className="data" style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{OrkData.COP(s.price)}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: "var(--border-subtle)" }} />
      <DetailRow icon="user" label={data.specialistLabel} value={summary.specialistName} />
      <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
      <DetailRow icon="calendar" label="Fecha" value={summary.dateLabel} />
      <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
      <DetailRow icon="clock" label="Hora" value={`${summary.time} · ${summary.totalMin} min`} />
      {!compact && <>
        <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
        <DetailRow icon="map-pin" label="Lugar" value={data.business.address} />
      </>}
      <div style={{ height: 1, background: "var(--border-subtle)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--surface-sunken)" }}>
        <span style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>Total</span>
        <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>{OrkData.COP(summary.total)}</span>
      </div>
    </Card>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
      <span style={{ width: 24, flex: "none", display: "flex", justifyContent: "center" }}><Icon name={icon} size={17} color="var(--text-tertiary)" /></span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", flex: "none" }}>{label}</span>
      <span style={{ flex: 1, textAlign: "right", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

// ════════════════════════ 1.6 CONFIRMACIÓN ════════════════════════
// phase "review" → confirma; phase "result" → muestra Confirmada/Solicitada
function ScreenConfirmacion({ data, summary, confirmMode, phase, submitting, appointment, onBack, onConfirm, onManage, onNew, onToast }) {
  const manual = confirmMode === "manual";

  if (phase === "result" && appointment) {
    const ok = appointment.status === "Confirmada";
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ paddingTop: STATUS_TOP }}>
          <div style={{ padding: "28px 20px 16px", textAlign: "center" }}>
            <div style={{
              width: 84, height: 84, borderRadius: "9999px", margin: "0 auto 20px",
              background: ok ? "var(--success-tint)" : "var(--warning-tint)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "ork-pop var(--dur-slow) var(--ease-out)",
            }}>
              <Icon name={ok ? "check-circle" : "clock"} size={42} color={ok ? "var(--success)" : "var(--warning)"} />
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: 8 }}>{ok ? "¡Cita confirmada!" : "Solicitud enviada"}</h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 300, margin: "0 auto", lineHeight: "20px" }}>
              {ok
                ? `Te esperamos en ${data.business.name}. Recibirás un recordatorio por WhatsApp.`
                : `${data.business.name} revisará tu solicitud y te confirmará por WhatsApp. Aún no es definitiva.`}
            </p>
            <div style={{ marginTop: 16 }}><StatusBadge status={appointment.status} size="lg" /></div>
          </div>

          <div style={{ padding: "8px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, padding: "10px 14px", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Código de reserva</span>
              <span className="data" style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)", letterSpacing: "0.04em" }}>{appointment.code}</span>
            </div>
            <BookingSummary data={data} summary={summary} />
          </div>
        </ScrollArea>
        <FooterBar>
          {ok && <Button fullWidth variant="secondary" size="md" iconLeft="calendar" onClick={() => onToast({ tone: "success", msg: "Agregado a tu calendario" })} style={{ marginBottom: 10 }}>Agregar al calendario</Button>}
          <Button fullWidth iconRight="arrow-right" onClick={onManage}>Ver mi cita</Button>
        </FooterBar>
      </div>
    );
  }

  // phase review
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Revisa y confirma" sub={data.business.name} onBack={onBack} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          <BookingSummary data={data} summary={summary} />

          {/* Datos de contacto */}
          <div style={{ marginTop: 16 }}>
            <Card padding={0}>
              <DetailRow icon="user" label="Reservas a nombre de" value={summary.contact.name} />
              <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
              <DetailRow icon="phone" label="Celular" value={`+57 ${summary.contact.phone}`} />
            </Card>
          </div>

          {/* Aviso de modo de confirmación */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, padding: 14, borderRadius: "var(--radius-md)", background: manual ? "var(--warning-tint)" : "var(--info-tint)", border: `1px solid ${manual ? "rgba(245,158,11,0.25)" : "rgba(59,130,246,0.2)"}` }}>
            <Icon name={manual ? "clock" : "shield-check"} size={18} color={manual ? "#B45309" : "var(--info)"} style={{ marginTop: 1 }} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: "18px" }}>
              {manual
                ? "Este negocio aprueba las citas manualmente. Tu reserva quedará como solicitada hasta que la confirmen."
                : "Tu cita se confirma de inmediato. Puedes cancelar o reagendar hasta 2 horas antes sin costo."}
            </span>
          </div>
        </div>
      </ScrollArea>
      <FooterBar>
        <PriceCta
          label={OrkData.COP(summary.total)}
          sublabel={`${summary.services.length} serv. · ${summary.totalMin} min`}
          ctaLabel={submitting ? "Procesando…" : manual ? "Enviar solicitud" : "Confirmar reserva"}
          ctaIcon={submitting ? null : "check"}
          disabled={submitting}
          onCta={onConfirm}
        />
      </FooterBar>
    </div>
  );
}

// ════════════════════════ 1.7 GESTIÓN ════════════════════════
function ScreenGestion({ data, appointment, summary, onBack, onReschedule, onCancel, onNew, onToast }) {
  const [sheet, setSheet] = React.useState(null); // null | 'cancel'

  // sin cita (entrada "ya tengo una cita")
  if (!appointment) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <AppHeader title="Mi cita" sub={data.business.name} onBack={onBack} />
        <ScrollArea>
          <EmptyState icon="ticket" title="No encontramos citas activas"
            body="No hay reservas asociadas a este enlace todavía. Cuando agendes una cita aparecerá aquí."
            action={<Button size="md" iconRight="arrow-right" onClick={onNew}>Reservar una cita</Button>} />
        </ScrollArea>
      </div>
    );
  }

  const cancelled = appointment.status === "Cancelada";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppHeader title="Mi cita" sub={data.business.name} onBack={onBack} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          {/* Ticket */}
          <Card padding={0} style={{ overflow: "hidden", opacity: cancelled ? 0.85 : 1 }}>
            <div style={{ background: "var(--navy)", padding: "18px 18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "14px 14px", opacity: 0.6 }} />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{data.business.name}</div>
                  <div className="data" style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-xl)" }}>{summary.time}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "var(--text-sm)", marginTop: 2 }}>{summary.dateLabel}</div>
                </div>
                <StatusBadge status={appointment.status} size="lg" />
              </div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.services.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-base)", color: "var(--text-primary)", fontWeight: 500 }}>{s.name}</span>
                  <span className="data" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{OrkData.COP(s.price)}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: "var(--border-subtle)" }} />
            <DetailRow icon="user" label={data.specialistLabel} value={summary.specialistName} />
            <div style={{ height: 1, background: "var(--border-subtle)", marginLeft: 48 }} />
            <DetailRow icon="map-pin" label="Lugar" value={data.business.address} />
            <div style={{ height: 1, background: "var(--border-subtle)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Código {appointment.code}</span>
              <span className="data" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{OrkData.COP(summary.total)}</span>
            </div>
          </Card>

          {cancelled && (
            <div style={{ marginTop: 16, display: "flex", gap: 10, padding: 14, borderRadius: "var(--radius-md)", background: "var(--error-tint)" }}>
              <Icon name="info" size={18} color="var(--error)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: "18px" }}>Esta cita fue cancelada. Puedes reservar una nueva cuando quieras.</span>
            </div>
          )}

          {/* Acciones secundarias */}
          {!cancelled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              <Button variant="secondary" size="md" iconLeft="navigation" onClick={() => onToast({ tone: "info", msg: "Abriendo cómo llegar…" })}>Cómo llegar</Button>
              <Button variant="secondary" size="md" iconLeft="phone" onClick={() => onToast({ tone: "info", msg: "Llamando al negocio…" })}>Llamar</Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <FooterBar>
        {cancelled ? (
          <Button fullWidth iconRight="arrow-right" onClick={onNew}>Reservar de nuevo</Button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" size="lg" iconLeft="refresh-cw" onClick={onReschedule} style={{ flex: 1 }}>Reagendar</Button>
            <Button variant="dangerGhost" size="lg" onClick={() => setSheet("cancel")} style={{ flex: 1, border: "1px solid var(--border-default)" }}>Cancelar cita</Button>
          </div>
        )}
      </FooterBar>

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="¿Cancelar esta cita?"
        footer={
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setSheet(null)}>Volver</Button>
            <Button variant="danger" size="lg" style={{ flex: 1 }} onClick={() => { setSheet(null); onCancel(); }}>Sí, cancelar</Button>
          </div>
        }>
        <p style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: "22px" }}>
          Se liberará tu horario de las <strong className="data" style={{ color: "var(--text-primary)" }}>{summary.time}</strong>. Esta acción no se puede deshacer, pero podrás reservar de nuevo.
        </p>
      </Sheet>
    </div>
  );
}

Object.assign(window, { BookingSummary, DetailRow, ScreenConfirmacion, ScreenGestion });
