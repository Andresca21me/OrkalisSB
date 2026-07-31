import type { ReactNode } from 'react';
import { Icon, Logo, Spinner } from '../../ui';

/**
 * Cascarón compartido de las páginas públicas de los enlaces de correo
 * (Plan-Correo §2.6): /verificar-correo, /restablecer, /invitacion. Son
 * pantallas de un solo propósito que se abren desde un email —a veces en el
 * celular—, así que: tarjeta centrada, angosta y sin navegación del sitio.
 */
export function TarjetaEnlace({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface-page)', padding: '32px 16px' }}>
      <div style={{ margin: '4vh 0 26px' }}>
        <Logo />
      </div>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg, 14px)', padding: '30px 26px', boxShadow: 'var(--shadow-md, 0 8px 30px rgba(15,23,42,0.06))' }}>
        {children}
      </div>
    </div>
  );
}

/** Cabecera de estado: icono redondo + título + texto secundario. */
export function EstadoEnlace({ tono, icon, titulo, children }: { tono: 'ok' | 'error' | 'info'; icon: string; titulo: string; children?: ReactNode }) {
  const color = tono === 'ok' ? 'var(--success, #16a34a)' : tono === 'error' ? 'var(--error)' : 'var(--blue)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
      <div aria-hidden style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, currentcolor 10%, transparent)', color }}>
        <Icon name={icon} size={26} color={color} />
      </div>
      <h1 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{titulo}</h1>
      {children && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{children}</div>}
    </div>
  );
}

export function CargandoEnlace({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0' }} aria-live="polite">
      <Spinner size={26} />
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{texto}</p>
    </div>
  );
}
