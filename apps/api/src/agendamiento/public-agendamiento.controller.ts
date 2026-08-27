import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PublicAgendamientoService } from './public-agendamiento.service';
import { BuscarCitaDto, ConfirmarDto, RetenerDto } from './dto/agendamiento.dto';

/**
 * Endpoints PÚBLICOS de reserva sin sesión (FASE-08). `:sucursalId` es el slug.
 * Marcados `@Public()`; el rate limiting global (ThrottlerGuard) los protege.
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
  @HttpCode(201)
  confirmar(@Param('sucursalId') sucursalId: string, @Body() dto: ConfirmarDto) {
    return this.service.confirmar(sucursalId, dto);
  }

  @Post('cita/buscar')
  @HttpCode(200)
  buscar(@Param('sucursalId') sucursalId: string, @Body() dto: BuscarCitaDto) {
    return this.service.buscarCita(sucursalId, dto.telefono);
  }

  @Get('cita/:id')
  detalle(@Param('sucursalId') sucursalId: string, @Param('id') id: string) {
    return this.service.detalleCita(sucursalId, id);
  }

  @Post('cita/:id/cancelar')
  @HttpCode(200)
  cancelar(@Param('sucursalId') sucursalId: string, @Param('id') id: string) {
    return this.service.cancelarDesdeEnlace(sucursalId, id);
  }
}
