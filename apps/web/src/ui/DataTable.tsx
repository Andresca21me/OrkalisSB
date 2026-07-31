import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Card, Icon } from './ui';

export interface ColumnaTabla<T> {
  id: string;
  titulo: ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Ancho fijo opcional (px o CSS). */
  width?: number | string;
  render: (fila: T) => ReactNode;
}

/**
 * Tabla del design system (Plan-Finanzas F4). Hasta ahora cada pantalla escribía
 * su `<table>` a mano (10 copias); esta pieza unifica el patrón y añade lo que
 * ninguna tenía: **fila expandible** (el arqueo de una transacción se abre en su
 * propia fila con `colSpan`, accesible con `aria-expanded`).
 */
export function DataTable<T>({ columnas, filas, keyDe, expandible, pie, minWidth = 680, vacio }: {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  keyDe: (fila: T) => string;
  /** Contenido de la fila expandida. Si se define, la tabla gana el chevron. */
  expandible?: (fila: T) => ReactNode;
  /** Pie (totales del rango) — se pinta dentro de la Card, bajo la tabla. */
  pie?: ReactNode;
  minWidth?: number;
  vacio?: ReactNode;
}) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const th: CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };

  const toggle = (k: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });

  const nCols = columnas.length + (expandible ? 1 : 0);

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div className="ork-scroll-x" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>
          <thead>
            <tr>
              {expandible && <th style={{ ...th, width: 36 }} aria-label="Expandir" />}
              {columnas.map((c) => (
                <th key={c.id} style={{ ...th, textAlign: c.align ?? 'left', width: c.width }}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={nCols} style={{ ...td, textAlign: 'center', color: 'var(--text-tertiary)', padding: 28 }}>{vacio ?? 'Sin datos en este período.'}</td></tr>
            )}
            {filas.map((f, i) => {
              const k = keyDe(f);
              const abierta = abiertas.has(k);
              const zebra = i % 2 ? 'var(--gray-50)' : 'transparent';
              return (
                <Fragment key={k}>
                  <tr
                    style={{ background: abierta ? 'var(--brand-tint)' : zebra, cursor: expandible ? 'pointer' : undefined }}
                    onClick={expandible ? () => toggle(k) : undefined}
                  >
                    {expandible && (
                      <td style={{ ...td, width: 36, padding: '12px 4px 12px 12px' }}>
                        <button
                          type="button"
                          aria-expanded={abierta}
                          aria-label={abierta ? 'Contraer detalle' : 'Ver detalle'}
                          onClick={(e) => { e.stopPropagation(); toggle(k); }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
                        >
                          <Icon name={abierta ? 'chevron-down' : 'chevron-right'} size={16} color={abierta ? 'var(--brand)' : 'var(--text-tertiary)'} />
                        </button>
                      </td>
                    )}
                    {columnas.map((c) => (
                      <td key={c.id} style={{ ...td, textAlign: c.align ?? 'left' }}>{c.render(f)}</td>
                    ))}
                  </tr>
                  {expandible && abierta && (
                    <tr>
                      <td colSpan={nCols} style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', padding: '16px 20px 18px' }}>
                        {expandible(f)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pie && <div style={{ borderTop: '1px solid var(--border-default)', padding: '12px 16px', background: 'var(--surface-sunken)' }}>{pie}</div>}
    </Card>
  );
}
