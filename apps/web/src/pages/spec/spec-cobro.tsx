import { useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { money } from '../../lib/format';
import { completarCita, type PagoLinea } from '../../lib/useCitas';
import { AppHeader, FooterBar, ScrollArea } from '../../ui';
import { PagoSplit, pagoInicial, sumaPagos } from '../../ui/PagoSplit';
import { Button, Card, Icon, useToast } from '../../ui/ui';
import { SectionLabel, turnoCliente, turnoTotal } from './spec-ui';

export function CobroSpec({ turno, onBack, onDone }: { turno: CitaAgenda; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const total = turnoTotal(turno);
  const [lineas, setLineas] = useState<PagoLinea[]>(() => pagoInicial(total));
  const [guardando, setGuardando] = useState(false);
  const cuadra = sumaPagos(lineas) === Math.round(total);

  async function confirmar() {
    if (!cuadra) { toast('El pago debe sumar exactamente el total', 'warning'); return; }
    setGuardando(true);
    try {
      await completarCita(turno.id, { pagos: lineas });
      onDone();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
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

          <div style={{ marginBottom: 10 }}><span className="eyebrow">Método de pago</span></div>
          <Card padding={14} style={{ marginBottom: 16 }}>
            <PagoSplit total={total} lineas={lineas} onChange={setLineas} />
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
