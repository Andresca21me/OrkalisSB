/**
 * Plantillas de los correos de acceso/credenciales (Plan-Correo, §2.5).
 *
 * Viven en código (como `templates.ts` de mensajería): no son personalizables
 * por negocio porque hablan en nombre de la PLATAFORMA (verificar un correo,
 * restablecer una contraseña). Cada una devuelve asunto + texto plano + HTML;
 * el texto plano lleva la URL completa y es el fallback para clientes sin HTML
 * (y lo que inspeccionan las pruebas E2E vía el MockAdapter).
 *
 * El HTML es una tabla de 600 px con CSS inline — el mínimo común denominador
 * que renderizan bien Gmail, Outlook y los webmail viejos. Nada de fuentes
 * externas ni imágenes remotas: el logo es texto.
 */

export interface CorreoRenderizado {
  asunto: string;
  texto: string;
  html: string;
}

// Paleta sobria alineada con la base slate del producto; el CTA usa el azul de
// plataforma (los correos son de Orkalis, no del vertical del negocio).
const C = {
  fondo: '#f1f5f9',
  tarjeta: '#ffffff',
  tinta: '#0f172a',
  tintaSuave: '#475569',
  borde: '#e2e8f0',
  marca: '#0b1f3a',
  cta: '#2563eb',
} as const;

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Envuelve el contenido en el layout base (marca, tarjeta, pie legal). */
function layout(titulo: string, contenidoHtml: string): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.fondo};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 8px 16px;font-family:Arial,Helvetica,sans-serif;">
          <span style="font-size:20px;font-weight:bold;color:${C.marca};letter-spacing:0.5px;">Orkalis</span>
        </td></tr>
        <tr><td style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:${C.tinta};font-size:15px;line-height:1.6;">
          ${contenidoHtml}
        </td></tr>
        <tr><td style="padding:16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.tintaSuave};line-height:1.5;">
          Recibiste este correo porque alguien usó tu dirección en Orkalis. Si no fuiste tú, puedes ignorarlo: sin este enlace no pasa nada.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function botonCta(url: string, etiqueta: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:${C.cta};">
    <a href="${escapar(url)}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapar(etiqueta)}</a>
  </td></tr></table>
  <p style="margin:0 0 8px;font-size:13px;color:${C.tintaSuave};">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${escapar(url)}" style="color:${C.cta};">${escapar(url)}</a></p>`;
}

export const correos = {
  /** Flujo 1 — verificación del correo en el alta (Paso 2 → 3 del wizard). */
  verificacionAlta(p: { nombre: string; url: string }): CorreoRenderizado {
    const asunto = 'Confirma tu correo para continuar con tu registro';
    const texto = [
      `Hola ${p.nombre},`,
      '',
      'Estás creando tu cuenta en Orkalis. Confirma que este correo es tuyo abriendo este enlace:',
      p.url,
      '',
      'El enlace vence en 24 horas. Después de confirmarlo, vuelve a la pestaña del registro para continuar.',
    ].join('\n');
    const html = layout(asunto, `
      <h1 style="margin:0 0 16px;font-size:20px;color:${C.tinta};">Hola ${escapar(p.nombre)},</h1>
      <p style="margin:0 0 8px;">Estás creando tu cuenta en <strong>Orkalis</strong>. Confirma que este correo es tuyo para continuar con el registro.</p>
      ${botonCta(p.url, 'Confirmar mi correo')}
      <p style="margin:16px 0 0;font-size:13px;color:${C.tintaSuave};">El enlace vence en <strong>24 horas</strong>. Después de confirmar, vuelve a la pestaña del registro.</p>`);
    return { asunto, texto, html };
  },

  /** Flujo 2 — restablecimiento de contraseña. */
  resetPassword(p: { nombre: string; url: string }): CorreoRenderizado {
    const asunto = 'Restablece tu contraseña de Orkalis';
    const texto = [
      `Hola ${p.nombre},`,
      '',
      'Pediste restablecer tu contraseña. Crea una nueva desde este enlace:',
      p.url,
      '',
      'El enlace vence en 60 minutos y sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.',
    ].join('\n');
    const html = layout(asunto, `
      <h1 style="margin:0 0 16px;font-size:20px;color:${C.tinta};">Hola ${escapar(p.nombre)},</h1>
      <p style="margin:0 0 8px;">Pediste restablecer tu contraseña de Orkalis. Crea una nueva desde el botón:</p>
      ${botonCta(p.url, 'Crear nueva contraseña')}
      <p style="margin:16px 0 0;font-size:13px;color:${C.tintaSuave};">El enlace vence en <strong>60 minutos</strong> y sirve una sola vez. Si no lo pediste, tu contraseña sigue igual.</p>`);
    return { asunto, texto, html };
  },

  /** Flujo 3 — confirmar la dirección NUEVA al cambiar el correo de la cuenta. */
  cambioEmail(p: { nombre: string; url: string }): CorreoRenderizado {
    const asunto = 'Confirma tu nuevo correo de acceso';
    const texto = [
      `Hola ${p.nombre},`,
      '',
      'Pediste usar esta dirección como tu nuevo correo de acceso a Orkalis. Confírmala abriendo este enlace:',
      p.url,
      '',
      'El enlace vence en 24 horas. Hasta que confirmes, tu correo de acceso sigue siendo el anterior.',
    ].join('\n');
    const html = layout(asunto, `
      <h1 style="margin:0 0 16px;font-size:20px;color:${C.tinta};">Hola ${escapar(p.nombre)},</h1>
      <p style="margin:0 0 8px;">Pediste usar esta dirección como tu nuevo correo de acceso a Orkalis. Confírmala para completar el cambio.</p>
      ${botonCta(p.url, 'Confirmar nuevo correo')}
      <p style="margin:16px 0 0;font-size:13px;color:${C.tintaSuave};">El enlace vence en <strong>24 horas</strong>. Hasta que confirmes, tu correo de acceso sigue siendo el anterior.</p>`);
    return { asunto, texto, html };
  },

  /** Flujo 3 — aviso informativo a la dirección ANTERIOR tras consolidar el cambio. */
  avisoCorreoCambiado(p: { nombre: string; nuevoEmail: string }): CorreoRenderizado {
    const asunto = 'Tu correo de acceso a Orkalis cambió';
    const texto = [
      `Hola ${p.nombre},`,
      '',
      `El correo de acceso de tu cuenta de Orkalis cambió a: ${p.nuevoEmail}`,
      '',
      'Si fuiste tú, no tienes que hacer nada. Si NO fuiste tú, escribe de inmediato a soporte@orkalis.co.',
    ].join('\n');
    const html = layout(asunto, `
      <h1 style="margin:0 0 16px;font-size:20px;color:${C.tinta};">Hola ${escapar(p.nombre)},</h1>
      <p style="margin:0 0 8px;">El correo de acceso de tu cuenta cambió a <strong>${escapar(p.nuevoEmail)}</strong>.</p>
      <p style="margin:16px 0 0;font-size:13px;color:${C.tintaSuave};">Si fuiste tú, no tienes que hacer nada. Si <strong>no</strong> fuiste tú, escribe de inmediato a <a href="mailto:soporte@orkalis.co" style="color:${C.cta};">soporte@orkalis.co</a>.</p>`);
    return { asunto, texto, html };
  },

  /** Flujo 4 — invitación de un especialista por el admin del negocio. */
  invitacionEspecialista(p: { nombre: string; negocio: string; url: string }): CorreoRenderizado {
    const asunto = `${p.negocio} te invitó a Orkalis`;
    const texto = [
      `Hola ${p.nombre},`,
      '',
      `${p.negocio} te invitó a unirte a su equipo en Orkalis: allí verás tu agenda, tus citas y tus ganancias.`,
      '',
      'Activa tu cuenta creando tu contraseña desde este enlace:',
      p.url,
      '',
      'La invitación vence en 7 días.',
    ].join('\n');
    const html = layout(asunto, `
      <h1 style="margin:0 0 16px;font-size:20px;color:${C.tinta};">Hola ${escapar(p.nombre)},</h1>
      <p style="margin:0 0 8px;"><strong>${escapar(p.negocio)}</strong> te invitó a unirte a su equipo en Orkalis: allí verás tu agenda, tus citas y tus ganancias.</p>
      <p style="margin:0;">Activa tu cuenta creando tu contraseña:</p>
      ${botonCta(p.url, 'Activar mi cuenta')}
      <p style="margin:16px 0 0;font-size:13px;color:${C.tintaSuave};">La invitación vence en <strong>7 días</strong>.</p>`);
    return { asunto, texto, html };
  },
};
