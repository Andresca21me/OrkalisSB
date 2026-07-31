import { useEffect, useState } from 'react';
import type { DesgloseAtencion } from '@orkalis/shared';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { Badge, Dialog, ErrorState, Icon, Spinner } from '../../ui/ui';
import { GSummaryRow } from './gestion-ui';

/** Etiqueta corta de la regla de una línea. */
function etiquetaRegla(r: DesgloseAtencion['servicios'][number]['regla']): string {
  const base = r.tipo === 'valor_fijo' ? `Fijo ${money(r.valor)}` : `${r.valor}%`;
  return r.origen === 'global' ? `${base} (estándar)` : base;
}

/**
 * Arqueo de UNA transacción para el ADMIN (Plan-Finanzas F3): la partición
 * exacta `Total cobrado = Ganancia del negocio + Pago al especialista
 * (+ comisión bancaria)`, con la regla aplicada a cada servicio y la comisión
 * de cada producto. Todo sale congelado de la atención — nada se recalcula.
 */
export function DesgloseDialog({ citaId, onClose }: { citaId: string; onClose: () => void }) {
  return (
    <DialogCargador citaId={citaId} onClose={onClose} />
  );
}

function DialogCargador({ citaId, onClose }: { citaId: string; onClose: () => void }) {
  const [datos, setDatos] = useState<DesgloseAtencion | null>(null);
  const [error, setError] = useState(false);

  const cargar = () => {
    setDatos(null);
    setError(false);
    api.get<DesgloseAtencion>(`/citas/${citaId}/atencion`).then(setDatos).catch(() => setError(true));
  };
  useEffect(cargar, [citaId]);

  return (
    <Dialog open onClose={onClose} width={560} title="Desglose de la transacción"
      subtitle={datos ? `${datos.clienteNombre ?? 'Walk-in'} · ${datos.especialista.nombre}` : undefined}>
      {error ? (
        <ErrorState onRetry={cargar} />
      ) : !datos ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <DesgloseAtencionView datos={datos} />
      )}
    </Dialog>
  );
}

/**
 * Carga y pinta el desglose de una cita — para la fila expandible del arqueo
 * (Plan-Finanzas F4). Mismo contenido que el Dialog, sin envoltorio.
 */
export function DesgloseInline({ citaId }: { citaId: string }) {
  const [datos, setDatos] = useState<DesgloseAtencion | null>(null);
  const [error, setError] = useState(false);
  const cargar = () => {
    setDatos(null);
    setError(false);
    api.get<DesgloseAtencion>(`/citas/${citaId}/atencion`).then(setDatos).catch(() => setError(true));
  };
  useEffect(cargar, [citaId]);
  if (error) return <ErrorState onRetry={cargar} />;
  if (!datos) return <div style={{ display: 'grid', placeItems: 'center', padding: 24 }}><Spinner /></div>;
  return <DesgloseAtencionView datos={datos} />;
}

/** El cuerpo del desglose (compartido por Dialog y fila expandible). */
export function DesgloseAtencionView({ datos }: { datos: DesgloseAtencion }) {
  return (
        <div style={{ paddingBottom: 6 }}>
          {datos.servicios.some((s) => s.aproximado) && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', marginBottom: 14, borderRadius: 'var(--radius-sm)', background: 'var(--info-tint)' }}>
              <Icon name="info" size={14} color="var(--info)" style={{ flex: 'none', marginTop: 2 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Cobro anterior al desglose por servicio: la regla mostrada es la actual del catálogo y puede diferir de la aplicada. Los totales sí son exactos.
              </span>
            </div>
          )}

          <div className="eyebrow" style={{ marginBottom: 6 }}>Servicios</div>
          {datos.servicios.map((s, i) => (
            <GSummaryRow key={i} first={i === 0} label={s.nombre} sub={`${money(s.precio)} × ${etiquetaRegla(s.regla)} → especialista`} value={money(s.ganProf)} />
          ))}

          {datos.productos.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Productos vendidos</div>
              {datos.productos.map((p, i) => (
                <GSummaryRow key={i} first={i === 0} label={`${p.nombre} ×${p.cantidad}`} sub={`Venta ${money(p.total)} · comisión del especialista`} value={money(p.comision)} />
              ))}
            </>
          )}

          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Ajustes</div>
          {datos.tarifaCliente > 0 && <GSummaryRow first label="Tarifa cliente → profesional" sub="La paga el cliente; va al especialista" value={`+${money(datos.tarifaCliente)}`} />}
          {datos.deduccionAdmin > 0 && <GSummaryRow first={datos.tarifaCliente <= 0} label="Deducción administrativa" sub="Retención del negocio sobre la parte del especialista" value={money(datos.deduccionAdmin)} />}
          {datos.comisionBancaria > 0 && <GSummaryRow first={datos.tarifaCliente <= 0 && datos.deduccionAdmin <= 0} label="Comisión bancaria" sub="La absorbe el negocio (porción electrónica del pago)" value={`−${money(datos.comisionBancaria)}`} tone="neg" />}
          {datos.tarifaCliente <= 0 && datos.deduccionAdmin <= 0 && datos.comisionBancaria <= 0 && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin ajustes en esta transacción.</p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 10px' }}>
            {datos.pagos.map((p, i) => (
              <Badge key={i} tone="neutral">{p.metodo} · {money(p.monto)}</Badge>
            ))}
          </div>

          {/* La fila de cuadre: la ecuación completa, verificable a simple vista. */}
          <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', padding: '6px 14px', marginTop: 6 }}>
            <GSummaryRow first label="Total cobrado" value={money(datos.totales.total)} strong />
            <GSummaryRow label="Ganancia del negocio" value={money(datos.totales.ganSalon)} tone="pos" />
            <GSummaryRow label="Pago al especialista" sub={datos.totales.totalProductos > 0 ? 'Incluye su comisión por productos' : undefined} value={money(datos.totales.ganProf)} />
            {datos.comisionBancaria > 0 && <GSummaryRow label="Comisión bancaria" value={money(datos.comisionBancaria)} tone="neg" />}
          </div>
        </div>
  );
}
