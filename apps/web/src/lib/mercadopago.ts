/**
 * Carga perezosa del SDK de Mercado Pago (Plan-Pagos FASE-05). El SDK tokeniza
 * la tarjeta en el navegador (PCI): los datos de la tarjeta nunca pasan por
 * nuestro backend. Se usa con el brick `cardPayment`.
 */

interface MpBricksController {
  unmount?: () => void;
}
interface MpBricks {
  create: (tipo: string, contenedor: string, settings: unknown) => Promise<MpBricksController>;
}
export interface MercadoPagoInstance {
  bricks: () => MpBricks;
}
type MercadoPagoCtor = new (publicKey: string, opts?: { locale?: string }) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

let cargando: Promise<void> | null = null;

/** Inserta el `<script>` del SDK una sola vez y resuelve cuando está disponible. */
export function cargarSdkMercadoPago(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload = () => resolve();
    s.onerror = () => {
      cargando = null;
      reject(new Error('No se pudo cargar el SDK de Mercado Pago.'));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/** Crea la instancia del SDK con la Public Key del entorno. */
export function crearMercadoPago(): MercadoPagoInstance {
  const pub = import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined;
  if (!pub) throw new Error('Falta VITE_MP_PUBLIC_KEY en el entorno del frontend.');
  if (!window.MercadoPago) throw new Error('El SDK de Mercado Pago no está cargado.');
  return new window.MercadoPago(pub, { locale: 'es-CO' });
}
