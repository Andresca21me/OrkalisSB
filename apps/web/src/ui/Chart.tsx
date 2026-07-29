/**
 * Wrappers de gráficos del Design System (FASE-01, decisión #4: recharts).
 *
 * Encapsulan recharts con la paleta y tipografía del DS para reusarlos en Panel
 * y Finanzas (FASE-05/08). Paleta: azul marca para la serie principal, teal solo
 * para "+datos"/crecimiento, slate neutro para ejes/grilla.
 */
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { readCssVar } from '../lib/theme';

/** Color de marca actual (sigue el tema por vertical). Se resuelve en cada
 *  render porque recharts no entiende `var(--brand)` en SVG/canvas. */
const brandColor = (): string => readCssVar('--brand') || '#1E3A8A';
/** Acento actual (cobre/rosa según vertical); recharts no entiende var(). */
const accentColor = (): string => readCssVar('--accent') || '#C2410C';
const AXIS = '#94A3B8';
const GRID = '#E2E8F0';

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11, fontFamily: 'var(--font-mono)' },
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: 'var(--navy)',
    border: 'none',
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg)',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: '#fff',
    padding: '8px 12px',
  },
  labelStyle: { color: '#fff', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: '#fff' },
  cursor: { stroke: GRID },
} as const;

export interface SeriePunto {
  label: string;
  value: number;
}

/** Línea compacta (tendencia). `color` opcional (default azul marca). */
export function LineChartMini({ data, height = 220, color = brandColor(), formatY }: { data: SeriePunto[]; height?: number; color?: string; formatY?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} tickFormatter={formatY} />
        <Tooltip {...tooltipStyle} formatter={(value) => (formatY ? formatY(Number(value)) : `${value}`)} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: color }} />
      </RLineChart>
    </ResponsiveContainer>
  );
}

/** Barras verticales. */
export function BarChart({ data, height = 220, color = brandColor(), formatY }: { data: SeriePunto[]; height?: number; color?: string; formatY?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} tickFormatter={formatY} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--brand-tint)' }} formatter={(value) => (formatY ? formatY(Number(value)) : `${value}`)} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={42} />
      </RBarChart>
    </ResponsiveContainer>
  );
}

export interface DonutDato {
  label: string;
  value: number;
  color?: string;
}

const donutPalette = (): string[] => [brandColor(), accentColor(), '#334155', '#64748B', '#3B82F6', '#94A3B8'];

/** Donut (composición). Leyenda opcional a la derecha. */
export function Donut({ data, height = 220, thickness = 28 }: { data: DonutDato[]; height?: number; thickness?: number }) {
  const outer = height / 2 - 8;
  const palette = donutPalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RPieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={outer - thickness} outerRadius={outer} paddingAngle={2} stroke="none">
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </RPieChart>
    </ResponsiveContainer>
  );
}
