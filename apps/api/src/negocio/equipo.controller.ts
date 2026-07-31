import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { RolUsuario, type BajaEspecialistaResp } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { EquipoService, type AccionBaja } from './equipo.service';
import { Throttle } from '@nestjs/throttler';
import { InvitacionEspecialistaService } from './invitacion-especialista.service';
import {
  ActivarInvitacionDto,
  AsignarServiciosDto,
  AsignarSucursalesDto,
  CrearEspecialistaDto,
  DisponibilidadDto,
  EditarEspecialistaDto,
  FotoEspecialistaDto,
  InvitarEspecialistaDto,
  InvitarExistenteDto,
  MiFichaDto,
  MiTelefonoConfirmarDto,
  MiTelefonoIniciarDto,
} from './dto/negocio.dto';

@Controller('especialistas')
@Roles(RolUsuario.Admin)
export class EquipoController {
  constructor(
    private readonly equipoService: EquipoService,
    private readonly invitacion: InvitacionEspecialistaService,
  ) {}

  // ── Alta por invitación (Plan-Correo E5, D4) ────────────────────────────────
  // El admin captura los datos básicos + correo; la contraseña y el celular los
  // pone el propio especialista desde el enlace que recibe (7 días).

  @Post('invitar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  invitar(@CurrentTenant() ctx: TenantContext, @Body() dto: InvitarEspecialistaDto) {
    return this.invitacion.invitar(ctx, dto);
  }

  /** Invitaciones vigentes del negocio (badges de la pantalla de equipo). */
  @Get('invitaciones')
  invitaciones(@CurrentTenant() ctx: TenantContext) {
    return this.invitacion.pendientes(ctx);
  }

  /** Invita (o re-invita con otro correo) a un especialista existente sin acceso. */
  @Post(':id/invitar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  async invitarExistente(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitarExistenteDto,
  ): Promise<void> {
    await this.invitacion.invitarExistente(ctx, id, dto.email);
  }

  @Post(':id/invitacion/reenviar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  async reenviarInvitacion(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.invitacion.reenviar(ctx, id);
  }

  /** "Yo también atiendo" (E8): la ficha de especialista del propio admin. */
  @Post('mi-ficha')
  miFicha(@CurrentTenant() ctx: TenantContext, @Body() dto: MiFichaDto) {
    return this.equipoService.crearMiFicha(ctx, dto);
  }

  /** "Este soy yo" (E8): enlaza un especialista YA creado a la cuenta en sesión. */
  @Post(':id/vincular-mi-cuenta')
  @HttpCode(204)
  async vincularMiCuenta(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.invitacion.vincularMiCuenta(ctx, id);
  }

  // ── El propio especialista verifica su celular ──────────────────────────────
  // (Paso 2 de la invitación, o después desde su panel si la mensajería estaba
  // pausada.) Admin incluido: con "Yo también atiendo" (E8) él también tiene
  // ficha propia. Throttle estricto: cada intento cuesta un SMS de Verify.

  @Post('mi/telefono/iniciar')
  @Roles(RolUsuario.Especialista, RolUsuario.Admin)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  miTelefonoIniciar(@CurrentTenant() ctx: TenantContext, @Body() dto: MiTelefonoIniciarDto) {
    return this.invitacion.miTelefonoIniciar(ctx, dto.celular);
  }

  @Post('mi/telefono/confirmar')
  @Roles(RolUsuario.Especialista, RolUsuario.Admin)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  miTelefonoConfirmar(@CurrentTenant() ctx: TenantContext, @Body() dto: MiTelefonoConfirmarDto) {
    return this.invitacion.miTelefonoConfirmar(ctx, dto.codigo);
  }

  @Get()
  @Roles(RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista)
  listar(@CurrentTenant() ctx: TenantContext) {
    return this.equipoService.listar(ctx);
  }

  /** Ganancias del especialista en un período (FASE-10, H3). */
  @Get(':id/ganancias')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista)
  ganancias(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.equipoService.ganancias(ctx, id, new Date(desde), new Date(hasta));
  }

  /**
   * Detalle por transacción de las ganancias (Plan-Finanzas F2): citas cobradas
   * y ventas directas, con bruto × regla = neto. Mismo candado que `ganancias`:
   * un especialista solo consulta las suyas (D2).
   */
  @Get(':id/ganancias/detalle')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista)
  gananciasDetalle(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.equipoService.gananciasDetalle(ctx, id, new Date(desde), new Date(hasta));
  }

  @Post()
  crear(@CurrentTenant() ctx: TenantContext, @Body() dto: CrearEspecialistaDto) {
    const credenciales =
      dto.email && dto.password ? { email: dto.email, password: dto.password } : undefined;
    return this.equipoService.crear(ctx, dto.nombre, dto.especialidad, dto.sucursalIds ?? [], {
      credenciales,
      servicioIds: dto.servicioIds,
    });
  }

  // ── Foto de perfil ──────────────────────────────────────────────────────────

  // Las rutas `mi/foto` van ANTES que `:id/foto`: Nest resuelve por orden de
  // declaración y "mi" no es un UUID, así que el `ParseUUIDPipe` de la otra las
  // rechazaría con un 400 antes de llegar aquí.

  /**
   * El propio especialista cambia su foto desde su panel.
   *
   * Sin id en la URL a propósito: se deduce de la sesión, de modo que nadie
   * puede escribir sobre la ficha de un compañero del mismo negocio.
   */
  @Put('mi/foto')
  @Roles(RolUsuario.Especialista, RolUsuario.Admin)
  guardarMiFoto(@CurrentTenant() ctx: TenantContext, @Body() dto: FotoEspecialistaDto) {
    return this.equipoService.guardarMiFoto(ctx, dto.dataUrl);
  }

  @Delete('mi/foto')
  @Roles(RolUsuario.Especialista, RolUsuario.Admin)
  @HttpCode(204)
  async borrarMiFoto(@CurrentTenant() ctx: TenantContext): Promise<void> {
    await this.equipoService.borrarMiFoto(ctx);
  }

  /** Sube o reemplaza la foto (data URL ya reducido en el navegador). */
  @Put(':id/foto')
  guardarFoto(
    @CurrentTenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FotoEspecialistaDto,
  ) {
    return this.equipoService.guardarFoto(ctx, id, dto.dataUrl);
  }

  @Delete(':id/foto')
  @HttpCode(204)
  async borrarFoto(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.equipoService.borrarFoto(ctx, id);
  }

  @Patch(':id')
  editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarEspecialistaDto) {
    return this.equipoService.editar(ctx, id, dto);
  }

  /** El propio especialista alterna su disponibilidad (FASE-10). */
  @Patch(':id/disponibilidad')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista, RolUsuario.Recepcionista)
  disponibilidad(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: DisponibilidadDto) {
    return this.equipoService.editar(ctx, id, { disponible: dto.disponible });
  }

  @Put(':id/sucursales')
  @HttpCode(204)
  async asignar(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: AsignarSucursalesDto,
  ): Promise<void> {
    await this.equipoService.asignarSucursales(ctx, id, dto.sucursalIds);
  }

  /** Servicios que el especialista realiza. Lista vacía = todos (sin restricción). */
  @Put(':id/servicios')
  @HttpCode(204)
  async asignarServicios(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: AsignarServiciosDto,
  ): Promise<void> {
    await this.equipoService.asignarServicios(ctx, id, dto.servicioIds);
  }

  /** Citas futuras pendientes: lo que hay que resolver antes de darlo de baja. */
  @Get(':id/citas-futuras')
  citasFuturas(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.equipoService.citasFuturas(ctx, id);
  }

  /**
   * Baja lógica (conserva historial). Con citas futuras pendientes responde 409
   * salvo que se indique qué hacer con ellas vía `?accion=reasignar|cancelar`.
   *
   * Sin `accion` mantiene el contrato de siempre (204 sin cuerpo); con `accion`
   * devuelve 200 con el recuento de lo que se hizo con las citas, que es
   * justamente lo que el admin necesita ver.
   */
  @Delete(':id')
  async darDeBaja(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Query('accion') accion?: AccionBaja,
  ): Promise<BajaEspecialistaResp | undefined> {
    const r = await this.equipoService.darDeBaja(ctx, id, accion);
    if (!accion) {
      res.status(204);
      return undefined;
    }
    return r;
  }

  @Post(':id/reactivar')
  @HttpCode(204)
  async reactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string): Promise<void> {
    await this.equipoService.reactivar(ctx, id);
  }
}


/**
 * Invitación del especialista, **pública**: la abre alguien que aún no tiene
 * cuenta (el enlace llegó a su correo). Vive en su propia clase por el mismo
 * motivo que la foto: `RolesGuard` no consulta `@Public()` y el `@Roles(Admin)`
 * de la clase de arriba devolvería 403.
 */
@Public()
@Controller('public/invitacion')
export class InvitacionPublicaController {
  constructor(private readonly invitacion: InvitacionEspecialistaService) {}

  /** Qué pintar en la página /invitacion: válida (nombre/negocio), usada o inválida. */
  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  info(@Param('token') token: string) {
    return this.invitacion.info(token);
  }

  /** El especialista crea su contraseña y su cuenta queda activa. */
  @Post(':token/activar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  activar(@Param('token') token: string, @Body() dto: ActivarInvitacionDto) {
    return this.invitacion.activar(token, dto.password);
  }
}

/**
 * Foto del especialista, **pública**: el enlace de reserva no tiene sesión y es
 * justo ahí donde el cliente necesita reconocer a su especialista.
 *
 * Vive en su propio controlador y no junto a los demás endpoints de equipo
 * porque aquel lleva `@Roles(Admin)` a nivel de clase, y el `RolesGuard` —a
 * diferencia del de JWT— no consulta `@Public()`: dejarlo allí devolvía 403 aun
 * siendo público. Mismo patrón que el webhook de Mercado Pago.
 */
@Public()
@Controller('especialistas')
export class EspecialistaFotoController {
  constructor(private readonly equipoService: EquipoService) {}

  /**
   * La URL lleva `?v=<fecha de la foto>`, así que se puede cachear un año: si el
   * admin sube otra, cambia la URL y el navegador la vuelve a pedir sola.
   */
  @Get(':id/foto')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  // Helmet marca TODA respuesta como `same-origin`, y como la web vive en
  // orkalis.com y la API en api.orkalis.com, el navegador descargaba la imagen
  // y la descartaba sin pintarla —sin ningún error visible—. Se abre solo en
  // esta ruta, que sirve imágenes públicas por diseño; el resto de la API
  // conserva la política estricta.
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async foto(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const f = await this.equipoService.leerFoto(id);
    if (!f) throw new NotFoundException('Sin foto.');
    res.setHeader('Content-Type', f.mime);
    res.setHeader('ETag', `"${f.actualizadoEn.getTime()}"`);
    res.end(f.datos);
  }
}
