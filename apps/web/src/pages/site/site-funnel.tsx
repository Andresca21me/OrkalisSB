import { useState } from 'react';
import type { PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { Badge, Button, Icon } from '../../ui/ui';
import { monthly, planById, VERTICAL, type Vertical } from './site-data';
import { PlanSummary, SField, SInput, SSeg, Section, SectionHead, type Funnel, type Go } from './site-ui';
import { CheckoutMercadoPago } from './checkout-mp';

interface Props { vertical: Vertical; go: Go; funnel: Funnel; setFunnel: (f: (p: Funnel) => Funnel) => void }

// ── 8.5 · Registro (alta real · Plan-Pagos FASE-03) ──────────────────────────
export function SignupPage({ vertical, go, funnel, setFunnel }: Props) {
  const { registrar } = useAuth();
  const [form, setForm] = useState({ negocio: '', tipo: vertical as string, responsable: '', email: '', tel: '', pass: '' });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | 'prueba' | 'pago'>(null);
  const [serverErr, setServerErr] = useState<string>();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const emailValid = /.+@.+\..+/.test(form.email);
  const errs = {
    negocio: touched && !form.negocio.trim() ? 'Escribe el nombre de tu negocio' : undefined,
    responsable: touched && !form.responsable.trim() ? 'Escribe tu nombre' : undefined,
    email: touched && !emailValid ? 'Correo no válido' : undefined,
    pass: touched && form.pass.length < 8 ? 'Mínimo 8 caracteres' : undefined,
  };
  const valid = form.negocio.trim() && form.responsable.trim() && emailValid && form.pass.length >= 8;

  async function crear(modo: 'prueba' | 'pago') {
    setTouched(true);
    setServerErr(undefined);
    if (!valid || busy) return;
    setBusy(modo);
    setFunnel((f) => ({ ...f, vertical: form.tipo as Vertical, negocio: form.negocio }));
    try {
      const plan = planById(funnel.planId);
      // El cupo no puede ser menor que los especialistas incluidos del plan.
      const numEspecialistas = Math.max(funnel.specialists, plan.included);
      const r = await registrar({
        negocioNombre: form.negocio.trim(),
        perfil: form.tipo as PerfilNegocio,
        plan: funnel.planId as PlanSuscripcion,
        numEspecialistas,
        admin: { nombre: form.responsable.trim(), email: form.email.trim(), password: form.pass },
        modo,
      });
      // Modo prueba: el router entra solo al panel (la sesión ya quedó activa).
      // Modo pago: vamos al checkout (FASE-05).
      if (r.requierePago) go('pago');
    } catch (e) {
      setServerErr(e instanceof Error ? e.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
      setBusy(null);
    }
  }

  return (
    <Section>
      <div className="mkt-funnel" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32, maxWidth: 940, margin: '0 auto', alignItems: 'start' }}>
        <div>
          <SectionHead eyebrow="Crear cuenta" eyebrowTone="brand" title="Crea tu cuenta de Orkalis" sub="Solo lo mínimo para empezar. Configuras el resto después." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SField label="Nombre del negocio" error={errs.negocio}><SInput value={form.negocio} onChange={set('negocio')} placeholder={VERTICAL[vertical].sample} invalid={!!errs.negocio} /></SField>
            <SField label="Tipo de negocio">
              <SSeg value={form.tipo} onChange={set('tipo')} options={[{ value: 'salon', label: 'Salón de belleza' }, { value: 'barberia', label: 'Barbería' }]} />
            </SField>
            <div className="mkt-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SField label="Nombre del responsable" error={errs.responsable}><SInput value={form.responsable} onChange={set('responsable')} placeholder="Ej.: Catalina Mejía" invalid={!!errs.responsable} /></SField>
              <SField label="Teléfono" optional><SInput value={form.tel} onChange={set('tel')} placeholder="300 000 0000" /></SField>
            </div>
            <SField label="Correo" error={errs.email}><SInput value={form.email} onChange={set('email')} type="email" placeholder="nombre@negocio.co" invalid={!!errs.email} /></SField>
            <SField label="Contraseña" hint="Mínimo 8 caracteres." error={errs.pass}><SInput value={form.pass} onChange={set('pass')} type="password" placeholder="Crea una contraseña" invalid={!!errs.pass} /></SField>

            {serverErr && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid var(--error)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
                <Icon name="alert-circle" size={16} color="var(--error)" />{serverErr}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="primary" size="lg" fullWidth iconRight={busy === 'prueba' ? undefined : 'arrow-right'} loading={busy === 'prueba'} disabled={!!busy} onClick={() => crear('prueba')}>Empezar prueba gratis (15 días)</Button>
              <Button variant="secondary" size="lg" fullWidth iconLeft={busy === 'pago' ? undefined : 'credit-card'} loading={busy === 'pago'} disabled={!!busy} onClick={() => crear('pago')}>Pagar y empezar ya</Button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>La prueba no pide tarjeta. Puedes cancelar cuando quieras.</p>
            <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>¿Ya tienes cuenta? <button type="button" onClick={() => go('login')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Inicia sesión</button></p>
          </div>
        </div>
        <PlanSummary funnel={funnel} setFunnel={setFunnel} editable />
      </div>
    </Section>
  );
}

// ── 8.6 · Checkout (Mercado Pago · Plan-Pagos FASE-05) ───────────────────────
export function CheckoutPage({ go, funnel, setFunnel }: Props) {
  const { refrescar } = useAuth();
  const plan = planById(funnel.planId);
  const monto = monthly(plan, funnel.specialists); // = cargoMensual (precios sin IVA)
  const [ok, setOk] = useState(false);

  async function pagado() {
    setOk(true);
    await refrescar(); // carga la sesión → el router entra al panel
  }

  return (
    <Section>
      <div className="mkt-funnel" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32, maxWidth: 940, margin: '0 auto', alignItems: 'start' }}>
        <div>
          <SectionHead eyebrow="Pago" eyebrowTone="brand" title="Activa tu suscripción" sub="Pago seguro con Mercado Pago. Los datos de tu tarjeta no pasan por nuestros servidores." />
          {ok ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 18, borderRadius: 'var(--radius-md)', background: 'var(--teal-tint)', border: '1px solid rgba(0,212,170,0.28)' }}>
              <Icon name="check-circle" size={22} color="var(--success)" />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}><strong>¡Pago aprobado!</strong> Entrando a tu panel…</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 11, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--brand-tint)', border: '1px solid rgba(124,58,237,0.22)', marginBottom: 20 }}>
                <Icon name="zap" size={18} color="var(--brand)" style={{ flex: 'none', marginTop: 1 }} />
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>
                  Pagas <strong style={{ color: 'var(--text-primary)' }}>{money(monto)}/mes</strong> y activas tu cuenta hoy. El cobro se repetirá cada mes en esta misma fecha; puedes cancelar cuando quieras.
                </div>
              </div>
              <CheckoutMercadoPago amount={monto} onPaid={pagado} />
              <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '14px 0 0', lineHeight: 1.5 }}>
                Al pagar aceptas los{' '}
                <button type="button" onClick={() => go('terminos')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, padding: 0 }}>Términos</button>{' '}y el{' '}
                <button type="button" onClick={() => go('privacidad')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, padding: 0 }}>tratamiento de datos</button> (Habeas Data).
              </p>
            </>
          )}
        </div>

        <div>
          <PlanSummary funnel={funnel} setFunnel={setFunnel} />
          <div style={{ marginTop: 16, padding: 20, borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunken)' }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Resumen del pedido</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <span>{plan.name} · {funnel.specialists} especialistas</span>
              <span className="data" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{money(monto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 2px', marginTop: 4, borderTop: '1.5px solid var(--border-default)' }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>Total mensual</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>{money(monto)}</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── 8.7 · Bienvenida ─────────────────────────────────────────────────────────
export function WelcomePage({ vertical, go, funnel }: Props) {
  const plan = planById(funnel.planId);
  const vv = VERTICAL[vertical];
  return (
    <Section>
      <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'var(--teal-tint)', marginBottom: 20 }}>
          <Icon name="check-circle" size={36} color="var(--success)" />
        </span>
        <h1 className="mkt-h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.025em', margin: 0, color: 'var(--text-primary)' }}>¡Bienvenido a Orkalis!</h1>
        <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5 }}>Tu suscripción está activa (maqueta). Inicia sesión para configurar tu negocio y compartir tu enlace de reservas.</p>

        <div style={{ margin: '28px 0', padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="eyebrow">Tu suscripción</span>
            <Badge tone="success" size="lg" dot>Activa</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            {([['Plan', plan.name], ['Especialistas', String(funnel.specialists)], ['Facturación', funnel.cycle === 'anual' ? 'Anual' : 'Mensual'], ['Próximo cobro', 'En 14 días']] as [string, string][]).map(([k, val]) => (
              <div key={k}><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{k}</div><div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div></div>
            ))}
          </div>
        </div>

        {/* TODO(v-next): al encender el alta, encadenar con el onboarding del negocio. */}
        <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={() => go('login')}>Ir a iniciar sesión</Button>

        <div style={{ marginTop: 24, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Icon name="link" size={16} color="var(--brand)" />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Tu enlace de reservas: <span className="data" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vv.bookingHost}</span></span>
        </div>
      </div>
    </Section>
  );
}
