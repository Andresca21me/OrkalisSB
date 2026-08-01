import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { ClientesService } from './clientes.service';
import { ServiciosService } from './servicios.service';
import { InventarioService } from './inventario.service';
import { GastosService } from './gastos.service';
import { LiquidacionesService } from './liquidaciones.service';
import { ReportesService } from './reportes.service';
import { CierreService } from './cierre.service';
import {
  CierreDto,
  ClienteDto,
  EditarClienteDto,
  EditarProductoDto,
  EditarServicioDto,
  GastoDto,
  LiquidacionDto,
  MovimientoDto,
  PreviewLiquidacionDto,
  ProductoDto,
  ServicioDto,
  VentaDto,
} from './dto/operacion.dto';

@Controller('clientes')
@Roles(RolUsuario.Admin, RolUsuario.Recepcionista)
export class ClientesController {
  constructor(private readonly s: ClientesService) {}
  @Get() listar(@CurrentTenant() ctx: TenantContext, @Query('buscar') buscar?: string) {
    return this.s.listar(ctx, buscar);
  }
  @Get(':id/historial') historial(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.historial(ctx, id);
  }
  @Post() crear(@CurrentTenant() ctx: TenantContext, @Body() dto: ClienteDto) {
    return this.s.crear(ctx, dto.nombre, dto.telefono);
  }
  @Patch(':id') editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarClienteDto) {
    return this.s.editar(ctx, id, dto);
  }
  @Delete(':id') @HttpCode(204) desactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.desactivar(ctx, id);
  }
}

@Controller('servicios')
@Roles(RolUsuario.Admin)
export class ServiciosController {
  constructor(private readonly s: ServiciosService) {}
  // Lectura permitida también a recepción/especialista (para walk-ins/agenda).
  @Get() @Roles(RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista)
  listar(@CurrentTenant() ctx: TenantContext) {
    return this.s.listar(ctx);
  }
  @Post() crear(@CurrentTenant() ctx: TenantContext, @Body() dto: ServicioDto) {
    return this.s.crear(ctx, dto);
  }
  @Patch(':id') editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarServicioDto) {
    return this.s.editar(ctx, id, dto);
  }
  @Delete(':id') @HttpCode(204) desactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.desactivar(ctx, id);
  }
}

@Controller('inventario')
@Roles(RolUsuario.Admin)
export class InventarioController {
  constructor(private readonly s: InventarioService) {}
  // Lectura permitida también a recepción/especialista: la necesitan para el
  // selector de productos al cobrar una cita. El gate del módulo sigue aplicando
  // (403 si está inactivo), y ese 403 es la señal de "sin módulo" para esos paneles.
  @Get('productos') @Roles(RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista)
  listar(@CurrentTenant() ctx: TenantContext, @Query('sucursalId') suc?: string) {
    return this.s.listar(ctx, suc);
  }
  @Post('productos') crear(@CurrentTenant() ctx: TenantContext, @Body() dto: ProductoDto) {
    return this.s.crear(ctx, dto);
  }
  @Patch('productos/:id') editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarProductoDto) {
    return this.s.editar(ctx, id, dto);
  }
  @Delete('productos/:id') @HttpCode(204) desactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.desactivar(ctx, id);
  }
  // Las rutas fijas van ANTES de cualquier `productos/:id` para que Nest no las
  // capture como un id. (Aquí no colisionan, pero se mantiene el orden por claridad.)
  @Get('movimientos') movimientos(
    @CurrentTenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId?: string,
    @Query('productoId') productoId?: string,
    @Query('tipo') tipo?: 'entrada' | 'salida' | 'ajuste',
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.s.listarMovimientos(ctx, {
      sucursalId,
      productoId,
      tipo,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }
  @Get('ventas') ventas(
    @CurrentTenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('especialistaId') especialistaId?: string,
    @Query('productoId') productoId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('origen') origen?: 'cita' | 'directa',
  ) {
    return this.s.listarVentas(ctx, {
      sucursalId,
      especialistaId,
      productoId,
      clienteId,
      origen,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }
  @Post('movimientos') @HttpCode(200) movimiento(@CurrentTenant() ctx: TenantContext, @Body() dto: MovimientoDto) {
    return this.s.movimiento(ctx, dto);
  }
  @Post('ventas') @HttpCode(201) vender(@CurrentTenant() ctx: TenantContext, @Body() dto: VentaDto) {
    return this.s.vender(ctx, dto);
  }
  @Get('alertas') alertas(@CurrentTenant() ctx: TenantContext, @Query('sucursalId') suc?: string) {
    return this.s.alertasStockBajo(ctx, suc);
  }
  @Get('valoracion') async valoracion(@CurrentTenant() ctx: TenantContext, @Query('sucursalId') suc?: string) {
    return { valoracion: await this.s.valoracion(ctx, suc) };
  }
}

@Controller('gastos')
@Roles(RolUsuario.Admin)
export class GastosController {
  constructor(private readonly s: GastosService) {}
  @Get() listar(@CurrentTenant() ctx: TenantContext, @Query('sucursalId') suc?: string) {
    return this.s.listar(ctx, suc);
  }
  /** Desglose del período (Plan-Gastos): cada ocurrencia con fecha + totales. */
  @Get('detalle') detalle(
    @CurrentTenant() ctx: TenantContext,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('sucursalId') suc?: string,
  ) {
    return this.s.detalle(ctx, new Date(desde), new Date(hasta), suc);
  }
  @Post() crear(@CurrentTenant() ctx: TenantContext, @Body() dto: GastoDto) {
    return this.s.crear(ctx, dto);
  }
  @Delete(':id') @HttpCode(204) desactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.desactivar(ctx, id);
  }
}

@Controller('liquidaciones')
@Roles(RolUsuario.Admin)
export class LiquidacionesController {
  constructor(private readonly s: LiquidacionesService) {}
  @Post('preview') @HttpCode(200) preview(@CurrentTenant() ctx: TenantContext, @Body() dto: PreviewLiquidacionDto) {
    return this.s.preview(ctx, { sucursalId: dto.sucursalId, desde: new Date(dto.desde), hasta: new Date(dto.hasta) });
  }
  @Post('generar') @HttpCode(201) generar(@CurrentTenant() ctx: TenantContext, @Body() dto: LiquidacionDto) {
    return this.s.generar(ctx, { ...dto, desde: new Date(dto.desde), hasta: new Date(dto.hasta) });
  }
  /**
   * Exporta el PREVIEW en CSV. Antes llamaba a `generar()` — exportar dos veces
   * duplicaba filas persistidas sin que nadie lo pidiera (Plan-Finanzas F5).
   */
  @Post('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(@CurrentTenant() ctx: TenantContext, @Body() dto: PreviewLiquidacionDto): Promise<string> {
    const r = await this.s.preview(ctx, { sucursalId: dto.sucursalId, desde: new Date(dto.desde), hasta: new Date(dto.hasta) });
    return this.s.exportarCsv(r);
  }
}

@Controller('reportes')
@Roles(RolUsuario.Admin)
export class ReportesController {
  constructor(private readonly s: ReportesService) {}
  @Get('financiero') financiero(
    @CurrentTenant() ctx: TenantContext,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.s.financiero(ctx, new Date(desde), new Date(hasta), sucursalId);
  }

  @Get('analisis') analisis(
    @CurrentTenant() ctx: TenantContext,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('especialistaId') especialistaId?: string,
    @Query('servicioId') servicioId?: string,
  ) {
    // Filtros de transparencia (Plan-Finanzas F4): por especialista y servicio.
    return this.s.analisis(ctx, new Date(desde), new Date(hasta), sucursalId, { especialistaId, servicioId });
  }

  @Get('panel') panel(
    @CurrentTenant() ctx: TenantContext,
    @Query('fecha') fecha: string,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.s.panel(ctx, fecha, sucursalId);
  }
}

@Controller('cierres')
@Roles(RolUsuario.Admin)
export class CierreController {
  constructor(private readonly s: CierreService) {}
  @Get() listar(@CurrentTenant() ctx: TenantContext) {
    return this.s.listar(ctx);
  }
  @Post() @HttpCode(201) cerrar(@CurrentTenant() ctx: TenantContext, @Body() dto: CierreDto) {
    return this.s.cerrar(ctx, dto);
  }
}
