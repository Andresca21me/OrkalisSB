import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { RolUsuario, type CanalPlantilla, type EventoPlantilla, type PlantillaMensaje } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { CuposService, type EstadoCupo } from './cupos.service';
import { AlertasService, type AlertaAdminDto } from './alertas.service';
import { PlantillasService } from './plantillas.service';
import { MensajesService } from './mensajes.service';
import { CANALES_VALIDOS, EVENTOS_VALIDOS, GuardarPlantillaDto, ListarMensajesDto, ListarPlantillasDto } from './dto/plantilla.dto';

/** Exposición HTTP de notificaciones (FASE-09, H5): cupos y avisos al admin. */
@Controller('notificaciones')
@Roles(RolUsuario.Admin)
export class NotificacionesController {
  constructor(
    private readonly cupos: CuposService,
    private readonly alertas: AlertasService,
    private readonly plantillas: PlantillasService,
    private readonly mensajes: MensajesService,
  ) {}

  /** Consumo/cupo de cada canal en el ciclo de cobro vigente (ADR-009, D1). */
  @Get('cupos')
  getCupos(@CurrentTenant() ctx: TenantContext): Promise<EstadoCupo[]> {
    return this.cupos.verificarTodos(ctx.negocioId);
  }

  /** Avisos persistentes (sobreconsumo de cupos, FASE-03). */
  @Get('alertas')
  getAlertas(
    @CurrentTenant() ctx: TenantContext,
    @Query('sinLeer') sinLeer?: string,
  ): Promise<AlertaAdminDto[]> {
    return this.alertas.listar(ctx, sinLeer === 'true');
  }

  @Post('alertas/:id/leer')
  @HttpCode(204)
  async leer(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.alertas.marcarLeida(ctx, id);
  }

  // ── Registro de mensajes (FASE-10) ──────────────────────────────────────────

  /** Mensajes enviados con su estado de entrega, filtrable y paginado. */
  @Get('mensajes')
  getMensajes(@CurrentTenant() ctx: TenantContext, @Query() q: ListarMensajesDto) {
    return this.mensajes.listar(ctx, q);
  }

  /** Conteo por estado del período (cabecera del registro y tasa de fallo). */
  @Get('mensajes/resumen')
  getResumenMensajes(@CurrentTenant() ctx: TenantContext) {
    return this.mensajes.resumen(ctx);
  }

  // ── Plantillas de mensaje (FASE-04, D5) ─────────────────────────────────────

  /** Plantilla de cada evento + el texto por defecto de plataforma. */
  @Get('plantillas')
  getPlantillas(
    @CurrentTenant() ctx: TenantContext,
    @Query() q: ListarPlantillasDto,
  ): Promise<PlantillaMensaje[]> {
    return this.plantillas.listar(ctx, q.canal ?? 'sms');
  }

  /** Guarda (o restablece, enviando el contenido vacío) una plantilla. */
  @Put('plantillas/:evento/:canal')
  @HttpCode(204)
  async putPlantilla(
    @CurrentTenant() ctx: TenantContext,
    @Param('evento') evento: string,
    @Param('canal') canal: string,
    @Body() dto: GuardarPlantillaDto,
  ): Promise<void> {
    // Los parámetros de ruta no pasan por el ValidationPipe del body: se validan
    // aquí para no dejar que un evento inventado llegue al enum de Postgres.
    if (!EVENTOS_VALIDOS.includes(evento as EventoPlantilla)) {
      throw new BadRequestException(`Evento no válido. Opciones: ${EVENTOS_VALIDOS.join(', ')}.`);
    }
    if (!CANALES_VALIDOS.includes(canal as CanalPlantilla)) {
      throw new BadRequestException(`Canal no válido. Opciones: ${CANALES_VALIDOS.join(', ')}.`);
    }
    await this.plantillas.guardar(ctx, evento as EventoPlantilla, canal as CanalPlantilla, dto);
  }
}
