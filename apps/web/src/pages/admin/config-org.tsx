import { useState } from 'react';
import { RolUsuario, type UsuarioInterno } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { crearUsuario, editarUsuario, useUsuarios } from '../../lib/useUsuarios';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  ErrorState,
  Icon,
  Input,
  Select,
  Spinner,
  Switch,
  useToast,
} from '../../ui/ui';
import { GConfirm, GField, RowMenu } from './gestion-ui';
import { ConfigBanner, thConfig } from './config-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

// ── Sucursales ───────────────────────────────────────────────────────────────
export function ConfigSucursales({ sucursales, onChanged }: { sucursales: Sucursal[]; onChanged: () => void }) {
  const toast = useToast();
  const [crear, setCrear] = useState(false);
  const [editar, setEditar] = useState<Sucursal | null>(null);
  const [confirmar, setConfirmar] = useState<Sucursal | null>(null);

  const activas = sucursales.filter((s) => s.activa).length;

  async function alternar(s: Sucursal) {
    try { await api.patch(`/sucursales/${s.id}/estado`, { activa: !s.activa }); toast(`Sucursal ${s.activa ? 'desactivada' : 'activada'}`, s.activa ? 'info' : 'success'); onChanged(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <ConfigBanner tone="brand" icon="store" title="El cobro depende del plan y del nº de especialistas, no de las sucursales">
          Tienes <strong>{activas} {activas === 1 ? 'sucursal activa' : 'sucursales activas'}</strong>. Según el modelo de cobro (ADR-009), la suscripción se calcula por plan + especialistas + cupos de mensajería.
        </ConfigBanner>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{sucursales.length} {sucursales.length === 1 ? 'sucursal' : 'sucursales'}</span>
        <Button iconLeft="plus" onClick={() => setCrear(true)}>Crear sucursal</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sucursales.map((b) => (
          <Card key={b.id} padding={18} style={{ opacity: b.activa ? 1 : 0.72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none' }}><Icon name="store" size={21} color="var(--text-secondary)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{b.nombre}</span>
                  <Badge tone={b.activa ? 'success' : 'neutral'} size="md" dot>{b.activa ? 'Activa' : 'Inactiva'}</Badge>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Switch checked={b.activa} onChange={() => alternar(b)} />
                <RowMenu items={[
                  { icon: 'edit', label: 'Editar sucursal', onClick: () => setEditar(b) },
                  { icon: b.activa ? 'x-circle' : 'check-circle', label: b.activa ? 'Desactivar' : 'Activar', onClick: () => (b.activa ? setConfirmar(b) : alternar(b)) },
                ]} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {crear && <SucursalModal sucursales={sucursales} onClose={() => setCrear(false)} onSaved={() => { setCrear(false); onChanged(); }} />}
      {editar && <SucursalModal sucursal={editar} sucursales={sucursales} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); onChanged(); }} />}
      <GConfirm open={!!confirmar} danger title={confirmar ? `Desactivar ${confirmar.nombre}` : ''} confirmLabel="Desactivar" confirmIcon="x-circle"
        desc={confirmar ? <span>La sucursal dejará de operar y de aparecer en la agenda. Puedes reactivarla cuando quieras; no se borra ningún dato.</span> : ''}
        onClose={() => setConfirmar(null)} onConfirm={() => { if (confirmar) { void alternar(confirmar); setConfirmar(null); } }} />
    </div>
  );
}

function SucursalModal({ sucursal, sucursales, onClose, onSaved }: { sucursal?: Sucursal; sucursales: Sucursal[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '');
  const [init, setInit] = useState<'negocio' | 'clonar'>('negocio');
  const [from, setFrom] = useState(sucursales[0]?.id ?? '');
  const [guardando, setGuardando] = useState(false);
  const editando = !!sucursal;

  async function guardar() {
    if (nombre.trim().length < 2) { toast('Escribe un nombre', 'error'); return; }
    setGuardando(true);
    try {
      if (editando) {
        await api.patch(`/sucursales/${sucursal!.id}`, { nombre: nombre.trim() });
        toast('Sucursal actualizada', 'success');
      } else {
        await api.post('/sucursales', { nombre: nombre.trim(), clonarDeSucursalId: init === 'clonar' ? from : undefined });
        toast('Sucursal creada', 'success');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={520} title={editando ? 'Editar sucursal' : 'Crear sucursal'} subtitle={editando ? sucursal!.nombre : 'Hereda del negocio o clona la configuración de otra sede.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" iconLeft={editando ? 'check' : 'plus'} loading={guardando} onClick={guardar}>{editando ? 'Guardar' : 'Crear sucursal'}</Button>
      </>}>
      <div style={{ padding: '6px 0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GField label="Nombre de la sucursal"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Sede Norte" /></GField>
        {!editando && (
          <div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Configuración inicial</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {([{ v: 'negocio', l: 'Heredar configuración del negocio', d: 'Toma los valores del negocio. Recomendado.' }, { v: 'clonar', l: 'Clonar de otra sucursal', d: 'Copia los overrides de una sede existente.' }] as const).map((o) => {
                const on = init === o.v;
                return (
                  <button key={o.v} type="button" onClick={() => setInit(o.v)} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', padding: 12, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', background: on ? 'var(--brand-tint)' : 'var(--surface-card)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`, flex: 'none', marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{on && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--brand)' }} />}</span>
                    <div><div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{o.l}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{o.d}</div></div>
                  </button>
                );
              })}
              {init === 'clonar' && sucursales.length > 0 && (
                <Select value={from} onChange={(e) => setFrom(e.target.value)}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ── Usuarios ─────────────────────────────────────────────────────────────────
const ROL_LABEL: Record<string, string> = { admin: 'Administrador', recepcionista: 'Recepcionista', especialista: 'Especialista', operador_plataforma: 'Operador' };
const ROL_TONE: Record<string, 'brand' | 'info' | 'neutral'> = { admin: 'brand', recepcionista: 'info', especialista: 'neutral', operador_plataforma: 'neutral' };

export function ConfigUsuarios({ sucursales }: { sucursales: Sucursal[] }) {
  const toast = useToast();
  const { usuario } = useAuth();
  const { data, cargando, error, recargar } = useUsuarios();
  const [invitar, setInvitar] = useState(false);
  const [editar, setEditar] = useState<UsuarioInterno | null>(null);
  const sucNombre = (id: string) => sucursales.find((s) => s.id === id)?.nombre ?? id;

  async function alternar(u: UsuarioInterno) {
    try { await editarUsuario(u.id, { activo: !u.activo }); toast(`Usuario ${u.activo ? 'desactivado' : 'reactivado'}`, u.activo ? 'info' : 'success'); await recargar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  if (error) return <ErrorState onRetry={recargar} />;
  if (cargando || !data) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{data.length} {data.length === 1 ? 'usuario' : 'usuarios'} con acceso</span>
        <Button iconLeft="user-plus" onClick={() => setInvitar(true)}>Nuevo usuario</Button>
      </div>

      <Card padding={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={thConfig}>Usuario</th><th style={thConfig}>Rol</th><th style={thConfig}>Alcance</th><th style={{ ...thConfig, textAlign: 'right' }}>Estado</th><th style={{ ...thConfig, width: 52 }} />
          </tr></thead>
          <tbody>
            {data.map((u, i) => {
              const self = u.id === usuario!.id;
              const alcance = u.rol === RolUsuario.Admin ? 'Todas las sucursales' : (u.sucursalIds.length ? u.sucursalIds.map(sucNombre).join(', ') : '—');
              return (
                <tr key={u.id} style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: u.activo ? 1 : 0.6 }}>
                  <td style={{ padding: '14px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={u.nombre} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{u.nombre}</span>
                          {self && <Badge tone="neutral" size="md">Tú</Badge>}
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 22px' }}><Badge tone={ROL_TONE[u.rol]} size="md">{ROL_LABEL[u.rol]}</Badge></td>
                  <td style={{ padding: '14px 22px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{alcance}</td>
                  <td style={{ padding: '14px 22px', textAlign: 'right' }}><Badge tone={u.activo ? 'success' : 'neutral'} size="md" dot>{u.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td style={{ padding: '14px 16px 14px 0', textAlign: 'right' }}>
                    {!self && <RowMenu items={[
                      { icon: 'edit', label: 'Editar rol y alcance', onClick: () => setEditar(u) },
                      { divider: true },
                      { icon: u.activo ? 'user-x' : 'check-circle', label: u.activo ? 'Desactivar' : 'Reactivar', danger: u.activo, onClick: () => alternar(u) },
                    ]} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {invitar && <UsuarioModal sucursales={sucursales} onClose={() => setInvitar(false)} onSaved={async () => { setInvitar(false); await recargar(); }} />}
      {editar && <UsuarioModal usuario={editar} sucursales={sucursales} onClose={() => setEditar(null)} onSaved={async () => { setEditar(null); await recargar(); }} />}
    </div>
  );
}

function UsuarioModal({ usuario, sucursales, onClose, onSaved }: { usuario?: UsuarioInterno; sucursales: Sucursal[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editando = !!usuario;
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>(usuario?.rol ?? RolUsuario.Recepcionista);
  const [sel, setSel] = useState<string[]>(usuario?.sucursalIds ?? (sucursales[0] ? [sucursales[0].id] : []));
  const [guardando, setGuardando] = useState(false);

  const esAdmin = rol === RolUsuario.Admin;
  const valid = nombre.trim().length >= 2 && (editando || (email.trim() && password.length >= 8)) && (esAdmin || sel.length > 0);

  function toggleSuc(id: string) { setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }

  async function guardar() {
    if (!valid) { toast('Completa los campos requeridos', 'error'); return; }
    setGuardando(true);
    try {
      if (editando) {
        await editarUsuario(usuario!.id, { nombre: nombre.trim(), rol, sucursalIds: esAdmin ? undefined : sel });
        toast('Usuario actualizado', 'success');
      } else {
        await crearUsuario({ nombre: nombre.trim(), email: email.trim(), password, rol, sucursalIds: esAdmin ? undefined : sel });
        toast('Usuario creado', 'success');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={500} title={editando ? `Editar ${usuario!.nombre.split(' ')[0]}` : 'Nuevo usuario'} subtitle={editando ? usuario!.email : 'Crea una cuenta con acceso. Define una contraseña temporal.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>{editando ? 'Guardar cambios' : 'Crear usuario'}</Button>
      </>}>
      <div style={{ padding: '6px 0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GField label="Nombre completo"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Mariana Ruiz" /></GField>
        {!editando && (
          <>
            <GField label="Correo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@negocio.co" /></GField>
            <GField label="Contraseña temporal" hint="Mínimo 8 caracteres. El usuario podrá cambiarla luego."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></GField>
          </>
        )}
        <GField label="Rol" hint={!editando ? 'Para crear un especialista (con su agenda), ve a Gestión › Equipo.' : undefined}>
          <Select value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}>
            <option value={RolUsuario.Admin}>Administrador</option>
            <option value={RolUsuario.Recepcionista}>Recepcionista</option>
            {editando && rol === RolUsuario.Especialista && (
              <option value={RolUsuario.Especialista}>Especialista</option>
            )}
          </Select>
        </GField>
        {!esAdmin && (
          <GField label="Alcance de sucursales">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sucursales.map((b) => {
                const on = sel.includes(b.id);
                return (
                  <button key={b.id} type="button" onClick={() => toggleSuc(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-xs)', background: on ? 'var(--brand-tint)' : 'var(--surface-card)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on && <Icon name="check" size={12} color="#fff" />}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{b.nombre}</span>
                  </button>
                );
              })}
            </div>
          </GField>
        )}
      </div>
    </Dialog>
  );
}
