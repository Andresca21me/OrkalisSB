import { useEffect, useMemo, useState } from 'react';
import type { CitasFuturasResp, EspecialistaEquipo, LiquidacionResultado } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { urlFotoEspecialista } from '../../lib/api';
import { EditorFoto } from '../../ui/EditorFoto';
import {
  asignarServicios,
  asignarSucursales,
  borrarFotoEspecialista,
  subirFotoEspecialista,
  citasFuturasEspecialista,
  darDeBajaEspecialista,
  editarEspecialista,
  invitacionesPendientes,
  invitarEspecialista,
  invitarExistente,
  previewLiquidacion,
  reenviarInvitacion,
  useEquipo,
  type InvitacionPendiente,
} from '../../lib/useEquipo';
import { PageHead } from '../../ui/Shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
  Spinner,
  StatTile,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from '../../ui/ui';
import { useServicios } from '../../lib/useServicios';
import { GConfirm, GField, GSummaryRow, RowMenu } from './gestion-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

export function EquipoScreen({ particion }: { particion: boolean }) {
  const { consolidado, sucursalActiva } = useSucursal();
  const toast = useToast();
  const { data, cargando, error, recargar } = useEquipo();
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));
  const sucNombre = useMemo(() => new Map((sucs.data ?? []).map((s) => [s.id, s.nombre])), [sucs.data]);
  const servicios = useServicios();
  const serviciosActivos = useMemo(() => (servicios.data ?? []).filter((x) => x.activo), [servicios.data]);
  const servNombre = useMemo(() => new Map(serviciosActivos.map((x) => [x.id, x.nombre])), [serviciosActivos]);

  const [filtro, setFiltro] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editSp, setEditSp] = useState<EspecialistaEquipo | null>(null);
  const [delSp, setDelSp] = useState<EspecialistaEquipo | null>(null);
  // Invitar al panel a un especialista que ya existe sin acceso (Plan-Correo E5).
  const [invitarSp, setInvitarSp] = useState<EspecialistaEquipo | null>(null);
  // Invitaciones vigentes → badge "Invitación enviada" y botón de reenvío.
  const invitaciones = useApi<InvitacionPendiente[]>(invitacionesPendientes);
  const invPorEsp = useMemo(() => new Map((invitaciones.data ?? []).map((i) => [i.especialistaId, i])), [invitaciones.data]);
  // Cuando la baja choca con citas futuras, el servidor las cuenta y aquí se
  // decide qué hacer con ellas antes de reintentar.
  const [conflicto, setConflicto] = useState<{ esp: EspecialistaEquipo; citas: CitasFuturasResp } | null>(null);

  useEffect(() => { if (!particion && filtro === 'liquidacion') setFiltro('todos'); }, [particion, filtro]);

  const activos = useMemo(() => (data ?? []).filter((e) => e.activo), [data]);
  const libres = activos.filter((e) => e.disponible).length;
  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');

  // Cupo de especialistas pagado (Plan-Pagos FASE-08): bloquea crear más allá.
  const susc = useApi<{ limites: { especialistas: number } }>(() => api.get('/suscripcion'));
  const cupo = susc.data?.limites.especialistas ?? null;
  const cupoLleno = cupo != null && activos.length >= cupo;

  let lista = activos;
  if (filtro === 'libres') lista = activos.filter((e) => e.disponible);
  else if (filtro === 'ocupados') lista = activos.filter((e) => !e.disponible);

  async function toggleDisponible(e: EspecialistaEquipo) {
    try {
      await editarEspecialista(e.id, { disponible: !e.disponible });
      toast(`${e.nombre.split(' ')[0]} ahora está ${e.disponible ? 'ocupado' : 'libre'}`, 'info');
      await recargar();
    } catch (err) { toast((err as Error).message, 'error'); }
  }

  async function eliminar(e: EspecialistaEquipo) {
    try {
      await darDeBajaEspecialista(e.id);
      setDelSp(null);
      toast(`${e.nombre} dado de baja`, 'info');
      await recargar();
    } catch (err) {
      // 409 = tiene citas futuras. No es un error del admin: es una decisión
      // que solo él puede tomar, así que se le presenta en vez de fallar.
      if (/citas futuras/i.test((err as Error).message)) {
        try {
          const citas = await citasFuturasEspecialista(e.id);
          setDelSp(null);
          setConflicto({ esp: e, citas });
          return;
        } catch { /* si falla, cae al toast de abajo */ }
      }
      toast((err as Error).message, 'error');
    }
  }

  async function reenviar(e: EspecialistaEquipo) {
    try {
      await reenviarInvitacion(e.id);
      toast(`Invitación reenviada a ${invPorEsp.get(e.id)?.email ?? 'su correo'}`, 'success');
      await invitaciones.recargar();
    } catch (err) { toast((err as Error).message, 'error'); }
  }

  async function resolverBaja(accion: 'reasignar' | 'cancelar') {
    if (!conflicto) return;
    try {
      const r = await darDeBajaEspecialista(conflicto.esp.id, accion);
      const partes = [
        r.reasignadas ? `${r.reasignadas} cita(s) reasignada(s)` : '',
        r.canceladas ? `${r.canceladas} cancelada(s)` : '',
      ].filter(Boolean);
      toast(`${conflicto.esp.nombre} dado de baja · ${partes.join(' y ') || 'sin citas afectadas'}`, 'info');
      setConflicto(null);
      await recargar();
    } catch (err) { toast((err as Error).message, 'error'); }
  }

  const tabs = [
    { value: 'todos', label: 'Todos' },
    { value: 'libres', label: 'Libres' },
    { value: 'ocupados', label: 'Ocupados' },
    ...(particion ? [{ value: 'liquidacion', label: 'Liquidación' }] : []),
  ];

  return (
    <div>
      <PageHead
        title="Equipo"
        desc={`${cupo != null ? `${activos.length} de ${cupo} especialistas` : 'Gestiona a tu equipo'} · ${scope}`}
        action={
          <Button
            iconLeft="user-plus"
            disabled={cupoLleno}
            onClick={() => { setEditSp(null); setFormOpen(true); }}
          >
            Nuevo especialista
          </Button>
        }
      />

      {cupoLleno && (
        <div data-testid="cupo-lleno" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius-md)', background: 'var(--warning-tint)', border: '1px solid rgba(180,83,9,0.3)' }}>
          <Icon name="alert-circle" size={18} color="#B45309" />
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
            Alcanzaste el cupo de <strong>{cupo} especialistas</strong> de tu plan. Para agregar más, sube tu plan en <strong>Configuración › Suscripción</strong>.
          </span>
        </div>
      )}

      <div className="ork-kpis" style={{ marginBottom: 20 }}>
        <StatTile label="Especialistas activos" value={cargando ? '—' : activos.length} icon="users" loading={cargando} />
        <StatTile label="Libres ahora" value={cargando ? '—' : `${libres} de ${activos.length}`} icon="check-circle" loading={cargando} accent={libres > 0} />
      </div>

      <div style={{ marginBottom: 20 }}><Tabs tabs={tabs} value={filtro} onChange={setFiltro} /></div>

      {filtro === 'liquidacion' ? (
        <LiquidationPanel sucursales={sucs.data ?? []} />
      ) : error ? (
        <ErrorState onRetry={recargar} />
      ) : cargando ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} padding={16}><div style={{ display: 'flex', gap: 12 }}><Skeleton w={46} h={46} r={99} /><div style={{ flex: 1 }}><Skeleton w="60%" h={15} /><div style={{ height: 8 }} /><Skeleton w="40%" h={12} /></div></div><div style={{ height: 16 }} /><Skeleton w="100%" h={44} /></Card>
          ))}
        </div>
      ) : activos.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon="users" title="Aún no tienes especialistas" desc="Agrega a tu equipo para asignar citas y medir su desempeño." action={<Button iconLeft="user-plus" onClick={() => { setEditSp(null); setFormOpen(true); }}>Nuevo especialista</Button>} />
        </Card>
      ) : lista.length === 0 ? (
        <Card padding={0}><EmptyState icon="users" title="Sin coincidencias" desc={`No hay especialistas ${filtro === 'libres' ? 'libres' : 'ocupados'} en este momento.`} action={<Button variant="secondary" onClick={() => setFiltro('todos')}>Ver todos</Button>} /></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {lista.map((e) => (
            <SpecialistCard
              key={e.id}
              s={e}
              sucNombre={sucNombre}
              servNombre={servNombre}
              invitacion={invPorEsp.get(e.id) ?? null}
              onToggle={() => toggleDisponible(e)}
              onEdit={() => { setEditSp(e); setFormOpen(true); }}
              onDelete={() => setDelSp(e)}
              onReenviar={() => void reenviar(e)}
              onInvitar={() => setInvitarSp(e)}
            />
          ))}
        </div>
      )}

      {formOpen && <SpecialistModal especialista={editSp} sucursales={sucs.data ?? []} servicios={serviciosActivos} onClose={() => { setFormOpen(false); setEditSp(null); }} onSaved={async () => { setFormOpen(false); setEditSp(null); await recargar(); await invitaciones.recargar(); }} />}
      {invitarSp && (
        <InvitarExistenteDialog
          especialista={invitarSp}
          onClose={() => setInvitarSp(null)}
          onSent={async () => { setInvitarSp(null); await invitaciones.recargar(); }}
        />
      )}
      <GConfirm open={!!delSp} title="Dar de baja al especialista" danger confirmLabel="Dar de baja" confirmIcon="user-x"
        desc={delSp ? <span><strong style={{ color: 'var(--text-primary)' }}>{delSp.nombre}</strong> dejará de aparecer en el equipo, pero su historial de servicios y liquidaciones se conserva (borrado lógico).</span> : ''}
        onClose={() => setDelSp(null)} onConfirm={() => delSp && eliminar(delSp)} />

      {conflicto && (
        <Dialog
          open
          onClose={() => setConflicto(null)}
          width={520}
          title="Tiene citas pendientes"
          subtitle={`${conflicto.esp.nombre} · ${conflicto.citas.total} cita(s) por atender`}
          footer={<Button variant="ghost" onClick={() => setConflicto(null)}>Volver</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 8px' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              No se puede dar de baja sin decidir qué pasa con estas citas: si se quedan asignadas a alguien que ya no trabaja, nadie las atenderá.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
              {conflicto.citas.muestra.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.clienteNombre ?? 'Sin cliente'} · {c.servicios.join(', ') || '—'}
                  </span>
                  <span className="data" style={{ flex: 'none' }}>
                    {new Date(c.inicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {conflicto.citas.total > conflicto.citas.muestra.length && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>y {conflicto.citas.total - conflicto.citas.muestra.length} más…</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="primary" fullWidth iconLeft="repeat" onClick={() => void resolverBaja('reasignar')}>
                Reasignar a otro especialista
              </Button>
              <p style={{ margin: '-4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Cada cita pasa a alguien de la misma sede que realice sus servicios. Las que nadie pueda atender se cancelan y se avisa al cliente.
              </p>
              <Button variant="secondary" fullWidth iconLeft="x-circle" onClick={() => void resolverBaja('cancelar')}>
                Cancelar todas las citas
              </Button>
              <p style={{ margin: '-4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Se cancelan las {conflicto.citas.total} y se avisa a cada cliente.
              </p>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Píldora de la tarjeta (sucursal o servicio). */
function Chip({ icon, children, tone }: { icon: string; children: React.ReactNode; tone?: 'muted' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)', color: tone === 'muted' ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
      <Icon name={icon} size={12} color="var(--text-tertiary)" />{children}
    </span>
  );
}

function SpecialistCard({ s, sucNombre, servNombre, invitacion, onToggle, onEdit, onDelete, onReenviar, onInvitar }: { s: EspecialistaEquipo; sucNombre: Map<string, string>; servNombre: Map<string, string>; invitacion: InvitacionPendiente | null; onToggle: () => void; onEdit: () => void; onDelete: () => void; onReenviar: () => void; onInvitar: () => void }) {
  // Sin servicios declarados realiza todos: se dice en claro para que el admin no
  // lo lea como "no tiene ninguno asignado".
  const todos = s.servicioIds.length === 0;
  const visibles = s.servicioIds.slice(0, 3);
  const resto = s.servicioIds.length - visibles.length;
  // Estado del acceso (Plan-Correo E5): con cuenta, con invitación en el aire o
  // sin nada (los creados solo con nombre desde el asistente de alta).
  const acceso = s.usuarioId
    ? ({ tone: 'success', icon: 'check-circle', label: s.telefonoVerificadoEn ? 'Con acceso' : 'Con acceso · celular sin verificar' } as const)
    : invitacion
      ? ({ tone: 'info', icon: 'mail', label: 'Invitación enviada' } as const)
      : ({ tone: 'neutral', icon: 'user-x', label: 'Sin acceso al panel' } as const);
  return (
    <Card padding={0} testId={`esp-row-${s.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={s.nombre} size={46} src={urlFotoEspecialista(s.id, s.fotoVersion)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.especialidad || 'Sin especialidad'}</div>
        </div>
        <RowMenu items={[
          { icon: 'edit', label: 'Editar', onClick: onEdit },
          { icon: 'scissors', label: 'Asignar servicios', onClick: onEdit },
          ...(!s.usuarioId && invitacion ? [{ icon: 'mail', label: 'Reenviar invitación', onClick: onReenviar }] : []),
          ...(!s.usuarioId && !invitacion ? [{ icon: 'mail', label: 'Invitar al panel', onClick: onInvitar }] : []),
          { divider: true },
          { icon: 'trash-2', label: 'Eliminar', danger: true, onClick: onDelete },
        ]} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px 0' }} title={invitacion ? `Enviada a ${invitacion.email}` : undefined}>
        <Badge tone={acceso.tone} dot>{acceso.label}</Badge>
        {invitacion && !s.usuarioId && (
          <button type="button" onClick={onReenviar} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--brand)' }}>
            Reenviar
          </button>
        )}
      </div>

      {s.sucursalIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 16px 0' }}>
          {s.sucursalIds.map((id) => (
            <Chip key={id} icon="store">{sucNombre.get(id) ?? 'Sucursal'}</Chip>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px 0' }}>
        {todos ? (
          <Chip icon="scissors" tone="muted">Todos los servicios</Chip>
        ) : (
          <>
            {visibles.map((id) => <Chip key={id} icon="scissors">{servNombre.get(id) ?? 'Servicio'}</Chip>)}
            {resto > 0 && <Chip icon="plus" tone="muted">{resto} más</Chip>}
          </>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '14px 16px 16px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', cursor: 'pointer' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: s.disponible ? 'var(--success)' : 'var(--warning)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.disponible ? 'Libre' : 'Ocupado'}</span>
        </span>
        <Switch checked={s.disponible} onChange={onToggle} tone="success" />
      </label>
    </Card>
  );
}

function SpecialistModal({ especialista, sucursales, servicios, onClose, onSaved }: { especialista: EspecialistaEquipo | null; sucursales: Sucursal[]; servicios: { id: string; nombre: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(especialista?.nombre ?? '');
  const [apellidos, setApellidos] = useState('');
  const [especialidad, setEspecialidad] = useState(especialista?.especialidad ?? '');
  // Vista previa en base64. Se sube DESPUÉS de que el especialista exista: al
  // crear no hay id todavía hasta que responda el alta.
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoQuitada, setFotoQuitada] = useState(false);
  // Foto recién elegida, a la espera de encuadre en el editor.
  const [editandoFoto, setEditandoFoto] = useState<File | null>(null);
  const fotoActual = especialista ? urlFotoEspecialista(especialista.id, especialista.fotoVersion) : null;
  const [disponible, setDisponible] = useState(especialista?.disponible ?? true);
  const [sel, setSel] = useState<string[]>(especialista?.sucursalIds ?? (sucursales[0] ? [sucursales[0].id] : []));
  // Servicios que realiza. Vacío = todos (no es "ninguno"): así el alta sin
  // tocar nada deja al especialista disponible para todo el catálogo.
  const [selServ, setSelServ] = useState<string[]>(especialista?.servicioIds ?? []);
  const [notas, setNotas] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Correo de la invitación (Plan-Correo E5): obligatorio en el alta. La
  // contraseña y el celular los pone el propio especialista desde el enlace.
  const emailValid = /.+@.+\..+/.test(email.trim());

  const nombreErr = touched && nombre.trim().length < 2 ? 'Escribe un nombre' : undefined;
  const sucErr = touched && sel.length === 0 ? 'Asigna al menos una sucursal' : undefined;
  const emailErr = touched && !especialista && !emailValid ? 'Escribe un correo válido' : undefined;
  const valid = nombre.trim().length >= 2 && sel.length > 0 && (Boolean(especialista) || emailValid);

  /**
   * Aplica el cambio de foto tras existir el especialista. Un fallo aquí NO
   * puede tumbar el alta: el especialista ya está creado y perder su foto es
   * mucho menos grave que perderlo a él.
   */
  async function guardarFoto(id: string) {
    try {
      if (foto) await subirFotoEspecialista(id, foto);
      else if (fotoQuitada) await borrarFotoEspecialista(id);
    } catch (err) {
      toast(`Se guardó el especialista, pero la foto falló: ${(err as Error).message}`, 'warning');
    }
  }

  function elegirFoto(archivo: File | undefined) {
    if (archivo) setEditandoFoto(archivo);
  }

  function toggleSuc(id: string) {
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleServ(id: string) {
    setSelServ((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function guardar() {
    setTouched(true);
    if (!valid) return;
    setGuardando(true);
    try {
      if (especialista) {
        await editarEspecialista(especialista.id, { nombre: nombre.trim(), especialidad: especialidad.trim() || undefined, disponible });
        await asignarSucursales(especialista.id, sel);
        await asignarServicios(especialista.id, selServ);
        await guardarFoto(especialista.id);
        toast('Especialista actualizado', 'success');
      } else {
        // Alta nueva (Plan-Correo E5): el especialista se crea YA y recibe la
        // invitación en su correo; contraseña y celular los pone él.
        const creado = await invitarEspecialista({
          nombre: nombre.trim(),
          apellidos: apellidos.trim() || undefined,
          especialidad: especialidad.trim() || undefined,
          email: email.trim(),
          sucursalIds: sel,
          servicioIds: selServ,
          disponible,
        });
        await guardarFoto(creado.id);
        toast(`Invitación enviada a ${email.trim()}`, 'success');
      }
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={580} title={especialista ? 'Editar especialista' : 'Nuevo especialista'} subtitle={especialista ? especialista.nombre : 'Registra los datos básicos: el especialista recibirá una invitación por correo para crear su contraseña y confirmar su celular.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>{especialista ? 'Guardar cambios' : 'Crear y enviar invitación'}</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {/* Foto: se ve como se verá luego (círculo), para que el admin
              entienda que se recorta al centro. */}
          <GField label="Foto" optional span={2} hint="Podrás mover, acercar y girar la imagen antes de guardarla.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={nombre || '?'} size={72} src={fotoQuitada ? null : (foto ?? fotoActual)} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--brand)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  <Icon name="image" size={15} color="var(--brand)" />
                  {foto || (fotoActual && !fotoQuitada) ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" onChange={(e) => { elegirFoto(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
                </label>
                {(foto || (fotoActual && !fotoQuitada)) && (
                  <Button size="md" variant="ghost" onClick={() => { setFoto(null); setFotoQuitada(true); }}>Quitar</Button>
                )}
              </div>
            </div>
          </GField>
          {editandoFoto && (
            <EditorFoto
              archivo={editandoFoto}
              onCancelar={() => setEditandoFoto(null)}
              onConfirmar={(dataUrl) => { setFoto(dataUrl); setFotoQuitada(false); setEditandoFoto(null); }}
            />
          )}
          <GField label="Nombre" error={nombreErr}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Andrés" /></GField>
          <GField label="Apellidos" optional><Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Ej.: Mejía" /></GField>
          {!especialista && (
            <GField label="Correo" span={2} error={emailErr} hint="A este correo le llega la invitación: con ella crea su contraseña y confirma su celular por SMS.">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@negocio.co" />
            </GField>
          )}
          <GField label="Especialidad" optional span={2}><Input value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Ej.: Barbero senior" /></GField>
        </div>

        <GField label="Asignación a sucursales" error={sucErr}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sucursales.map((b) => {
              const on = sel.includes(b.id);
              return (
                <button key={b.id} type="button" onClick={() => toggleSuc(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius-sm)', background: on ? 'var(--brand-tint)' : 'var(--surface-card)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 'var(--radius-xs)', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--brand)' : 'var(--surface-card)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}` }}>{on && <Icon name="check" size={13} color="#fff" />}</span>
                  <Icon name="store" size={15} color="var(--text-tertiary)" />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{b.nombre}</span>
                </button>
              );
            })}
          </div>
        </GField>

        <GField
          label="Servicios que realiza"
          hint={selServ.length === 0
            ? 'Sin selección: realiza TODOS los servicios del catálogo.'
            : `Solo aparecerá en las reservas de estos ${selServ.length} servicio(s).`}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {servicios.map((sv) => {
              const on = selServ.includes(sv.id);
              return (
                <button key={sv.id} type="button" onClick={() => toggleServ(sv.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: on ? 'var(--brand-tint)' : 'var(--surface-card)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {on && <Icon name="check" size={13} color="var(--brand)" />}
                  {sv.nombre}
                </button>
              );
            })}
            {servicios.length === 0 && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Aún no hay servicios en el catálogo.</span>
            )}
          </div>
          {selServ.length > 0 && (
            <button type="button" onClick={() => setSelServ([])} style={{ marginTop: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 600 }}>
              Quitar selección (que realice todos)
            </button>
          )}
        </GField>

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <Switch checked={disponible} onChange={setDisponible} tone="success" />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Disponible (libre)</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Aparece como libre para recibir citas.</div>
          </div>
        </label>

        {!especialista && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-tint)', border: '1px solid var(--border-subtle)' }}>
            <Icon name="mail" size={16} color="var(--info)" style={{ flex: 'none', marginTop: 2 }} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tú ya no defines su contraseña ni su celular: la invitación (vence en <strong>7 días</strong>) lleva al especialista a <strong>crear su contraseña</strong> y a <strong>confirmar su celular</strong> con un código SMS. Mientras no la active, aparecerá como «Invitación enviada».
            </div>
          </div>
        )}

        <GField label="Notas" optional hint="Solo de referencia; no se guarda aún."><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Horario, observaciones…" rows={2} /></GField>
      </div>
    </Dialog>
  );
}

function LiquidationPanel({ sucursales }: { sucursales: Sucursal[] }) {
  const { sucursalActivaId } = useSucursal();
  const toast = useToast();
  const periodos = useMemo(periodosMes, []);
  const [sucId, setSucId] = useState(sucursalActivaId ?? sucursales[0]?.id ?? '');
  const [periodoKey, setPeriodoKey] = useState(periodos[0]?.key ?? '');
  const [rows, setRows] = useState<LiquidacionResultado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const periodo = periodos.find((p) => p.key === periodoKey) ?? periodos[0];

  useEffect(() => {
    if (!sucId || !periodo) { setRows([]); return; }
    let vivo = true;
    setCargando(true); setError(false);
    previewLiquidacion({ desde: periodo.desde, hasta: periodo.hasta, sucursalId: sucId })
      .then((r) => { if (vivo) setRows(r); })
      .catch(() => { if (vivo) setError(true); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [sucId, periodo?.key]);

  const total = (rows ?? []).reduce((a, r) => a + r.neto, 0);

  function exportarCsv() {
    if (!rows || rows.length === 0) return;
    const head = 'especialista,bruto,descuento,neto';
    const body = rows.map((r) => `"${r.nombre}",${r.bruto},${r.descuento},${r.neto}`).join('\n');
    const blob = new Blob(['﻿' + head + '\n' + body + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion-${periodo?.key ?? 'periodo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Liquidación exportada (CSV)', 'success');
  }

  return (
    <div>
      <Card padding={18} style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, alignItems: 'end' }}>
          <GField label="Sucursal"><Select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></GField>
          <GField label="Período"><Select value={periodoKey} onChange={(e) => setPeriodoKey(e.target.value)}>{periodos.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</Select></GField>
          <Button variant="secondary" iconLeft="download" disabled={!rows || rows.length === 0} onClick={exportarCsv}>Exportar CSV</Button>
        </div>
      </Card>

      {error ? (
        <ErrorState onRetry={() => setSucId((v) => v)} />
      ) : cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : !rows || rows.length === 0 ? (
        <Card padding={0}><EmptyState icon="calendar-x" title="Sin actividad en el período" desc="No hay servicios liquidables para esta sucursal en el período elegido. Prueba con otro." /></Card>
      ) : (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr>
                {['Especialista', 'Bruto', 'Descuento', 'Neto a pagar'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '14px 16px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.especialistaId}>
                    <td style={{ padding: '13px 16px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Avatar name={r.nombre} size={28} />{r.nombre}</span>
                    </td>
                    <td style={tdNum}>{money(r.bruto)}</td>
                    <td style={{ ...tdNum, color: r.descuento ? 'var(--error)' : 'var(--text-tertiary)' }}>{r.descuento ? `− ${money(r.descuento)}` : '—'}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: 'var(--brand)' }}>{money(r.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <GSummaryRow first strong label="Total neto del período" value={money(total)} />
          </div>
        </Card>
      )}
    </div>
  );
}

const tdNum: React.CSSProperties = { padding: '13px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' };

/** Últimos 4 meses como períodos de liquidación. */
function periodosMes(): { key: string; label: string; desde: string; hasta: string }[] {
  // Mes/año ACTUALES en la zona del negocio (Bogotá), no en UTC: en la noche del
  // último día del mes, UTC ya rodó al mes siguiente y el período por defecto se
  // saltaba uno (dejando la liquidación del mes en curso vacía).
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const yNow = Number(parts.find((p) => p.type === 'year')!.value);
  const mNow = Number(parts.find((p) => p.type === 'month')!.value) - 1; // 0-indexed
  const fmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  const out: { key: string; label: string; desde: string; hasta: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const y = yNow;
    const m = mNow - i;
    const desde = new Date(Date.UTC(y, m, 1, 5, 0, 0)).toISOString();
    const hasta = new Date(Date.UTC(y, m + 1, 1, 4, 59, 59)).toISOString();
    const ref = new Date(Date.UTC(y, m, 15));
    const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: fmt.format(ref), desde, hasta });
  }
  return out;
}

/**
 * Invitar al panel a un especialista que ya existe sin acceso — el caso típico
 * son los creados solo con el nombre desde el asistente de alta del negocio.
 */
function InvitarExistenteDialog({ especialista, onClose, onSent }: { especialista: EspecialistaEquipo; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const emailValid = /.+@.+\..+/.test(email.trim());
  const err = touched && !emailValid ? 'Escribe un correo válido' : undefined;

  async function enviar() {
    setTouched(true);
    if (!emailValid || enviando) return;
    setEnviando(true);
    try {
      await invitarExistente(especialista.id, email.trim());
      toast(`Invitación enviada a ${email.trim()}`, 'success');
      onSent();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={460} title="Invitar al panel" subtitle={`${especialista.nombre} recibirá un enlace (7 días) para crear su contraseña y confirmar su celular.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={enviando} onClick={() => void enviar()}>Enviar invitación</Button>
      </>}>
      <div style={{ padding: '8px 0 18px' }}>
        <GField label="Correo del especialista" error={err}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@negocio.co" autoFocus />
        </GField>
      </div>
    </Dialog>
  );
}
