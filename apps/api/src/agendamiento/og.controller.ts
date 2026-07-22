import { Controller, Get, Header, Param, ParseUUIDPipe, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import type { Env } from '../config/env.validation';
import { MarcaService } from '../negocio/negocio.service';
import { PublicAgendamientoService } from './public-agendamiento.service';

/**
 * Tarjeta de vista previa del enlace de reserva (Open Graph), servida desde el
 * SERVIDOR.
 *
 * **Por qué existe:** el frontend es un SPA estático, así que todas sus rutas
 * devuelven el mismo `index.html` con las etiquetas genéricas de Orkalis. Los
 * crawlers de WhatsApp, Facebook o Telegram **no ejecutan JavaScript**: leen el
 * HTML tal como llega. Sin esto, el enlace de un salón mostraría siempre la
 * tarjeta de la plataforma en lugar de la del negocio.
 *
 * Caddy enruta aquí únicamente cuando el `User-Agent` es un crawler y la ruta
 * es `/reservar/*`. Una persona nunca ve esta página; aun así lleva redirección
 * y enlace, por si alguien llega por otra vía.
 */
@Public()
@Controller('og')
export class OgController {
  constructor(
    private readonly publico: PublicAgendamientoService,
    private readonly marca: MarcaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('reservar/:sucursalId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // Media hora: si el negocio cambia su logo o descripción, la tarjeta se
  // refresca sola en un rato. WhatsApp además cachea por su cuenta varios días.
  @Header('Cache-Control', 'public, max-age=1800')
  async reservar(
    @Param('sucursalId', ParseUUIDPipe) sucursalId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Origen de la WEB: el primero de CORS_ORIGIN, que ya apunta al dominio real.
    const web = (this.config.get('CORS_ORIGIN', { infer: true }) ?? 'https://orkalis.com').split(',')[0].trim();
    // Origen de la API: se toma de la propia petición, así no hay que mantener
    // otra variable de entorno que se pueda desincronizar del dominio.
    const api = `${req.protocol}://${req.get('host')}`;
    const url = `${web}/reservar/${sucursalId}`;

    const tarjeta = await this.datosDe(sucursalId, web, api).catch(() => null);
    res.end(
      html(
        tarjeta ?? {
          // Sucursal inexistente o inactiva: tarjeta genérica en vez de un
          // error, que en WhatsApp se vería como un enlace roto.
          titulo: 'Reserva tu cita',
          descripcion: 'Agenda en línea, sin llamadas y sin crear cuenta.',
          imagen: `${web}/og.png`,
          url,
        },
      ),
    );
  }

  private async datosDe(sucursalId: string, web: string, api: string): Promise<Tarjeta> {
    const [info, negocioId] = await Promise.all([
      this.publico.info(sucursalId),
      this.publico.negocioIdDeSucursal(sucursalId),
    ]);
    const marca = await this.marca.marcaDe(negocioId);

    return {
      titulo: [info.negocioNombre, info.sucursalNombre].filter(Boolean).join(' · '),
      descripcion:
        marca?.descripcion?.trim() ||
        `Reserva tu cita en ${info.negocioNombre} en línea, sin llamadas y sin crear cuenta.`,
      // El logo del negocio manda; si no lo ha subido, la tarjeta de Orkalis.
      imagen: marca?.logoVersion
        ? `${api}/api/negocios/${negocioId}/logo?v=${encodeURIComponent(marca.logoVersion)}`
        : `${web}/og.png`,
      url: `${web}/reservar/${sucursalId}`,
    };
  }
}

interface Tarjeta {
  titulo: string;
  descripcion: string;
  imagen: string;
  url: string;
}

/** Escapa para atributos HTML: el nombre del negocio lo escribe el usuario. */
function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function html({ titulo, descripcion, imagen, url }: Tarjeta): string {
  const t = esc(titulo);
  const d = esc(descripcion);
  const img = esc(imagen);
  const u = esc(url);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Orkalis">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">
<meta property="og:locale" content="es_CO">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0;url=${u}">
</head>
<body><a href="${u}">${t}</a></body>
</html>`;
}
