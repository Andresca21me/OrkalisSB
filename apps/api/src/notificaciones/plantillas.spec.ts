import { medirSms } from '@orkalis/shared';
import { renderizar, valoresDe, variablesDe, variablesWa } from './plantillas.render';
import type { DatosCita } from './templates';

const DATOS: DatosCita = {
  clienteNombre: 'Pedro',
  sucursalNombre: 'Sede Centro',
  especialistaNombre: 'Carlos',
  servicioNombre: 'Corte',
  inicio: new Date('2030-03-10T19:00:00Z'), // 14:00 en Bogotá
};

describe('Plantillas de mensaje (FASE-04, D5)', () => {
  describe('render de variables', () => {
    it('sustituye las variables por sus valores', () => {
      const out = renderizar('Hola {{cliente}}, te esperamos en {{sucursal}} con {{especialista}}.', valoresDe(DATOS));
      expect(out).toBe('Hola Pedro, te esperamos en Sede Centro con Carlos.');
    });

    it('tolera espacios dentro de las llaves', () => {
      expect(renderizar('Hola {{ cliente }}', valoresDe(DATOS))).toBe('Hola Pedro');
    });

    it('una variable sin valor NO deja el literal {{…}} en el mensaje', () => {
      const sinNombre = { ...DATOS, clienteNombre: undefined };
      const out = renderizar('Hola {{cliente}}, tu cita es a las {{hora}}.', valoresDe(sinNombre));
      expect(out).not.toContain('{{');
      expect(out).toBe('Hola , tu cita es a las 2:00 p.m..');
    });

    it('{{hora}} y {{fecha}} salen en zona Bogotá', () => {
      const valores = valoresDe(DATOS);
      expect(valores.hora).toContain('2:00');
      // Formato compacto GSM-7 (sin «á» de sábado ni fecha de lujo): «dom 10 mar, …»
      expect(valores.fecha).toContain('10 mar');
    });

    it('detecta las variables usadas, sin repetir', () => {
      expect(variablesDe('{{cliente}} y {{cliente}} con {{fecha}}')).toEqual(['cliente', 'fecha']);
    });
  });

  describe('ContentVariables de WhatsApp (variablesWa)', () => {
    const DATOS: DatosCita = { clienteNombre: 'Ana', sucursalNombre: 'Sede Centro', especialistaNombre: 'Carlos', servicioNombre: 'Corte', inicio: new Date('2030-03-10T19:00:00Z') };

    it('manda EXACTAMENTE las claves que declara la plantilla del evento', () => {
      // Twilio rechaza claves de más ("Content Variables parameter is invalid").
      expect(Object.keys(variablesWa('confirmacion', DATOS)).sort()).toEqual(['cliente', 'especialista', 'fecha', 'servicio', 'sucursal']);
      expect(Object.keys(variablesWa('aviso', DATOS)).sort()).toEqual(['cliente', 'fecha', 'sucursal']);
      expect(Object.keys(variablesWa('aviso_especialista', DATOS)).sort()).toEqual(['cliente', 'fecha', 'motivo', 'servicio', 'sucursal']);
    });

    it('nunca manda valores vacíos (Meta los rechaza): usa relleno neutro', () => {
      const sinDatos: DatosCita = { sucursalNombre: 'Sede', especialistaNombre: 'Carlos', inicio: new Date('2030-03-10T19:00:00Z') };
      const v = variablesWa('confirmacion', sinDatos);
      for (const val of Object.values(v)) expect(val.trim().length).toBeGreaterThan(0);
      expect(v.cliente).toBe('cliente');
      expect(v.servicio).toBe('tu servicio');
    });
  });

  describe('segmentos SMS', () => {
    it('texto corto sin tildes raras = 1 segmento GSM-7', () => {
      const m = medirSms('Reserva confirmada con Carlos en Sede Centro.');
      expect(m.codificacion).toBe('GSM-7');
      expect(m.segmentos).toBe(1);
    });

    it('ñ, é y ¿ SÍ están en GSM-7 (no encarecen el mensaje)', () => {
      const m = medirSms('¿Mañana a las tres? Te esperamos, José.');
      expect(m.codificacion).toBe('GSM-7');
    });

    it('á í ó ú NO están en GSM-7 y fuerzan UCS-2 (la trampa del español)', () => {
      const m = medirSms('Tu código está listo');
      expect(m.codificacion).toBe('UCS-2');
      expect(m.fueraDeGsm).toEqual(expect.arrayContaining(['ó', 'á']));
    });

    it('el corte de segmento GSM-7 es 160, y luego de 153 en 153', () => {
      expect(medirSms('a'.repeat(160)).segmentos).toBe(1);
      expect(medirSms('a'.repeat(161)).segmentos).toBe(2);
      expect(medirSms('a'.repeat(306)).segmentos).toBe(2);
      expect(medirSms('a'.repeat(307)).segmentos).toBe(3);
    });

    it('en UCS-2 el corte es 70 y luego 67', () => {
      expect(medirSms('á'.repeat(70)).segmentos).toBe(1);
      expect(medirSms('á'.repeat(71)).segmentos).toBe(2);
    });

    it('los caracteres GSM con escape ({, }, €) cuentan doble', () => {
      expect(medirSms('{').caracteres).toBe(2);
      expect(medirSms('€').caracteres).toBe(2);
    });

    it('un emoji cuenta como 2 unidades UCS-2, no como 1 carácter suelto', () => {
      const m = medirSms('💇');
      expect(m.codificacion).toBe('UCS-2');
      expect(m.caracteres).toBe(2);
    });

    it('texto vacío no consume segmentos', () => {
      expect(medirSms('').segmentos).toBe(0);
    });
  });
});
