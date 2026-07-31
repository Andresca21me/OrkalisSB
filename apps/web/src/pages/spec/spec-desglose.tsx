import { useEffect, useState } from 'react';
import type { DesgloseAtencion } from '@orkalis/shared';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { ErrorState, Icon, Spinner } from '../../ui/ui';
import { Sheet } from './spec-ui';

/** Etiqueta corta de la regla aplicada a una línea. */
export function etiquetaRegla(r: DesgloseAtencion['servicios'][number]['regla']): string {
  return r.tipo === 'valor_fijo' ? `Fijo ${money(r.valor)}` : `${r.valor}%`;
}

const VERDE = '#0A8F5B';

/**
 * "Ver desglose" del especialista (Plan-Finanzas F2): la fórmula de SU ganancia
 * en una cita — `precio × regla = tu parte` por servicio, comisión por producto,
 * tarifa que suma y deducción que resta. Enfocado en su lado del reparto: el
 * ticket total aparece como referencia, la partición del negocio no.
 */
export function DesgloseSheet({ citaId, open, onClose }: { citaId: string | null; open: boolean; onClose: () => void }) {
  const [datos, setDatos] = useState<DesgloseAtencion | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !citaId) return;
    setDatos(null);
    setError(false);
    api
      .get<DesgloseAtencion>(`/citas/${citaId}/atencion`)
      .then(setDatos)
      .catch(() => setError(true));
  }, [open, citaId]);

  const fila = (label: React.ReactNode, valor: React.ReactNode, opts?: { sub?: string; tone?: 'pos' | 'neg' }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '10px 2px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        {opts?.sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>{opts.sub}</div>}
      </div>
      <span className="data" style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-sm)', color: opts?.tone === 'pos' ? VERDE : opts?.tone === 'neg' ? 'var(--error)' : 'var(--text-primary)' }}>
        {valor}
      </span>
    </div>
  );
  const separador = <div style={{ height: 1, background: 'var(--border-subtle)' }} />;

  return (
    <Sheet open={open} onClose={onClose} title="Tu ganancia, al detalle">
      {error ? (
        <ErrorState onRetry={() => { setError(false); setDatos(null); api.get<DesgloseAtencion>(`/citas/${citaId}/atencion`).then(setDatos).catch(() => setError(true)); }} />
      ) : !datos ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ paddingBottom: 8 }}>
          {datos.servicios.some((s) => s.aproximado) && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)', background: 'var(--info-tint)' }}>
              <Icon name="info" size={14} color="var(--info)" style={{ flex: 'none', marginTop: 2 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Este cobro es anterior al desglose por servicio: la regla mostrada es la actual y puede diferir de la aplicada. Los totales sí son los exactos.
              </span>
            </div>
          )}

          <span className="eyebrow">Servicios</span>
          <div style={{ margin: '8px 0 16px' }}>
            {datos.servicios.map((s, i) => (
              <div key={i}>
                {i > 0 && separador}
                {fila(s.nombre, money(s.ganProf), { sub: `${money(s.precio)} × ${etiquetaRegla(s.regla)}`, tone: 'pos' })}
              </div>
            ))}
          </div>

          {datos.productos.length > 0 && (
            <>
              <span className="eyebrow">Productos vendidos</span>
              <div style={{ margin: '8px 0 16px' }}>
                {datos.productos.map((p, i) => (
                  <div key={i}>
                    {i > 0 && separador}
                    {fila(`${p.nombre} ×${p.cantidad}`, money(p.comision), { sub: `Venta ${money(p.total)} · tu comisión`, tone: 'pos' })}
                  </div>
                ))}
              </div>
            </>
          )}

          {(datos.tarifaCliente > 0 || datos.deduccionAdmin > 0) && (
            <>
              <span className="eyebrow">Ajustes</span>
              <div style={{ margin: '8px 0 16px' }}>
                {datos.tarifaCliente > 0 && fila('Tarifa cliente → profesional', `+${money(datos.tarifaCliente)}`, { sub: 'La paga el cliente y es tuya', tone: 'pos' })}
                {datos.tarifaCliente > 0 && datos.deduccionAdmin > 0 && separador}
                {datos.deduccionAdmin > 0 && fila('Deducción administrativa', `−${money(datos.deduccionAdmin)}`, { sub: 'Retención del negocio', tone: 'neg' })}
              </div>
            </>
          )}

          <div style={{ borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', padding: '4px 14px', marginTop: 4 }}>
            {fila('Total cobrado al cliente', money(datos.totales.total), { sub: datos.pagos.map((p) => `${p.metodo} ${money(p.monto)}`).join(' · ') })}
            {separador}
            {fila(<strong>Tu ganancia</strong>, <span style={{ fontSize: 'var(--text-base)' }}>{money(datos.totales.ganProf)}</span>, { tone: 'pos' })}
          </div>
        </div>
      )}
    </Sheet>
  );
}
