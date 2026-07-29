import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { money } from '../../lib/format';
import { Badge, Button, Icon } from '../../ui/ui';
import { Reveal } from '../../ui/Reveal';
import { PLANS, VERTICAL, annualTotal, displayMonthly, type Ciclo, type Plan, type Vertical } from './site-data';

export type Go = (target: string, opts?: Record<string, unknown>) => void;

// CSS responsive del sitio (se inyecta una vez en SiteApp).
export const SITE_CSS = `
.mkt-wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.mkt-section { padding: 72px 0; }
.mkt-h1 { font-size: clamp(34px, 5vw, 56px); line-height: 1.05; }
.mkt-h2 { font-size: clamp(26px, 3.4vw, 38px); line-height: 1.1; }
.mkt-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.mkt-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.mkt-hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 40px; align-items: center; }
.mkt-mobile { display: none; }
@media (max-width: 920px) {
  .mkt-desktop { display: none !important; }
  .mkt-mobile { display: inline-flex !important; }
  .mkt-hero { grid-template-columns: 1fr; }
  .mkt-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .mkt-funnel { grid-template-columns: 1fr !important; }
  .mkt-footer-grid { grid-template-columns: 1fr 1fr !important; }
}
.mkt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
@media (max-width: 620px) {
  .mkt-section { padding: 48px 0; }
  .mkt-grid-3, .mkt-grid-4 { grid-template-columns: 1fr; }
  .mkt-grid-2 { grid-template-columns: 1fr !important; }
}
/* Móvil pequeño (320–480px): menos aire, tipografías y tarjetas más contenidas
   para reducir el scroll y mostrar más contenido en el primer viewport.
   Solo afecta a móvil; el escritorio conserva sus valores. */
@media (max-width: 480px) {
  .mkt-wrap { padding: 0 16px; }
  .mkt-section { padding: 34px 0; }
  .mkt-h1 { font-size: clamp(26px, 7.5vw, 36px); }
  .mkt-h2 { font-size: clamp(23px, 6vw, 30px); }
  .mkt-hero { gap: 26px; }
  .mkt-hero-section { padding-bottom: 52px !important; }
  .mkt-sectionhead { margin-bottom: 24px !important; }
  .mkt-plancard { padding: 18px !important; }
  .mkt-plancard .mkt-price { font-size: 26px !important; }
}

/* ── Movimiento y detalle (sin abrumar) ─────────────────────────────────── */
/* Elevación suave al pasar el cursor sobre tarjetas. */
.mkt-lift { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s cubic-bezier(0.16,1,0.3,1), border-color 0.28s ease; }
.mkt-lift:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: color-mix(in srgb, var(--brand) 35%, var(--border-subtle)); }
/* Flotación lenta para los chips/mocks del hero. */
@keyframes mkt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes mkt-float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.mkt-float { animation: mkt-float 6s ease-in-out infinite; }
.mkt-float-slow { animation: mkt-float-slow 8s ease-in-out infinite; }
/* Marquee horizontal (franja "confían en nosotros"). */
@keyframes mkt-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.mkt-marquee-track { display: inline-flex; gap: 40px; white-space: nowrap; animation: mkt-marquee 26s linear infinite; }
.mkt-marquee-mask { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
/* Brillo que recorre un texto/acento. */
@keyframes mkt-shimmer { to { background-position: 200% center; } }
.mkt-gradient-text { background: linear-gradient(90deg, var(--brand), var(--accent), var(--brand)); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; animation: mkt-shimmer 6s linear infinite; }
/* Ken-burns muy leve para fotos lifestyle. */
@keyframes mkt-kenburns { from { transform: scale(1); } to { transform: scale(1.06); } }
.mkt-kenburns { animation: mkt-kenburns 18s ease-in-out infinite alternate; }
/* Cursor de la máquina de escribir del titular. Parpadea aparte del texto para
   que no se note el salto entre teclear y borrar. */
@keyframes mkt-caret { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }
.mkt-caret { display: inline-block; width: 3px; margin-left: 2px; border-radius: 2px; background: var(--brand); animation: mkt-caret 1s steps(1) infinite; vertical-align: baseline; }
/* Reserva el alto de la frase más larga: sin esto el titular salta de línea
   cada vez que cambia la palabra y arrastra media pantalla con él. */
.mkt-type-wrap { position: relative; display: block; }
.mkt-type-sizer { visibility: hidden; pointer-events: none; }
.mkt-type-live { position: absolute; inset: 0; }

@media (prefers-reduced-motion: reduce) {
  .mkt-float, .mkt-float-slow, .mkt-marquee-track, .mkt-gradient-text, .mkt-kenburns, .mkt-caret { animation: none !important; }
  .mkt-lift { transition: none; }
}
`;

export function SiteLogo({ color = 'var(--text-primary)', onClick }: { color?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke={color} strokeWidth="2.4" /><circle cx="14.5" cy="14.5" r="4.2" fill={color} /></svg>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.04em', color, textTransform: 'uppercase' }}>Orkalis</span>
    </button>
  );
}

export function Pill({ children, tone = 'teal', icon }: { children: ReactNode; tone?: 'teal' | 'brand'; icon?: string }) {
  const m = tone === 'brand' ? { c: 'var(--brand)', bg: 'var(--brand-tint)', dot: 'var(--brand)' } : { c: 'var(--accent-text)', bg: 'var(--teal-tint)', dot: 'var(--accent)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 13px', borderRadius: 'var(--radius-pill)', background: m.bg, color: m.c, fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
      {icon ? <Icon name={icon} size={13} color={m.c} /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot }} />}
      {children}
    </span>
  );
}

export function VerticalToggle({ vertical, onChange, light }: { vertical: Vertical; onChange: (v: Vertical) => void; light?: boolean }) {
  const opts: { v: Vertical; l: string }[] = [{ v: 'salon', l: 'Salón' }, { v: 'barberia', l: 'Barbería' }];
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 'var(--radius-pill)', background: light ? 'rgba(255,255,255,0.12)' : 'var(--surface-sunken)', border: `1px solid ${light ? 'rgba(255,255,255,0.18)' : 'var(--border-subtle)'}` }}>
      {opts.map((o) => {
        const on = o.v === vertical;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{ height: 32, padding: '0 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: on ? (light ? '#fff' : 'var(--surface-card)') : 'transparent', color: on ? (light ? 'var(--navy)' : 'var(--text-primary)') : (light ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'), boxShadow: on ? 'var(--shadow-xs)' : 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{o.l}</button>
        );
      })}
    </div>
  );
}

export function MktNav({ vertical, onVertical, go }: { vertical: Vertical; onVertical: (v: Vertical) => void; go: Go }) {
  const [open, setOpen] = useState(false);
  const links = [
    { id: 'landing', label: 'Funciones' },
    { id: 'precios', label: 'Precios' },
    { id: 'comparar', label: 'Comparar' },
    { id: 'faq', label: 'FAQ' },
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, height: 64, display: 'flex', alignItems: 'center', gap: 28, padding: '0 24px', background: 'color-mix(in srgb, var(--surface-page) 82%, transparent)', backdropFilter: 'saturate(180%) blur(12px)', WebkitBackdropFilter: 'saturate(180%) blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
      <SiteLogo onClick={() => go('landing')} />
      <nav className="mkt-desktop" style={{ display: 'flex', gap: 2 }}>
        {links.map((l) => (
          <button key={l.label} type="button" onClick={() => go(l.id)} style={{ padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', borderRadius: 'var(--radius-xs)' }}>{l.label}</button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div className="mkt-desktop" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <VerticalToggle vertical={vertical} onChange={onVertical} />
        <button type="button" onClick={() => go('login')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Iniciar sesión</button>
        <Button variant="primary" size="sm" iconRight="arrow-right" onClick={() => go('registro')}>Empieza gratis</Button>
      </div>
      <button type="button" className="mkt-mobile" aria-label="Menú" onClick={() => setOpen((o) => !o)} style={{ display: 'none', border: 'none', background: 'transparent', cursor: 'pointer', padding: 6 }}>
        <Icon name={open ? 'x' : 'list'} size={24} color="var(--text-primary)" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            {links.map((l) => (
              <button key={l.label} type="button" onClick={() => { go(l.id); setOpen(false); }} style={{ textAlign: 'left', padding: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}>{l.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Tipo de negocio</span>
            <VerticalToggle vertical={vertical} onChange={onVertical} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="secondary" size="md" fullWidth onClick={() => { go('login'); setOpen(false); }}>Iniciar sesión</Button>
            <Button variant="primary" size="md" fullWidth iconRight="arrow-right" onClick={() => { go('registro'); setOpen(false); }}>Empieza gratis</Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function Section({ children, tone, id, style }: { children: ReactNode; tone?: 'navy' | 'sunken'; id?: string; style?: CSSProperties }) {
  const bg = tone === 'navy' ? 'var(--navy)' : tone === 'sunken' ? 'var(--surface-sunken)' : 'transparent';
  return <section id={id} className="mkt-section" style={{ background: bg, ...style }}><div className="mkt-wrap">{children}</div></section>;
}

export function SectionHead({ eyebrow, title, sub, center, light, eyebrowTone }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; center?: boolean; light?: boolean; eyebrowTone?: 'teal' | 'brand' }) {
  return (
    <div className="mkt-sectionhead" style={{ maxWidth: 680, margin: center ? '0 auto' : 0, textAlign: center ? 'center' : 'left', marginBottom: 44 }}>
      {eyebrow && <Reveal style={{ marginBottom: 16, display: 'inline-block' }}><Pill tone={eyebrowTone}>{eyebrow}</Pill></Reveal>}
      <Reveal delay={80}>
        <h2 className="mkt-h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.025em', color: light ? '#fff' : 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 'var(--text-md)', lineHeight: 1.5, color: light ? 'rgba(255,255,255,0.72)' : 'var(--text-secondary)', margin: '16px 0 0' }}>{sub}</p>}
      </Reveal>
    </div>
  );
}

export function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="mkt-lift" style={{ height: '100%', padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--brand-tint)', marginBottom: 14 }}><Icon name={icon} size={22} color="var(--brand)" /></span>
      <h3 style={{ fontSize: 'var(--text-md)', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

export function BillingToggle({ cycle, onChange }: { cycle: Ciclo; onChange: (c: Ciclo) => void }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
        {([{ v: 'mensual', l: 'Mensual' }, { v: 'anual', l: 'Anual' }] as { v: Ciclo; l: string }[]).map((o) => {
          const on = o.v === cycle;
          return <button key={o.v} type="button" onClick={() => onChange(o.v)} style={{ height: 36, padding: '0 18px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-xs)' : 'none', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{o.l}</button>;
        })}
      </div>
      <Badge tone="accent" size="lg" dot>2 meses gratis</Badge>
    </div>
  );
}

export function PlanCard({ plan, cycle, specialists, onChoose }: { plan: Plan; cycle: Ciclo; specialists: number; onChoose: (p: Plan) => void }) {
  const price = displayMonthly(plan, specialists || plan.included, cycle);
  const hi = !!plan.highlight;
  return (
    <div className="mkt-plancard" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: 24, borderRadius: 'var(--radius-lg)', background: hi ? 'var(--navy)' : 'var(--surface-card)', color: hi ? '#fff' : 'var(--text-primary)', border: `1px solid ${hi ? 'var(--navy)' : 'var(--border-subtle)'}`, boxShadow: hi ? 'var(--shadow-lg)' : 'var(--shadow-xs)' }}>
      {hi && <span style={{ position: 'absolute', top: 16, right: 16 }}><Badge tone="accent" solid size="md">Recomendado</Badge></span>}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', letterSpacing: '-0.01em' }}>{plan.name}</div>
      <p style={{ fontSize: 'var(--text-sm)', color: hi ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', margin: '6px 0 16px', minHeight: 40 }}>{plan.blurb}</p>
      {plan.contact ? (
        <div style={{ marginBottom: 18 }}>
          <div className="data mkt-price" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em' }}>Desde {money(plan.base)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: hi ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)', marginTop: 4 }}>/mes · hablemos de tu cadena</div>
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: hi ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)' }}>desde</span>
            <span className="data mkt-price" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}>{money(price)}</span>
            <span style={{ fontSize: 'var(--text-sm)', color: hi ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)' }}>/mes</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: hi ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)', marginTop: 4 }}>
            {cycle === 'anual' ? `Facturado anual · ${money(annualTotal(plan, specialists || plan.included))}/año` : `Incluye ${plan.included} especialistas · +${money(plan.perExtra)} por especialista`}
          </div>
        </div>
      )}
      <Button variant={hi ? 'primary' : 'secondary'} size="md" fullWidth iconRight={plan.contact ? 'mail' : 'arrow-right'} onClick={() => onChoose(plan)}>{plan.cta}</Button>
      <div style={{ height: 1, background: hi ? 'rgba(255,255,255,0.12)' : 'var(--border-subtle)', margin: '20px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.perks.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 'var(--text-sm)', color: hi ? 'rgba(255,255,255,0.86)' : 'var(--text-secondary)' }}>
            <Icon name="check" size={16} color={hi ? 'var(--accent-on-inverse)' : 'var(--success)'} style={{ flex: 'none', marginTop: 1 }} />{p}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter({ go }: { go: Go }) {
  const cols: { h: string; items: [string, string][] }[] = [
    { h: 'Producto', items: [['Funciones', 'landing'], ['Precios', 'precios'], ['Comparar planes', 'comparar'], ['Calculadora', 'calculadora']] },
    { h: 'Soluciones', items: [['Para barberías', 'para-barberias'], ['Para salones', 'para-salones'], ['Preguntas frecuentes', 'faq']] },
    { h: 'Empresa', items: [['Contacto / ventas', 'contacto'], ['Iniciar sesión', 'login']] },
    { h: 'Legal', items: [['Términos', 'terminos'], ['Privacidad · Habeas Data', 'privacidad']] },
  ];
  return (
    <footer style={{ background: 'var(--navy)', color: '#fff', padding: '56px 24px 32px' }}>
      <div className="mkt-wrap">
        <div className="mkt-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 32, marginBottom: 40 }}>
          <div>
            <SiteLogo color="#fff" onClick={() => go('landing')} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', margin: '14px 0 0', maxWidth: 260, lineHeight: 1.5 }}>La plataforma de operaciones para salones y barberías en Colombia.</p>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{c.h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.items.map(([l, id]) => (
                  <button key={l} type="button" onClick={() => go(id)} style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.78)' }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>© 2026 Orkalis Software Solutions. Todos los derechos reservados.</p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Orkalis Software Solutions es operado por Andrés Camilo Medina Muriel | NIT / Cédula: 1005892839.</p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Contacto: <a href="mailto:orkalis.solution@gmail.com" style={{ color: 'rgba(255,255,255,0.78)', textDecoration: 'underline' }}>orkalis.solution@gmail.com</a> | Cali, Colombia
          </p>
        </div>
      </div>
    </footer>
  );
}

// Maqueta del enlace público en un navegador.
export function BrowserMock({ vertical }: { vertical: Vertical }) {
  const vv = VERTICAL[vertical];
  const servicios = [{ n: 'Corte de cabello', m: 30, p: 25000 }, { n: 'Barba', m: 20, p: 15000 }, { n: 'Corte + barba', m: 45, p: 35000 }];
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--gray-300)' }} />)}
        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}><Icon name="lock" size={11} color="var(--text-tertiary)" />{vv.bookingHost}</span>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--navy)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="scissors" size={19} color="#fff" /></span>
          <div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{vv.sample}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Reserva en línea</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {servicios.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${i === 0 ? 'var(--brand)' : 'var(--border-subtle)'}`, background: i === 0 ? 'var(--brand-tint)' : 'var(--surface-card)' }}>
              <div><div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.n}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.m} min</div></div>
              <span className="data" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{money(s.p)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          <Icon name="calendar" size={16} color="#fff" />Elegir horario
        </div>
      </div>
    </div>
  );
}

// ── Primitivas de formulario del funnel ──────────────────────────────────────
export function SField({ label, hint, error, optional, children }: { label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{label}{optional && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · opcional</span>}</span>
      {children}
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="alert-circle" size={13} color="var(--error)" />{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{hint}</span> : null}
    </label>
  );
}

export function SInput({ value, onChange, type = 'text', placeholder, invalid, trailing }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; invalid?: boolean; trailing?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 13px', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', border: `1px solid ${invalid ? 'var(--error)' : focus ? 'var(--brand)' : 'var(--border-default)'}`, boxShadow: focus ? `0 0 0 3px ${invalid ? 'var(--error-tint)' : 'var(--brand-tint)'}` : 'none' }}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }} />
      {trailing}
    </div>
  );
}

export function SSeg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
      {options.map((o) => {
        const on = o.value === value;
        return <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{ height: 38, padding: '0 16px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-xs)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-xs)' : 'none', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{o.label}</button>;
      })}
    </div>
  );
}

export interface Funnel { planId: string; specialists: number; sucursales: number; cycle: Ciclo; vertical: Vertical; negocio: string }

export function PlanSummary({ funnel, setFunnel, editable }: { funnel: Funnel; setFunnel: (f: (p: Funnel) => Funnel) => void; editable?: boolean }) {
  const plan = PLANS.find((p) => p.id === funnel.planId) ?? PLANS[1];
  const m = plan.base + Math.max(0, funnel.specialists - plan.included) * plan.perExtra;
  const shown = funnel.cycle === 'anual' ? Math.round((m * 10) / 12) : m;
  const extra = Math.max(0, funnel.specialists - plan.included);
  const Step = ({ value, set, min, max }: { value: number; set: (v: number) => void; min: number; max: number }) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
      <button type="button" onClick={() => set(Math.max(min, value - 1))} style={{ width: 34, height: 36, border: 'none', background: 'var(--surface-card)', cursor: 'pointer' }}><Icon name="minus" size={14} color="var(--text-secondary)" /></button>
      <span className="data" style={{ minWidth: 40, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{value}{value >= max ? '+' : ''}</span>
      <button type="button" onClick={() => set(Math.min(max, value + 1))} style={{ width: 34, height: 36, border: 'none', background: 'var(--surface-card)', cursor: 'pointer', borderLeft: '1px solid var(--border-subtle)' }}><Icon name="plus" size={14} color="var(--text-secondary)" /></button>
    </div>
  );
  return (
    <div style={{ padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="eyebrow">Tu plan</span>
        <Badge tone="brand" size="md">{plan.name}</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
        <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{money(shown)}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>/mes</span>
      </div>
      {funnel.cycle === 'anual' && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-text)', marginTop: 2 }}>Facturado anual · 2 meses gratis</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '18px 0', padding: '16px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {editable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan</span>
            <SSeg value={funnel.planId} onChange={(v) => setFunnel((f) => ({ ...f, planId: v }))} options={PLANS.filter((p) => !p.contact).map((p) => ({ value: p.id, label: p.name }))} />
          </div>
        )}
        <Row label="Especialistas">{editable ? <Step value={funnel.specialists} set={(v) => setFunnel((f) => ({ ...f, specialists: v }))} min={1} max={16} /> : <span className="data" style={{ fontWeight: 600 }}>{funnel.specialists}</span>}</Row>
        <Row label="Sucursales">{editable ? <Step value={funnel.sucursales} set={(v) => setFunnel((f) => ({ ...f, sucursales: v }))} min={1} max={9} /> : <span className="data" style={{ fontWeight: 600 }}>{funnel.sucursales}</span>}</Row>
        <Row label="Facturación">{editable ? <SSeg value={funnel.cycle} onChange={(v) => setFunnel((f) => ({ ...f, cycle: v as Ciclo }))} options={[{ value: 'mensual', label: 'Mensual' }, { value: 'anual', label: 'Anual' }]} /> : <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{funnel.cycle === 'anual' ? 'Anual' : 'Mensual'}</span>}</Row>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Base {money(plan.base)} + {extra} adicionales × {money(plan.perExtra)}. Mensajería WhatsApp + SMS incluida.
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}


/**
 * Titular con máquina de escribir (inspirado en la referencia de gogahub, no
 * copiado: aquí rota la *promesa* del producto, no el tipo de negocio).
 *
 * Tres cuidados que hacen la diferencia entre "bonito" y "usable":
 * - **No salta el layout**: se renderiza invisible la frase más larga para
 *   reservar el alto; si no, el titular cambia de línea y empuja media página.
 * - **Accesible**: el lector de pantalla lee UNA frase completa y estable; la
 *   parte animada va `aria-hidden` para no dictar letra a letra.
 * - **Respeta `prefers-reduced-motion`**: con movimiento reducido se muestra la
 *   primera frase fija, sin teclear.
 */
export function Typewriter({ frases, className, style }: { frases: string[]; className?: string; style?: CSSProperties }) {
  const reducido = usePrefiereMenosMovimiento();
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [borrando, setBorrando] = useState(false);

  const masLarga = frases.reduce((a, b) => (b.length > a.length ? b : a), '');

  // Al cambiar de vertical llega otro array de frases. Sin este reinicio, el
  // contador de letras se queda apuntando a una posición de la frase anterior
  // —normalmente más larga— y la animación se congela hasta recargar.
  useEffect(() => {
    setI(0);
    setN(0);
    setBorrando(false);
  }, [frases]);

  useEffect(() => {
    if (reducido || frases.length === 0) return;
    const frase = frases[i % frases.length];
    // Borrar es más rápido que escribir: así se siente natural y no aburre.
    // Se compara con >= y no con ===: si el contador se pasara de largo por
    // cualquier motivo, la animación se recupera sola en vez de quedarse muerta.
    const completa = !borrando && n >= frase.length;
    const vacia = borrando && n <= 0;
    const espera = completa ? 1900 : vacia ? 260 : borrando ? 32 : 62;

    const t = setTimeout(() => {
      if (completa) setBorrando(true);
      else if (vacia) {
        setBorrando(false);
        setI((v) => (v + 1) % frases.length);
      } else setN((v) => v + (borrando ? -1 : 1));
    }, espera);
    return () => clearTimeout(t);
  }, [n, borrando, i, frases, reducido]);

  if (reducido) return <span className={className} style={style}>{frases[0]}</span>;

  return (
    <span className={`mkt-type-wrap ${className ?? ''}`} style={style}>
      {/* Sizer: reserva el espacio de la frase más larga. */}
      <span className="mkt-type-sizer" aria-hidden="true">{masLarga}</span>
      {/* Texto real para lectores de pantalla (estable, no se teclea). */}
      <span className="sr-only">{frases[0]}</span>
      <span className="mkt-type-live" aria-hidden="true">
        {frases[i % frases.length].slice(0, Math.max(0, n))}
        <span className="mkt-caret" style={{ height: '0.9em' }} />
      </span>
    </span>
  );
}

/** `true` si el sistema pide menos animación (accesibilidad). */
export function usePrefiereMenosMovimiento(): boolean {
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aplicar = () => setReducido(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);
  return reducido;
}
