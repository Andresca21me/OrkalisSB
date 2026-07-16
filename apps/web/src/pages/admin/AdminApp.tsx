import { useState } from 'react';
import { Shell, type NavItem } from '../../ui/Shell';
import { SucursalProvider } from '../../lib/sucursal';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { Button, Icon } from '../../ui/ui';
import { Tour, type TourStep } from '../../ui/Tour';
import { PanelScreen } from './PanelScreen';
import { AgendaScreen } from './AgendaScreen';
import { GestionScreen } from './GestionScreen';
import { FinanzasScreen } from './FinanzasScreen';
import { ConfigScreen } from './ConfigScreen';
import { ClientesScreen } from './screens';

const NAV: NavItem[] = [
  { id: 'panel', label: 'Panel', icon: 'layout-grid' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'gestion', label: 'Gestión', icon: 'briefcase' },
  { id: 'finanzas', label: 'Finanzas', icon: 'bar-chart-2' },
];

// Configuración vive en el menú de perfil, no en el nav principal.
const PERFIL_ITEMS: NavItem[] = [{ id: 'config', label: 'Configuración', icon: 'settings' }];

export function AdminApp() {
  return (
    <SucursalProvider>
      <AdminShell />
    </SucursalProvider>
  );
}

/** Marca de que el usuario ya vio (o saltó) el tutorial en este navegador. */
const TOUR_KEY = 'orkalis:tour:admin:v1';

/** Pasos del tutorial guiado del panel (Onboarding). `onEnter` cambia de sección. */
function pasosTour(setVista: (v: string) => void): TourStep[] {
  return [
    {
      title: '¡Bienvenido a Orkalis! 👋',
      body: 'Te muestro en un minuto las secciones clave de tu panel. Avanza con “Siguiente” o sáltalo cuando quieras.',
      onEnter: () => setVista('panel'),
    },
    {
      target: '[data-tour="sucursal"]',
      title: 'Tu sede activa',
      body: 'Cambia la sucursal en la que estás trabajando, o “Todo el negocio” para ver todas tus sedes consolidadas.',
      onEnter: () => setVista('panel'),
    },
    {
      target: '[data-tour="nav-panel"]',
      title: 'Panel',
      body: 'Tu resumen del día: próximas citas, ingresos y alertas de un vistazo. Es tu punto de partida cada mañana.',
      onEnter: () => setVista('panel'),
    },
    {
      target: '[data-tour="nav-agenda"]',
      title: 'Agenda',
      body: 'El día de cada especialista, en tiempo real. Desde aquí creas, mueves, reasignas y cobras las citas.',
      onEnter: () => setVista('agenda'),
    },
    {
      target: '[data-tour="nav-clientes"]',
      title: 'Clientes',
      body: 'Tu base de clientes con su historial de visitas y gasto. Se llena sola con cada reserva.',
      onEnter: () => setVista('clientes'),
    },
    {
      target: '[data-tour="nav-gestion"]',
      title: 'Gestión — ¡empieza aquí!',
      body: 'Tu equipo, servicios e inventario. Este es tu primer paso: agrega tus especialistas y define los servicios que ofreces.',
      onEnter: () => setVista('gestion'),
    },
    {
      target: '[data-tour="nav-finanzas"]',
      title: 'Finanzas',
      body: 'Caja, gastos, cierres y las liquidaciones de cada especialista. Todo cuadra solo, sin Excel.',
      onEnter: () => setVista('finanzas'),
    },
    {
      target: '[data-tour="usermenu"]',
      title: 'Configuración y Suscripción',
      body: 'Desde tu menú de usuario abres la Configuración (módulos, reglas y tu enlace de reservas) y tu Suscripción (plan y facturación).',
      onEnter: () => setVista('panel'),
    },
    {
      target: '[data-tour="ayuda"]',
      title: '¿Dudas más adelante?',
      body: 'Puedes reabrir este tutorial cuando quieras desde el botón de ayuda (?). ¡Ahora sí, a operar tu negocio!',
      nextLabel: '¡Empezar!',
      onEnter: () => setVista('panel'),
    },
  ];
}

function AdminShell() {
  const [vista, setVista] = useState('panel');
  // Auto-inicia el tutorial en el primer ingreso de este navegador.
  const [tour, setTour] = useState(() => {
    try { return !localStorage.getItem(TOUR_KEY); } catch { return false; }
  });
  const cerrarTour = () => {
    setTour(false);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <>
      <Shell
        nav={NAV}
        activo={vista}
        onNav={setVista}
        sucursalSelector
        perfilItems={PERFIL_ITEMS}
        acciones={
          <button
            type="button"
            data-tour="ayuda"
            onClick={() => setTour(true)}
            aria-label="Ver tutorial"
            title="Ver tutorial"
            style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
          >
            <Icon name="help-circle" size={18} />
          </button>
        }
      >
        <TrialBanner onIrSuscripcion={() => setVista('config')} />
        {vista === 'panel' && <PanelScreen onNav={setVista} />}
        {vista === 'agenda' && <AgendaScreen />}
        {vista === 'clientes' && <ClientesScreen />}
        {vista === 'gestion' && <GestionScreen />}
        {vista === 'finanzas' && <FinanzasScreen />}
        {vista === 'config' && <ConfigScreen />}
      </Shell>
      <Tour steps={pasosTour(setVista)} open={tour} onClose={cerrarTour} onFinish={cerrarTour} />
    </>
  );
}

/**
 * Banner por estado de suscripción (Plan-Pagos FASE-04/11):
 *  - `prueba`: días restantes + CTA para agregar método (cambia de tono cerca de 0).
 *  - `en_gracia`: no pudimos cobrar; reintentaremos / paga ahora antes del corte.
 * En otros estados (activa/cortesía) no renderiza nada.
 */
function TrialBanner({ onIrSuscripcion }: { onIrSuscripcion: () => void }) {
  const { data } = useApi<{ trialDiasRestantes: number | null; estado: string }>(() =>
    api.get('/suscripcion'),
  );
  if (!data) return null;

  // Mora: cobro rechazado, en periodo de gracia antes de la suspensión.
  if (data.estado === 'en_gracia') {
    return (
      <BannerBase
        testid="gracia-banner"
        icon="alert-circle"
        fondo="var(--warning-tint)"
        borde="rgba(180,83,9,0.3)"
        acento="#B45309"
        cta="Pagar ahora"
        onCta={onIrSuscripcion}
        detalle="Reintentaremos automáticamente; paga ahora para evitar la suspensión."
      >
        <strong>No pudimos cobrar tu suscripción.</strong>
      </BannerBase>
    );
  }

  const dias = data.trialDiasRestantes;
  if (dias == null) return null;
  const urgente = dias <= 3;
  const texto = dias === 0 ? 'Tu prueba termina hoy' : `Te quedan ${dias} ${dias === 1 ? 'día' : 'días'} de prueba`;
  return (
    <BannerBase
      testid="trial-banner"
      icon={urgente ? 'alert-circle' : 'sparkles'}
      fondo={urgente ? 'var(--warning-tint)' : 'var(--brand-tint)'}
      borde={urgente ? 'rgba(180,83,9,0.3)' : 'rgba(124,58,237,0.25)'}
      acento={urgente ? '#B45309' : 'var(--brand)'}
      cta="Agregar método de pago"
      onCta={onIrSuscripcion}
      detalle="Agrega tu método de pago para no perder el acceso al panel."
    >
      <strong>{texto}.</strong>
    </BannerBase>
  );
}

function BannerBase({
  testid,
  icon,
  fondo,
  borde,
  acento,
  cta,
  onCta,
  children,
  detalle,
}: {
  testid: string;
  icon: string;
  fondo: string;
  borde: string;
  acento: string;
  cta: string;
  onCta: () => void;
  children: React.ReactNode;
  /** Frase secundaria; se oculta en móvil para mantener la alerta compacta. */
  detalle?: React.ReactNode;
}) {
  return (
    <div
      data-testid={testid}
      className="ork-trialbanner"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: fondo, border: `1px solid ${borde}` }}
    >
      <Icon name={icon} size={18} color={acento} style={{ flex: 'none' }} />
      <span className="ork-tb-msg" style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: '20px' }}>
        {children}
        {detalle && <span className="ork-tb-extra"> {detalle}</span>}
      </span>
      <Button variant="primary" size="sm" iconRight="arrow-right" onClick={onCta}>{cta}</Button>
    </div>
  );
}
