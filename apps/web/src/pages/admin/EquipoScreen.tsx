import { useMemo, useState } from 'react';
import type { CitasFuturasResp, EspecialistaEquipo } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { urlFotoEspecialista } from '../../lib/api';
import { EditorFoto } from '../../ui/EditorFoto';
import { useAuth } from '../../lib/auth';
import {
  asignarServicios,
  asignarSucursales,
  borrarFotoEspecialista,
  subirFotoEspecialista,
  citasFuturasEspecialista,
  crearMiFicha,
  darDeBajaEspecialista,
  editarEspecialista,
  invitacionesPendientes,
  invitarEspecialista,
  invitarExistente,
  reenviarInvitacion,
  useEquipo,
  vincularMiCuenta,
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
  Skeleton,
  StatTile,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from '../../ui/ui';
import { useServicios } from '../../lib/useServicios';
import { GConfirm, GField, RowMenu } from './gestion-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

export function EquipoScreen() {
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
  // "Este soy yo" (E8): vincular una ficha existente a mi propia cuenta.
  const [vincularSp, setVincularSp] = useState<EspecialistaEquipo | null>(null);
  // Asignación de servicios sin pasar por el editor completo.
  const [servSp, setServSp] = useState<EspecialistaEquipo | null>(null);
  const { refrescar } = useAuth();
  // Invitaciones vigentes → badge "Invitación enviada" y botón de reenvío.
  const invitaciones = useApi<InvitacionPendiente[]>(invitacionesPendientes);
  const invPorEsp = useMemo(() => new Map((invitaciones.data ?? []).map((i) => [i.especialistaId, i])), [invitaciones.data]);
  // Cuando la baja choca con citas futuras, el servidor las cuenta y aquí se
  // decide qué hacer con ellas antes de reintentar.
  const [conflicto, setConflicto] = useState<{ esp: EspecialistaEquipo; citas: CitasFuturasResp } | null>(null);

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

  async function vincular() {
    if (!vincularSp) return;
    try {
      await vincularMiCuenta(vincularSp.id);
      setVincularSp(null);
      // La sesión gana `especialistaId`: aparece "Mi panel de especialista".
      await refrescar();
      await recargar();
      await invitaciones.recargar();
      toast('Listo: esa ficha ahora es tuya. Tienes "Mi panel de especialista" en tu menú.', 'success');
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

  // La Liquidación vive ahora en Finanzas (Plan-Finanzas F5): es el pago del
  // período, no gestión del equipo.
  const tabs = [
    { value: 'todos', label: 'Todos' },
    { value: 'libres', label: 'Libres' },
    { value: 'ocupados', label: 'Ocupados' },
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

      {error ? (
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
              onServicios={() => setServSp(e)}
              onDelete={() => setDelSp(e)}
              onReenviar={() => void reenviar(e)}
              onInvitar={() => setInvitarSp(e)}
              onVincular={() => setVincularSp(e)}
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
      {servSp && (
        <AsignarServiciosDialog
          especialista={servSp}
          servicios={serviciosActivos}
          onClose={() => setServSp(null)}
          onSaved={async () => { setServSp(null); await recargar(); }}
        />
      )}
      <GConfirm open={!!vincularSp} title="Vincular esta ficha a tu cuenta" confirmLabel="Sí, este soy yo" confirmIcon="user"
        desc={vincularSp ? <span>La ficha de <strong style={{ color: 'var(--text-primary)' }}>{vincularSp.nombre}</strong> quedará enlazada a TU cuenta: sus citas y ganancias serán las tuyas y tendrás acceso a tu panel de especialista. {invPorEsp.has(vincularSp.id) ? 'Su invitación pendiente se cancela.' : ''}</span> : ''}
        onClose={() => setVincularSp(null)} onConfirm={() => void vincular()} />
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

function SpecialistCard({ s, sucNombre, servNombre, invitacion, onToggle, onEdit, onServicios, onDelete, onReenviar, onInvitar, onVincular }: { s: EspecialistaEquipo; sucNombre: Map<string, string>; servNombre: Map<string, string>; invitacion: InvitacionPendiente | null; onToggle: () => void; onEdit: () => void; onServicios: () => void; onDelete: () => void; onReenviar: () => void; onInvitar: () => void; onVincular: () => void }) {
  // Sin servicios declarados realiza todos: se dice en claro para que el admin no
  // lo lea como "no tiene ninguno asignado".
  const todos = s.servicioIds.length === 0;
  const visibles = s.servicioIds.slice(0, 3);
  const resto = s.servicioIds.length - visibles.length;
  // Estado del acceso (Plan-Correo E5/E8): tu propia ficha, con cuenta, con
  // invitación en el aire o sin nada (los creados solo con nombre en el alta).
  const { usuario } = useAuth();
  const esMia = !!usuario && s.usuarioId === usuario.id;
  const acceso = esMia
    ? ({ tone: 'brand', icon: 'user', label: s.telefonoVerificadoEn ? 'Tú' : 'Tú · celular sin verificar' } as const)
    : s.usuarioId
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
          { icon: 'scissors', label: 'Asignar servicios', onClick: onServicios },
          ...(!s.usuarioId && invitacion ? [{ icon: 'mail', label: 'Reenviar invitación', onClick: onReenviar }] : []),
          ...(!s.usuarioId && !invitacion ? [{ icon: 'mail', label: 'Invitar al panel', onClick: onInvitar }] : []),
          // "Este soy yo" (E8): solo sobre fichas sin acceso y si mi cuenta aún
          // no tiene la suya.
          ...(!s.usuarioId && !usuario?.especialistaId ? [{ icon: 'user', label: 'Este soy yo (vincular a mi cuenta)', onClick: onVincular }] : []),
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

  // "Soy yo" (Plan-Correo E8): el admin crea SU propia ficha, enlazada a su
  // cuenta — sin correo ni invitación. Solo se ofrece si aún no tiene una.
  const { usuario, refrescar } = useAuth();
  const [soyYo, setSoyYo] = useState(false);
  const puedeSerYo = !especialista && !usuario?.especialistaId;

  // Correo de la invitación (Plan-Correo E5): obligatorio en el alta ajena. La
  // contraseña y el celular los pone el propio especialista desde el enlace.
  const emailValid = /.+@.+\..+/.test(email.trim());

  const nombreErr = touched && nombre.trim().length < 2 ? 'Escribe un nombre' : undefined;
  const sucErr = touched && sel.length === 0 ? 'Asigna al menos una sucursal' : undefined;
  const emailErr = touched && !especialista && !soyYo && !emailValid ? 'Escribe un correo válido' : undefined;
  const valid = nombre.trim().length >= 2 && sel.length > 0 && (Boolean(especialista) || soyYo || emailValid);

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
      } else if (soyYo) {
        // "Soy yo" (E8): ficha propia enlazada a la cuenta en sesión, sin
        // invitación. Se refresca la sesión para que aparezca el conmutador
        // "Mi panel de especialista".
        const creado = await crearMiFicha({
          nombre: nombre.trim(),
          apellidos: apellidos.trim() || undefined,
          especialidad: especialidad.trim() || undefined,
          sucursalIds: sel,
          servicioIds: selServ,
          disponible,
        });
        await guardarFoto(creado.id);
        await refrescar();
        toast('Listo: tu ficha quedó enlazada a tu cuenta. Tienes "Mi panel de especialista" en tu menú.', 'success');
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
        <Button variant="primary" loading={guardando} onClick={guardar}>{especialista ? 'Guardar cambios' : soyYo ? 'Crear mi ficha' : 'Crear y enviar invitación'}</Button>
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
          {puedeSerYo && (
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
              <Switch testId="soy-yo-switch" checked={soyYo} onChange={(v) => { setSoyYo(v); if (v && !nombre.trim()) setNombre(usuario?.nombre ?? ''); }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Soy yo (yo también atiendo)</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>La ficha se enlaza a tu cuenta actual: sin invitación ni otro correo.</div>
              </div>
            </label>
          )}
          <GField label="Nombre" error={nombreErr}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Andrés" /></GField>
          <GField label="Apellidos" optional><Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Ej.: Mejía" /></GField>
          {!especialista && !soyYo && (
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

        {!especialista && !soyYo && (
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

/**
 * Asignación de servicios directa (sin pasar por el editor completo): las
 * mismas píldoras del alta, pero solas. Vacío = realiza TODOS los servicios.
 */
function AsignarServiciosDialog({ especialista, servicios, onClose, onSaved }: { especialista: EspecialistaEquipo; servicios: { id: string; nombre: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>(especialista.servicioIds);
  const [guardando, setGuardando] = useState(false);

  function toggle(id: string) {
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      await asignarServicios(especialista.id, sel);
      toast(sel.length === 0 ? `${especialista.nombre} realizará todos los servicios` : `Servicios de ${especialista.nombre} actualizados`, 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={520} title="Asignar servicios" subtitle={especialista.nombre}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={() => void guardar()}>Guardar servicios</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {sel.length === 0
            ? 'Sin selección: realiza TODOS los servicios del catálogo.'
            : `Solo aparecerá en las reservas de estos ${sel.length} servicio(s).`}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {servicios.map((sv) => {
            const on = sel.includes(sv.id);
            return (
              <button key={sv.id} type="button" onClick={() => toggle(sv.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: on ? 'var(--brand-tint)' : 'var(--surface-card)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {on && <Icon name="check" size={13} color="var(--brand)" />}
                {sv.nombre}
              </button>
            );
          })}
          {servicios.length === 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Aún no hay servicios en el catálogo.</span>
          )}
        </div>
        {sel.length > 0 && (
          <button type="button" onClick={() => setSel([])} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 600 }}>
            Quitar selección (que realice todos)
          </button>
        )}
      </div>
    </Dialog>
  );
}
