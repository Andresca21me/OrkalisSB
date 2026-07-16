import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

export interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}

interface SucursalState {
  sucursales: Sucursal[];
  cargando: boolean;
  /** true = vista consolidada (todas las sucursales). */
  consolidado: boolean;
  /** Sucursal activa, o null cuando la vista es consolidada. */
  sucursalActivaId: string | null;
  sucursalActiva: Sucursal | undefined;
  elegirConsolidado: () => void;
  elegirSucursal: (id: string) => void;
}

const Ctx = createContext<SucursalState | null>(null);

/**
 * Contexto de sucursal/consolidado (FASE-02). Carga `GET /sucursales` (alcance
 * del usuario) y mantiene la selección que consumen las pantallas admin. El
 * admin arranca en "consolidado"; al elegir una sucursal, las pantallas filtran
 * por `sucursalActivaId`.
 */
export function SucursalProvider({ children }: { children: ReactNode }) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [consolidado, setConsolidado] = useState(true);
  const [sucursalActivaId, setActiva] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const list = await api.get<Sucursal[]>('/sucursales');
        if (vivo) setSucursales(list);
      } catch {
        /* las pantallas muestran su propio error */
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const elegirConsolidado = useCallback(() => {
    setConsolidado(true);
    setActiva(null);
  }, []);

  const elegirSucursal = useCallback((id: string) => {
    setConsolidado(false);
    setActiva(id);
  }, []);

  const value = useMemo<SucursalState>(
    () => ({
      sucursales,
      cargando,
      consolidado,
      sucursalActivaId: consolidado ? null : sucursalActivaId,
      sucursalActiva: sucursales.find((s) => s.id === sucursalActivaId),
      elegirConsolidado,
      elegirSucursal,
    }),
    [sucursales, cargando, consolidado, sucursalActivaId, elegirConsolidado, elegirSucursal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSucursal(): SucursalState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSucursal fuera de SucursalProvider');
  return ctx;
}
