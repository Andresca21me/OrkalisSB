import { cicloDeCobro, type DatosCiclo } from './ciclo';

/** Base sin datos de cobro: cada prueba sobreescribe lo que le interesa. */
const base: DatosCiclo = {
  diaCobro: null,
  proximoCobro: null,
  trialFin: null,
  creadoEn: new Date('2026-01-09T10:00:00Z'),
};

const iso = (d: Date) => d.toISOString();

describe('Ciclo de cupos por aniversario de cobro (FASE-03, D1)', () => {
  it('el ciclo va de aniversario a aniversario, no del día 1 al 30', () => {
    const c = cicloDeCobro({ ...base, diaCobro: 15 }, new Date('2026-07-20T08:00:00Z'));
    expect(iso(c.inicio)).toBe('2026-07-15T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-08-15T12:00:00.000Z');
  });

  it('antes del aniversario del mes seguimos en el ciclo anterior', () => {
    const c = cicloDeCobro({ ...base, diaCobro: 15 }, new Date('2026-07-03T08:00:00Z'));
    expect(iso(c.inicio)).toBe('2026-06-15T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-07-15T12:00:00.000Z');
  });

  it('cruza el año hacia atrás sin romperse (enero → diciembre)', () => {
    const c = cicloDeCobro({ ...base, diaCobro: 20 }, new Date('2026-01-05T08:00:00Z'));
    expect(iso(c.inicio)).toBe('2025-12-20T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-01-20T12:00:00.000Z');
  });

  it('el día ancla se acota a 28: febrero nunca queda sin ciclo', () => {
    const c = cicloDeCobro({ ...base, diaCobro: 31 }, new Date('2026-03-01T08:00:00Z'));
    expect(iso(c.inicio)).toBe('2026-02-28T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-03-28T12:00:00.000Z');
  });

  it('sin diaCobro usa el día del próximo cobro', () => {
    const c = cicloDeCobro(
      { ...base, proximoCobro: new Date('2026-08-07T12:00:00Z') },
      new Date('2026-07-20T08:00:00Z'),
    );
    expect(iso(c.inicio)).toBe('2026-07-07T12:00:00.000Z');
  });

  it('cuenta en prueba (sin cobro): ancla en el fin de prueba', () => {
    const c = cicloDeCobro(
      { ...base, trialFin: new Date('2026-07-24T12:00:00Z') },
      new Date('2026-07-20T08:00:00Z'),
    );
    expect(iso(c.inicio)).toBe('2026-06-24T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-07-24T12:00:00.000Z');
  });

  it('sin nada más, ancla en la fecha de alta', () => {
    const c = cicloDeCobro(base, new Date('2026-07-20T08:00:00Z'));
    expect(iso(c.inicio)).toBe('2026-07-09T12:00:00.000Z');
  });

  it('el cron de cobro atrasado NO desplaza el ciclo: manda el aniversario', () => {
    // `proximoCobro` quedó en el pasado (el cron no corrió); aun así el ciclo
    // devuelto es el que contiene a `ahora`.
    const c = cicloDeCobro(
      { ...base, diaCobro: 10, proximoCobro: new Date('2026-05-10T12:00:00Z') },
      new Date('2026-07-20T08:00:00Z'),
    );
    expect(iso(c.inicio)).toBe('2026-07-10T12:00:00.000Z');
    expect(iso(c.fin)).toBe('2026-08-10T12:00:00.000Z');
  });

  it('el instante exacto del aniversario ya pertenece al ciclo nuevo', () => {
    const c = cicloDeCobro({ ...base, diaCobro: 15 }, new Date('2026-07-15T12:00:00Z'));
    expect(iso(c.inicio)).toBe('2026-07-15T12:00:00.000Z');
  });

  it('ciclos consecutivos encajan sin huecos ni solapes', () => {
    const s = { ...base, diaCobro: 15 };
    const julio = cicloDeCobro(s, new Date('2026-07-20T08:00:00Z'));
    const agosto = cicloDeCobro(s, new Date('2026-08-20T08:00:00Z'));
    expect(iso(julio.fin)).toBe(iso(agosto.inicio));
  });
});
