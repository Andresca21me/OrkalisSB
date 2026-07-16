import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { cargarSdkMercadoPago, crearMercadoPago } from '../../lib/mercadopago';
import { Icon, Spinner } from '../../ui/ui';

/** formData que entrega el brick `cardPayment` al enviar. */
interface CardFormData {
  token: string;
  payment_method_id: string;
  payer?: { email?: string };
}

/** Datos de tarjeta tokenizados que el brick entrega para cobrar en el backend. */
export interface DatosTarjeta {
  cardToken: string;
  payerEmail?: string;
  paymentMethodId: string;
}

/**
 * Brick de pago de Mercado Pago (Plan-Pagos FASE-05). Tokeniza la tarjeta en el
 * navegador y, al enviar, cobra en el backend. Por defecto llama a
 * `POST /suscripcion/pagar`; con `onSubmit` se dirige a otro endpoint (p. ej. el
 * prorrateo de una subida de plan). Al aprobarse, invoca `onPaid()`.
 */
export function CheckoutMercadoPago({
  amount,
  onPaid,
  onSubmit,
}: {
  amount: number;
  onPaid: () => void;
  onSubmit?: (datos: DatosTarjeta) => Promise<void>;
}) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState<string>();
  const montado = useRef(false);

  useEffect(() => {
    if (montado.current) return; // evita doble montaje (StrictMode)
    montado.current = true;
    let controller: { unmount?: () => void } | null = null;

    (async () => {
      await cargarSdkMercadoPago();
      const mp = crearMercadoPago();
      controller = await mp.bricks().create('cardPayment', 'mp-brick', {
        initialization: { amount },
        customization: { visual: { style: { theme: 'default' } } },
        callbacks: {
          onReady: () => setEstado('listo'),
          onError: (e: { message?: string }) => {
            setError(e?.message ?? 'Hubo un problema con el formulario de pago.');
            setEstado('error');
          },
          onSubmit: async (formData: CardFormData) => {
            setError(undefined);
            const datos: DatosTarjeta = {
              cardToken: formData.token,
              payerEmail: formData.payer?.email,
              paymentMethodId: formData.payment_method_id,
            };
            try {
              if (onSubmit) await onSubmit(datos);
              else await api.post('/suscripcion/pagar', datos);
              onPaid();
            } catch (e) {
              setError((e as Error).message);
              throw e; // el brick muestra el error y permite reintentar
            }
          },
        },
      });
    })().catch((e) => {
      setError((e as Error).message);
      setEstado('error');
    });

    return () => controller?.unmount?.();
  }, [amount, onPaid]);

  return (
    <div>
      {estado === 'cargando' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'var(--text-secondary)' }}>
          <Spinner size={18} /> Cargando pago seguro…
        </div>
      )}
      {error && (
        <div role="alert" style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', marginBottom: 14, borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid var(--error)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
          <Icon name="alert-circle" size={16} color="var(--error)" />{error}
        </div>
      )}
      {/* Contenedor del brick (Mercado Pago renderiza aquí su formulario PCI). */}
      <div id="mp-brick" />
    </div>
  );
}
