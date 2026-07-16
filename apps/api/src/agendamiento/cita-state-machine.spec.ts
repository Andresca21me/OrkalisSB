import { BadRequestException } from '@nestjs/common';
import { EstadoCita } from '@orkalis/shared';
import { puedeTransicionar, transicionar } from './cita-state-machine';

describe('máquina de estados de la cita', () => {
  it('permite las transiciones válidas', () => {
    expect(transicionar(EstadoCita.Solicitada, 'aprobar')).toBe(EstadoCita.Confirmada);
    expect(transicionar(EstadoCita.Confirmada, 'iniciar')).toBe(EstadoCita.EnProgreso);
    expect(transicionar(EstadoCita.EnProgreso, 'completar')).toBe(EstadoCita.Completada);
    expect(transicionar(EstadoCita.Confirmada, 'no_asistio')).toBe(EstadoCita.NoAsistio);
    expect(transicionar(EstadoCita.Completada, 'revertir')).toBe(EstadoCita.EnProgreso);
  });

  it('rechaza transiciones inválidas', () => {
    // No se puede iniciar una completada.
    expect(() => transicionar(EstadoCita.Completada, 'iniciar')).toThrow(BadRequestException);
    // No se puede completar una confirmada (debe pasar por en_progreso).
    expect(() => transicionar(EstadoCita.Confirmada, 'completar')).toThrow(BadRequestException);
    // Una cancelada es terminal.
    expect(() => transicionar(EstadoCita.Cancelada, 'iniciar')).toThrow(BadRequestException);
    expect(puedeTransicionar(EstadoCita.Completada, 'iniciar')).toBe(false);
    expect(puedeTransicionar(EstadoCita.Confirmada, 'iniciar')).toBe(true);
  });
});
