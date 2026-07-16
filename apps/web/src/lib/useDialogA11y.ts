import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accesibilidad de diálogos modales (FASE-14, RNF a11y / WCAG 2.4.3, 2.1.2):
 * - Cierra con `Esc`.
 * - Atrapa el foco dentro del panel (Tab/Shift+Tab circulan).
 * - Mueve el foco al primer control al abrir y lo restaura al cerrar.
 * - Bloquea el scroll del fondo mientras está abierto.
 *
 * Devuelve un ref para el panel del diálogo (el contenedor con role="dialog").
 */
export function useDialogA11y(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previo = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Foco inicial: primer control del panel, o el panel mismo.
    const panel = panelRef.current;
    const enfocar = () => {
      if (!panel) return;
      const primero = panel.querySelector<HTMLElement>(FOCUSABLE);
      (primero ?? panel).focus();
    };
    const raf = requestAnimationFrame(enfocar);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const foco = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (foco.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === panel)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [open, onClose]);

  return panelRef;
}
