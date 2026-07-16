import { useState } from 'react';
import type { CitaAgenda, MetodoPago } from '@orkalis/shared';
import { money } from '../../lib/format';
import { completarCita } from '../../lib/useCitas';
import { AppHeader, FooterBar, ScrollArea } from '../../ui';
import { Button, Card, Chip, Icon, useToast } from '../../ui/ui';
import { PAGOS, SectionLabel, turnoCliente, turnoTotal } from './spec-ui';

export function CobroSpec({ turno, onBack, onDone }: { turno: CitaAgenda; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const [pago, setPago] = useState<MetodoPago | null>(null);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const total = turnoTotal(turno);

  async function confirmar() {
    setIntento(true);
    if (!pago) { toast('Elige un método de pago', 'warning'); return; }
    setGuardando(true);
    try {
      await completarCita(turno.id, { metodoPago: pago });
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: intento && !pago ? 8 : 16 }}>
            {PAGOS.map((p) => <Chip key={p.id} active={pago === p.id} icon={p.icon} onClick={() => setPago(p.id)}>{p.label}</Chip>)}
          </div>
          {intento && !pago && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: 'var(--text-xs)', marginBottom: 16 }}><Icon name="alert-circle" size={14} color="var(--error)" /> Selecciona un método de pago para completar.</div>}

          <Card padding={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>Total a cobrar</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{money(total)}</span>
            </div>
          </Card>
        </div>
      </ScrollArea>

      <FooterBar>
        <Button size="lg" fullWidth loading={guardando} iconLeft="check" onClick={confirmar}>Confirmar cobro y completar</Button>
      </FooterBar>
    </div>
  );
}
