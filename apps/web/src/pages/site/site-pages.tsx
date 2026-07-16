import { Fragment, useState } from 'react';
import { money } from '../../lib/format';
import { Badge, Button, Icon } from '../../ui/ui';
import {
  FAQ,
  FEATURES,
  FEATURE_GROUPS,
  METRICS,
  PAINS,
  PLANS,
  STEPS,
  TESTIMONIALS,
  VERTICAL,
  displayMonthly,
  monthly,
  planById,
  type Ciclo,
  type Plan,
  type Vertical,
} from './site-data';
import { AnimatedBackground } from '../../ui/AnimatedBackground';
import { Reveal } from '../../ui/Reveal';
import { BillingToggle, BrowserMock, FeatureCard, Pill, PlanCard, Section, SectionHead, SField, SInput, type Funnel, type Go } from './site-ui';
import { FloatingChip, GlowBlob, Marquee, MediaFrame } from './site-media';

/** Ciudades para la franja "confían en nosotros" (marquee). */
const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Pereira', 'Manizales'];

/**
 * Bloques showcase (zig-zag imagen + texto). Coloca las capturas reales en
 * `apps/web/public/marketing/` con estos nombres; mientras no existan, se ve el
 * placeholder guiado con la instrucción.
 */
const SHOWCASE = [
  {
    eyebrow: 'Agenda',
    title: 'El día de tu equipo, en tiempo real',
    desc: 'Cada especialista ve su agenda ordenada; recepción mueve, reasigna y cobra sin fricción. Cero doble reserva.',
    bullets: ['Vista por sede o consolidada', 'Estados de la cita en vivo', 'Walk-in y registro retroactivo'],
    img: '/marketing/captura-agenda.png',
    imgLabel: 'Captura: Agenda del día',
    imgHint: 'Screenshot real del panel (pestaña Agenda). PNG ~1600×1000, fondo claro.',
    icon: 'calendar',
    flip: false,
  },
  {
    eyebrow: 'Finanzas',
    title: 'La caja y la nómina cuadran solas',
    desc: 'Cada servicio se reparte entre el profesional y el negocio con tus reglas. Cierres y liquidaciones sin Excel.',
    bullets: ['Repartición automática por servicio', 'Cierre de quincena y de mes', 'Reportes por sede y por especialista'],
    img: '/marketing/captura-finanzas.png',
    imgLabel: 'Captura: Finanzas / liquidaciones',
    imgHint: 'Screenshot real (Finanzas → liquidaciones o reportes). PNG ~1600×1000.',
    icon: 'wallet',
    flip: true,
  },
];

interface PageProps { vertical: Vertical; go: Go; funnel: Funnel; setFunnel: (f: (p: Funnel) => Funnel) => void }

function choose(plan: Plan, go: Go, setFunnel: (f: (p: Funnel) => Funnel) => void) {
  if (plan.contact) { go('contacto'); return; }
  setFunnel((f) => ({ ...f, planId: plan.id }));
  go('registro');
}

// ── Landing ──────────────────────────────────────────────────────────────────
export function LandingPage({ vertical, go, setFunnel }: PageProps) {
  const vv = VERTICAL[vertical];
  return (
    <div>
      {/* Hero con fondo animado. El fondo del hero termina en --surface-sunken
          (igual que "el problema"), así la animación se funde sin escalón. */}
      <section className="mkt-section mkt-hero-section" style={{ position: 'relative', overflow: 'hidden', paddingBottom: 112, background: 'linear-gradient(to bottom, var(--surface-page) 52%, var(--surface-sunken) 100%)' }}>
        <AnimatedBackground variant="medium" intensity={0.3} speed={0.085} />
        <div className="mkt-wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="mkt-hero">
            <div>
              <Reveal style={{ display: 'inline-block' }}><Pill icon="sparkles" tone="brand">Para {vv.label.toLowerCase()}s en Colombia</Pill></Reveal>
              <Reveal delay={90}><h1 className="mkt-h1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.03em', margin: '18px 0 0', color: 'var(--text-primary)' }}>{vv.heroTitle}</h1></Reveal>
              <Reveal delay={180}><p style={{ fontSize: 'var(--text-md)', lineHeight: 1.5, color: 'var(--text-secondary)', margin: '18px 0 0', maxWidth: 520 }}>{vv.heroSub}</p></Reveal>
              <Reveal delay={270}>
                <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                  <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go('registro')}>Empieza gratis</Button>
                  <Button variant="secondary" size="lg" onClick={() => go('precios')}>Ver precios</Button>
                </div>
              </Reveal>
              <Reveal delay={360}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 26, flexWrap: 'wrap' }}>
                  <AvatarStack vertical={vertical} />
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>+500 negocios</strong> ya operan con Orkalis
                  </div>
                </div>
              </Reveal>
              <Reveal delay={430}>
                <div style={{ display: 'flex', gap: 26, marginTop: 26, flexWrap: 'wrap' }}>
                  {METRICS.map((m) => (
                    <div key={m.label}>
                      <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>{m.value}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            {/* Mock del producto con profundidad: blob + flotación + chips "en vivo". */}
            <Reveal delay={200} y={24}>
              <div style={{ position: 'relative' }}>
                <GlowBlob color="var(--brand)" size={360} style={{ top: -40, right: -40 }} />
                <GlowBlob color="var(--accent)" size={260} style={{ bottom: -30, left: -30 }} />
                <div className="mkt-float-slow" style={{ position: 'relative' }}><BrowserMock vertical={vertical} /></div>
                <FloatingChip icon="check-circle" tone="accent" title="Nueva reserva confirmada" sub="Hoy · 3:30 p. m." float="slow" style={{ top: -18, left: -22 }} />
                <FloatingChip icon="bell" tone="brand" title="Recordatorio enviado" sub="WhatsApp · −40% ausencias" float="fast" style={{ bottom: 34, right: -26 }} />
              </div>
            </Reveal>
          </div>
          {/* Franja "confían en nosotros" (ciudades) — movimiento sutil. */}
          <Reveal delay={520}>
            <div style={{ marginTop: 56, paddingTop: 22, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 16 }}>Barberías y salones en toda Colombia</div>
              <Marquee items={CIUDADES} />
            </div>
          </Reveal>
        </div>
      </section>

      <Section tone="sunken">
        <SectionHead eyebrow="El problema" title="Conoces el dolor. Nosotros la solución." center />
        <div className="mkt-grid-3">
          {PAINS.map((p, i) => (
            <Reveal key={p.pain} delay={i * 90}>
              <div className="mkt-lift" style={{ height: '100%', padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'var(--error-tint)', marginBottom: 14 }}><Icon name={p.icon} size={20} color="var(--error)" /></span>
                <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{p.pain}</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{p.sol}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section id="funciones">
        <SectionHead eyebrow="Funciones" title="Todo lo que tu negocio necesita, en un solo lugar" center />
        <div className="mkt-grid-3">
          {FEATURES.map((f, i) => <Reveal key={f.title} delay={i * 70}><FeatureCard {...f} /></Reveal>)}
        </div>
      </Section>

      {/* Showcase zig-zag: capturas reales del producto + copy. */}
      <Section tone="sunken">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 72 }}>
          {SHOWCASE.map((s) => <ShowcaseRow key={s.title} {...s} />)}
        </div>
      </Section>

      {/* Banda lifestyle a lo ancho: la única foto grande de personas reales. */}
      <LifestyleBand vertical={vertical} go={go} />

      <Section tone="sunken">
        <SectionHead eyebrow="Cómo funciona" title="Empiezas a operar el mismo día" center />
        <div className="mkt-grid-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div style={{ textAlign: 'center', padding: 22 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 999, background: 'var(--brand)', color: '#fff', marginBottom: 14 }}><Icon name={s.icon} size={24} color="#fff" /></span>
                <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{s.n}. {s.title}</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '6px auto 0', maxWidth: 280, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Prueba social" title={`Negocios que dejaron el caos atrás`} center />
        <div className="mkt-grid-3">
          {TESTIMONIALS[vertical].map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <div className="mkt-lift" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>{[0, 1, 2, 3, 4].map((s) => <Icon key={s} name="star" size={15} color="#F59E0B" />)}</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.55, margin: 0, flex: 1 }}>“{t.quote}”</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 16 }}>
                  <div style={{ width: 44, flex: 'none' }}>
                    <MediaFrame circle frame={false} src={`/marketing/avatar-${vertical}-${i + 1}.jpg`} alt={t.name} icon="user" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t.role} · {t.city}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="navy">
        <Reveal style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto' }}>
          <h2 className="mkt-h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0 }}>Tu negocio, en control.</h2>
          <p style={{ fontSize: 'var(--text-md)', color: 'rgba(255,255,255,0.72)', margin: '14px 0 26px' }}>Empieza gratis. Configura tu negocio en minutos y comparte tu enlace de reservas hoy.</p>
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => { setFunnel((f) => ({ ...f })); go('registro'); }}>Crear mi cuenta</Button>
        </Reveal>
      </Section>
    </div>
  );
}

// ── Piezas visuales de la landing ────────────────────────────────────────────

/** Pila de avatares para la prueba social del hero ("+500 negocios"). */
function AvatarStack({ vertical }: { vertical: Vertical }) {
  return (
    <div style={{ display: 'inline-flex' }}>
      {[1, 2, 3, 4].map((n, i) => (
        <span key={n} style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--surface-page)', marginLeft: i === 0 ? 0 : -10, overflow: 'hidden', display: 'inline-block', boxShadow: 'var(--shadow-xs)' }}>
          <MediaFrame circle frame={false} src={`/marketing/avatar-${vertical}-${n}.jpg`} alt="" icon="user" />
        </span>
      ))}
    </div>
  );
}

/** Fila showcase: imagen (captura) + texto, alternando lado. */
function ShowcaseRow({ eyebrow, title, desc, bullets, img, imgLabel, imgHint, icon, flip }: (typeof SHOWCASE)[number]) {
  const texto = (
    <Reveal y={20}>
      <Pill tone="brand" icon={icon}>{eyebrow}</Pill>
      <h3 className="mkt-h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '16px 0 0', fontSize: 'clamp(22px, 2.6vw, 30px)' }}>{title}</h3>
      <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '12px 0 0' }}>{desc}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {bullets.map((b) => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 99, background: 'var(--brand-tint)', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="check" size={13} color="var(--brand)" /></span>
            {b}
          </div>
        ))}
      </div>
    </Reveal>
  );
  const imagen = (
    <Reveal y={24} delay={60}>
      <MediaFrame src={img} alt={title} ratio="16 / 10" label={imgLabel} hint={imgHint} icon={icon} />
    </Reveal>
  );
  return (
    <div className="mkt-grid-2">
      {flip ? <>{imagen}{texto}</> : <>{texto}{imagen}</>}
    </div>
  );
}

/** Banda lifestyle a lo ancho: foto grande de personas reales con overlay. */
function LifestyleBand({ vertical, go }: { vertical: Vertical; go: Go }) {
  const vv = VERTICAL[vertical];
  return (
    <section className="mkt-section" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="mkt-wrap">
        <Reveal y={24}>
          <MediaFrame
            src={`/marketing/lifestyle-${vertical}.jpg`}
            alt={`Interior de una ${vv.label.toLowerCase()} con Orkalis`}
            ratio="21 / 9"
            kenburns
            label={`Foto lifestyle · ${vv.label}`}
            hint="Foto horizontal, cálida, de un profesional atendiendo (o el local). JPG ~2000×860."
            icon="camera"
          >
            {/* Degradado + copy sobre la foto. */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, color-mix(in srgb, var(--navy) 78%, transparent) 0%, color-mix(in srgb, var(--navy) 35%, transparent) 48%, transparent 72%)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: 'clamp(20px, 4vw, 48px)', maxWidth: 560 }}>
                <h2 className="mkt-h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', margin: 0, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>Menos caos. Más sillas llenas.</h2>
                <p style={{ fontSize: 'var(--text-md)', color: 'rgba(255,255,255,0.85)', margin: '12px 0 20px', lineHeight: 1.5, maxWidth: 440 }}>
                  Tu operación ordenada para que te dediques a lo que sabes hacer: atender bien.
                </p>
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go('registro')}>Empieza gratis</Button>
              </div>
            </div>
          </MediaFrame>
        </Reveal>
      </div>
    </section>
  );
}

// ── Precios ──────────────────────────────────────────────────────────────────
export function PricingPage({ go, funnel, setFunnel }: PageProps) {
  const [cycle, setCycle] = useState<Ciclo>(funnel.cycle);
  const [specialists, setSpecialists] = useState(funnel.specialists);
  return (
    <Section>
      <SectionHead eyebrow="Precios" title="Un precio claro, por especialista" sub="Cada plan incluye 2 especialistas. Suma una tarifa por cada uno adicional. Sin sorpresas." center eyebrowTone="brand" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 36, flexWrap: 'wrap' }}>
        <BillingToggle cycle={cycle} onChange={setCycle} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 8px 6px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>Especialistas</span>
          <Stepper value={specialists} set={setSpecialists} min={1} max={16} />
        </div>
      </div>
      <div className="mkt-grid-4">
        {PLANS.map((p, i) => <Reveal key={p.id} delay={i * 80}><PlanCard plan={p} cycle={cycle} specialists={specialists} onChoose={(pl) => { setFunnel((f) => ({ ...f, cycle, specialists })); choose(pl, go, setFunnel); }} /></Reveal>)}
      </div>
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <Button variant="ghost" iconRight="arrow-right" onClick={() => go('comparar')}>Comparar todos los planes</Button>
      </div>
    </Section>
  );
}

// ── Comparativa ──────────────────────────────────────────────────────────────
export function ComparePage({ go }: PageProps) {
  const cell = (v: boolean | string) => {
    if (v === true) return <Icon name="check" size={18} color="var(--success)" />;
    if (v === '—') return <span style={{ color: 'var(--text-disabled)' }}>—</span>;
    return <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{v}</span>;
  };
  return (
    <Section>
      <SectionHead eyebrow="Comparativa" title="Compara los planes en detalle" center />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', position: 'sticky', left: 0, background: 'var(--surface-page)' }} />
              {PLANS.map((p) => (
                <th key={p.id} style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-base)', color: p.highlight ? 'var(--brand)' : 'var(--text-primary)' }}>{p.name}</div>
                  {!p.contact && <div className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{money(p.base)}/mes</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_GROUPS.map((g) => (
              <Fragment key={g.group}>
                <tr><td colSpan={5} style={{ padding: '18px 16px 8px', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{g.group}</td></tr>
                {g.rows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' }}>{r.label}</td>
                    {r.vals.map((v, i) => <td key={i} style={{ padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>{cell(v)}</td>)}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <Button variant="primary" iconRight="arrow-right" onClick={() => go('registro')}>Empieza gratis</Button>
      </div>
    </Section>
  );
}

// ── Calculadora ──────────────────────────────────────────────────────────────
export function CalculatorPage({ go, funnel, setFunnel }: PageProps) {
  const [planId, setPlanId] = useState(funnel.planId);
  const [specialists, setSpecialists] = useState(funnel.specialists);
  const [cycle, setCycle] = useState<Ciclo>(funnel.cycle);
  const plan = planById(planId);
  // TODO(v-next): sustituir la fórmula local por el cálculo real de suscripción del backend.
  const mensual = monthly(plan, specialists);
  const mostrado = displayMonthly(plan, specialists, cycle);
  const extra = Math.max(0, specialists - plan.included);

  return (
    <Section>
      <SectionHead eyebrow="Calculadora" title="¿Cuánto pagarías?" sub="Estima tu cobro mensual según tu plan y tu equipo." center eyebrowTone="brand" />
      <div className="mkt-funnel" style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 32, maxWidth: 880, margin: '0 auto', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8 }}>Plan</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PLANS.filter((p) => !p.contact).map((p) => {
                const on = p.id === planId;
                return <button key={p.id} type="button" data-testid={`calc-plan-${p.id}`} onClick={() => setPlanId(p.id)} style={{ height: 40, padding: '0 16px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand-tint)' : 'var(--surface-card)', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{p.name}</button>;
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Especialistas</div>
            <Stepper value={specialists} set={setSpecialists} min={1} max={16} testId="calc-especialistas" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Facturación</div>
            <BillingToggle cycle={cycle} onChange={setCycle} />
          </div>
        </div>
        <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--navy)', color: '#fff' }}>
          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.6)' }}>Tu cobro estimado</div>
          <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', margin: '6px 0 2px' }}>{money(mostrado)}<span style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>/mes</span></div>
          {cycle === 'anual' && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>Facturado anual · 2 meses gratis</div>}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)' }}><span>Base ({plan.name})</span><span className="data">{money(plan.base)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)' }}><span>{extra} adicionales × {money(plan.perExtra)}</span><span className="data">{money(extra * plan.perExtra)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.14)' }}><span>Total mensual</span><span className="data" data-testid="calc-total">{money(mensual)}</span></div>
          </div>
          <Button variant="primary" size="md" fullWidth iconRight="arrow-right" style={{ marginTop: 18 }} onClick={() => { setFunnel((f) => ({ ...f, planId, specialists, cycle })); go('registro'); }}>Empezar con {plan.name}</Button>
        </div>
      </div>
    </Section>
  );
}

// ── FAQ / Soporte ────────────────────────────────────────────────────────────
export function FAQPage({ go }: { go: Go }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section>
      <SectionHead eyebrow="Soporte" title="Preguntas frecuentes" center />
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQ.map((f, i) => {
          const on = open === i;
          return (
            <div key={i} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpen(on ? null : i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '16px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{f.q}</span>
                <Icon name={on ? 'chevron-up' : 'chevron-down'} size={18} color="var(--text-tertiary)" />
              </button>
              {on && <div style={{ padding: '0 18px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{f.a}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>¿No resolviste tu duda? </span>
        <Button variant="ghost" iconRight="arrow-right" onClick={() => go('contacto')}>Contáctanos</Button>
      </div>
    </Section>
  );
}

export function ContactPage() {
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' });
  const [enviado, setEnviado] = useState(false);
  return (
    <Section>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <SectionHead eyebrow="Contacto" title="Hablemos de tu negocio" sub="Cuéntanos qué necesitas y te contactamos. Para cadenas, agendamos una demo." eyebrowTone="brand" />
        {enviado ? (
          <div style={{ display: 'flex', gap: 12, padding: 18, borderRadius: 'var(--radius-md)', background: 'var(--teal-tint)', border: '1px solid rgba(0,212,170,0.28)' }}>
            <Icon name="check-circle" size={20} color="var(--success)" style={{ flex: 'none' }} />
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Gracias. Te contactaremos pronto a <strong style={{ color: 'var(--text-primary)' }}>{form.email || 'tu correo'}</strong>. <span style={{ color: 'var(--text-tertiary)' }}>(maqueta · sin envío real)</span></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SField label="Nombre"><SInput value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Tu nombre" /></SField>
            <SField label="Correo"><SInput value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="nombre@negocio.co" /></SField>
            <SField label="Mensaje">
              <textarea value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} rows={4} placeholder="¿Qué necesitas?" style={{ width: '100%', padding: '12px 13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', background: 'var(--surface-card)', resize: 'vertical' }} />
            </SField>
            <Button variant="primary" size="lg" fullWidth iconRight="mail" onClick={() => setEnviado(true)}>Enviar mensaje</Button>
          </div>
        )}
      </div>
    </Section>
  );
}

export function LegalPage({ kind }: { kind: 'terminos' | 'privacidad' }) {
  const titulo = kind === 'terminos' ? 'Términos y condiciones' : 'Política de privacidad · Habeas Data';
  return (
    <Section>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <SectionHead eyebrow="Legal" title={titulo} sub="Documento maqueta para la versión visual del sitio." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {['Este es un texto de marcador de posición para la maqueta del sitio. El contenido legal definitivo se incorporará cuando se encienda el alta self-service.', 'Orkalis cobra únicamente la suscripción a la plataforma. El cobro del servicio a los clientes finales del negocio es presencial y ajeno a Orkalis.', 'El tratamiento de datos personales sigue la Ley 1581 de 2012 (Habeas Data). El titular puede consultar, actualizar o suprimir sus datos en contacto@orkalis.co.'].map((p, i) => (
            <p key={i} style={{ margin: 0 }}>{p}</p>
          ))}
          <Badge tone="warning">Maqueta · contenido no vinculante</Badge>
        </div>
      </div>
    </Section>
  );
}

function Stepper({ value, set, min, max, testId }: { value: number; set: (v: number) => void; min: number; max: number; testId?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', background: 'var(--surface-card)' }}>
      <button type="button" aria-label="Menos" data-testid={testId && `${testId}-menos`} onClick={() => set(Math.max(min, value - 1))} style={{ width: 34, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}><Icon name="minus" size={14} color="var(--text-secondary)" /></button>
      <span className="data" data-testid={testId && `${testId}-valor`} style={{ minWidth: 40, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{value}{value >= max ? '+' : ''}</span>
      <button type="button" aria-label="Más" data-testid={testId && `${testId}-mas`} onClick={() => set(Math.min(max, value + 1))} style={{ width: 34, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', borderLeft: '1px solid var(--border-subtle)' }}><Icon name="plus" size={14} color="var(--text-secondary)" /></button>
    </div>
  );
}
