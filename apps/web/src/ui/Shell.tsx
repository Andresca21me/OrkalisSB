import { useState, type ReactNode } from 'react';
import { RolUsuario } from '@orkalis/shared';
import { useAuth } from '../lib/auth';
import { useSucursal } from '../lib/sucursal';
import { Avatar, BranchSelector, Icon, Logo, MenuItem, Popover } from './ui';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const ROL_LABEL: Record<string, string> = {
  [RolUsuario.Admin]: 'Administrador',
  [RolUsuario.Recepcionista]: 'Recepción',
  [RolUsuario.Especialista]: 'Especialista',
  [RolUsuario.OperadorPlataforma]: 'Operador',
};

/**
 * Shell de panel de escritorio (FASE-02): TopNav horizontal fiel al prototipo
 * (`admin-ui.jsx`): logo + selector de sucursal + navegación inline + menú de
 * usuario. Contenido fluido 12-col, máx 1280px sobre superficie hundida.
 */
export function Shell({
  nav,
  activo,
  onNav,
  acciones,
  sucursalSelector,
  perfilItems,
  children,
}: {
  nav: NavItem[];
  activo: string;
  onNav: (id: string) => void;
  /** Acciones específicas de la página (a la derecha del nav). */
  acciones?: ReactNode;
  /** Muestra el selector sucursal/consolidado (requiere SucursalProvider). */
  sucursalSelector?: boolean;
  /** Ítems que viven en el menú de perfil (p. ej. Configuración), no en el nav. */
  perfilItems?: NavItem[];
  children: ReactNode;
}) {
  const [menuMovil, setMenuMovil] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-sunken)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          flex: 'none',
          height: 'var(--topnav-h)',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
        }}
      >
        <Logo />
        <div className="ork-tn-sep" style={{ width: 1, height: 28, background: 'var(--border-subtle)' }} />

        {sucursalSelector && <span data-tour="sucursal" className="ork-tn-branch"><SucursalSelectorConectado /></span>}

        <nav className="ork-tn-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          {nav.map((it) => {
            const on = it.id === activo;
            return (
              <button
                key={it.id}
                type="button"
                data-tour={`nav-${it.id}`}
                onClick={() => onNav(it.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 40,
                  padding: '0 14px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: on ? 'var(--brand-tint)' : 'transparent',
                  color: on ? 'var(--brand)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'background var(--dur-fast) var(--ease-out)',
                }}
              >
                <Icon name={it.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
                {it.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {acciones}

        {/* Menú móvil (hamburguesa) */}
        <button
          className="ork-tn-burger"
          onClick={() => setMenuMovil((o) => !o)}
          aria-label="Menú"
          style={{ display: 'none', width: 38, height: 38, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
        >
          <Icon name="layout-grid" />
        </button>

        <div className="ork-tn-sep" style={{ width: 1, height: 28, background: 'var(--border-subtle)' }} />
        <span data-tour="usermenu"><MenuUsuario items={perfilItems} activo={activo} onNav={onNav} /></span>
      </header>

      {/* Drawer de navegación en móvil */}
      {menuMovil && (
        <div className="ork-tn-drawer" onClick={() => setMenuMovil(false)} style={{ position: 'fixed', inset: 0, top: 'var(--topnav-h)', zIndex: 29, background: 'rgba(10,15,20,0.4)' }}>
          <nav onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sucursalSelector && (
              <div style={{ padding: '6px 4px 10px', marginBottom: 4, borderBottom: '1px solid var(--border-subtle)' }}>
                <SucursalSelectorConectado />
              </div>
            )}
            {nav.map((it) => {
              const on = it.id === activo;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { onNav(it.id); setMenuMovil(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    height: 44,
                    padding: '0 12px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: on ? 'var(--brand-tint)' : 'transparent',
                    color: on ? 'var(--brand)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <Icon name={it.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
                  {it.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <main className="ork-main" style={{ flex: 1, width: '100%', maxWidth: 'var(--content-max)', margin: '0 auto', padding: 24, minWidth: 0 }}>{children}</main>

      <style>{`
        @media (max-width: 920px) {
          .ork-tn-nav { display: none !important; }
          .ork-tn-branch { display: none !important; }
          .ork-tn-burger { display: inline-flex !important; align-items: center; justify-content: center; }
        }
        @media (max-width: 560px) {
          .ork-tn-sep { display: none !important; }
          .ork-tn-userlabel { display: none !important; }
          .ork-main { padding: 16px !important; }
        }

        /* ── Utilidades responsive de los paneles (admin/recepción/spec/plataforma) ── */
        /* KPIs: 4 en escritorio → 2 en móvil → 1 en pantallas muy angostas.
           minmax(0,1fr) + min-width:0 permiten que las tarjetas ENCogan (sin desbordar). */
        .ork-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .ork-kpis > * { min-width: 0; }
        /* Contenido principal + barra lateral (apila la barra abajo en móvil). */
        .ork-main-aside { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 20px; align-items: start; }
        .ork-aside { position: sticky; top: 88px; }
        /* Que las columnas puedan ENCogar (su contenido se reajusta, no desborda). */
        .ork-main-aside > *, .ork-config-body > *, .ork-agenda-body > * { min-width: 0; }
        /* Rejillas de N columnas que colapsan por pasos (minmax(0,1fr) evita desbordes). */
        .ork-cols-2 { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; }
        .ork-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
        .ork-cols-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
        .ork-cols-2 > *, .ork-cols-3 > *, .ork-cols-4 > * { min-width: 0; }
        /* Contenedor de scroll horizontal para tablas anchas (no rompe el layout). */
        .ork-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        /* Barra de filtros/acciones que envuelve en móvil. */
        .ork-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        /* Barra lateral IZQUIERDA + contenido (Config, Agenda): apila en móvil. */
        .ork-config-body { display: grid; grid-template-columns: 220px minmax(0,1fr); gap: 24px; align-items: start; }
        .ork-agenda-body { display: grid; grid-template-columns: 264px minmax(0,1fr); gap: 20px; align-items: start; }

        @media (max-width: 960px) {
          .ork-main-aside { grid-template-columns: minmax(0, 1fr); }
          .ork-aside { position: static; top: auto; }
          .ork-cols-4 { grid-template-columns: repeat(2, 1fr); }
          .ork-config-body, .ork-agenda-body { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 720px) {
          .ork-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .ork-cols-2, .ork-cols-3 { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 520px) {
          .ork-cols-4 { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 360px) {
          .ork-kpis { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function SucursalSelectorConectado() {
  const { sucursales, consolidado, sucursalActiva, elegirConsolidado, elegirSucursal } = useSucursal();
  return (
    <BranchSelector
      consolidado={consolidado}
      sucursales={sucursales}
      activaNombre={sucursalActiva?.nombre}
      onConsolidado={elegirConsolidado}
      onPick={elegirSucursal}
    />
  );
}

function MenuUsuario({ items, activo, onNav }: { items?: NavItem[]; activo: string; onNav: (id: string) => void }) {
  const { usuario, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 44, padding: '0 6px 0 4px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
      >
        <Avatar name={usuario?.nombre ?? ''} size={34} />
        <div className="ork-tn-userlabel" style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{usuario?.nombre}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{ROL_LABEL[usuario?.rol ?? ''] ?? ''}</div>
        </div>
        <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" width={210}>
        <div style={{ padding: '6px 10px 8px' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{usuario?.negocio.nombre}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{usuario?.email}</div>
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 4px 6px' }} />
        {items?.map((it) => (
          <MenuItem key={it.id} icon={it.icon} active={it.id === activo} onClick={() => { onNav(it.id); setOpen(false); }}>
            {it.label}
          </MenuItem>
        ))}
        {items && items.length > 0 && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />}
        <MenuItem icon="log-out" danger onClick={() => void logout()}>
          Cerrar sesión
        </MenuItem>
      </Popover>
    </div>
  );
}

/** Encabezado de página con título y descripción. */
export function PageHead({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>{title}</h1>
        {desc && <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}
