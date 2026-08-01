import { iniciosEnVentanas, type Ocupado } from './franjas.calculo';

/** Minutos del día a partir de 'HH:MM' (legibilidad de los casos). */
const min = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const ocupado = (ini: string, fin: string): Ocupado => ({ ini: min(ini), fin: min(fin) });

describe('iniciosEnVentanas (Plan-Franjas)', () => {
  const manana = [{ desde: min('09:00'), hasta: min('12:00') }];

  it('sin ocupados: rejilla desde la apertura cada `paso`', () => {
    const r = iniciosEnVentanas(manana, [], 30, 15);
    expect(r[0]).toBe(min('09:00'));
    expect(r[r.length - 1]).toBe(min('11:30')); // último inicio que cabe
    expect(r).toHaveLength(11);
  });

  it('re-ancla tras una cita: 9:45–10:20 ofrece la siguiente franja a las 10:20 exactas', () => {
    const r = iniciosEnVentanas(manana, [ocupado('09:45', '10:20')], 30, 15);
    // Antes de la cita: 9:00 y el encaje de cola 9:15 (9:15+30 = 9:45 justo).
    expect(r).toContain(min('09:00'));
    expect(r).toContain(min('09:15'));
    // Nada que pise la cita…
    expect(r).not.toContain(min('09:30'));
    expect(r).not.toContain(min('10:00'));
    // …y el segmento siguiente arranca al minuto exacto del fin, no a las 10:30.
    expect(r).toContain(min('10:20'));
    expect(r).toContain(min('10:35'));
    expect(r).not.toContain(min('10:30'));
  });

  it('fusiona citas solapadas o pegadas antes de restar', () => {
    const r = iniciosEnVentanas(manana, [ocupado('10:00', '11:00'), ocupado('10:30', '11:30')], 30, 15);
    expect(r).not.toContain(min('10:45')); // dentro de la unión 10:00–11:30
    expect(r).toContain(min('11:30'));
  });

  it('el buffer separa la franja nueva de las citas por ambos lados', () => {
    const r = iniciosEnVentanas(manana, [ocupado('10:00', '10:30')], 30, 30, 10);
    // 9:30+30 = 10:00 pegaría el fin al inicio de la cita → lo mata el buffer.
    expect(r).not.toContain(min('09:30'));
    expect(r).toContain(min('09:20')); // encaje de cola: termina 9:50, deja los 10 min
    // Tras la cita: no a las 10:30 (sin margen), sí a las 10:40.
    expect(r).not.toContain(min('10:30'));
    expect(r).toContain(min('10:40'));
  });

  it('encaje de cola: un hueco exacto entre dos citas se llena por completo', () => {
    const r = iniciosEnVentanas(manana, [ocupado('09:00', '10:00'), ocupado('10:50', '12:00')], 50, 30);
    expect(r).toEqual([min('10:00')]); // hueco de 50 min, servicio de 50 min
  });

  it('encaje de cola: también dentro de un hueco no exacto', () => {
    const r = iniciosEnVentanas(manana, [ocupado('09:00', '10:00'), ocupado('10:50', '12:00')], 40, 30);
    expect(r).toEqual([min('10:00'), min('10:10')]); // rejilla + último inicio posible
  });

  it('segmento más corto que la duración: sin franjas ahí', () => {
    const r = iniciosEnVentanas(manana, [ocupado('09:00', '10:00'), ocupado('10:50', '12:00')], 60, 15);
    expect(r).toEqual([]);
  });

  it('paso configurable: rejilla de 20 en 20', () => {
    const r = iniciosEnVentanas([{ desde: min('09:00'), hasta: min('11:00') }], [], 20, 20);
    expect(r).toEqual(['09:00', '09:20', '09:40', '10:00', '10:20', '10:40'].map(min));
  });

  it('ocupados fuera de la ventana (p. ej. retención de otro día) no afectan', () => {
    const r = iniciosEnVentanas(manana, [{ ini: -120, fin: -60 }, ocupado('13:00', '14:00')], 30, 15);
    expect(r).toHaveLength(11);
  });

  it('sin ventanas o parámetros inválidos: vacío', () => {
    expect(iniciosEnVentanas([], [], 30, 15)).toEqual([]);
    expect(iniciosEnVentanas(manana, [], 0, 15)).toEqual([]);
    expect(iniciosEnVentanas(manana, [], 30, 0)).toEqual([]);
  });

  it('varias ventanas: cada una ancla su propia rejilla', () => {
    const r = iniciosEnVentanas(
      [{ desde: min('09:00'), hasta: min('10:00') }, { desde: min('14:10'), hasta: min('15:10') }],
      [],
      30,
      30,
    );
    expect(r).toEqual([min('09:00'), min('09:30'), min('14:10'), min('14:40')]);
  });
});
