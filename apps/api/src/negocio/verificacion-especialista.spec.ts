import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { especialista, negocio, sucursal, suscripcion, usuario, verificacionEspecialista } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PlanService } from '../plans/plan.service';
import { EquipoService } from './equipo.service';
import { VerificacionEspecialistaService } from './verificacion-especialista.service';
import { RemitenteResolver } from '../notificaciones/remitente/remitente.resolver';
import { CODIGO_VERIFY_MOCK, MockVerifyAdapter } from '../notificaciones/verify/mock-verify.adapter';
import type { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';

/**
 * Doble del estado de mensajería. `sinMensajes()` es lo único que consulta el
 * servicio, y decide entre las dos rutas del alta: código por Verify (false) o
 * código local mostrado en pantalla (true).
 */
const estadoFalso = (sinMensajes: boolean) =>
  ({ sinMensajes: () => sinMensajes }) as unknown as MensajeriaEstadoService;

/** Verify mock que además cuenta los envíos (para probar cooldown/reenvíos). */
class VerifySpy extends MockVerifyAdapter {
  envios: string[] = [];
  override async start(to: string, canal: 'sms' | 'whatsapp'): Promise<void> {
    this.envios.push(to);
    await super.start(to, canal);
  }
}

describe('Alta de especialista con celular verificado (FASE-06, D3)', () => {
  const NOMBRE = 'Negocio VERIF TEST';
  let negocioId: string;
  let sucursalId: string;
  let ctx: TenantContext;
  let servicio: VerificacionEspecialistaService;
  let verify: VerifySpy;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    // Plan con cupo holgado para no chocar con el límite en las pruebas felices.
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 10 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    ctx = { negocioId, sucursalIds: null, rol: RolUsuario.Admin };

    verify = new VerifySpy();
    const remitente = new RemitenteResolver({ get: () => undefined } as never);
    // Estado de mensajería FIJO en "hay mensajes": este bloque prueba la ruta de
    // Twilio Verify. Con el servicio real, `sinMensajes()` depende de que existan
    // claves TWILIO_* en el entorno, así que las pruebas pasaban o fallaban según
    // el `.env` de cada máquina (y en CI, que no las define, fallaban siempre).
    // La ruta contraria —código local en pantalla— se prueba más abajo.
    servicio = new VerificacionEspecialistaService(new EquipoService(new PlanService(), { encolarAviso: async () => {} } as unknown as NotificacionesService), remitente, verify, estadoFalso(false));
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  const iniciar = (extra: Record<string, unknown> = {}) =>
    servicio.iniciar(ctx, { nombre: 'Laura', celular: '3001112233', sucursalIds: [sucursalId], ...extra });

  it('iniciar NO crea el especialista todavía: solo el borrador + envío del código', async () => {
    const antes = (await adminDb.select().from(especialista).where(eq(especialista.negocioId, negocioId))).length;
    const { verificacionId, expiraEn } = await iniciar();

    expect(antes).toBe(0);
    const [fila] = await adminDb.select().from(verificacionEspecialista).where(eq(verificacionEspecialista.id, verificacionId));
    expect(fila.estado).toBe('pendiente');
    expect(fila.telefono).toBe('+573001112233'); // normalizado a E.164
    expect(expiraEn.getTime()).toBeGreaterThan(Date.now());
    expect(verify.envios.at(-1)).toBe('+573001112233');

    const despues = await adminDb.select().from(especialista).where(eq(especialista.negocioId, negocioId));
    expect(despues).toHaveLength(0); // sigue sin existir hasta confirmar
  });

  it('rechaza un celular que no es móvil colombiano antes de gastar el SMS', async () => {
    const envios = verify.envios.length;
    await expect(iniciar({ celular: '6012345678' })).rejects.toThrow(/móvil colombiano/i);
    expect(verify.envios.length).toBe(envios); // no se envió nada
  });

  it('código incorrecto no crea nada y descuenta intentos', async () => {
    const { verificacionId } = await iniciar();
    await expect(servicio.confirmar(ctx, verificacionId, '000000')).rejects.toThrow(/incorrecto.*4 intentos/i);

    const [fila] = await adminDb.select().from(verificacionEspecialista).where(eq(verificacionEspecialista.id, verificacionId));
    expect(fila.intentos).toBe(1);
    expect(fila.estado).toBe('pendiente');
  });

  it('a los 5 intentos fallidos la verificación se cancela y ya no admite el código bueno', async () => {
    const { verificacionId } = await iniciar();
    for (let i = 0; i < 5; i++) {
      await expect(servicio.confirmar(ctx, verificacionId, '000000')).rejects.toThrow();
    }
    const [fila] = await adminDb.select().from(verificacionEspecialista).where(eq(verificacionEspecialista.id, verificacionId));
    expect(fila.estado).toBe('cancelado');

    await expect(servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK)).rejects.toThrow(/cancelada/i);
  });

  it('código correcto crea el especialista con el teléfono ya verificado', async () => {
    const { verificacionId } = await iniciar({ nombre: 'Marta', apellidos: 'Ríos', especialidad: 'Color' });
    const creado = await servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK);

    expect(creado.nombre).toBe('Marta');
    expect(creado.apellidos).toBe('Ríos');
    expect(creado.telefono).toBe('+573001112233');
    expect(creado.telefonoVerificadoEn).not.toBeNull();
    expect(creado.activo).toBe(true);

    const [fila] = await adminDb.select().from(verificacionEspecialista).where(eq(verificacionEspecialista.id, verificacionId));
    expect(fila.estado).toBe('verificado');
  });

  it('confirmar dos veces no duplica el especialista (doble clic)', async () => {
    const { verificacionId } = await iniciar({ nombre: 'Unico' });
    await servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK);
    await expect(servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK)).rejects.toThrow(/ya se completó/i);

    const filas = await adminDb.select().from(especialista).where(eq(especialista.nombre, 'Unico'));
    expect(filas).toHaveLength(1);
  });

  it('la contraseña del login NUNCA se guarda en claro en el borrador', async () => {
    const { verificacionId } = await iniciar({
      nombre: 'ConLogin',
      email: `verif-${Date.now()}@orkalis.test`,
      password: 'secreto-larguisimo-123',
    });
    const [fila] = await adminDb.select().from(verificacionEspecialista).where(eq(verificacionEspecialista.id, verificacionId));
    const borrador = JSON.stringify(fila.datosBorrador);
    expect(borrador).not.toContain('secreto-larguisimo-123');
    expect(borrador).toContain('$argon2');

    // Y el login creado funciona con ese hash (se reutiliza, no se re-hashea).
    const creado = await servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK);
    expect(creado.usuarioId).not.toBeNull();
    const [u] = await adminDb.select().from(usuario).where(eq(usuario.id, creado.usuarioId!));
    expect(u.passwordHash).toBe((fila.datosBorrador as { passwordHash: string }).passwordHash);
  });

  it('reenviar respeta el cooldown de 30 s', async () => {
    const { verificacionId } = await iniciar({ nombre: 'Cooldown' });
    await expect(servicio.reenviar(ctx, verificacionId)).rejects.toThrow(/Espera \d+ s/);
  });

  it('una verificación expirada no sirve, aunque el código sea correcto', async () => {
    const { verificacionId } = await iniciar({ nombre: 'Expirada' });
    await adminDb
      .update(verificacionEspecialista)
      .set({ expiraEn: new Date(Date.now() - 1000) })
      .where(eq(verificacionEspecialista.id, verificacionId));

    await expect(servicio.confirmar(ctx, verificacionId, CODIGO_VERIFY_MOCK)).rejects.toThrow(/expiró/i);
    expect(await servicio.expirarVencidas()).toBeGreaterThanOrEqual(1);
  });

  it('sin cupo del plan NO se envía el código (no se gasta un SMS en vano)', async () => {
    await adminDb.update(suscripcion).set({ numEspecialistas: 0 }).where(eq(suscripcion.negocioId, negocioId));
    const envios = verify.envios.length;
    await expect(iniciar({ nombre: 'SinCupo' })).rejects.toThrow(/cupo/i);
    expect(verify.envios.length).toBe(envios);
    await adminDb.update(suscripcion).set({ numEspecialistas: 10 }).where(eq(suscripcion.negocioId, negocioId));
  });

  it('en modo sin mensajes el código se genera en casa y se devuelve para verlo en pantalla', async () => {
    const sinSaldo = new VerificacionEspecialistaService(
      new EquipoService(new PlanService(), { encolarAviso: async () => {} } as unknown as NotificacionesService),
      new RemitenteResolver({ get: () => undefined } as never),
      verify,
      estadoFalso(true),
    );
    const envios = verify.envios.length;
    const { verificacionId, codigoVisible } = await sinSaldo.iniciar(ctx, {
      nombre: 'SinSaldo',
      celular: '3001112233',
      sucursalIds: [sucursalId],
    });

    expect(codigoVisible).toMatch(/^\d{6}$/);
    expect(verify.envios.length).toBe(envios); // no se tocó Verify: no hay SMS que mandar

    // El código de Verify no vale: aquí se comprueba contra el hash local.
    await expect(sinSaldo.confirmar(ctx, verificacionId, '000000')).rejects.toThrow(/incorrecto/i);
    const creado = await sinSaldo.confirmar(ctx, verificacionId, codigoVisible!);
    expect(creado.nombre).toBe('SinSaldo');
    expect(creado.telefonoVerificadoEn).not.toBeNull();
  });
});
