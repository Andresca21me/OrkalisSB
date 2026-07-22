import { Component, type ReactNode } from 'react';

/**
 * Red de seguridad para los chunks de `React.lazy` (App.tsx).
 *
 * **El problema:** el código está partido por ruta y cada chunk lleva un hash en
 * el nombre. Si se despliega una versión nueva mientras alguien tiene la app
 * abierta, su `index.html` en memoria sigue apuntando a hashes que ya no existen
 * en el servidor. Al navegar, el `import()` dinámico falla y, sin un
 * ErrorBoundary, React desmonta TODO el árbol → **pantalla en blanco**, sin
 * mensaje y sin forma de continuar.
 *
 * **La solución:** detectar ese fallo y recargar una sola vez. Al recargar, el
 * navegador pide `index.html` (servido `no-cache`) y obtiene los hashes nuevos,
 * así que el usuario continúa y el despliegue le resulta invisible.
 *
 * Cualquier OTRO error también se atrapa aquí: no se recarga (no serviría de
 * nada), pero se muestra una pantalla con opción de reintentar en vez de dejar
 * la ventana en blanco.
 */

const FLAG = 'orkalis:recarga-por-chunk';
/** Si la app aguanta este rato sin fallar, la recarga funcionó. */
const MS_ESTABLE = 8000;

/** ¿El error viene de un chunk que ya no existe (o llegó HTML en vez de JS)? */
export function esErrorDeChunk(error: unknown): boolean {
  const msg = (error as Error)?.message ?? String(error);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|expected a JavaScript(-or-Wasm)? module|MIME type/i.test(
    msg,
  );
}

interface Props {
  children: ReactNode;
  /** Pantalla a mostrar cuando recargar no resolvió (o el error es otro). */
  fallback: (reintentar: () => void, esVersionNueva: boolean) => ReactNode;
}

interface State {
  error: unknown;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private temporizador?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidMount(): void {
    // El flag debe SOBREVIVIR a la recarga: si se limpiara aquí, un chunk roto
    // de verdad entraría en un bucle infinito de refrescos. Se limpia solo
    // cuando la app lleva un rato funcionando sin caerse.
    this.temporizador = setTimeout(() => sessionStorage.removeItem(FLAG), MS_ESTABLE);
  }

  componentWillUnmount(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  componentDidCatch(error: unknown): void {
    if (!esErrorDeChunk(error)) return; // otro error → solo se muestra el fallback
    if (sessionStorage.getItem(FLAG)) return; // ya se recargó y sigue fallando

    sessionStorage.setItem(FLAG, '1');
    window.location.reload();
  }

  private reintentar = (): void => {
    sessionStorage.removeItem(FLAG);
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.reintentar, esErrorDeChunk(this.state.error));
    return this.props.children;
  }
}
