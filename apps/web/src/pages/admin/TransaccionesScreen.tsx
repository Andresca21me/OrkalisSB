import { useEffect, useMemo, useState } from 'react';
import { MetodoPago, type ArqueoFila, type ArqueoResp } from '@orkalis/shared';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useSucursal } from '../../lib/sucursal';
import { useEquipo } from '../../lib/useEquipo';
import { useServicios } from '../../lib/useServicios';
import { DataTable, type ColumnaTabla } from '../../ui/DataTable';
import type { Periodo } from '../../ui/PeriodPicker';
import { Badge, Button, ErrorState, Icon, Select, Spinner } from '../../ui/ui';
import { DesgloseInline } from './DesgloseDialog';
import { colorDe, horaCorta } from './agenda-ui';

const PAGE = 100;
const FMT_FECHA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' });
const PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transf.', nequi: 'Nequi', otro: 'Otro' };

/**
 * Arqueo de transacciones (Plan-Finanzas F4): cada cobro del período, fila por
 * fila, con la partición Total = Negocio + Especialista al expandir. Es la
 * respuesta a "¿de dónde salió este número?" para cualquier agregado del
 * Resumen: mismos filtros, mismas fuentes.
 */
export function TransaccionesScreen({ periodo }: { periodo: Periodo }) {
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const equipo = useEquipo();
  const servicios = useServicios();

  const [espId, setEspId] = useState('');
  const [servId, setServId] = useState('');
  const [metodo, setMetodo] = useState('');
  const [filas, setFilas] = useState<ArqueoFila[]>([]);
  const [totales, setTotales] = useState<ArqueoResp['totales'] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta, limit: String(PAGE) });
    if (sucursalActivaId) p.set('sucursalId', sucursalActivaId);
    if (espId) p.set('especialistaId', espId);
    if (servId) p.set('servicioId', servId);
    if (metodo) p.set('metodo', metodo);
    return p;
  }, [periodo.desde, periodo.hasta, sucursalActivaId, espId, servId, metodo]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    setOffset(0);
    api
      .get<ArqueoResp>(`/atenciones?${query.toString()}&offset=0`)
      .then((r) => {
        if (!vivo) return;
        setFilas(r.filas);
        setTotales(r.totales);
        setHayMas(r.hayMas);
      })
      .catch(() => vivo && setError(true))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [query]);

  async function cargarMas() {
    const nuevoOffset = offset + PAGE;
    const r = await api.get<ArqueoResp>(`/atenciones?${query.toString()}&offset=${nuevoOffset}`);
    setFilas((prev) => [...prev, ...r.filas]);
    setHayMas(r.hayMas);
    setOffset(nuevoOffset);
  }

  const columnas: ColumnaTabla<ArqueoFila>[] = [
    { id: 'fecha', titulo: 'Fecha', render: (f) => <span className="data" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{FMT_FECHA.format(new Date(f.fecha))} · {horaCorta(f.fecha)}</span> },
    { id: 'cliente', titulo: 'Cliente', render: (f) => f.clienteNombre ?? <span style={{ color: 'var(--text-tertiary)' }}>Walk-in</span> },
    {
      id: 'especialista', titulo: 'Especialista',
      render: (f) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: colorDe(f.especialista.id), flex: 'none' }} />
          {f.especialista.nombre}
        </span>
      ),
    },
    {
      id: 'concepto', titulo: 'Servicios',
      render: (f) => (
        <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>{f.servicios.join(' · ') || '—'}</span>
          {f.numProductos > 0 && (
            <span title={`Incluye ${f.numProductos} producto(s)`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
              <Icon name="package" size={13} color="var(--text-tertiary)" />{f.numProductos}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'metodos', titulo: 'Pago',
      render: (f) => (
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
          {f.metodos.map((m) => <Badge key={m} tone="neutral" size="md">{PAGO_LABEL[m] ?? m}</Badge>)}
        </span>
      ),
    },
    { id: 'total', titulo: 'Total', align: 'right', render: (f) => <span className="data" style={{ fontWeight: 700 }}>{money(f.total)}</span> },
    { id: 'ganSalon', titulo: 'Negocio', align: 'right', render: (f) => <span className="data" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{money(f.ganSalon)}</span> },
    { id: 'ganProf', titulo: 'Especialista', align: 'right', render: (f) => <span className="data" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{money(f.ganProf)}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal')} · {periodo.etiqueta}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Transacciones</h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Cada cobro del período. Expande una fila para ver la partición exacta.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select value={espId} onChange={(e) => setEspId(e.target.value)} aria-label="Filtrar por especialista" style={{ height: 38 }}>
            <option value="">Todos los especialistas</option>
            {(equipo.data ?? []).filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Select>
          <Select value={servId} onChange={(e) => setServId(e.target.value)} aria-label="Filtrar por servicio" style={{ height: 38 }}>
            <option value="">Todos los servicios</option>
            {(servicios.data ?? []).filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Select>
          <Select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Filtrar por método de pago" style={{ height: 38 }}>
            <option value="">Todos los métodos</option>
            {Object.values(MetodoPago).map((m) => <option key={m} value={m}>{PAGO_LABEL[m] ?? m}</option>)}
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={() => { setEspId((v) => v); setOffset((o) => o); setError(false); setCargando(true); api.get<ArqueoResp>(`/atenciones?${query.toString()}&offset=0`).then((r) => { setFilas(r.filas); setTotales(r.totales); setHayMas(r.hayMas); }).catch(() => setError(true)).finally(() => setCargando(false)); }} />
      ) : cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner /></div>
      ) : (
        <>
          <DataTable
            columnas={columnas}
            filas={filas}
            keyDe={(f) => f.atencionId}
            minWidth={920}
            expandible={(f) => <div style={{ maxWidth: 640 }}><DesgloseInline citaId={f.citaId} /></div>}
            vacio="Sin transacciones en este período con esos filtros."
            pie={totales && (
              <div style={{ display: 'flex', gap: '10px 26px', flexWrap: 'wrap', alignItems: 'baseline', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>{totales.transacciones}</strong> transacciones del período</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 22, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cobrado <strong className="data" style={{ color: 'var(--text-primary)' }}>{money(totales.total)}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Negocio <strong className="data" style={{ color: 'var(--text-primary)' }}>{money(totales.ganSalon)}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Especialistas <strong className="data" style={{ color: 'var(--text-primary)' }}>{money(totales.ganProf)}</strong></span>
                  {totales.comisionBancaria > 0 && <span style={{ color: 'var(--text-secondary)' }}>Comisión bancaria <strong className="data" style={{ color: 'var(--error)' }}>{money(totales.comisionBancaria)}</strong></span>}
                </span>
              </div>
            )}
          />
          {hayMas && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Button variant="secondary" onClick={() => void cargarMas()}>Cargar más ({filas.length} de {totales?.transacciones ?? '…'})</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
