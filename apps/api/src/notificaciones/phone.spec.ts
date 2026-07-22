import { aE164Colombia } from './phone';

describe('aE164Colombia', () => {
  it('antepone +57 a un móvil local de 10 dígitos', () => {
    expect(aE164Colombia('3118452210')).toBe('+573118452210');
  });

  it('ignora espacios y separadores', () => {
    expect(aE164Colombia('311 845 2210')).toBe('+573118452210');
  });

  it('respeta un número que ya trae indicativo 57 (12 dígitos)', () => {
    expect(aE164Colombia('573118452210')).toBe('+573118452210');
  });

  it('respeta un número que ya viene con +', () => {
    expect(aE164Colombia('+573118452210')).toBe('+573118452210');
    expect(aE164Colombia('+14155238886')).toBe('+14155238886');
  });
});
