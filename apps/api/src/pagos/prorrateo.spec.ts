import { prorratearDiferencia } from './prorrateo';

/** Fecha UTC al mediodía (igual que el ancla de `proximoCobro`). */
const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

/**
 * Pruebas profundas de la proración del cargo de una subida (Plan-Pagos B1).
 * El día de cobro está anclado a 1..28, así que `proximoCobro` siempre cae en
 * día ≤ 28 (sin desbordes de mes al restar un mes).
 */
describe('prorratearDiferencia (B1 · matemática de dinero)', () => {
  const DIF = 80_000; // diferencia mensual típica (Básico→Pro)

  describe('casos triviales / guardas', () => {
    it('diferencia 0 → no cobra', () => {
      expect(prorratearDiferencia(0, d('2026-04-15'), d('2026-04-01'))).toBe(0);
    });
    it('diferencia negativa (bajada) → no cobra', () => {
      expect(prorratearDiferencia(-50_000, d('2026-04-15'), d('2026-04-01'))).toBe(0);
    });
    it('sin próximo cobro conocido → diferencia completa (conservador)', () => {
      expect(prorratearDiferencia(DIF, null, d('2026-04-01'))).toBe(80_000);
    });
    it('redondea la diferencia a entero COP cuando no hay ciclo', () => {
      expect(prorratearDiferencia(80_000.4, null, d('2026-04-01'))).toBe(80_000);
    });
  });

  describe('ciclo de 31 días (próximo cobro 2026-04-15, inicio 2026-03-15)', () => {
    const prox = d('2026-04-15');
    it('ahora == próximo cobro → 0 días → no cobra', () => {
      expect(prorratearDiferencia(DIF, prox, d('2026-04-15'))).toBe(0);
    });
    it('ahora DESPUÉS del próximo cobro (vencido) → 0', () => {
      expect(prorratearDiferencia(DIF, prox, d('2026-04-16'))).toBe(0);
    });
    it('ahora == inicio del ciclo → ciclo completo → diferencia completa', () => {
      expect(prorratearDiferencia(DIF, prox, d('2026-03-15'))).toBe(80_000);
    });
    it('ahora ANTES del inicio → se acota al ciclo → diferencia completa', () => {
      expect(prorratearDiferencia(DIF, prox, d('2026-02-01'))).toBe(80_000);
    });
    it('15 de 31 días restantes', () => {
      // 80000 * 15/31 = 38709.677 → 38710
      expect(prorratearDiferencia(DIF, prox, d('2026-03-31'))).toBe(38_710);
    });
    it('30 de 31 días restantes', () => {
      // 80000 * 30/31 = 77419.354 → 77419
      expect(prorratearDiferencia(DIF, prox, d('2026-03-16'))).toBe(77_419);
    });
    it('1 de 31 días restantes', () => {
      // 80000 * 1/31 = 2580.6 → 2581
      expect(prorratearDiferencia(DIF, prox, d('2026-04-14'))).toBe(2_581);
    });
  });

  describe('cruce de mes y febrero', () => {
    it('ciclo de 28 días (feb no bisiesto): mitad del ciclo = mitad del cargo', () => {
      // prox 2026-03-28, inicio 2026-02-28 → 28 días; quedan 14 → 80000*14/28 = 40000
      expect(prorratearDiferencia(DIF, d('2026-03-28'), d('2026-03-14'))).toBe(40_000);
    });
    it('año bisiesto (feb 2028 = 29 días): ciclo de 29 días', () => {
      // prox 2028-03-28, inicio 2028-02-28 → 29 días; quedan 15 → 80000*15/29 = 41379.3 → 41379
      expect(prorratearDiferencia(DIF, d('2028-03-28'), d('2028-03-13'))).toBe(41_379);
    });
  });

  describe('política de redondeo de días (día parcial cuenta como día completo)', () => {
    it('ahora a las 11:00 (queda ~1 día y 1 h) cuenta como 2 días (ceil)', () => {
      // prox 2026-04-15 12:00; ahora 2026-04-14 11:00 → 1.04 días → ceil 2 → 80000*2/31 = 5161.3 → 5161
      const prox = d('2026-04-15');
      const ahora = new Date('2026-04-14T11:00:00.000Z');
      expect(prorratearDiferencia(DIF, prox, ahora)).toBe(5_161);
    });
  });

  describe('invariantes (propiedad sobre muchos puntos del ciclo)', () => {
    it('nunca cobra más que la diferencia mensual ni menos de 0, y crece con los días restantes', () => {
      const prox = d('2026-04-15');
      // Acotación en muchos puntos del ciclo (de cerca del cobro hacia el inicio).
      for (let dia = 15; dia >= 1; dia--) {
        const v = prorratearDiferencia(DIF, prox, new Date(Date.UTC(2026, 3, dia, 12, 0, 0)));
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(80_000);
      }
      // Monotonía: cuanto más cerca del inicio, mayor o igual el cobro.
      const cerca = prorratearDiferencia(DIF, prox, d('2026-04-14')); // 1 día restante
      const lejos = prorratearDiferencia(DIF, prox, d('2026-03-20')); // ~26 días restantes
      expect(lejos).toBeGreaterThan(cerca);
    });
  });
});
