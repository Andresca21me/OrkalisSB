import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RolUsuario, type EspecialistaEquipo } from '@orkalis/shared';
import { api, ApiError } from '../../lib/api';
import { hora, hoyISO, money, sumarDiasISO } from '../../lib/format';
import { useAuth, useMiFoto } from '../../lib/auth';
import { borrarMiFoto, miTelefonoIniciar, subirMiFoto } from '../../lib/useEquipo';
import { EditorFoto } from '../../ui/EditorFoto';
import { rangoDiaBogota } from '../../lib/useCitas';
import { useGananciasDetalle } from '../../lib/useEspecialista';
import { DesgloseSheet } from './spec-desglose';
import { diasATimestamps, etiquetaRango, presetRango, type RangoDias } from '../../lib/useReportes';
import { AppHeader, ScrollArea } from '../../ui';
import { RangeCalendar } from '../../ui/RangeCalendar';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton, Segmented, Switch, useToast } from '../../ui/ui';
import { DayStat, SectionLabel, Sheet } from './spec-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }
type Periodo = 'hoy' | 'semana' | 'mes';

function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = hoyISO();
  if (p === 'hoy') return rangoDiaBogota(hoy);
  const [y, m] = hoy.split('-').map(Number);
  const desdeIso = p === 'semana' ? sumarDiasISO(hoy, -6) : `${y}-${String(m).padStart(2, '0')}-01`;
  return { desde: `${desdeIso}T05:00:00.000Z`, hasta: rangoDiaBogota(hoy).hasta };
}

// ── Ganancias ────────────────────────────────────────────────────────────────
export function GananciasSpec({ especialistaId }: { especialistaId: string; sucursalId: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [custom, setCustom] = useState<RangoDias | null>(null);
  const [rangoSheet, setRangoSheet] = useState(false);
  // "Ver desglose" de una transacción concreta (Plan-Finanzas F2).
  const [desgloseCita, setDesgloseCita] = useState<string | null>(null);
  const { desde, hasta } = useMemo(() => (custom ? diasATimestamps(custom) : rango(periodo)), [custom, periodo]);
  // Una sola fuente: los agregados Y las filas salen del mismo endpoint, así la
  // lista SIEMPRE suma lo que dice el hero (antes se pintaba el bruto de los
  // servicios en verde-ganancia y nada cuadraba).
  const g = useGananciasDetalle(especialistaId, desde, hasta);

  const d = g.data;
  const avg = d && d.servicios ? Math.round(d.ganServicios / d.servicios) : 0;
  const esHoy = !custom && periodo === 'hoy';
  const periodoLabel = custom ? etiquetaRango(custom) : periodo === 'hoy' ? 'hoy' : periodo === 'semana' ? 'esta semana' : 'este mes';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Mis ganancias" />
      <div style={{ flex: 'none', padding: '14px 20px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Segmented options={[{ value: 'hoy', label: 'Hoy' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} value={custom ? '' : periodo} onChange={(v) => { setCustom(null); setPeriodo(v as Periodo); }} />
          </div>
          <button type="button" onClick={() => setRangoSheet(true)} aria-label="Rango de fechas personalizado" style={{ flex: 'none', width: 40, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: `1px solid ${custom ? 'var(--brand)' : 'var(--border-default)'}`, background: custom ? 'var(--brand-tint)' : 'var(--surface-card)', cursor: 'pointer' }}>
            <Icon name="calendar" size={18} color={custom ? 'var(--brand)' : 'var(--text-tertiary)'} />
          </button>
        </div>
        {custom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span className="data" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--brand)' }}><Icon name="calendar" size={14} color="var(--brand)" />{etiquetaRango(custom)}</span>
            <button type="button" onClick={() => setCustom(null)} aria-label="Quitar rango" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 4 }}><Icon name="x" size={16} color="var(--text-tertiary)" /></button>
          </div>
        )}
      </div>

      <ScrollArea>
        {g.error ? (
          <div style={{ padding: 20 }}><ErrorState onRetry={g.recargar} /></div>
        ) : g.cargando || !d ? (
          <div style={{ padding: 20 }}><Skeleton h={130} r={16} style={{ marginBottom: 18 }} /><div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={8} style={{ flex: 1 }} />)}</div></div>
        ) : esHoy && d.servicios === 0 ? (
          <div style={{ padding: 20 }}><EmptyState icon="dollar-sign" title="Aún sin ganancias hoy" desc="Cuando completes tu primer turno del día verás aquí tu total y el desglose." /></div>
        ) : (
          <div style={{ padding: 20 }}>
            <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--navy)', padding: '22px 20px', marginBottom: 18, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.6 }} />
              <div style={{ position: 'relative' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tus ganancias · {periodoLabel}</div>
                <div className="data" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-4xl)', letterSpacing: '-0.03em', marginTop: 6 }}>{money(d.total)}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-xs)', marginTop: 6 }}>Servicios + comisiones por venta de productos</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
              <DayStat value={d.servicios} label="Servicios" />
              <DayStat value={money(avg)} label="Prom./serv." mono />
              <DayStat value={money(d.comisiones)} label="Comisiones" mono accent />
            </div>

            <SectionLabel>Tus transacciones {esHoy ? 'de hoy' : `· ${d.transacciones.length}`}</SectionLabel>
            {d.transacciones.length === 0 ? (
              <Card padding={18}><div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>El detalle por transacción del período aparece aquí.</div></Card>
            ) : (
              <Card padding={0}>
                {d.transacciones.map((t, i) => {
                  const clave = t.atencionId ?? t.ventaId ?? String(i);
                  const contenido = (
                    <>
                      <span className="data" style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', minWidth: 42 }}>{hora(t.fecha)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.tipo === 'venta_directa' ? 'Venta directa' : (t.clienteNombre ?? 'Walk-in')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.concepto} · {t.reglaResumen}
                        </div>
                      </div>
                      <div style={{ flex: 'none', textAlign: 'right' }}>
                        {/* El verde es SOLO para tu ganancia; el bruto queda de referencia. */}
                        <div className="data" style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#0A8F5B' }}>{money(t.neto)}</div>
                        <div className="data" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>de {money(t.bruto)}</div>
                      </div>
                      {t.citaId && <Icon name="chevron-right" size={15} color="var(--text-tertiary)" style={{ flex: 'none' }} />}
                    </>
                  );
                  return (
                    <div key={clave}>
                      {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                      {t.citaId ? (
                        <button type="button" onClick={() => setDesgloseCita(t.citaId)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                          {contenido}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>{contenido}</div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
            <p style={{ margin: '10px 2px 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              Toca una transacción para ver la fórmula aplicada: precio × regla = tu ganancia.
            </p>
          </div>
        )}
      </ScrollArea>

      <Sheet open={rangoSheet} onClose={() => setRangoSheet(false)} title="Elige el rango de fechas">
        <RangeCalendar value={custom ?? presetRango('mes')} onApply={(r) => { setCustom(r); setRangoSheet(false); }} />
      </Sheet>
      <DesgloseSheet citaId={desgloseCita} open={desgloseCita !== null} onClose={() => setDesgloseCita(null)} />
    </div>
  );
}

// ── Perfil ───────────────────────────────────────────────────────────────────

/**
 * Avatar del especialista, editable por él mismo.
 *
 * Normalmente la foto la sube el administrador al darlo de alta, pero aquí
 * puede cambiarla: es su cara y es quien mejor la elige. Se guarda contra
 * `mi/foto` —sin id en la ruta, lo deduce el servidor de la sesión— y después
 * se refresca la sesión, que es lo que hace que el cambio salte a la vez en
 * esta pantalla, en la cabecera de "Mi día" y en el menú lateral de escritorio.
 * La misma foto es la que ve el cliente en el enlace de reserva.
 */
function MiFoto({ nombre }: { nombre: string }) {
  const { refrescar } = useAuth();
  const foto = useMiFoto();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Foto recién elegida, a la espera de encuadre en el editor.
  const [editando, setEditando] = useState<File | null>(null);

  async function aplicar(accion: () => Promise<unknown>, ok: string) {
    setMenu(false);
    setOcupado(true);
    try {
      await accion();
      await refrescar();
      toast(ok, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenu(true)}
        disabled={ocupado}
        aria-label="Cambiar mi foto de perfil"
        style={{ position: 'relative', flex: 'none', padding: 0, border: 'none', background: 'transparent', borderRadius: 999, cursor: ocupado ? 'progress' : 'pointer', opacity: ocupado ? 0.6 : 1 }}
      >
        <Avatar name={nombre} size={64} src={foto} />
        <span
          aria-hidden
          style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 999, background: 'var(--brand)', border: '2px solid var(--surface-card)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="image" size={12} color="var(--brand-on, #fff)" />
        </span>
      </button>

      {/* El input vive fuera del botón: anidarlo dispararía el diálogo de
          archivos al abrir el menú, no al elegir la opción. */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          // Se limpia para que volver a elegir el MISMO archivo cuente como
          // cambio y el onChange se dispare otra vez.
          e.target.value = '';
          if (archivo) setEditando(archivo);
        }}
      />

      {editando && (
        <EditorFoto
          archivo={editando}
          onCancelar={() => setEditando(null)}
          onConfirmar={(dataUrl) => {
            setEditando(null);
            void aplicar(() => subirMiFoto(dataUrl), 'Foto actualizada');
          }}
        />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Tu foto de perfil">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', lineHeight: '19px' }}>
            La verán tus clientes al elegirte en el enlace de reservas.
          </div>
          <Button variant="secondary" size="lg" fullWidth iconLeft="image" onClick={() => input.current?.click()}>
            {foto ? 'Cambiar foto' : 'Subir una foto'}
          </Button>
          {foto && (
            <Button variant="secondary" size="lg" fullWidth iconLeft="trash-2" onClick={() => void aplicar(borrarMiFoto, 'Foto eliminada')}>
              Quitar foto
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}

export function PerfilSpec({ disponible, onToggleDisp, sucursales, sucActivaId, sucActivaNombre, onPickSucursal }: {
  disponible: boolean; onToggleDisp: () => void; sucursales: Sucursal[]; sucActivaId: string | null; sucActivaNombre: string; onPickSucursal: (id: string) => void;
}) {
  const { usuario, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<Sucursal | null>(null);
  // Un admin con ficha propia ("Yo también atiendo", E8) entra a este panel
  // como especialista; desde aquí vuelve a su panel de administración.
  const esAdmin = usuario?.rol === RolUsuario.Admin;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Perfil" />
      <ScrollArea>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <MiFoto nombre={usuario?.nombre ?? ''} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{usuario?.nombre}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{esAdmin ? 'Administrador · atiende agenda' : 'Especialista'} · {usuario?.negocio.nombre}</div>
            </div>
          </div>

          {esAdmin && (
            <Card padding={14} style={{ marginBottom: 18 }}>
              <Button variant="secondary" fullWidth iconLeft="layout-grid" onClick={() => navigate('/admin')}>
                Volver a administración
              </Button>
            </Card>
          )}

          <VerificarCelularCard />

          <SectionLabel>Disponibilidad</SectionLabel>
          <Card padding={16} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{disponible ? 'Disponible' : 'Ocupado'}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: '17px', marginTop: 2 }}>{disponible ? 'Tus franjas libres se ofrecen en el enlace de reservas.' : 'Tus franjas dejan de ofrecerse en el enlace público.'}</div>
              </div>
              <Switch checked={disponible} onChange={onToggleDisp} tone="success" />
            </div>
          </Card>

          {sucursales.length > 1 && (
            <>
              <SectionLabel>Sucursal activa</SectionLabel>
              <Card padding={0} style={{ marginBottom: 18 }}>
                {sucursales.map((b, i) => {
                  const on = b.id === sucActivaId;
                  return (
                    <div key={b.id}>
                      {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                      <button type="button" onClick={() => !on && setConfirm(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: on ? 'default' : 'pointer', textAlign: 'left' }}>
                        <Icon name="building" size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
                        <span style={{ flex: 1, fontWeight: on ? 600 : 500, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{b.nombre}</span>
                        {on ? <Badge tone="brand" dot>Activa</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />}
                      </button>
                    </div>
                  );
                })}
              </Card>
            </>
          )}

          <Button variant="secondary" size="lg" fullWidth iconLeft="log-out" onClick={() => void logout()}>Cerrar sesión</Button>
          <div style={{ height: 8 }} />
          <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Sede actual: {sucActivaNombre}</div>
        </div>
      </ScrollArea>

      {confirm && (
        <Sheet open onClose={() => setConfirm(null)} title="¿Cambiar de sucursal?"
          footer={<div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setConfirm(null)}>Volver</Button>
            <Button size="lg" style={{ flex: 1 }} onClick={() => { onPickSucursal(confirm.id); toast(`Operando en ${confirm.nombre}`, 'success'); setConfirm(null); }}>Cambiar</Button>
          </div>}>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: '22px' }}>Vas a operar en <strong style={{ color: 'var(--text-primary)' }}>{confirm.nombre}</strong>. Tu agenda y disponibilidad cambiarán a esta sede.</p>
        </Sheet>
      )}
    </div>
  );
}

/**
 * Registro del celular del propio especialista, SIN códigos (los OTP se
 * retiraron): se guarda el número y llega un mensaje de prueba — si llega, el
 * número quedó bien; si no, se corrige aquí mismo y se reenvía. Aparece
 * mientras no haya celular registrado; tras enviarlo queda un paso de
 * comprobación con opción de corregir el número.
 */
function VerificarCelularCard() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [esp, setEsp] = useState<EspecialistaEquipo | null>(null);
  const [paso, setPaso] = useState<'aviso' | 'celular' | 'enviado' | 'listo'>('aviso');
  const [celular, setCelular] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!usuario?.especialistaId) return;
    api.get<EspecialistaEquipo[]>('/especialistas')
      .then((eqp) => setEsp(eqp.find((e) => e.id === usuario.especialistaId) ?? null))
      .catch(() => { /* sin datos no se muestra nada */ });
  }, [usuario?.especialistaId]);

  if (!esp || (esp.telefono && paso === 'aviso') || paso === 'listo') return null;

  async function enviar() {
    const digitos = celular.replace(/\D/g, '').replace(/^57/, '');
    if (!/^3\d{9}$/.test(digitos)) { toast('Celular de 10 dígitos que empiece por 3.', 'error'); return; }
    setOcupado(true);
    try {
      await miTelefonoIniciar(digitos);
      setPaso('enviado');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast('La mensajería está pausada; inténtalo más tarde.', 'warning');
      else toast((e as Error).message, 'error');
    } finally { setOcupado(false); }
  }

  return (
    <Card padding={16} style={{ marginBottom: 18, border: '1px solid rgba(180,83,9,0.3)', background: 'var(--warning-tint)' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Icon name="smartphone" size={18} color="#B45309" style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Registra tu celular</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
            {paso === 'enviado'
              ? 'Te enviamos un mensaje de prueba. Si te llegó, tu número quedó listo; si no, corrígelo y vuelve a enviarlo.'
              : 'Sin él no podemos avisarte cuando te agenden, cancelen o muevan una cita.'}
          </div>

          {paso === 'aviso' && (
            <Button size="sm" variant="secondary" style={{ marginTop: 10 }} onClick={() => setPaso('celular')}>Registrar ahora</Button>
          )}
          {paso === 'celular' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="300 123 4567" inputMode="tel"
                style={{ flex: 1, minWidth: 150, height: 36, padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }} />
              <Button size="sm" loading={ocupado} onClick={() => void enviar()}>Guardar y probar</Button>
            </div>
          )}
          {paso === 'enviado' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Button size="sm" onClick={() => setPaso('listo')}>Me llegó, todo bien</Button>
              <Button size="sm" variant="secondary" onClick={() => setPaso('celular')}>No llegó · corregir número</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
