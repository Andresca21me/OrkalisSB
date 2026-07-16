import { useCallback, useEffect, useState } from 'react';

/** Hook de carga de datos con estado y recarga. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, deps);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { data, cargando, error, recargar: cargar };
}
