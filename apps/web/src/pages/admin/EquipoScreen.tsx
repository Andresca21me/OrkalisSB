import { useEffect, useMemo, useState } from 'react';
import type { EspecialistaEquipo, LiquidacionResultado } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import {
  asignarSucursales,
  confirmarVerificacion,
  darDeBajaEspecialista,
  editarEspecialista,
  iniciarVerificacion,
  previewLiquidacion,
  reenviarCodigo,
  useEquipo,
} from '../../lib/useEquipo';
import { PageHead } from '../../ui/Shell';
import {
  Avatar,
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
import { GConfirm, GField, GSummaryRow, RowMenu } from './gestion-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

export function EquipoScreen({ particion }: { particion: boolean }) {
  const { consolidado, sucursalActiva } = useSucursal();
  const toast = useToast();
  const { data, cargando, error, recargar } = useEquipo();
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));
  const sucNombre = useMemo(() => new Map((sucs.data ?? []).map((s) => [s.id, s.nombre])), [sucs.data]);

  const [filtro, setFiltro] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editSp, setEditSp] = useState<EspecialistaEquipo | null>(null);
  const [delSp, setDelSp] = useState<EspecialistaEquipo | null>(null);

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
            <SpecialistCard key={e.id} s={e} sucNombre={sucNombre} onToggle={() => toggleDisponible(e)} onEdit={() => { setEditSp(e); setFormOpen(true); }} onDelete={() => setDelSp(e)} />
          ))}
        </div>
      )}

      {formOpen && <SpecialistModal especialista={editSp} sucursales={sucs.data ?? []} onClose={() => { setFormOpen(false); setEditSp(null); }} onSaved={async () => { setFormOpen(false); setEditSp(null); await recargar(); }} />}
      <GConfirm open={!!delSp} title="Dar de baja al especialista" danger confirmLabel="Dar de baja" confirmIcon="user-x"
        desc={delSp ? <span><strong style={{ color: 'var(--text-primary)' }}>{delSp.nombre}</strong> dejará de aparecer en el equipo, pero su historial de servicios y liquidaciones se conserva (borrado lógico).</span> : ''}
        onClose={() => setDelSp(null)} onConfirm={() => delSp && eliminar(delSp)} />
    </div>
  );
}

function SpecialistCard({ s, sucNombre, onToggle, onEdit, onDelete }: { s: EspecialistaEquipo; sucNombre: Map<string, string>; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card padding={0} testId={`esp-row-${s.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={s.nombre} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.especialidad || 'Sin especialidad'}</div>
        </div>
        <RowMenu items={[
          { icon: 'edit', label: 'Editar', onClick: onEdit },
          { divider: true },
          { icon: 'trash-2', label: 'Eliminar', danger: true, onClick: onDelete },
        ]} />
      </div>

      {s.sucursalIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 16px 0' }}>
          {s.sucursalIds.map((id) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              <Icon name="store" size={12} color="var(--text-tertiary)" />{sucNombre.get(id) ?? 'Sucursal'}
            </span>
          ))}
        </div>
      )}

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

function SpecialistModal({ especialista, sucursales, onClose, onSaved }: { especialista: EspecialistaEquipo | null; sucursales: Sucursal[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(especialista?.nombre ?? '');
  const [apellidos, setApellidos] = useState('');
  const [celular, setCelular] = useState('');
  const [especialidad, setEspecialidad] = useState(especialista?.especialidad ?? '');
  // Alta en dos pasos (FASE-06): al crear hay que verificar el celular.
  const [verificacionId, setVerificacionId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [disponible, setDisponible] = useState(especialista?.disponible ?? true);
  const [sel, setSel] = useState<string[]>(especialista?.sucursalIds ?? (sucursales[0] ? [sucursales[0].id] : []));
  const [notas, setNotas] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Acceso al panel (opcional): si se llena, crea/enlaza el login del especialista.
  const emailValid = /.+@.+\..+/.test(email.trim());
  const quiereLogin = email.trim() !== '' || password !== '';
  const loginOk = emailValid && password.length >= 8;

  // Móvil colombiano: 10 dígitos empezando por 3 (se acepta con o sin +57).
  const celularDigitos = celular.replace(/\D/g, '').replace(/^57/, '');
  const celularOk = /^3\d{9}$/.test(celularDigitos);
  const celularErr = touched && !especialista && !celularOk ? 'Celular de 10 dígitos que empiece por 3' : undefined;

  const nombreErr = touched && nombre.trim().length < 2 ? 'Escribe un nombre' : undefined;
  const sucErr = touched && sel.length === 0 ? 'Asigna al menos una sucursal' : undefined;
  const loginErr = touched && quiereLogin && !loginOk ? 'Correo válido y contraseña de 8+ caracteres' : undefined;
  const valid = nombre.trim().length >= 2 && sel.length > 0 && (!quiereLogin || loginOk) && (Boolean(especialista) || celularOk);

  function toggleSuc(id: string) {
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function guardar() {
    setTouched(true);
    if (!valid) return;
    setGuardando(true);
    try {
      if (especialista) {
        await editarEspecialista(especialista.id, { nombre: nombre.trim(), especialidad: especialidad.trim() || undefined, disponible });
        await asignarSucursales(especialista.id, sel);
        toast('Especialista actualizado', 'success');
      } else {
        // Alta nueva: no se crea nada todavía; se envía el código al celular.
        const { verificacionId: vid } = await iniciarVerificacion({
          nombre: nombre.trim(),
          apellidos: apellidos.trim() || undefined,
          celular: celularDigitos,
          especialidad: especialidad.trim() || undefined,
          sucursalIds: sel,
          ...(quiereLogin ? { email: email.trim(), password } : {}),
        });
        setVerificacionId(vid);
        toast('Te enviamos un código al celular del especialista', 'success');
        return; // el modal pasa al paso 2
      }
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function verificar() {
    if (!verificacionId || codigo.trim().length < 4) return;
    setGuardando(true);
    try {
      const creado = await confirmarVerificacion(verificacionId, codigo.trim());
      if (!disponible) await editarEspecialista(creado.id, { disponible: false });
      toast(quiereLogin ? 'Especialista creado con acceso al panel' : 'Especialista creado', 'success');
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function reenviar() {
    if (!verificacionId) return;
    try {
      await reenviarCodigo(verificacionId);
      toast('Código reenviado', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  // ── Paso 2: código de verificación ────────────────────────────────────────
  if (verificacionId) {
    return (
      <Dialog open onClose={onClose} width={460} title="Verifica el celular"
        subtitle={`Enviamos un código de 6 dígitos al ${celularDigitos}. El especialista se crea al confirmarlo.`}
        footer={<>
          <Button variant="ghost" onClick={() => setVerificacionId(null)}>Volver</Button>
          <Button variant="primary" loading={guardando} disabled={codigo.trim().length < 4} onClick={verificar}>Verificar y crear</Button>
        </>}>
        <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GField label="Código recibido">
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              inputMode="numeric"
              autoFocus
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', letterSpacing: '0.25em', textAlign: 'center' }}
            />
          </GField>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>El código vence en 10 minutos.</span>
            <Button variant="ghost" size="md" onClick={reenviar}>Reenviar código</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} width={580} title={especialista ? 'Editar especialista' : 'Nuevo especialista'} subtitle={especialista ? especialista.nombre : 'Registra a un miembro del equipo y asígnalo a una o varias sucursales.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>{especialista ? 'Guardar cambios' : 'Enviar código'}</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GField label="Nombre" error={nombreErr}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Andrés" /></GField>
          <GField label="Apellidos" optional><Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Ej.: Mejía" /></GField>
          {!especialista && (
            <GField label="Celular" span={2} error={celularErr} hint="Recibirá un código para confirmar el número; sin él no podremos avisarle de sus citas.">
              <Input value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="300 123 4567" inputMode="tel" />
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

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <Switch checked={disponible} onChange={setDisponible} tone="success" />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Disponible (libre)</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Aparece como libre para recibir citas.</div>
          </div>
        </label>

        {!especialista && (
          <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Acceso al panel <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· opcional</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: -4, lineHeight: 1.5 }}>
              Si das correo y contraseña, el especialista podrá <strong>iniciar sesión en su panel</strong> (su agenda y ganancias). Su recurso de agenda y su cuenta quedan enlazados. Puedes dejarlo en blanco y agregar el acceso más adelante.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <GField label="Correo" optional error={loginErr}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@negocio.co" /></GField>
              <GField label="Contraseña" optional hint="Mínimo 8 caracteres."><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></GField>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 16, alignItems: 'end' }}>
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
