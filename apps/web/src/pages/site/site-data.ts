/**
 * Datos del sitio de marketing (FASE-12, SOLO VISUAL). Planes, fórmula de
 * precios (ADR-009: plan + nº especialistas + cupos), matriz de funciones y copy.
 *
 * TODO(v-next): cuando se encienda el alta, consumir el cálculo real de
 * suscripción del backend en vez de la fórmula local.
 */
export type Vertical = 'barberia' | 'salon';
export type Ciclo = 'mensual' | 'anual';

/**
 * Catálogo mostrado en la landing. **Debe cuadrar con `plans/plan-registry.ts`
 * del backend**: `included` es el nº de especialistas sin coste extra, y si aquí
 * dice menos, el simulador de precio cobra extras que el backend no cobra.
 * Hay una prueba que compara ambos catálogos (`cupos-plan.spec.ts`).
 */
export interface Plan {
  id: string;
  name: string;
  base: number;
  perExtra: number;
  included: number;
  sucursales: number; // Infinity = ilimitado
  highlight?: boolean;
  contact?: boolean;
  blurb: string;
  cta: string;
  perks: string[];
}

export const PLANS: Plan[] = [
  { id: 'basico', name: 'Básico', base: 80000, perExtra: 15000, included: 2, sucursales: 1, blurb: 'Empieza a recibir reservas en línea y ordena tu día.', cta: 'Empezar', perks: ['Reservas 24/7 con enlace público', 'Agenda en vivo por especialista', 'Recordatorios por WhatsApp + SMS', 'Clientes y CRM básico', '1 sucursal'] },
  { id: 'pro', name: 'Pro', base: 130000, perExtra: 18000, included: 2, sucursales: 1, highlight: true, blurb: 'Para negocios que ya viven de su agenda.', cta: 'Empezar', perks: ['Todo lo de Básico', 'Inventario y venta de productos', 'Servicios y repartición por especialista', 'Nómina y liquidaciones quincenales', 'Más cupos de mensajería', '1 sucursal'] },
  { id: 'premium', name: 'Premium', base: 210000, perExtra: 22000, included: 2, sucursales: 2, blurb: 'Crece a una segunda sede con reportes finos.', cta: 'Empezar', perks: ['Todo lo de Pro', 'Hasta 2 sucursales', 'Reportes avanzados y exportables', 'Parámetros financieros por sucursal', 'Soporte prioritario'] },
  { id: 'empresarial', name: 'Empresarial', base: 720000, perExtra: 25000, included: 15, sucursales: Infinity, contact: true, blurb: 'Cadenas y franquicias con varias sedes.', cta: 'Contactar ventas', perks: ['Todo lo de Premium', 'Sucursales ilimitadas', 'Roles y permisos avanzados', 'Acompañamiento de implementación', 'SLA y soporte dedicado'] },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[1];
}
export function monthly(plan: Plan, specialists: number): number {
  return plan.base + Math.max(0, specialists - plan.included) * plan.perExtra;
}
export function annualTotal(plan: Plan, specialists: number): number {
  return monthly(plan, specialists) * 10; // 2 meses gratis
}
export function displayMonthly(plan: Plan, specialists: number, cycle: Ciclo): number {
  const m = monthly(plan, specialists);
  return cycle === 'anual' ? Math.round((m * 10) / 12) : m;
}

export const FEATURE_GROUPS: { group: string; rows: { label: string; vals: (boolean | string)[] }[] }[] = [
  { group: 'Agenda y reservas', rows: [
    { label: 'Reservas en línea (enlace público)', vals: [true, true, true, true] },
    { label: 'Agenda en vivo por especialista', vals: [true, true, true, true] },
    { label: 'App del especialista (móvil)', vals: [true, true, true, true] },
    { label: 'Walk-ins y cobro presencial', vals: [true, true, true, true] },
    { label: 'Aprobación manual de reservas', vals: [true, true, true, true] },
  ] },
  { group: 'Clientes y operación', rows: [
    { label: 'Clientes / CRM', vals: ['Básico', 'Completo', 'Completo', 'Completo'] },
    { label: 'Inventario y productos', vals: ['—', true, true, true] },
    { label: 'Servicios y repartición', vals: ['—', true, true, true] },
    { label: 'Nómina y liquidaciones', vals: ['—', true, true, true] },
    { label: 'Cierre de período', vals: ['—', true, true, true] },
  ] },
  { group: 'Escala y análisis', rows: [
    { label: 'Sucursales', vals: ['1', '1', '2', 'Ilimitadas'] },
    { label: 'Reportes', vals: ['Básicos', 'Básicos', 'Avanzados', 'Avanzados'] },
    { label: 'Parámetros financieros por sucursal', vals: ['—', '—', true, true] },
    { label: 'Roles y permisos avanzados', vals: ['—', '—', '—', true] },
  ] },
  { group: 'Mensajería y soporte', rows: [
    { label: 'WhatsApp (recordatorios)', vals: ['500/mes', '1.500/mes', '4.000/mes', 'A la medida'] },
    { label: 'SMS de respaldo', vals: ['200/mes', '600/mes', '1.500/mes', 'A la medida'] },
    { label: 'Soporte', vals: ['Email', 'Email + chat', 'Prioritario', 'Dedicado · SLA'] },
  ] },
];

/**
 * Copy por vertical. `heroTitle` se parte en dos: `heroFijo` es la promesa que
 * NO cambia y `heroRotativo` son los remates que se teclean uno tras otro. Rota
 * el beneficio, no el tipo de negocio: cada frase añade una razón de compra en
 * lugar de repetir a quién va dirigido.
 */
export const VERTICAL: Record<Vertical, { label: string; esp: string; heroTitle: string; heroFijo: string; heroRotativo: string[]; heroSub: string; bookingHost: string; sample: string }> = {
  barberia: { label: 'Barbería', esp: 'barberos', heroTitle: 'Tus clientes reservan solos. Tú dejas de vivir en WhatsApp.',
    heroFijo: 'Tus clientes reservan solos.',
    heroRotativo: ['Tú dejas de vivir en WhatsApp.', 'Tú dejas de perder citas.', 'Tú dejas de cuadrar caja a mano.', 'Tú dejas de armar la nómina en Excel.'], heroSub: 'Agenda en línea, recordatorios automáticos, finanzas y equipo de tu barbería en un solo lugar.', bookingHost: 'orkalis.co/r/la-navaja', sample: 'La Navaja' },
  salon: { label: 'Salón de belleza', esp: 'especialistas', heroTitle: 'Tu salón, agendado solo. Sin chats interminables ni cuadernos.',
    heroFijo: 'Tu salón, agendado solo.',
    heroRotativo: ['Sin chats interminables.', 'Sin cuadernos ni recordatorios a mano.', 'Sin cuadrar comisiones cada quincena.', 'Sin adivinar cómo va el mes.'], heroSub: 'Reservas en línea, recordatorios, inventario y liquidaciones de tu salón en una sola plataforma.', bookingHost: 'orkalis.co/r/estudio-aura', sample: 'Estudio Aura' },
};

export const PAINS = [
  { icon: 'smartphone', pain: 'Citas perdidas en el chat', sol: 'Un enlace público donde el cliente reserva 24/7, sin crear cuenta. La franja se bloquea sola.' },
  { icon: 'calendar-x', pain: 'Ausentismo que cuesta plata', sol: 'Recordatorios automáticos por WhatsApp y SMS. Menos sillas vacías, hasta −40% de inasistencias.' },
  { icon: 'wallet', pain: 'Caos de caja y nómina', sol: 'Cada servicio se reparte solo entre el profesional y el negocio. Cierres y liquidaciones sin Excel.' },
];

export const FEATURES = [
  { icon: 'calendar', title: 'Reservas 24/7', desc: 'Tu cliente agenda desde un enlace, sin cuenta ni app.' },
  { icon: 'users', title: 'Agenda en vivo', desc: 'El día de cada especialista, ordenado y en tiempo real.' },
  { icon: 'bell', title: 'Recordatorios automáticos', desc: 'WhatsApp y SMS antes de cada cita. Menos ausencias.' },
  { icon: 'wallet', title: 'Inventario, nómina y finanzas', desc: 'Stock, repartición y liquidaciones, todo conectado.' },
  { icon: 'store', title: 'Multi-sucursal', desc: 'Una vista del negocio y de cada sede, con su configuración.' },
  { icon: 'settings', title: 'Todo configurable', desc: 'Enciende o apaga módulos y reglas según tu operación.' },
];

export const STEPS = [
  { n: 1, icon: 'store', title: 'Crea tu negocio', desc: 'Datos, sucursal y equipo en minutos, con valores listos para operar.' },
  { n: 2, icon: 'share-2', title: 'Comparte tu enlace', desc: 'Publica tu enlace de reservas en redes, Google y WhatsApp.' },
  { n: 3, icon: 'calendar', title: 'Tus clientes agendan solos', desc: 'Las citas entran a tu agenda y el equipo solo atiende y cobra.' },
];

export const TESTIMONIALS: Record<Vertical, { quote: string; name: string; role: string; city: string }[]> = {
  barberia: [
    { quote: 'Dejé de contestar WhatsApp todo el día. La agenda se llena sola y las inasistencias bajaron muchísimo.', name: 'Andrés Mejía', role: 'Dueño · La Navaja', city: 'Bogotá' },
    { quote: 'El cierre de quincena lo hacía en Excel un domingo entero. Ahora sale solo, con el reparto de cada barbero.', name: 'Camilo Soto', role: 'Barbería Norte', city: 'Medellín' },
    { quote: 'Tener dos sedes en una sola vista me cambió la operación. Sé qué pasa en cada local en segundos.', name: 'Julián Restrepo', role: 'Distrito Barber', city: 'Cali' },
  ],
  salon: [
    { quote: 'Mis clientas reservan a cualquier hora y reciben su recordatorio. Las sillas vacías casi desaparecieron.', name: 'Valentina Gómez', role: 'Estudio Aura', city: 'Bogotá' },
    { quote: 'El inventario y la liquidación de cada estilista por fin cuadran sin que yo persiga papeles.', name: 'Daniela Cárdenas', role: 'Salón Lumière', city: 'Barranquilla' },
    { quote: 'Pasé de un cuaderno a tener todo el salón ordenado. La implementación fue de un día.', name: 'Mariana Ruiz', role: 'Casa Bella', city: 'Bucaramanga' },
  ],
};

export const METRICS = [
  { value: '−40%', label: 'inasistencias' },
  { value: '24/7', label: 'reservas en línea' },
  { value: '1 día', label: 'para empezar a operar' },
];

export const FAQ = [
  { q: '¿El cliente necesita crear una cuenta para reservar?', a: 'No. Tu cliente entra a tu enlace público, elige servicio, especialista y hora, y confirma con un código por mensaje. Sin cuenta ni app.' },
  { q: '¿Cómo se cobra la suscripción?', a: 'Por especialista activo. Cada plan incluye 2 especialistas y suma una tarifa por cada uno adicional. Puedes pagar mensual o anual (2 meses gratis).' },
  { q: '¿Incluye WhatsApp?', a: 'Sí. Los recordatorios y confirmaciones salen por WhatsApp, con SMS de respaldo. Cada plan trae sus cupos de mensajería.' },
  { q: '¿El cobro a mis clientes pasa por Orkalis?', a: 'No. El cobro del servicio a tus clientes es presencial, como hoy. Orkalis solo cobra tu suscripción a la plataforma.' },
  { q: '¿Puedo apagar módulos que no uso?', a: 'Sí. Inventario, nómina, cierres y más se encienden o apagan por negocio o por sucursal, sin perder datos.' },
  { q: '¿Funciona con varias sucursales?', a: 'Sí. Premium incluye hasta 2 sedes y Empresarial es ilimitado. El cobro escala por especialista activo de cada sede.' },
];
