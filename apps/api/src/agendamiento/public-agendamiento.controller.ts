import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PublicAgendamientoService } from './public-agendamiento.service';
import { BuscarCitaDto, ConfirmarDto, RetenerDto } from './dto/agendamiento.dto';

/** Límite global por defecto (ver `THROTTLE_LIMIT` en env.validation). */
const LIMITE_GLOBAL_DEFECTO = 120;

/**
 * Límite por minuto de una ruta pública sensible (FASE-01 piloto). Por defecto
 * es el estricto (`n`). Si se SUBIÓ el límite global por encima del default —
 * pruebas E2E que reservan cientos de veces desde una IP, o un despliegue donde
 * muchos clientes comparten IP — la ruta hereda ese techo para no romperlo.
 * Se evalúa en cada petición (Resolvable de @nestjs/throttler v6).
 */
export function limitePublico(n: number): () => number {
  return () => {
    const global = Number(process.env.THROTTLE_LIMIT ?? LIMITE_GLOBAL_DEFECTO);
    return global > LIMITE_GLOBAL_DEFECTO ? global : n;
  };
}

/**
 * Endpoints PÚBLICOS de reserva sin sesión (FASE-08). `:sucursalId` es el slug.
 * Marcados `@Public()`; el rate limiting global (ThrottlerGuard) los protege y
 * las rutas que crean citas o mandan mensajes llevan un límite propio más
 * estricto (FASE-01 piloto).
 *
 * Gestión de una cita existente: SOLO con su `token_gestion` secreto
 * (`gestion/:token`). El `id` de la cita ya no sirve desde fuera, y buscar por
 * celular solo manda el enlace por SMS al dueño del número.
 */
@Public()
@Controller('public/:sucursalId')
export class PublicAgendamientoController {
  constructor(private readonly service: PublicAgendamientoService) {}

  @Get('info')
  info(@Param('sucursalId') sucursalId: string) {
    return this.service.info(sucursalId);
  }

  @Get('especialistas')
  especialistas(@Param('sucursalId') sucursalId: string) {
    return this.service.especialistasPublicos(sucursalId);
  }

  @Get('servicios')
  servicios(@Param('sucursalId') sucursalId: string) {
    return this.service.serviciosPublicos(sucursalId);
  }

  @Get('disponibilidad')
  disponibilidad(
    @Param('sucursalId') sucursalId: string,
    @Query('especialista') especialista: string, // uuid o 'any'
    @Query('servicios') servicios: string, // ids separados por coma
    @Query('fecha') fecha: string,
  ) {
    const servicioIds = (servicios ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.service.franjas(sucursalId, especialista, servicioIds, fecha);
  }

  @Post('retener')
  @Throttle({ default: { limit: limitePublico(20), ttl: 60_000 } })
  @HttpCode(200)
  retener(@Param('sucursalId') sucursalId: string, @Body() dto: RetenerDto) {
    return this.service.retener(
      sucursalId,
      dto.especialistaId,
      new Date(dto.inicio),
      new Date(dto.fin),
    );
  }

  /**
   * COMPAT transitoria: el OTP de reserva se eliminó (ya no se piden códigos).
   * Este stub responde `requerido:false` para que un navegador con el bundle
   * anterior en caché confirme directo en vez de romperse con un 404.
   */
  @Post('otp/enviar')
  @HttpCode(200)
  enviarOtp() {
    return { enviado: false, requerido: false };
  }

  @Post('confirmar')
  @Throttle({ default: { limit: limitePublico(5), ttl: 60_000 } })
  @HttpCode(201)
  confirmar(@Param('sucursalId') sucursalId: string, @Body() dto: ConfirmarDto) {
    return this.service.confirmar(sucursalId, dto);
  }

  /** Manda por SMS el enlace de gestión al celular, si tiene cita. Nunca devuelve la cita. */
  @Post('cita/buscar')
  @Throttle({ default: { limit: limitePublico(5), ttl: 60_000 } })
  @HttpCode(200)
  buscar(@Param('sucursalId') sucursalId: string, @Body() dto: BuscarCitaDto) {
    return this.service.enviarEnlaceGestion(sucursalId, dto.telefono);
  }

  @Get('gestion/:token')
  detalle(@Param('sucursalId') sucursalId: string, @Param('token') token: string) {
    return this.service.detallePorToken(sucursalId, token);
  }

  @Post('gestion/:token/cancelar')
  @Throttle({ default: { limit: limitePublico(10), ttl: 60_000 } })
  @HttpCode(200)
  cancelar(@Param('sucursalId') sucursalId: string, @Param('token') token: string) {
    return this.service.cancelarPorToken(sucursalId, token);
  }
}
