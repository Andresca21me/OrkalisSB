import { useMemo, useState } from 'react';
import { SplitType } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { hoyISO, money, sumarDiasISO } from '../../lib/format';
import { rangoDiaBogota, useCitas } from '../../lib/useCitas';
import { efectivoDe, useConfig } from '../../lib/useConfig';
import {
  crearServicio,
  editarServicio,
  eliminarServicio,
  useServicios,
  type Servicio,
} from '../../lib/useServicios';
import { PageHead } from '../../ui/Shell';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  SearchInput,
  Select,
  Skeleton,
  Spinner,
  StatTile,
  Tabs,
  useToast,
} from '../../ui/ui';
import { GField, GMoney, GNumber, GConfirm, type MoneyValue } from './gestion-ui';
import { useVocabulario } from '../../lib/vocabulario';

export function ServiciosScreen() {
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const { data, cargando, error, recargar } = useServicios();
  // Repartición estándar de la config (finanzas) → default al crear un servicio.
  const cfg = useConfig(sucursalActivaId);
  const defaultProfPct = Number(efectivoDe(cfg.data, 'finanzas.reparticion_profesional')?.valor ?? 50);

  const [sub, setSub] = useState('catalogo');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('todas');
  const [formOpen, setFormOpen] = useState(false);
  const [editSv, setEditSv] = useState<Servicio | null>(null);
  const [delSv, setDelSv] = useState<Servicio | null>(null);

  const activos = useMemo(() => (data ?? []).filter((s) => s.activo), [data]);
  const cats = useMemo(() => [...new Set((data ?? []).map((s) => s.categoria).filter(Boolean) as string[])], [data]);
  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');

  const stats = {
    total: (data ?? []).length,
    activos: activos.length,
    promedio: activos.length ? Math.round(activos.reduce((a, s) => a + Number(s.precio), 0) / activos.length) : 0,
  };

  const q = query.trim().toLowerCase();
  let filtrados = data ?? [];
  if (cat !== 'todas') filtrados = filtrados.filter((s) => s.categoria === cat);
  if (q) filtrados = filtrados.filter((s) => s.nombre.toLowerCase().includes(q));

  async function eliminar(s: Servicio) {
    try {
      await eliminarServicio(s.id);
      setDelSv(null);
      toast(`${s.nombre} dado de baja`, 'info');
      await recargar();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div>
      <PageHead title="Servicios" desc={`Catálogo del negocio y registro de lo realizado · ${scope}`} action={sub === 'catalogo' ? <Button iconLeft="plus" onClick={() => { setEditSv(null); setFormOpen(true); }}>Nuevo servicio</Button> : undefined} />

      <div style={{ marginBottom: 20 }}><Tabs tabs={[{ value: 'catalogo', label: 'Catálogo' }, { value: 'registro', label: 'Registro' }]} value={sub} onChange={setSub} /></div>

      {sub === 'catalogo' ? (
        <>
          <div className="ork-kpis" style={{ marginBottom: 20 }}>
            <StatTile label="Servicios" value={cargando ? '—' : stats.total} icon="scissors" loading={cargando} />
            <StatTile label="Activos" value={cargando ? '—' : stats.activos} icon="check-circle" loading={cargando} accent />
            <StatTile label="Precio promedio" value={cargando ? '—' : money(stats.promedio)} icon="dollar-sign" loading={cargando} />
          </div>

          {error ? (
            <ErrorState onRetry={recargar} />
          ) : cargando ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <Card key={i} padding={16}><Skeleton w="55%" h={16} /><div style={{ height: 14 }} /><Skeleton w="40%" h={22} /><div style={{ height: 14 }} /><Skeleton w="100%" h={36} /></Card>)}
            </div>
          ) : (data ?? []).length === 0 ? (
            <Card padding={0}><EmptyState icon="scissors" title="Aún no tienes servicios" desc="Crea tu primer servicio para poder agendarlo, cobrarlo y repartirlo." action={<Button iconLeft="plus" onClick={() => { setEditSv(null); setFormOpen(true); }}>Nuevo servicio</Button>} /></Card>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{ width: 220 }}>
                  <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="todas">Todas las categorías</option>
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <SearchInput value={query} onChange={setQuery} placeholder="Buscar servicio…" width={300} />
              </div>
              {filtrados.length === 0 ? (
                <Card padding={0}><EmptyState icon="search" title="Sin resultados" desc="Ningún servicio coincide con el filtro." action={<Button variant="secondary" onClick={() => { setQuery(''); setCat('todas'); }}>Limpiar filtros</Button>} /></Card>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {filtrados.map((s) => <ServiceCard key={s.id} s={s} onEdit={() => { setEditSv(s); setFormOpen(true); }} onDelete={() => setDelSv(s)} />)}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <RegistroTab sucursalId={sucursalActivaId} />
      )}

      {formOpen && <ServiceModal servicio={editSv} defaultProfPct={defaultProfPct} onClose={() => { setFormOpen(false); setEditSv(null); }} onSaved={async () => { setFormOpen(false); setEditSv(null); await recargar(); }} />}
      <GConfirm open={!!delSv} title="Dar de baja el servicio" danger confirmLabel="Dar de baja" confirmIcon="trash-2"
        desc={delSv ? <span><strong style={{ color: 'var(--text-primary)' }}>{delSv.nombre}</strong> dejará de estar disponible para agendar, pero su historial se conserva (borrado lógico).</span> : ''}
        onClose={() => setDelSv(null)} onConfirm={() => delSv && eliminar(delSv)} />
    </div>
  );
}

function splitLabel(s: Servicio): string {
  return s.splitType === SplitType.ValorFijo
    ? `Fijo ${money(s.splitValor)} al prof.`
    : `${Number(s.splitValor)}% / ${100 - Number(s.splitValor)}%`;
}

function ServiceCard({ s, onEdit, onDelete }: { s: Servicio; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card padding={0} testId={`servicio-row-${s.id}`} style={{ display: 'flex', flexDirection: 'column', opacity: s.activo ? 1 : 0.72 }}>
      <div style={{ padding: '16px 16px 0', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)', lineHeight: 1.2 }}>{s.nombre}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>{s.categoria || 'Sin categoría'}</div>
          </div>
          <Badge tone={s.activo ? 'success' : 'neutral'} dot>{s.activo ? 'Activo' : 'Inactivo'}</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 14 }}>
          <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{money(s.precio)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}><Icon name="clock" size={14} color="var(--text-tertiary)" />{s.duracionMin} min</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <Badge tone="brand"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="percent" size={11} color="var(--brand)" />Reparto {splitLabel(s)}</span></Badge>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px', marginTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="secondary" size="sm" iconLeft="edit" onClick={onEdit} style={{ flex: 1 }}>Editar</Button>
        <Button variant="secondary" size="sm" onClick={onDelete} style={{ width: 40, padding: 0, color: 'var(--error)' }}><Icon name="trash-2" size={16} color="var(--error)" /></Button>
      </div>
    </Card>
  );
}

function ServiceModal({ servicio, defaultProfPct, onClose, onSaved }: { servicio: Servicio | null; defaultProfPct: number; onClose: () => void; onSaved: () => void }) {
  const voc = useVocabulario();
  const toast = useToast();
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [categoria, setCategoria] = useState(servicio?.categoria ?? '');
  const [duracion, setDuracion] = useState<number>(servicio?.duracionMin ?? 30);
  const [precio, setPrecio] = useState<MoneyValue>(servicio ? Number(servicio.precio) : '');
  const [splitType, setSplitType] = useState<SplitType>(servicio?.splitType ?? SplitType.Porcentaje);
  // Al crear: default = repartición de la config (editable). Al editar: el % del servicio.
  const [splitValor, setSplitValor] = useState<MoneyValue>(servicio ? Number(servicio.splitValor) : defaultProfPct);
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreErr = touched && nombre.trim().length < 2 ? 'Escribe un nombre' : undefined;
  const precioErr = touched && (precio === '' || precio == null) ? 'Indica un precio' : undefined;
  const valid = nombre.trim().length >= 2 && precio !== '' && precio != null;

  const profPct = splitType === SplitType.Porcentaje ? Number(splitValor || 0) : 0;
  const previewProf = splitType === SplitType.Porcentaje ? Math.round((Number(precio || 0) * profPct) / 100) : Number(splitValor || 0);
  const previewSalon = Math.max(0, Number(precio || 0) - previewProf);

  async function guardar() {
    setTouched(true);
    if (!valid) return;
    setGuardando(true);
    const body = {
      nombre: nombre.trim(),
      precio: Number(precio),
      duracionMin: Number(duracion) || 1,
      categoria: categoria.trim() || undefined,
      splitType,
      splitValor: Number(splitValor) || 0,
    };
    try {
      if (servicio) {
        await editarServicio(servicio.id, body);
        toast('Servicio actualizado', 'success');
      } else {
        await crearServicio(body);
        toast('Servicio creado', 'success');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={580} title={servicio ? 'Editar servicio' : 'Nuevo servicio'} subtitle={servicio ? servicio.nombre : 'Define el servicio, su precio y cómo se reparte.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>{servicio ? 'Guardar cambios' : 'Crear servicio'}</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GField label="Nombre del servicio" span={2} error={nombreErr}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Corte + barba" /></GField>
          <GField label="Categoría" optional><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej.: Cortes" /></GField>
          <GField label="Duración"><GNumber value={duracion} onChange={setDuracion} min={5} step={5} suffix="min" /></GField>
          <GField label="Precio" span={2} error={precioErr}><GMoney value={precio} onChange={setPrecio} invalid={!!precioErr} /></GField>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Repartición profesional / {voc.negocio}{!servicio && <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-tertiary)' }}> · sugerida por tu configuración ({defaultProfPct}% profesional). Puedes cambiarla.</span>}</div>
          <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <GField label="Modo">
              <Select value={splitType} onChange={(e) => setSplitType(e.target.value as SplitType)}>
                <option value={SplitType.Porcentaje}>Por porcentaje</option>
                <option value={SplitType.ValorFijo}>Valor fijo</option>
              </Select>
            </GField>
            <div style={{ marginTop: 14 }}>
              {splitType === SplitType.Porcentaje ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <GField label="% Profesional"><GNumber value={Number(splitValor) || 0} onChange={(v) => setSplitValor(Math.min(100, v))} min={0} suffix="%" /></GField>
                  <GField label={`% ${voc.Negocio}`}><GNumber value={100 - (Number(splitValor) || 0)} onChange={(v) => setSplitValor(Math.max(0, 100 - v))} min={0} suffix="%" /></GField>
                </div>
              ) : (
                <GField label="Valor fijo al profesional" hint={`El resto queda para ${voc.elNegocio}.`}><GMoney value={splitValor} onChange={setSplitValor} /></GField>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Profesional</div>
                <div className="data" style={{ fontWeight: 700, color: 'var(--brand)' }}>{money(previewProf)}</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{voc.Negocio}</div>
                <div className="data" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{money(previewSalon)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function RegistroTab({ sucursalId }: { sucursalId: string | null }) {
  const { desde, hasta } = useMemo(() => ({ desde: rangoDiaBogota(sumarDiasISO(hoyISO(), -30)).desde, hasta: rangoDiaBogota(sumarDiasISO(hoyISO(), 1)).desde }), []);
  const citas = useCitas({ desde, hasta, sucursalId });

  const rows = useMemo(() => {
    return (citas.data ?? [])
      .filter((c) => c.estado === 'completada')
      .flatMap((c) =>
        c.servicios.map((sv, i) => ({
          key: `${c.id}-${i}`,
          servicio: sv.nombre,
          cliente: c.clienteNombre ?? '—',
          especialista: c.especialistaNombre,
          fecha: c.inicio,
          precio: Number(sv.precio),
        })),
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [citas.data]);

  const th: React.CSSProperties = { textAlign: 'left', padding: '0 14px 10px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '13px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };

  if (citas.error) return <ErrorState onRetry={citas.recargar} />;
  if (citas.cargando) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;
  if (rows.length === 0) return <Card padding={0}><EmptyState icon="list" title="Sin servicios registrados" desc="Cuando completes citas, el registro de servicios realizados aparecerá aquí." /></Card>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
        <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: 999, background: 'var(--success)' }} />
        Últimos {rows.length} servicios · últimos 30 días
      </div>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead><tr>
              <th style={{ ...th, paddingLeft: 18 }}>Servicio</th><th style={th}>Cliente</th><th style={th}>Especialista</th><th style={th}>Fecha</th><th style={{ ...th, textAlign: 'right', paddingRight: 18 }}>Precio</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ ...td, paddingLeft: 18, fontWeight: 600 }}>{r.servicio}</td>
                  <td style={td}>{r.cliente}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.especialista}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}><span className="data">{new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }).format(new Date(r.fecha))}</span></td>
                  <td style={{ ...td, textAlign: 'right', paddingRight: 18 }}><span className="data" style={{ fontWeight: 700 }}>{money(r.precio)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
