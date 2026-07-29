import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import {
  disponibilidad,
  especialista,
  especialistaSucursal,
  negocio,
  servicio,
  sucursal,
  sucursalDiaLaborable,
} from '../db/schema';
import { runInTenantTx } from '../db/tx';
import type { TenantContext } from '../db/tenant-context';
import { DisponibilidadService } from './disponibilidad.service';
import { HorarioService } from './horario.service';
import { ValidadorPublico } from './validators/validador-publico';

/**
 * Horario de atención de la SUCURSAL (base + excepción por día) y su efecto en
 * lo que el cliente final puede reservar.
 *
 * La propiedad que se protege es que **oferta y validación no se separen**: si
 * las franjas se generan con una regla y la reserva se valida con otra, el
 * cliente ve huecos que luego el servidor rechaza. Por eso cada caso comprueba
 * las dos caras.
 */
describe('Horario de la sucursal ↔ franjas reservables', () => {
  const NOMBRE = 'Negocio HORARIO SUCURSAL';

  /** Próximo miércoles (día 3) y próximo sábado (día 6), en hora Bogotá. */
  const proximo = (weekday: number): string => {
    const hoy = new Date(Date.now() - 5 * 3600_000);
    const delta = (weekday - hoy.getUTCDay() + 7) % 7 || 7;
    return new Date(hoy.getTime() + delta * 86400_000).toISOString().slice(0, 10);
  };
  const MIERCOLES = proximo(3);
  const SABADO = proximo(6);

  let negocioId: string;
  let sucursalId: string;
  let servicioId: string;
  let heredero: string; // sin ventanas propias → hereda el horario de la sede
  let propio: string; // con ventana propia 08:00–20:00
  let ctx: TenantContext;
  let dispo: DisponibilidadService;
  const validador = new ValidadorPublico();

  /** Minutos del día (hora Bogotá) del inicio de una franja ISO. */
  const minutosDe = (iso: string): number => {
    const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };

  /** Instante UTC para una fecha local Bogotá + 'HH:MM'. */
  const instante = (fechaIso: string, hhmm: string): Date => {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const [h, min] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (h * 60 + min + 5 * 60) * 60000);
  };

  /** ¿Deja el validador público entrar esta franja? */
  const aceptaReserva = async (fechaIso: string, desde: string, hasta: string, especialistaId: string) =>
    runInTenantTx(ctx, async (tx) => {
      try {
        await validador.validar(tx, {
          negocioId,
          sucursalId,
          especialistaId,
          inicio: instante(fechaIso, desde),
          fin: instante(fechaIso, hasta),
          validarServicios: false,
        });
        return true;
      } catch {
        return false;
      }
    });

  const fijarHorario = (base: { apertura: string; cierre: string } | null, dias: ({ apertura: string; cierre: string } | null)[]) =>
    new HorarioService().setHorario(ctx, sucursalId, { base, dias });

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [srv] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 })
      .returning();
    servicioId = srv.id;

    const [a] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Heredero' }).returning();
    heredero = a.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: heredero, sucursalId });

    const [b] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Propio' }).returning();
    propio = b.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: propio, sucursalId });
    await adminDb.insert(disponibilidad).values(
      [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        negocioId, sucursalId, especialistaId: propio, diaSemana: dia, horaInicio: '08:00:00', horaFin: '20:00:00',
      })),
    );

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    dispo = new DisponibilidadService(new HorarioService());
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('sin horario de sede, el especialista sin ventanas propias no tiene franjas (comportamiento anterior)', async () => {
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], MIERCOLES);
    expect(franjas).toEqual([]);
  });

  it('con horario de sede, quien no tiene ventanas propias lo hereda', async () => {
    await fijarHorario({ apertura: '09:00', cierre: '18:00' }, [null, null, null, null, null, null, null]);

    const franjas = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], MIERCOLES);
    expect(franjas.length).toBeGreaterThan(0);

    const minutos = franjas.map((f) => minutosDe(f.inicio));
    expect(Math.min(...minutos)).toBe(9 * 60);
    // La última franja de 30 min empieza a las 17:30 y termina justo al cerrar.
    expect(Math.max(...minutos)).toBe(17 * 60 + 30);

    expect(await aceptaReserva(MIERCOLES, '09:00', '09:30', heredero)).toBe(true);
    expect(await aceptaReserva(MIERCOLES, '08:00', '08:30', heredero)).toBe(false);
    expect(await aceptaReserva(MIERCOLES, '17:45', '18:15', heredero)).toBe(false);
  });

  it('el horario de la sede recorta la ventana propia del especialista', async () => {
    // El "Propio" atiende 08:00–20:00, pero la sede abre 09:00–18:00.
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, propio, [servicioId], MIERCOLES);
    const minutos = franjas.map((f) => minutosDe(f.inicio));
    expect(Math.min(...minutos)).toBe(9 * 60);
    expect(Math.max(...minutos)).toBe(17 * 60 + 30);

    expect(await aceptaReserva(MIERCOLES, '08:30', '09:00', propio)).toBe(false);
    expect(await aceptaReserva(MIERCOLES, '19:00', '19:30', propio)).toBe(false);
  });

  it('un día puede tener su propio horario: el sábado se cierra antes', async () => {
    const dias: ({ apertura: string; cierre: string } | null)[] = [null, null, null, null, null, null, null];
    dias[6] = { apertura: '10:00', cierre: '14:00' }; // sábado
    await fijarHorario({ apertura: '09:00', cierre: '18:00' }, dias);

    const sabado = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], SABADO);
    const minSab = sabado.map((f) => minutosDe(f.inicio));
    expect(Math.min(...minSab)).toBe(10 * 60);
    expect(Math.max(...minSab)).toBe(13 * 60 + 30);

    // El miércoles sigue con el horario base: la excepción es solo del sábado.
    const miercoles = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], MIERCOLES);
    expect(Math.min(...miercoles.map((f) => minutosDe(f.inicio)))).toBe(9 * 60);

    expect(await aceptaReserva(SABADO, '09:00', '09:30', heredero)).toBe(false);
    expect(await aceptaReserva(SABADO, '10:00', '10:30', heredero)).toBe(true);
  });

  it('un día cerrado manda sobre cualquier horario', async () => {
    await new HorarioService().setDiasLaborables(ctx, sucursalId, [true, true, true, true, true, true, false]);
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], SABADO);
    expect(franjas).toEqual([]);
    expect(await aceptaReserva(SABADO, '10:00', '10:30', heredero)).toBe(false);

    // Y al reabrirlo vuelve su horario propio, que no se perdió al cerrar.
    await new HorarioService().setDiasLaborables(ctx, sucursalId, [true, true, true, true, true, true, true]);
    const dedeVuelta = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], SABADO);
    expect(Math.min(...dedeVuelta.map((f) => minutosDe(f.inicio)))).toBe(10 * 60);
  });

  it('vaciar la excepción devuelve el día al horario base', async () => {
    await fijarHorario({ apertura: '09:00', cierre: '18:00' }, [null, null, null, null, null, null, null]);
    const franjas = await dispo.franjasPublicas(ctx, sucursalId, heredero, [servicioId], SABADO);
    expect(Math.min(...franjas.map((f) => minutosDe(f.inicio)))).toBe(9 * 60);

    const filas = await adminDb
      .select({ apertura: sucursalDiaLaborable.horaApertura })
      .from(sucursalDiaLaborable)
      .where(eq(sucursalDiaLaborable.sucursalId, sucursalId));
    expect(filas.every((f) => f.apertura === null)).toBe(true);
  });

  it('estrenar horario libera a quien tenía el 09:00–18:00 por defecto', async () => {
    // Un especialista dado de alta ANTES de que la sede tuviera horario: lleva
    // las ventanas fijas Lun–Sáb 09:00–18:00 que ponía `equipo.crear`.
    const [c] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Antiguo' }).returning();
    await adminDb.insert(especialistaSucursal).values({ especialistaId: c.id, sucursalId });
    await adminDb.insert(disponibilidad).values(
      [1, 2, 3, 4, 5, 6].map((dia) => ({
        negocioId, sucursalId, especialistaId: c.id, diaSemana: dia, horaInicio: '09:00', horaFin: '18:00',
      })),
    );

    // El negocio amplía a 07:00–21:00: si las ventanas viejas siguieran mandando,
    // la intersección lo dejaría clavado en 9–18 y el cambio no serviría de nada.
    await fijarHorario({ apertura: '07:00', cierre: '21:00' }, [null, null, null, null, null, null, null]);

    const franjas = await dispo.franjasPublicas(ctx, sucursalId, c.id, [servicioId], MIERCOLES);
    const minutos = franjas.map((f) => minutosDe(f.inicio));
    expect(Math.min(...minutos)).toBe(7 * 60);
    expect(Math.max(...minutos)).toBe(20 * 60 + 30);
    expect(await aceptaReserva(MIERCOLES, '07:00', '07:30', c.id)).toBe(true);

    // Y se restablece el horario del resto de la prueba.
    await fijarHorario({ apertura: '09:00', cierre: '18:00' }, [null, null, null, null, null, null, null]);
  });

  it('rechaza horarios imposibles', async () => {
    await expect(fijarHorario({ apertura: '19:00', cierre: '09:00' }, [null, null, null, null, null, null, null]))
      .rejects.toThrow(/cerrar después de abrir/);
    await expect(fijarHorario(null, [null, null, null, null, null, null, { apertura: '10:00', cierre: '14:00' }]))
      .rejects.toThrow(/horario base/);
  });
});
