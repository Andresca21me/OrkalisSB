import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Badge, Button, Card, EmptyState, Icon, useToast } from '../../ui/ui';

interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}

/** Enlace público de reserva de una sucursal. */
function enlaceReserva(sucursalId: string): string {
  return `${window.location.origin}/reservar/${sucursalId}`;
}

/** Nombre de archivo seguro a partir del nombre de la sucursal. */
function slug(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita las marcas diacríticas combinantes tras NFD
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sucursal'
  );
}

/**
 * Sección "Reservas" (Configuración): por cada sucursal muestra el enlace
 * público de reserva y su código QR, con acciones para copiar el enlace, abrirlo
 * y descargar el QR en alta resolución para imprimir y dejarlo físico.
 */
export function ConfigReservas({ sucursales }: { sucursales: Sucursal[] }) {
  if (sucursales.length === 0) {
    return (
      <Card padding={0}>
        <EmptyState icon="store" title="Sin sucursales" desc="Crea una sucursal para obtener su enlace y QR de reservas." />
      </Card>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sucursales.map((s) => (
        <ReservaSucursalCard key={s.id} sucursal={s} />
      ))}
    </div>
  );
}

function ReservaSucursalCard({ sucursal }: { sucursal: Sucursal }) {
  const toast = useToast();
  const link = enlaceReserva(sucursal.id);
  const [qr, setQr] = useState<string>('');

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then((url) => { if (vivo) setQr(url); })
      .catch(() => { if (vivo) setQr(''); });
    return () => { vivo = false; };
  }, [link]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Enlace copiado', 'success');
    } catch {
      toast('No se pudo copiar el enlace', 'error');
    }
  }

  function descargar() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `reserva-${slug(sucursal.nombre)}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Card padding={20} testId={`reserva-suc-${sucursal.id}`}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* QR */}
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, height: 140, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {qr ? (
              <img src={qr} alt={`Código QR de reserva · ${sucursal.nombre}`} width={132} height={132} style={{ display: 'block' }} />
            ) : (
              <Icon name="link" size={26} color="var(--text-tertiary)" />
            )}
          </div>
          <Button variant="secondary" size="sm" iconLeft="download" onClick={descargar} disabled={!qr}>
            Descargar QR
          </Button>
        </div>

        {/* Datos y acciones */}
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Icon name="store" size={18} color="var(--text-tertiary)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{sucursal.nombre}</span>
            <Badge tone={sucursal.activa ? 'success' : 'neutral'} dot>{sucursal.activa ? 'Activa' : 'Inactiva'}</Badge>
          </div>

          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Enlace de reserva</span>
            <div
              data-testid="reserva-enlace"
              className="data"
              style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', wordBreak: 'break-all' }}
            >
              {link}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" iconLeft="copy" onClick={() => void copiar()}>Copiar enlace</Button>
            <Button variant="ghost" size="sm" iconLeft="external-link" onClick={() => window.open(link, '_blank', 'noopener')}>Abrir</Button>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={13} color="var(--text-tertiary)" />
            Comparte el enlace o imprime el QR para que tus clientes reserven en esta sucursal.
          </p>
        </div>
      </div>
    </Card>
  );
}
