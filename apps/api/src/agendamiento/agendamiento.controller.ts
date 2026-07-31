import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { AgendamientoService } from './agendamiento.service';
import { AtencionService } from '../finanzas/atencion.service';
import { DisponibilidadService } from './disponibilidad.service';
import { CompletarDto, CrearCitaDto, ReasignarDto, RevertirDto, WalkInRetroactivoDto, WalkInVivoDto } from './dto/agendamiento.dto';

/** Agenda interna y operación del turno (FASE-08/09). Roles internos. */
@Controller('citas')
@Roles(RolUsuario.Admin, RolUsuario.Especialista, RolUsuario.Recepcionista)
export class AgendamientoController {
  constructor(
    private readonly service: AgendamientoService,
    private readonly atencion: AtencionService,
    private readonly disponibilidad: DisponibilidadService,
  ) {}

  /**
   * Franjas libres para agendar desde la agenda interna: mismo cálculo que la
   * reserva pública (horario de sede × ventanas del especialista − ocupado).
   */
  @Get('disponibilidad')
  franjas(
    @CurrentTenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId: string,
    @Query('especialistaId') especialistaId: string,
    @Query('servicios') servicios: string,
    @Query('fecha') fecha: string,
  ) {
    const servicioIds = (servicios ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.disponibilidad.franjasPublicas(ctx, sucursalId, especialistaId, servicioIds, fecha);
  }

  @Get()
  listar(
    @CurrentTenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId?: string,
    @Query('especialistaId') especialistaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.listarAgenda(ctx, {
      sucursalId,
      especialistaId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  /** Crea una cita agendada (futura) desde la agenda interna (FASE-05). */
  @Post()
  @HttpCode(201)
  crear(@CurrentTenant() ctx: TenantContext, @Body() dto: CrearCitaDto) {
    return this.service.crearAgendada(ctx, {
      sucursalId: dto.sucursalId,
      especialistaId: dto.especialistaId,
      clienteId: dto.clienteId,
      servicioIds: dto.servicioIds,
      inicio: new Date(dto.inicio),
    });
  }

  @Post(':id/aprobar')
  aprobar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.service.aprobar(ctx, id);
  }

  @Post(':id/iniciar')
  iniciar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.service.iniciar(ctx, id);
  }

  /** Reasigna la cita a otro especialista (FASE-11, H4). Admin/recepción. */
  @Post(':id/reasignar')
  @Roles(RolUsuario.Admin, RolUsuario.Recepcionista)
  reasignar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: ReasignarDto) {
    return this.service.reasignar(ctx, id, dto.especialistaId);
  }

  /** Completa el turno con su cierre financiero (FASE-09). */
  @Post(':id/completar')
  completar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: CompletarDto) {
    return this.atencion.completar(ctx, id, dto);
  }

  /**
   * Revierte una atención completada (deshace ganancias; repone stock salvo que
   * se indique lo contrario). Devuelve `advertencia` si el cobro pertenecía a
   * un período ya cerrado (Plan-Finanzas D6) — se permite, pero se avisa.
   */
  @Post(':id/revertir')
  @HttpCode(200)
  revertir(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: RevertirDto): Promise<{ advertencia: string | null }> {
    return this.atencion.revertir(ctx, id, dto.reponerStock ?? true);
  }

  @Post(':id/cancelar')
  cancelar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.service.cancelar(ctx, id);
  }

  @Post(':id/no-asistio')
  noAsistio(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.service.noAsistio(ctx, id);
  }

  @Post('walk-in')
  @HttpCode(201)
  walkInVivo(@CurrentTenant() ctx: TenantContext, @Body() dto: WalkInVivoDto) {
    return this.service.walkInVivo(ctx, dto);
  }

  @Post('walk-in/retroactivo')
  @HttpCode(201)
  walkInRetroactivo(@CurrentTenant() ctx: TenantContext, @Body() dto: WalkInRetroactivoDto) {
    return this.service.walkInRetroactivo(ctx, {
      ...dto,
      inicio: new Date(dto.inicio),
      fin: new Date(dto.fin),
    });
  }
}
