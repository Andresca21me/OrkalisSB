import { useEffect, useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { money } from '../../lib/format';
import { completarCita, type PagoLinea } from '../../lib/useCitas';
import { AppHeader, FooterBar, ProductosVenta, ScrollArea, type LineaProducto } from '../../ui';
import { PagoSplit, pagoInicial, sumaPagos } from '../../ui/PagoSplit';
import { Button, Card, Icon, useToast } from '../../ui/ui';
import { SectionLabel, turnoCliente, turnoTotal } from './spec-ui';
import { DesgloseSheet } from './spec-desglose';

/** Lo que devuelve `POST /citas/:id/completar` (fila cruda; numerics como string). */
interface AtencionCruda {
  total: string;
  ganProf: string;
}

export function CobroSpec({ turno, onBack, onDone }: { turno: CitaAgenda; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const totalServicios = turnoTotal(turno);
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [subtotalProd, setSubtotalProd] = useState(0);
  const total = totalServicios + subtotalProd;
  const [lineas, setLineas] = useState<PagoLinea[]>(() => pagoInicial(totalServicios));
  const [guardando, setGuardando] = useState(false);
  // Transparencia en el momento que más importa (F2): tras cobrar se muestra
  // cuánto ganaste — antes la respuesta del cierre se descartaba sin leerla.
  const [resultado, setResultado] = useState<AtencionCruda | null>(null);
  const [verDesglose, setVerDesglose] = useState(false);
  const cuadra = sumaPagos(lineas) === Math.round(total);

  useEffect(() => { setLineas(pagoInicial(total)); }, [total]);

  async function confirmar() {
    if (!cuadra) { toast('El pago debe sumar exactamente el total', 'warning'); return; }
    setGuardando(true);
    try {
      const at = (await completarCita(turno.id, { pagos: lineas, productos: productos.length ? productos : undefined })) as AtencionCruda;
      setResultado(at);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  if (resultado) {
    const gan = Number(resultado.ganProf);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <AppHeader title="Turno completado" sub={turnoCliente(turno)} />
        <ScrollArea>
          <div style={{ padding: 20 }}>
            <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--navy)', padding: '26px 20px', marginBottom: 16, position: 'relative', textAlign: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.6 }} />
              <div style={{ position: 'relative' }}>
                <Icon name="check-circle" size={34} color="#4ade80" />
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 10 }}>Cobrado</div>
                <div className="data" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-3xl)', letterSpacing: '-0.03em', marginTop: 4 }}>{money(Number(resultado.total))}</div>
                {gan > 0 && (
                  <div style={{ color: '#4ade80', fontSize: 'var(--text-sm)', fontWeight: 700, marginTop: 8 }}>
                    Tu ganancia: {money(gan)}
                  </div>
                )}
              </div>
            </div>
            {gan > 0 && (
              <Button variant="secondary" fullWidth onClick={() => setVerDesglose(true)}>Ver desglose de mi ganancia</Button>
            )}
          </div>
        </ScrollArea>
        <FooterBar>
          <Button size="lg" fullWidth iconLeft="check" onClick={onDone}>Listo</Button>
        </FooterBar>
        <DesgloseSheet citaId={turno.id} open={verDesglose} onClose={() => setVerDesglose(false)} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Completar turno" sub={`${turnoCliente(turno)} · ${money(total)}`} onBack={onBack} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          <SectionLabel>Servicios realizados</SectionLabel>
          <Card padding={0} style={{ marginBottom: 16 }}>
            {turno.servicios.map((s, i) => (
              <div key={i}>
                {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
                  <span className="data" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{money(Number(s.precio))}</span>
                </div>
              </div>
            ))}
          </Card>

          <ProductosVenta sucursalId={turno.sucursalId} lineas={productos} onChange={setProductos} onSubtotalChange={setSubtotalProd} />

          <div style={{ marginBottom: 10 }}><span className="eyebrow">Método de pago</span></div>
          <Card padding={14} style={{ marginBottom: 16 }}>
            <PagoSplit total={total} lineas={lineas} onChange={setLineas} sucursalId={turno.sucursalId} />
          </Card>

          <Card padding={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>Total a cobrar</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{money(total)}</span>
            </div>
          </Card>
        </div>
      </ScrollArea>

      <FooterBar>
        {!cuadra && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: 'var(--text-xs)', marginBottom: 10 }}><Icon name="alert-circle" size={14} color="var(--error)" /> Los métodos deben sumar {money(total)} para completar.</div>}
        <Button size="lg" fullWidth loading={guardando} disabled={!cuadra} iconLeft="check" onClick={confirmar}>Confirmar cobro y completar</Button>
      </FooterBar>
    </div>
  );
}
