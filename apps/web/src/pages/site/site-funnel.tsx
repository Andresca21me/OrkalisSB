import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { Badge, Button, Icon } from '../../ui/ui';
import { monthly, planById, VERTICAL, type Vertical } from './site-data';
import { PlanSummary, Section, SectionHead, type Funnel, type Go } from './site-ui';
import { CheckoutMercadoPago } from './checkout-mp';

interface Props { vertical: Vertical; go: Go; funnel: Funnel; setFunnel: (f: (p: Funnel) => Funnel) => void }

// El alta (8.5) es ahora el asistente guiado de `alta-wizard.tsx`.

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 18, borderRadius: 'var(--radius-md)', background: 'var(--teal-tint)', border: '1px solid var(--accent-tint-border)' }}>
              <Icon name="check-circle" size={22} color="var(--success)" />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}><strong>¡Pago aprobado!</strong> Entrando a tu panel…</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 11, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--brand-tint)', border: '1px solid var(--brand-tint-border)', marginBottom: 20 }}>
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
