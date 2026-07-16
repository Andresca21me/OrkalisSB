/**
 * Catálogo de componentes del Design System (FASE-01).
 *
 * Ruta interna de desarrollo (`/_ui`) para verificar 1:1 contra el prototipo y
 * los cards del `_ds`. NO se enlaza desde la app ni se usa en producción.
 */
import { useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  BarChart,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Donut,
  EmptyState,
  ErrorState,
  EstadoBadge,
  Field,
  Icon,
  IconButton,
  Input,
  KpiCard,
  LineChartMini,
  Modal,
  QtyStepper,
  SearchInput,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  StatTile,
  Stars,
  Switch,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
  useToast,
} from '../../ui';
import { money } from '../../lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>{children}</div>
    </section>
  );
}

const SERIE = [
  { label: 'Lun', value: 320000 },
  { label: 'Mar', value: 410000 },
  { label: 'Mié', value: 280000 },
  { label: 'Jue', value: 520000 },
  { label: 'Vie', value: 610000 },
  { label: 'Sáb', value: 740000 },
];

export function UiCatalog() {
  const toast = useToast();
  const [sw, setSw] = useState(true);
  const [chk, setChk] = useState(true);
  const [seg, setSeg] = useState('dia');
  const [tab, setTab] = useState('agenda');
  const [chip, setChip] = useState('efectivo');
  const [qty, setQty] = useState(2);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [dialog, setDialog] = useState(false);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 4 }}>Catálogo de componentes</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 36 }}>Orkalis Design System · ruta de verificación (no productiva).</p>

      <Section title="Botones">
        <Button variant="primary">Primario</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Peligro</Button>
        <Button variant="primary" iconLeft="plus">Con icono</Button>
        <Button variant="primary" loading>Cargando</Button>
        <Button variant="primary" disabled>Deshabilitado</Button>
        <Button variant="secondary" size="sm">sm</Button>
        <Button variant="secondary" size="lg">lg</Button>
        <IconButton name="settings" title="Ajustes" />
      </Section>

      <Section title="Formularios">
        <div style={{ width: 240 }}>
          <Field label="Nombre" hint="Como aparece en la cuenta">
            <Input placeholder="Carlos Barbero" />
          </Field>
        </div>
        <div style={{ width: 240 }}>
          <Field label="Servicio">
            <Select>
              <option>Corte de cabello</option>
              <option>Arreglo de barba</option>
            </Select>
          </Field>
        </div>
        <div style={{ width: 240 }}>
          <Field label="Notas">
            <Textarea placeholder="Escribe una nota…" />
          </Field>
        </div>
        <div style={{ width: 240 }}>
          <Field label="Con error" error="Este campo es obligatorio">
            <Input />
          </Field>
        </div>
        <Switch checked={sw} onChange={setSw} />
        <Switch checked={sw} onChange={setSw} tone="success" />
        <Checkbox checked={chk} onChange={setChk} label="Acepto los términos" />
        <SearchInput value={search} onChange={setSearch} width={240} />
        <QtyStepper value={qty} onChange={setQty} />
      </Section>

      <Section title="Badges, tags y avatares">
        <Badge tone="brand">Brand</Badge>
        <Badge tone="success" dot>Activa</Badge>
        <Badge tone="warning">Pendiente</Badge>
        <Badge tone="error" solid>Solid</Badge>
        <Badge tone="accent">Accent</Badge>
        <EstadoBadge estado="confirmada" />
        <EstadoBadge estado="en_progreso" />
        <EstadoBadge estado="cancelada" />
        <Tag>Sin tarjeta</Tag>
        <Tag tone="brand" icon="zap">Pro</Tag>
        <Avatar name="Carlos Barbero" />
        <Avatar name="Diana Estilista" size={32} />
        <Stars value={4.8} />
      </Section>

      <Section title="Selección">
        <div style={{ width: 280 }}>
          <Segmented options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }]} value={seg} onChange={setSeg} />
        </div>
        <div style={{ width: 320 }}>
          <Tabs tabs={[{ value: 'agenda', label: 'Agenda' }, { value: 'clientes', label: 'Clientes' }, { value: 'finanzas', label: 'Finanzas' }]} value={tab} onChange={setTab} />
        </div>
        <Chip active={chip === 'efectivo'} icon="dollar-sign" onClick={() => setChip('efectivo')}>Efectivo</Chip>
        <Chip active={chip === 'tarjeta'} icon="credit-card" onClick={() => setChip('tarjeta')}>Tarjeta</Chip>
      </Section>

      <Section title="KPIs y métricas">
        <div style={{ width: 240 }}>
          <KpiCard label="Ingresos del día" value={money(740000)} icon="dollar-sign" trend={{ dir: 'up', value: '12%' }} sub="vs. ayer" />
        </div>
        <div style={{ width: 240 }}>
          <KpiCard label="Citas" value="18" icon="calendar" trend={{ dir: 'down', value: '3%' }} sub="vs. ayer" />
        </div>
        <div style={{ width: 240 }}>
          <KpiCard label="Cargando" loading />
        </div>
        <div style={{ width: 240 }}>
          <StatTile label="Ticket promedio" value={money(41000)} icon="trending-up" accent />
        </div>
      </Section>

      <Section title="Gráficos">
        <Card style={{ width: 480 }}>
          <LineChartMini data={SERIE} formatY={(v) => money(v)} />
        </Card>
        <Card style={{ width: 480 }}>
          <BarChart data={SERIE} formatY={(v) => money(v)} />
        </Card>
        <Card style={{ width: 320 }}>
          <Donut data={[{ label: 'Servicios', value: 70 }, { label: 'Productos', value: 30 }]} />
        </Card>
      </Section>

      <Section title="Avisos y feedback">
        <div style={{ width: 360 }}><Alert tone="info" title="Información">Un detalle útil para el usuario.</Alert></div>
        <div style={{ width: 360 }}><Alert tone="success" title="Listo">La acción se completó.</Alert></div>
        <div style={{ width: 360 }}><Alert tone="warning" title="Atención">Revisa esto antes de continuar.</Alert></div>
        <div style={{ width: 360 }}><Alert tone="error" title="Error">Algo salió mal.</Alert></div>
        <Tooltip label="Texto del tooltip"><Button variant="secondary">Hover aquí</Button></Tooltip>
        <Button variant="secondary" onClick={() => toast('Cambios guardados', 'success')}>Toast éxito</Button>
        <Button variant="secondary" onClick={() => toast('No se pudo guardar', 'error')}>Toast error</Button>
      </Section>

      <Section title="Overlays">
        <Button variant="secondary" onClick={() => setModal(true)}>Abrir Modal</Button>
        <Button variant="secondary" onClick={() => setDialog(true)}>Abrir Dialog</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="Modal" footer={<Button onClick={() => setModal(false)}>Cerrar</Button>}>
          <p style={{ color: 'var(--text-secondary)' }}>Contenido del modal (móvil/genérico).</p>
        </Modal>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="Dialog de escritorio" subtitle="Con subtítulo y Esc para cerrar" footer={<><Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button><Button onClick={() => setDialog(false)}>Guardar</Button></>}>
          <p style={{ color: 'var(--text-secondary)' }}>Contenido del diálogo de escritorio.</p>
        </Dialog>
      </Section>

      <Section title="Estados de carga / vacío / error">
        <Card style={{ width: 280 }}>
          <Skeleton w={140} h={14} />
          <div style={{ height: 10 }} />
          <Skeleton w="100%" h={12} />
          <div style={{ height: 6 }} />
          <Skeleton w="80%" h={12} />
        </Card>
        <Card style={{ width: 280 }}>
          <EmptyState icon="calendar" title="Sin citas aún" desc="Cuando agendes una cita aparecerá aquí." compact action={<Button size="sm" iconLeft="plus">Nueva cita</Button>} />
        </Card>
        <div style={{ width: 280 }}>
          <ErrorState onRetry={() => toast('Reintentando…', 'info')} />
        </div>
        <Spinner />
      </Section>

      <Section title="Iconos (muestra)">
        {['calendar', 'clock', 'user', 'users', 'scissors', 'dollar-sign', 'wallet', 'package', 'store', 'settings', 'bell', 'trending-up', 'check-circle', 'alert-octagon', 'map-pin', 'phone'].map((n) => (
          <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 72 }}>
            <Icon name={n} size={22} color="var(--text-secondary)" />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{n}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
