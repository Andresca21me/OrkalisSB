import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { MktNav, SiteFooter, SITE_CSS, type Funnel, type Go } from './site-ui';
import type { Vertical } from './site-data';
import { applyVertical, loadLandingVertical, saveLandingVertical } from '../../lib/theme';
import { CalculatorPage, ComparePage, ContactPage, FAQPage, LandingPage, LegalPage, PricingPage } from './site-pages';
import { CheckoutPage, WelcomePage } from './site-funnel';
import { SignupPage } from './alta-wizard';

/** Sitio de marketing + funnel (FASE-12, SOLO VISUAL). Rutas públicas. */
export function SiteApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [vertical, setVertical] = useState<Vertical>(() => loadLandingVertical());
  const [funnel, setFunnel] = useState<Funnel>({ planId: 'pro', specialists: 4, sucursales: 1, cycle: 'mensual', vertical: loadLandingVertical(), negocio: '' });

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [location.pathname]);

  // El selector del navbar cambia el tema de TODA la landing (y se recuerda
  // durante la sesión). Solo afecta al sitio público; la plataforma usa el
  // tema de la cuenta.
  useEffect(() => {
    applyVertical(vertical);
    saveLandingVertical(vertical);
  }, [vertical]);

  const go: Go = (target, opts) => {
    if (opts) setFunnel((f) => ({ ...f, ...opts }));
    switch (target) {
      case 'landing': navigate('/'); break;
      case 'precios': navigate('/precios'); break;
      case 'comparar': navigate('/comparativa'); break;
      case 'calculadora': navigate('/calculadora'); break;
      case 'registro': navigate('/alta'); break;
      case 'pago': navigate('/checkout'); break;
      case 'bienvenida': navigate('/bienvenida'); break;
      case 'faq': navigate('/soporte'); break;
      case 'contacto': navigate('/contacto'); break;
      case 'terminos': navigate('/terminos'); break;
      case 'privacidad': navigate('/privacidad'); break;
      case 'login': navigate('/login'); break;
      case 'para-barberias': setVertical('barberia'); setFunnel((f) => ({ ...f, vertical: 'barberia' })); navigate('/'); break;
      case 'para-salones': setVertical('salon'); setFunnel((f) => ({ ...f, vertical: 'salon' })); navigate('/'); break;
      default: navigate('/');
    }
  };

  const onVertical = (v: Vertical) => { setVertical(v); setFunnel((f) => ({ ...f, vertical: v })); };
  const shared = { vertical, go, funnel, setFunnel };

  // El alta es un asistente a pantalla completa (réplica del prototipo): trae
  // su propia cabecera y no debe competir con el nav ni el footer del sitio.
  const asistente = location.pathname === '/alta';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      <style>{SITE_CSS}</style>
      {!asistente && <MktNav vertical={vertical} onVertical={onVertical} go={go} />}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route index element={<LandingPage {...shared} />} />
          <Route path="precios" element={<PricingPage {...shared} />} />
          <Route path="comparativa" element={<ComparePage {...shared} />} />
          <Route path="calculadora" element={<CalculatorPage {...shared} />} />
          <Route path="alta" element={<SignupPage {...shared} />} />
          <Route path="checkout" element={<CheckoutPage {...shared} />} />
          <Route path="bienvenida" element={<WelcomePage {...shared} />} />
          <Route path="soporte" element={<FAQPage go={go} />} />
          <Route path="contacto" element={<ContactPage />} />
          <Route path="terminos" element={<LegalPage kind="terminos" />} />
          <Route path="privacidad" element={<LegalPage kind="privacidad" />} />
          <Route path="*" element={<LandingPage {...shared} />} />
        </Routes>
      </main>
      {!asistente && <SiteFooter go={go} />}
    </div>
  );
}
