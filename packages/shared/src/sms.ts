/**
 * Medición de segmentos SMS (Plan-Mensajeria FASE-04).
 *
 * Un SMS no se cobra por mensaje sino por **segmento**, y el tamaño del segmento
 * depende de la codificación:
 * - **GSM-7** (alfabeto estándar): 160 caracteres sueltos, 153 por segmento si
 *   el mensaje se parte en varios (7 caracteres se van en la cabecera de unión).
 * - **UCS-2** (Unicode): 70 y 67.
 *
 * La trampa en español: **`á í ó ú` NO existen en GSM-7** (sí `é ù ì ò ñ ü ä ö à`
 * y los signos `¿ ¡`). Una sola tilde de esas obliga a UCS-2 y **más que duplica**
 * el coste del mensaje. Por eso el editor de plantillas avisa: cambiar "código"
 * por "codigo" puede ahorrar la mitad de los segmentos.
 */

/** Alfabeto GSM 03.38 básico (cada carácter cuenta 1). */
const GSM7_BASICO =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

/** Caracteres GSM que viajan con secuencia de escape (cuentan 2). */
const GSM7_EXTENDIDO = '^{}\\[~]|€';

const BASICO = new Set(GSM7_BASICO.split(''));
const EXTENDIDO = new Set(GSM7_EXTENDIDO.split(''));

export interface MedidaSms {
  codificacion: 'GSM-7' | 'UCS-2';
  /** Unidades facturables (los caracteres de escape GSM cuentan doble). */
  caracteres: number;
  segmentos: number;
  /** Caracteres que fuerzan UCS-2 (para señalarlos en la UI). */
  fueraDeGsm: string[];
}

/** Mide un texto de SMS: codificación, unidades y nº de segmentos. */
export function medirSms(texto: string): MedidaSms {
  // Se recorre por puntos de código (un emoji es 1 carácter, no 2 unidades UTF-16).
  const puntos = [...texto];
  const fueraDeGsm = [...new Set(puntos.filter((c) => !BASICO.has(c) && !EXTENDIDO.has(c)))];
  const esGsm = fueraDeGsm.length === 0;

  if (esGsm) {
    const unidades = puntos.reduce((n, c) => n + (EXTENDIDO.has(c) ? 2 : 1), 0);
    return {
      codificacion: 'GSM-7',
      caracteres: unidades,
      segmentos: unidades === 0 ? 0 : unidades <= 160 ? 1 : Math.ceil(unidades / 153),
      fueraDeGsm,
    };
  }

  // UCS-2: los caracteres fuera del plano básico (emoji) ocupan 2 unidades.
  const unidades = puntos.reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  return {
    codificacion: 'UCS-2',
    caracteres: unidades,
    segmentos: unidades === 0 ? 0 : unidades <= 70 ? 1 : Math.ceil(unidades / 67),
    fueraDeGsm,
  };
}
