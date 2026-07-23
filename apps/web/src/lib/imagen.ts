/**
 * Prepara la foto de un especialista en el NAVEGADOR antes de subirla.
 *
 * Se hace aquí y no en el servidor por tres razones prácticas:
 * - Una foto de móvil pesa varios MB. Subirla entera por datos móviles sería
 *   lento justo cuando el admin está dando de alta a alguien delante del cliente.
 * - El avatar se muestra a 44 px; guardar 4000 px sería desperdiciar espacio.
 * - Recortar al centro y en cuadrado evita que las caras salgan deformadas al
 *   meterlas en un círculo.
 */

/** Lado del cuadrado final. 256 basta para un avatar nítido en pantallas retina. */
const LADO = 256;
/** Calidad JPEG: por encima de 0.82 el archivo crece sin que se note. */
const CALIDAD = 0.82;

export async function prepararFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }

  const bitmap = await cargarImagen(archivo);
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen.');

  // Recorte cuadrado centrado: se toma el lado menor y se descarta el sobrante.
  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO, LADO);

  return lienzo.toDataURL('image/jpeg', CALIDAD);
}

/** Carga el archivo como imagen; `createImageBitmap` cuando existe (más rápido). */
export async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(archivo);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

/**
 * Color dominante de una imagen, para sugerir el color de marca.
 *
 * Implementado con canvas y sin dependencias: un cuantizador por cubos de 32
 * niveles por canal es más que suficiente para un logo, que suele tener pocos
 * colores planos.
 *
 * Se descartan a propósito:
 * - **Píxeles casi transparentes**: los logos PNG traen un fondo vacío enorme
 *   que si no ganaría siempre.
 * - **Blancos, negros y grises**: son el fondo o el contorno del logo, no su
 *   color de marca. Un logo negro sobre blanco debe sugerir un acento, no #000,
 *   porque con negro los botones pierden toda personalidad.
 */
export async function colorDominante(dataUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    i.src = dataUrl;
  });

  // Muestreo pequeño: 64x64 basta y es instantáneo.
  const N = 64;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, N, N);

  const { data } = ctx.getImageData(0, 0, N, N);
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturacion = max === 0 ? 0 : (max - min) / max;
    // Fuera fondos y contornos: muy oscuro, muy claro o sin color.
    if (max < 40 || min > 225 || saturacion < 0.18) continue;

    // Cubo de 32 niveles por canal (>> 3).
    const clave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const acc = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    acc.n++;
    acc.r += r;
    acc.g += g;
    acc.b += b;
    cubos.set(clave, acc);
  }

  if (cubos.size === 0) return null; // logo en blanco y negro: no se sugiere nada
  const ganador = [...cubos.values()].sort((a, b) => b.n - a.n)[0];
  return hex(Math.round(ganador.r / ganador.n), Math.round(ganador.g / ganador.n), Math.round(ganador.b / ganador.n));
}

function hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/**
 * Prepara el LOGO.
 *
 * A diferencia del avatar no se recorta en cuadrado —un logo suele ser apaisado
 * y recortarlo lo mutilaría—: se encaja conservando la proporción.
 *
 * **El formato se elige según el contenido, y esto importa de verdad:** un logo
 * con fondo transparente TIENE que ir en PNG o saldría con un recuadro blanco
 * encima del color del negocio. Pero PNG comprime fatal las imágenes
 * fotográficas, y muchos "logos" que sube la gente son en realidad una foto del
 * local. Guardar eso en PNG generaba un data URL de varios cientos de KB y el
 * servidor lo rechazaba con "request entity too large".
 *
 * Por eso: transparencia → PNG; opaco → JPEG. Y si aun así se pasa de tamaño,
 * se reintenta más pequeño en vez de fallar.
 */
export async function prepararLogo(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');

  const bitmap = await cargarImagen(archivo);

  // Tope de bytes ya decodificados; el servidor rechaza por encima de 400 KB.
  const MAX_BYTES = 320_000;
  for (const lado of [512, 384, 256]) {
    const dataUrl = dibujar(bitmap, lado);
    if (pesoAproximado(dataUrl) <= MAX_BYTES) return dataUrl;
  }
  // Último recurso: el más pequeño y siempre en JPEG.
  return dibujar(bitmap, 256, true);
}

/** Bytes reales que representa un data URL en base64. */
function pesoAproximado(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

function dibujar(bitmap: ImageBitmap | HTMLImageElement, max: number, forzarJpeg = false): string {
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Tu navegador no permite procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (!forzarJpeg && tieneTransparencia(ctx, w, h)) return c.toDataURL('image/png');

  // JPEG no admite alfa: se rellena en blanco antes, o el fondo saldría negro.
  const plano = document.createElement('canvas');
  plano.width = w;
  plano.height = h;
  const pctx = plano.getContext('2d');
  if (!pctx) throw new Error('Tu navegador no permite procesar la imagen.');
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, w, h);
  pctx.drawImage(c, 0, 0);
  return plano.toDataURL('image/jpeg', 0.85);
}

/** ¿Algún píxel no es del todo opaco? Se muestrea: no hace falta ser exacto. */
function tieneTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4 * 7) {
    if (data[i] < 250) return true;
  }
  return false;
}
