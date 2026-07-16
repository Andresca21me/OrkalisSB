import { EstadoSuscripcion as E, tieneAcceso } from '@orkalis/shared';
import {
  EstadoOrigen,
  EventoSuscripcion,
  TransicionInvalidaError,
  puedeTransicionar,
  transicionar,
} from './suscripcion-estado';

describe('transicionar (máquina de estados de la suscripción)', () => {
  // Transiciones válidas esperadas (origen, evento, destino).
  const validas: [EstadoOrigen, EventoSuscripcion, E][] = [
    // Registro.
    ['nueva', 'iniciar_prueba', E.Prueba],
    ['nueva', 'pago_ok', E.Activa], // "pagar ya"
    ['nueva', 'dar_cortesia', E.Cortesia],
    // Prueba.
    [E.Prueba, 'pago_ok', E.Activa],
    [E.Prueba, 'prueba_vence', E.Suspendida],
    [E.Prueba, 'dar_cortesia', E.Cortesia],
    [E.Prueba, 'cancelar', E.Cancelada],
    // Activa.
    [E.Activa, 'pago_ok', E.Activa], // renovación
    [E.Activa, 'cobro_falla', E.EnGracia],
    [E.Activa, 'dar_cortesia', E.Cortesia],
    [E.Activa, 'cancelar', E.Cancelada],
    // En gracia.
    [E.EnGracia, 'pago_ok', E.Activa],
    [E.EnGracia, 'cobro_falla', E.EnGracia], // reintento falla, sigue en gracia
    [E.EnGracia, 'gracia_agotada', E.Suspendida],
    [E.EnGracia, 'cancelar', E.Cancelada],
    // Suspendida.
    [E.Suspendida, 'pago_ok', E.Activa],
    [E.Suspendida, 'reactivar', E.Activa],
    [E.Suspendida, 'dar_cortesia', E.Cortesia],
    // Cortesía.
    [E.Cortesia, 'quitar_cortesia', E.Suspendida],
    [E.Cortesia, 'pago_ok', E.Activa],
    // Cancelada (terminal salvo cortesía).
    [E.Cancelada, 'dar_cortesia', E.Cortesia],
  ];

  it.each(validas)('%s --%s--> %s', (origen, evento, destino) => {
    expect(transicionar(origen, evento)).toBe(destino);
    expect(puedeTransicionar(origen, evento)).toBe(true);
  });

  // Muestras representativas de transiciones inválidas.
  const invalidas: [EstadoOrigen, EventoSuscripcion][] = [
    [E.Activa, 'iniciar_prueba'], // ya no es nueva
    [E.Activa, 'prueba_vence'], // no estaba en prueba
    [E.Prueba, 'cobro_falla'], // la prueba no cobra
    [E.Prueba, 'reactivar'], // no estaba suspendida
    [E.Suspendida, 'cobro_falla'], // suspendida no entra al cron
    [E.Cancelada, 'pago_ok'], // terminal
    [E.Cortesia, 'cobro_falla'], // cortesía no cobra
    ['nueva', 'reactivar'],
  ];

  it.each(invalidas)('lanza en %s --%s--> ✗', (origen, evento) => {
    expect(() => transicionar(origen, evento)).toThrow(TransicionInvalidaError);
    expect(puedeTransicionar(origen, evento)).toBe(false);
  });
});

describe('tieneAcceso (regla única de acceso, ADR-P2)', () => {
  it('da acceso a prueba, activa, en_gracia y cortesía', () => {
    expect(tieneAcceso(E.Prueba)).toBe(true);
    expect(tieneAcceso(E.Activa)).toBe(true);
    expect(tieneAcceso(E.EnGracia)).toBe(true);
    expect(tieneAcceso(E.Cortesia)).toBe(true);
  });

  it('bloquea suspendida y cancelada', () => {
    expect(tieneAcceso(E.Suspendida)).toBe(false);
    expect(tieneAcceso(E.Cancelada)).toBe(false);
  });
});
