import { useEffect, useState } from 'react';

/**
 * Observa una media query y devuelve si coincide, reaccionando a cambios de
 * tamaño (resize, rotación). App CSR (Vite), sin SSR → se puede leer en el
 * primer render sin desajustes de hidratación.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
