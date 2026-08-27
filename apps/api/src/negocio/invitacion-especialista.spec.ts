import { config as loadEnv } from 'dotenv';
loadEnv();

import * as argon2 from 'argon2';
import { desc, eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { ConfigService } from '@nestjs/config';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { especialista, mensaje, negocio, sucursal, suscripcion, usuario, usuarioSucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import type { Env } from '../config/env.validation';
import { CorreoAuthService } from '../correo/correo-auth.service';
import { TokenAccionService } from '../correo/token-accion.service';
import { tokenAccion } from '../db/schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';
import { PlanService } from '../plans/plan.service';
import { EquipoService } from './equipo.service';
import { InvitacionEspecialistaService } from './invitacion-especialista.service';

/** Doble del estado de mensajería: decide la ruta del celular (D5). */
const estadoFalso = (sinMensajes: boolean) => ({ sinMensajes: () => sinMensajes }) as unknown as MensajeriaEstadoService;


/**
 * Doble MÍNIMO del encolado de correos: escribe la fila del outbox igual que el
 * real (es de donde el spec extrae el token del enlace), sin arrastrar el resto
 * de dependencias de NotificacionesService. Se inserta ya `enviado` a propósito:
 * una fila `pendiente` la reclamaría el worker de otra suite corriendo en
 * paralelo y le descuadraría los conteos de su mock.
 */
/** Celulares a los que salió el mensaje de prueba (sin OTP). */
const bienvenidas: string[] = [];

const notificacionesFalsas = {
  encolarBienvenidaEspecialista: async (_negocioId: string, telefono: string) => {
    bienvenidas.push(telefono);
  },
  encolarEmailAcceso: async (opts: { negocioId?: string | null; email: string; asunto: string; cuerpo: string; html?: string; tipo: string }) => {
    await adminDb.insert(mensaje).values({
      negocioId: opts.negocioId ?? null,
      canal: 'email',
      cupoCanal: 'email',
      tipo: opts.tipo,
      destino: opts.email,
      asunto: opts.asunto,
      cuerpo: opts.cuerpo,
      cuerpoHtml: opts.html ?? null,
      estado: 'enviado',
    });
  },
  encolarAviso: async () => {},
} as unknown as NotificacionesService;

describe('Invitación de especialistas por correo (Plan-Correo E5, D4)', () => {
  const NOMBRE = 'Negocio INVIT TEST';
  let negocioId: string;
  let sucursalId: string;
  let ctx: TenantContext;
  let servicio: InvitacionEspecialistaService;
  let tokens: TokenAccionService;
  let n = 0;
  const email = () => `invit-spec-${++n}@orkalis-test.local`;

  function construir(sinMensajes: boolean): InvitacionEspecialistaService {
    const config = { get: (k: string) => (k === 'CORS_ORIGIN' ? 'http://localhost:5173' : undefined) } as unknown as ConfigService<Env, true>;
    const correo = new CorreoAuthService(tokens, notificacionesFalsas, config);
    const equipo = new EquipoService(new PlanService(), notificacionesFalsas);
    return new InvitacionEspecialistaService(equipo, correo, tokens, notificacionesFalsas, estadoFalso(sinMensajes));
  }

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    // Cupo holgado: estas pruebas crean bastantes fichas y ninguna quiere
    // chocar con el límite del plan (eso se prueba aparte, con su propio negocio).
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 30 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    ctx = { negocioId, sucursalIds: null, rol: RolUsuario.Admin };
    tokens = new TokenAccionService();
    servicio = construir(false);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  const invitar = (extra: Record<string, unknown> = {}) =>
    servicio.invitar(ctx, { nombre: 'Laura', email: email(), sucursalIds: [sucursalId], ...extra });

  /** Token del enlace del último correo encolado a ese destino. */
  async function tokenDelCorreo(destino: string): Promise<string> {
    const [m] = await adminDb
      .select({ cuerpo: mensaje.cuerpo })
      .from(mensaje)
      .where(eq(mensaje.destino, destino))
      .orderBy(desc(mensaje.creadoEn))
      .limit(1);
    const match = /token=([A-Za-z0-9_-]+)/.exec(m?.cuerpo ?? '');
    expect(match).not.toBeNull();
    return match![1];
  }

  it('invitar crea el especialista YA (sin login ni teléfono) y encola el correo', async () => {
    const destino = email();
    const esp = await servicio.invitar(ctx, { nombre: 'Laura', apellidos: 'Gómez', email: destino, sucursalIds: [sucursalId] });

    expect(esp.usuarioId).toBeNull();
    expect(esp.telefono).toBeNull();
    expect(esp.invitacionEmail).toBe(destino);

    const token = await tokenDelCorreo(destino);
    expect(token.length).toBeGreaterThan(20);
    const pendientes = await servicio.pendientes(ctx);
    expect(pendientes.some((p) => p.especialistaId === esp.id && p.email === destino)).toBe(true);
  });

  it('un correo con cuenta existente → 409 y NO crea especialista', async () => {
    const destino = email();
    await adminDb.insert(usuario).values({ negocioId, nombre: 'Ya Existe', email: destino, passwordHash: 'x', rol: RolUsuario.Admin });
    const antes = (await adminDb.select().from(especialista).where(eq(especialista.negocioId, negocioId))).length;

    await expect(invitar({ email: destino })).rejects.toMatchObject({ status: 409 });
    const despues = (await adminDb.select().from(especialista).where(eq(especialista.negocioId, negocioId))).length;
    expect(despues).toBe(antes);
  });

  it('activar crea el usuario especialista con la contraseña que ÉL eligió (nunca en claro)', async () => {
    const destino = email();
    const esp = await invitar({ email: destino });
    const token = await tokenDelCorreo(destino);

    const info = await servicio.info(token);
    expect(info).toMatchObject({ estado: 'valida', nombre: 'Laura', negocio: NOMBRE, email: destino });

    const r = await servicio.activar(token, 'ClaveDeLaura9');
    expect(r.ok).toBe(true);

    const [u] = await adminDb.select().from(usuario).where(eq(usuario.email, destino));
    expect(u.rol).toBe(RolUsuario.Especialista);
    expect(u.passwordHash).not.toBe('ClaveDeLaura9');
    expect(await argon2.verify(u.passwordHash, 'ClaveDeLaura9')).toBe(true);
    expect(u.emailVerificadoEn).toBeInstanceOf(Date);

    const [espFinal] = await adminDb.select().from(especialista).where(eq(especialista.id, esp.id));
    expect(espFinal.usuarioId).toBe(u.id);
    const alcance = await adminDb.select().from(usuarioSucursal).where(eq(usuarioSucursal.usuarioId, u.id));
    expect(alcance.map((a) => a.sucursalId)).toEqual([sucursalId]);
  });

  it('la invitación es de un solo uso: el segundo activar → 409 y la info dice "usada"', async () => {
    const destino = email();
    await invitar({ email: destino });
    const token = await tokenDelCorreo(destino);

    // Diagnóstico de flake (corridas paralelas): si esto falla, el token ya
    // nació inválido — el problema está en crear/extraer, no en el doble uso.
    expect((await servicio.info(token)).estado).toBe('valida');

    await servicio.activar(token, 'Password123');
    await expect(servicio.activar(token, 'OtraClave456')).rejects.toMatchObject({ status: 409 });
    expect(await servicio.info(token)).toEqual({ estado: 'usada' });
  });

  it('una invitación vencida no activa nada', async () => {
    const destino = email();
    await invitar({ email: destino });
    const token = await tokenDelCorreo(destino);
    await adminDb.update(tokenAccion).set({ expiraEn: new Date(Date.now() - 1000) }).where(eq(tokenAccion.email, destino));

    expect(await servicio.info(token)).toEqual({ estado: 'invalida' });
    await expect(servicio.activar(token, 'Password123')).rejects.toMatchObject({ status: 400 });
  });

  it('el especialista registra SU celular: se guarda normalizado, queda habilitado y recibe el mensaje de prueba (sin OTP)', async () => {
    const destino = email();
    const esp = await invitar({ email: destino });
    await servicio.activar(await tokenDelCorreo(destino), 'Password123');
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.email, destino));
    const ctxEsp: TenantContext = { negocioId, sucursalIds: [sucursalId], rol: RolUsuario.Especialista, usuarioId: u.id };

    await servicio.miTelefonoIniciar(ctxEsp, '300 111 2233');
    const [fila] = await adminDb.select().from(especialista).where(eq(especialista.id, esp.id));
    expect(fila.telefono).toBe('+573001112233'); // normalizado a E.164
    expect(fila.telefonoVerificadoEn).toBeInstanceOf(Date); // habilitado desde ya, sin código
    expect(bienvenidas).toContain('+573001112233'); // le llegó el mensaje de prueba
  });

  it('con la mensajería pausada, iniciar el celular responde SIN_MENSAJERIA y no gasta SMS (D5)', async () => {
    const destino = email();
    await invitar({ email: destino });
    await servicio.activar(await tokenDelCorreo(destino), 'Password123');
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.email, destino));
    const ctxEsp: TenantContext = { negocioId, sucursalIds: [sucursalId], rol: RolUsuario.Especialista, usuarioId: u.id };

    const pausado = construir(true);
    const enviosAntes = bienvenidas.length;
    await expect(pausado.miTelefonoIniciar(ctxEsp, '3009998877')).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ codigo: 'SIN_MENSAJERIA' }),
    });
    expect(bienvenidas.length).toBe(enviosAntes);
  });

  it('reenviar respeta el cooldown y regenera el enlace (el viejo muere)', async () => {
    const destino = email();
    const esp = await invitar({ email: destino });
    const tokenViejo = await tokenDelCorreo(destino);

    await expect(servicio.reenviar(ctx, esp.id)).rejects.toMatchObject({ status: 429 });
    await adminDb.update(tokenAccion).set({ ultimoEnvio: new Date(Date.now() - 61_000) }).where(eq(tokenAccion.email, destino));
    await servicio.reenviar(ctx, esp.id);

    expect(await servicio.info(tokenViejo)).toEqual({ estado: 'invalida' });
    const tokenNuevo = await tokenDelCorreo(destino);
    expect((await servicio.info(tokenNuevo)).estado).toBe('valida');
  });

  it('invitarExistente cubre a los creados solo con nombre (asistente de alta)', async () => {
    const equipo = new EquipoService(new PlanService(), notificacionesFalsas);
    const esp = await equipo.crear(ctx, 'Solo Nombre', undefined, [sucursalId]);
    const destino = email();

    await servicio.invitarExistente(ctx, esp.id, destino);
    const token = await tokenDelCorreo(destino);
    await servicio.activar(token, 'Password123');

    await expect(servicio.invitarExistente(ctx, esp.id, email())).rejects.toMatchObject({ status: 409 });
  });

  it('"Yo también atiendo" (E8): la ficha se enlaza al usuario en sesión, sin invitación', async () => {
    const destino = email();
    const [admin] = await adminDb
      .insert(usuario)
      .values({ negocioId, nombre: 'Dueña Que Atiende', email: destino, passwordHash: 'x', rol: RolUsuario.Admin })
      .returning();
    const ctxAdmin: TenantContext = { negocioId, sucursalIds: null, rol: RolUsuario.Admin, usuarioId: admin.id };
    const equipo = new EquipoService(new PlanService(), notificacionesFalsas);

    const ficha = await equipo.crearMiFicha(ctxAdmin, { especialidad: 'Colorista', sucursalIds: [sucursalId] });
    expect(ficha.usuarioId).toBe(admin.id);
    expect(ficha.nombre).toBe('Dueña Que Atiende'); // por defecto, el nombre de su cuenta

    // No hubo correo: su cuenta ya existe (no hay nada que invitar).
    const [correo] = await adminDb.select().from(mensaje).where(eq(mensaje.destino, destino));
    expect(correo).toBeUndefined();

    // Una segunda ficha para el mismo usuario no tiene sentido → 409.
    await expect(equipo.crearMiFicha(ctxAdmin, { sucursalIds: [sucursalId] })).rejects.toMatchObject({ status: 409 });

    // Y puede registrar SU celular con el endpoint `mi/*` siendo admin.
    await servicio.miTelefonoIniciar(ctxAdmin, '3015556677');
    const [conTel] = await adminDb.select().from(especialista).where(eq(especialista.id, ficha.id));
    expect(conTel.telefono).toBe('+573015556677');
    expect(conTel.telefonoVerificadoEn).toBeInstanceOf(Date);
  });

  it('"Este soy yo" (E8): vincula un especialista ya creado y cancela su invitación pendiente', async () => {
    const destinoAdmin = email();
    const [admin] = await adminDb
      .insert(usuario)
      .values({ negocioId, nombre: 'Dueño Tardío', email: destinoAdmin, passwordHash: 'x', rol: RolUsuario.Admin })
      .returning();
    const ctxAdmin: TenantContext = { negocioId, sucursalIds: null, rol: RolUsuario.Admin, usuarioId: admin.id };

    // Ficha creada aparte, con una invitación en el aire.
    const destinoInvitacion = email();
    const esp = await servicio.invitar(ctx, { nombre: 'En Realidad Soy Yo', email: destinoInvitacion, sucursalIds: [sucursalId] });
    const token = await tokenDelCorreo(destinoInvitacion);

    await servicio.vincularMiCuenta(ctxAdmin, esp.id);
    const [fila] = await adminDb.select().from(especialista).where(eq(especialista.id, esp.id));
    expect(fila.usuarioId).toBe(admin.id);

    // La invitación pendiente murió: activarla ya no crea nada.
    expect(await servicio.info(token)).toEqual({ estado: 'invalida' });
    await expect(servicio.activar(token, 'Password123')).rejects.toMatchObject({ status: 400 });

    // Ni doble vínculo del especialista, ni segunda ficha para la misma cuenta.
    await expect(servicio.vincularMiCuenta(ctxAdmin, esp.id)).rejects.toMatchObject({ status: 409 });
    const otro = await servicio.invitar(ctx, { nombre: 'Otra Persona', email: email(), sucursalIds: [sucursalId] });
    await expect(servicio.vincularMiCuenta(ctxAdmin, otro.id)).rejects.toMatchObject({ status: 409 });
  });

  it('sin cupo del plan, invitar no crea ni envía nada', async () => {
    // Negocio aparte con cupo mínimo: Pro incluye 2 y ya se pagan solo 2.
    const [neg] = await adminDb.insert(negocio).values({ nombre: `${NOMBRE} CUPO`, perfil: PerfilNegocio.Barberia }).returning();
    await adminDb.insert(suscripcion).values({ negocioId: neg.id, plan: PlanSuscripcion.Pro, numEspecialistas: 2 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId: neg.id, nombre: 'Sede' }).returning();
    const ctx2: TenantContext = { negocioId: neg.id, sucursalIds: null, rol: RolUsuario.Admin };

    await servicio.invitar(ctx2, { nombre: 'Uno', email: email(), sucursalIds: [suc.id] });
    await servicio.invitar(ctx2, { nombre: 'Dos', email: email(), sucursalIds: [suc.id] });
    const destino = email();
    await expect(servicio.invitar(ctx2, { nombre: 'Tres', email: destino, sucursalIds: [suc.id] })).rejects.toMatchObject({ status: 403 });

    const [correoTres] = await adminDb.select().from(mensaje).where(eq(mensaje.destino, destino));
    expect(correoTres).toBeUndefined();
    await adminDb.delete(negocio).where(eq(negocio.id, neg.id));
  });
});
