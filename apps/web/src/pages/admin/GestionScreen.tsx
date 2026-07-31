import { useEffect, useMemo, useState } from 'react';
import { useSucursal } from '../../lib/sucursal';
import { moduloActivo, useConfig } from '../../lib/useConfig';
import { Icon } from '../../ui/ui';
import { EquipoScreen } from './EquipoScreen';
import { ServiciosScreen } from './ServiciosScreen';
import { InventarioScreen } from './InventarioScreen';

interface TabDef { id: string; label: string; icon: string }

/** Contenedor de Gestión: Inventario (si módulo ON) · Servicios · Equipo. */
export function GestionScreen() {
  const { sucursalActivaId } = useSucursal();
  const config = useConfig(sucursalActivaId);
  const inventarioOn = moduloActivo(config.data, 'modulo.inventario');

  const tabs = useMemo<TabDef[]>(
    () => [
      ...(inventarioOn ? [{ id: 'inventario', label: 'Inventario', icon: 'package' }] : []),
      { id: 'servicios', label: 'Servicios', icon: 'scissors' },
      { id: 'equipo', label: 'Equipo', icon: 'users' },
    ],
    [inventarioOn],
  );

  const [tab, setTab] = useState('servicios');
  // Si la pestaña activa deja de existir (inventario se apaga), cae a la primera.
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '1px solid var(--border-subtle)' }}>
        {tabs.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 44, padding: '0 16px', marginBottom: -1, border: 'none', borderBottom: `2px solid ${on ? 'var(--brand)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600 }}
            >
              <Icon name={t.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'inventario' && inventarioOn && <InventarioScreen sucursalId={sucursalActivaId} />}
      {tab === 'servicios' && <ServiciosScreen />}
      {tab === 'equipo' && <EquipoScreen />}
    </div>
  );
}
