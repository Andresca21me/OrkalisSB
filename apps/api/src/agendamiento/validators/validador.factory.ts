import { Injectable } from '@nestjs/common';
import { OrigenCita } from '@orkalis/shared';
import type { ValidadorCita } from './validador-cita.port';
import { ValidadorPublico } from './validador-publico';
import { ValidadorInterno } from './validador-interno';

/** Selecciona el validador según el origen (Strategy, FASE-08). */
@Injectable()
export class ValidadorFactory {
  private readonly publico = new ValidadorPublico();
  private readonly interno = new ValidadorInterno();

  paraOrigen(origen: OrigenCita): ValidadorCita {
    return origen === OrigenCita.AgendamientoPublico ? this.publico : this.interno;
  }
}
