import { useEffect, useMemo, useState } from 'react';
import type { ClienteCRM, ClienteHistorial, MetodoPago } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { fechaCorta, hoyISO, money } from '../../lib/format';
import {
  crearCliente,
  desactivarCliente,
  editarCliente,
  historialCliente,
  useClientes,
} from '../../lib/useClientes';
import { PageHead } from '../../ui/Shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Input,
  MenuItem,
  Popover,
  SearchInput,
  Skeleton,
  Spinner,
  StatTile,
  Tabs,
  useToast,
} from '../../ui/ui';

const PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  otro: 'Otro',
} as Record<MetodoPago, string>;

/** "Nuevo este mes": creado dentro del mes en curso (Bogotá). */
function esNuevo(creadoEn: string): boolean {
  return creadoEn.slice(0, 7) === hoyISO().slice(0, 7);
}

export function ClientesScreen() {
  const { consolidado, sucursalActiva } = useSucursal();
  const toast = useToast();
  const { data, cargando, error, recargar } = useClientes();

  const [tab, setTab] = useState('todos');
  const [query, setQuery] = useState('');
  const [hist, setHist] = useState<ClienteCRM | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClienteCRM | null>(null);
  const [delClient, setDelClient] = useState<ClienteCRM | null>(null);

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const lista = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const total = lista.length;
    const nuevos = lista.filter((c) => esNuevo(c.creadoEn)).length;
    const ingresos = lista.reduce((s, c) => s + c.gastado, 0);
    const promedio = total ? Math.round(ingresos / total) : 0;
    return { total, nuevos, ingresos, promedio };
  }, [lista]);

  const filtrados = useMemo(() => {
    let r = [...lista];
    if (tab === 'recientes') r = r.filter((c) => c.ultimaVisita).sort((a, b) => (b.ultimaVisita ?? '').localeCompare(a.ultimaVisita ?? ''));
    else if (tab === 'frecuentes') r = r.filter((c) => c.numServicios >= 2).sort((a, b) => b.numServicios - a.numServicios);
    const q = query.trim().toLowerCase();
    if (q) r = r.filter((c) => c.nombre.toLowerCase().includes(q) || (c.telefono ?? '').includes(q));
    return r;
  }, [lista, tab, query]);

  async function guardar(form: { nombre: string; telefono: string }) {
    const body = { nombre: form.nombre.trim(), telefono: form.telefono.trim() || undefined };
    try {
      if (editClient) {
        await editarCliente(editClient.id, body);
        toast('Cliente actualizado', 'success');
      } else {
        await crearCliente(body);
        toast('Cliente creado', 'success');
      }
      setFormOpen(false);
      setEditClient(null);
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function eliminar(c: ClienteCRM) {
    try {
      await desactivarCliente(c.id);
      setDelClient(null);
      toast(`${c.nombre.split(' ')[0]} marcado como inactivo`, 'info');
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const sinClientes = !cargando && !error && lista.length === 0;

  return (
    <div>
      <PageHead
        title="Clientes"
        desc={`Directorio y CRM del negocio · ${scope}`}
        action={<Button iconLeft="user-plus" onClick={() => { setEditClient(null); setFormOpen(true); }}>Nuevo cliente</Button>}
      />

      {/* Estadísticas */}
      <div className="ork-kpis" style={{ marginBottom: 22 }}>
        <StatTile label="Total de clientes" value={cargando ? '—' : stats.total} icon="users" loading={cargando} />
        <StatTile label="Nuevos este mes" value={cargando ? '—' : stats.nuevos} icon="user-plus" loading={cargando} accent />
        <StatTile label="Ingresos generados" value={cargando ? '—' : money(stats.ingresos)} icon="dollar-sign" loading={cargando} />
        <StatTile label="Gasto promedio" value={cargando ? '—' : money(stats.promedio)} icon="trending-up" loading={cargando} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <Tabs tabs={[{ value: 'todos', label: 'Todos' }, { value: 'recientes', label: 'Recientes' }, { value: 'frecuentes', label: 'Frecuentes' }]} value={tab} onChange={setTab} />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre o teléfono…" width={340} />
      </div>

      {error ? (
        <ErrorState onRetry={recargar} />
      ) : cargando ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} padding={16}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Skeleton w={44} h={44} r={99} />
                <div style={{ flex: 1 }}><Skeleton w="60%" h={15} /><div style={{ height: 10 }} /><Skeleton w="80%" h={12} /></div>
              </div>
              <div style={{ height: 16 }} />
              <Skeleton w="100%" h={48} />
            </Card>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card padding={0}>
          {sinClientes ? (
            <EmptyState
              icon="users"
              title="Aún no tienes clientes"
              desc="Crea tu primer cliente para empezar a medir visitas, gasto y frecuencia."
              action={<Button iconLeft="user-plus" onClick={() => { setEditClient(null); setFormOpen(true); }}>Nuevo cliente</Button>}
            />
          ) : (
            <EmptyState
              icon="search"
              title="Sin resultados"
              desc={query ? `No encontramos clientes que coincidan con “${query}”.` : 'No hay clientes en esta vista.'}
              action={<Button variant="secondary" onClick={() => { setQuery(''); setTab('todos'); }}>Limpiar búsqueda</Button>}
            />
          )}
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtrados.map((c) => (
            <ClientCard
              key={c.id}
              c={c}
              onEdit={() => { setEditClient(c); setFormOpen(true); }}
              onHistory={() => setHist(c)}
              onDelete={() => setDelClient(c)}
            />
          ))}
        </div>
      )}

      {hist && <ClientHistoryDialog client={hist} onClose={() => setHist(null)} />}
      <ClientFormDialog open={formOpen} client={editClient} onClose={() => { setFormOpen(false); setEditClient(null); }} onSave={guardar} />
      {delClient && <ConfirmDeleteDialog client={delClient} onClose={() => setDelClient(null)} onConfirm={() => eliminar(delClient)} />}
    </div>
  );
}

function ClientCard({ c, onEdit, onHistory, onDelete }: { c: ClienteCRM; onEdit: () => void; onHistory: () => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const nuevo = esNuevo(c.creadoEn);
  const cels = [
    { k: 'Servicios', v: String(c.numServicios) },
    { k: 'Gastado', v: money(c.gastado) },
    { k: 'Última visita', v: c.ultimaVisita ? fechaCorta(c.ultimaVisita) : '—' },
  ];
  return (
    <Card padding={0} testId={`cliente-row-${c.id}`} style={{ overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={c.nombre} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
            {nuevo && <Badge tone="accent">Nuevo</Badge>}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 6 }}>
            <Icon name="phone" size={13} color="var(--text-tertiary)" />{c.telefono || 'Sin teléfono'}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <IconButton name="more-vertical" title="Acciones" onClick={() => setMenu((o) => !o)} />
          <Popover open={menu} onClose={() => setMenu(false)} align="right" width={196}>
            <MenuItem icon="edit" onClick={() => { onEdit(); setMenu(false); }}>Editar</MenuItem>
            <MenuItem icon="clock" onClick={() => { onHistory(); setMenu(false); }}>Ver historial</MenuItem>
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
            <MenuItem icon="trash-2" danger onClick={() => { onDelete(); setMenu(false); }}>Eliminar</MenuItem>
          </Popover>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', margin: '16px 16px 0', borderTop: '1px solid var(--border-subtle)' }}>
        {cels.map((s, i) => (
          <div key={s.k} style={{ padding: '12px 0', borderLeft: i ? '1px solid var(--border-subtle)' : 'none', paddingLeft: i ? 12 : 0 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.k}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 16px' }}>
        <Button variant="secondary" size="sm" iconLeft="clock" onClick={onHistory} style={{ flex: 1 }}>Historial</Button>
        <Button variant="secondary" size="sm" iconLeft="edit" onClick={onEdit} style={{ flex: 1 }}>Editar</Button>
      </div>
    </Card>
  );
}

function ClientHistoryDialog({ client, onClose }: { client: ClienteCRM; onClose: () => void }) {
  const [data, setData] = useState<ClienteHistorial | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setData(null);
    setError(false);
    historialCliente(client.id)
      .then((h) => vivo && setData(h))
      .catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [client.id]);

  const td: React.CSSProperties = { padding: '12px 0', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };
  const subtitle = data ? `${data.numServicios} servicios · ${money(data.gastoAcumulado)} en total` : undefined;

  return (
    <Dialog open onClose={onClose} width={580} title={client.nombre} subtitle={subtitle} footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      {error ? (
        <div style={{ padding: '8px 0 16px' }}><ErrorState onRetry={() => { setError(false); setData(null); historialCliente(client.id).then(setData).catch(() => setError(true)); }} /></div>
      ) : !data ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : data.visitas.length === 0 ? (
        <EmptyState compact icon="clock" title="Sin servicios registrados" desc="Este cliente aún no tiene visitas en el historial." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr>
              {['Fecha', 'Servicio', 'Especialista', 'Pago', 'Monto'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '0 0 8px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.visitas.map((r, i) => (
              <tr key={i} data-testid={`historial-visita-${i}`}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><span className="data">{fechaCorta(r.fecha)}</span></td>
                <td style={td}>{r.servicio}</td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.especialista}</td>
                <td style={{ ...td, color: 'var(--text-secondary)' }}>{PAGO_LABEL[r.metodoPago] ?? r.metodoPago}</td>
                <td style={{ ...td, textAlign: 'right' }}><span className="data" style={{ fontWeight: 600 }}>{money(r.monto)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}

function ClientFormDialog({ open, client, onClose, onSave }: { open: boolean; client: ClienteCRM | null; onClose: () => void; onSave: (f: { nombre: string; telefono: string }) => void }) {
  const [form, setForm] = useState({ nombre: '', telefono: '' });
  useEffect(() => {
    if (open) setForm({ nombre: client?.nombre ?? '', telefono: client?.telefono ?? '' });
  }, [open, client]);

  const valid = form.nombre.trim().length >= 2;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={520}
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle={client ? 'Actualiza los datos de contacto del cliente.' : 'Registra un cliente para empezar a medir su actividad.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave(form)}>{client ? 'Guardar cambios' : 'Crear cliente'}</Button>
      </>}
    >
      <div style={{ display: 'grid', gap: 16, padding: '8px 0 16px' }}>
        <Field label="Nombre completo"><Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej.: Valentina Gómez" /></Field>
        <Field label="Teléfono (opcional)"><Input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="300 000 0000" /></Field>
      </div>
    </Dialog>
  );
}

function ConfirmDeleteDialog({ client, onClose, onConfirm }: { client: ClienteCRM; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title="Marcar cliente como inactivo"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" iconLeft="user-x" onClick={onConfirm}>Marcar inactivo</Button>
      </>}
    >
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', padding: '4px 0 16px', lineHeight: '24px' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{client.nombre}</strong> dejará de aparecer en el directorio, pero su historial de servicios y montos se conserva (borrado lógico). Podrás reactivarlo más adelante.
      </p>
    </Dialog>
  );
}
