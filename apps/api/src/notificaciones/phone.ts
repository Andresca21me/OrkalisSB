/**
 * Normaliza un teléfono a formato E.164 para los proveedores (Twilio exige
 * `+<indicativo><número>`; sin el `+` rechaza el envío). v1 asume **Colombia**:
 * el frontend guarda solo los 10 dígitos locales (móvil que empieza por 3) y
 * pinta el `+57` aparte, así que aquí lo anteponemos. Si el número ya trae el
 * indicativo (12 dígitos empezando por 57) o venía con `+`, se respeta.
 *
 * No cambia el valor almacenado (que sigue siendo la identidad del cliente/OTP);
 * solo formatea en la frontera con el proveedor.
 */
export function aE164Colombia(telefono: string): string {
  const conMas = telefono.trim().startsWith('+');
  const d = telefono.replace(/\D/g, '');
  if (conMas) return `+${d}`;
  if (d.length === 12 && d.startsWith('57')) return `+${d}`;
  if (d.length === 10) return `+57${d}`;
  // Último recurso: anteponer `+` para no romper números ya internacionales.
  return `+${d}`;
}
