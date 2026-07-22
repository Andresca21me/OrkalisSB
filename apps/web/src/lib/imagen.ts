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

  const bitmap = await cargar(archivo);
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
async function cargar(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(archivo);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}
