import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { Button, Card, Icon, Logo, Spinner, useToast } from '../ui/ui';
import { CheckoutMercadoPago } from './site/checkout-mp';

interface Resumen {
  plan: string;
  estado: string;
  cargoMensual: number;
  metodoUltimos4: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
  empresarial: 'Empresarial',
};

/**
 * Recuperación de acceso (Plan-Pagos FASE-11). Pantalla de la SESIÓN LIMITADA:
 * una cuenta con la prueba vencida o suspendida por mora entra aquí (no al panel)
 * y paga con Mercado Pago para reactivarse. Al aprobarse, refresca la sesión y
 * el router lleva al panel. Reusa el brick de pago de FASE-05.
 */
export function RecuperarAcceso() {
  const { motivoBloqueo, refrescar, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState(false);
  const [pagar, setPagar] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .get<Resumen>('/suscripcion')
      .then((d) => vivo && setData(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  const prueba = motivoBloqueo === 'prueba_vencida';

  async function alPagar() {
    toast('¡Pago aprobado! Reactivando tu cuenta…', 'success');
    await refrescar();
    navigate('/', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface-page)', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo />
        </div>

        <Card style={{ padding: 28 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: prueba ? 'var(--brand-tint)' : 'var(--error-tint)', marginBottom: 16 }}>
            <Icon name={prueba ? 'sparkles' : 'alert-octagon'} size={26} color={prueba ? 'var(--brand)' : 'var(--error)'} />
          </span>

          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', margin: 0 }}>
            {prueba ? 'Tu prueba terminó' : 'Reactiva tu cuenta'}
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: '10px 0 20px', lineHeight: 1.5 }}>
            {prueba
              ? 'Se acabaron tus 15 días de prueba. Agrega un método de pago para activar tu plan y volver al panel.'
              : 'Tu cuenta está suspendida por un pago pendiente. Paga ahora con tu tarjeta para recuperar el acceso al instante.'}
          </p>

          {error ? (
            <div role="alert" style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid var(--error)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
              <Icon name="alert-circle" size={16} color="var(--error)" />
              No pudimos cargar tu plan. Recarga la página o contacta a soporte.
            </div>
          ) : !data ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: 'var(--text-secondary)' }}>
              <Spinner size={18} /> Cargando tu plan…
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan {PLAN_LABEL[data.plan] ?? data.plan}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Cargo mensual</div>
                </div>
                <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)' }}>{money(data.cargoMensual)}</div>
              </div>

              {pagar ? (
                <CheckoutMercadoPago amount={data.cargoMensual} onPaid={alPagar} />
              ) : (
                <Button variant="primary" size="lg" fullWidth iconLeft="credit-card" onClick={() => setPagar(true)}>
                  {prueba ? 'Agregar método y pagar' : 'Pagar ahora'}
                </Button>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>Cerrar sesión</Button>
          </div>
        </Card>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '18px 0 0' }}>
          ¿Necesitas ayuda? soporte@orkalis.co · +57 601 432 0099
        </p>
      </div>
    </div>
  );
}
