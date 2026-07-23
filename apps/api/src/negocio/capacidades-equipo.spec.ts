import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoCita, OrigenCita, PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import {
  cita,
  citaServicio,
  cliente,
  disponibilidad,
  especialista,
  especialistaServicio,
  especialistaSucursal,
  negocio,
  servicio,
  sucursal,
  suscripcion,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { runInTenantTx } from '../db/tx';
import { PlanService } from '../plans/plan.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EquipoService } from './equipo.service';
import { filtrarPorServicios, realizaServicios } from '../agendamiento/validators/capacidades';

/**
 * Qué servicios realiza cada especialista y qué pasa con las citas cuando alguien
 * se va. Lo que se protege aquí es que la restricción sea OPCIONAL (sin declarar
 * nada, se realiza todo) y que dar de baja nunca deje citas huérfanas.
 */
describe('Capacidades del especialista y baja en cascada', () => {
  const NOMBRE = 'Negocio CAPACIDADES TEST';
  let negocioId: string;
  let sucursalId: string;
  let corteId: string;
  let tinteId: string;
  let ctx: TenantContext;
  let equipo: EquipoService;
  /** Avisos encolados durante la prueba (para comprobar que se avisa al cliente). */
  const avisos: string[] = [];

  /** Crea un especialista con sus sedes y, si se indican, sus servicios. */
  async function crearEsp(nombre: string, servicioIds?: string[]): Promise<string> {
    const e = await equipo.crear(ctx, nombre, undefined, [sucursalId], { servicioIds });
    return e.id;
  }

  /** Siembra una cita futura confirmada para un especialista. */
  async function citaFutura(especialistaId: string, servicioId: string, enHoras: number): Promise<string> {
    const inicio = new Date(Date.now() + enHoras * 3600_000);
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId,
        sucursalId,
        especialistaId,
        inicio,
        fin: new Date(inicio.getTime() + 30 * 60_000),
        estado: EstadoCita.Confirmada,
        origen: OrigenCita.CreacionInterna,
      })
      .returning();
    await adminDb.insert(citaServicio).values({ citaId: c.id, servicioId, precioAplicado: '20000.00' });
    return c.id;
  }

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    // Cupo holgado: la suite crea muchos especialistas y el cupo del plan no es
    // lo que se está probando aquí.
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 100 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [corte] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '20000.00', duracionMin: 30 })
      .returning();
    corteId = corte.id;
    const [tinte] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Tinte', precio: '60000.00', duracionMin: 60 })
      .returning();
    tinteId = tinte.id;

    ctx = { negocioId, sucursalIds: null, rol: RolUsuario.Admin };
    const notiSpy = {
      encolarAviso: async (_n: string, tel: string) => {
        avisos.push(tel);
      },
    } as unknown as NotificacionesService;
    equipo = new EquipoService(new PlanService(), notiSpy);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  // ── La regla por defecto (D2) ──────────────────────────────────────────────

  it('sin servicios declarados, el especialista realiza TODOS', async () => {
    const id = await crearEsp('Comodín');
    await runInTenantTx(ctx, async (tx) => {
      expect(await realizaServicios(tx, id, [corteId])).toBe(true);
      expect(await realizaServicios(tx, id, [corteId, tinteId])).toBe(true);
    });
    const lista = await equipo.listar(ctx);
    expect(lista.find((e) => e.id === id)!.servicioIds).toEqual([]);
  });

  it('con servicios declarados, solo realiza esos', async () => {
    const id = await crearEsp('Solo cortes', [corteId]);
    await runInTenantTx(ctx, async (tx) => {
      expect(await realizaServicios(tx, id, [corteId])).toBe(true);
      expect(await realizaServicios(tx, id, [tinteId])).toBe(false);
      // Un combo exige TODOS: basta que falte uno para quedar fuera.
      expect(await realizaServicios(tx, id, [corteId, tinteId])).toBe(false);
    });
    const lista = await equipo.listar(ctx);
    expect(lista.find((e) => e.id === id)!.servicioIds).toEqual([corteId]);
  });

  it('asignar una lista vacía devuelve al estado "realiza todos"', async () => {
    const id = await crearEsp('Vuelve a todo', [corteId]);
    await equipo.asignarServicios(ctx, id, []);
    await runInTenantTx(ctx, async (tx) => {
      expect(await realizaServicios(tx, id, [tinteId])).toBe(true);
    });
  });

  it('filtrarPorServicios deja pasar a los no restringidos y descarta a los que no pueden', async () => {
    const comodin = await crearEsp('Filtro comodín');
    const soloCorte = await crearEsp('Filtro corte', [corteId]);
    await runInTenantTx(ctx, async (tx) => {
      const aptos = await filtrarPorServicios(tx, [comodin, soloCorte], [tinteId]);
      expect(aptos).toEqual([comodin]);
      const ambos = await filtrarPorServicios(tx, [comodin, soloCorte], [corteId]);
      expect(ambos.sort()).toEqual([comodin, soloCorte].sort());
    });
  });

  it('un servicio de otro negocio no se puede asignar', async () => {
    const id = await crearEsp('Ajeno');
    const [otro] = await adminDb.insert(negocio).values({ nombre: `${NOMBRE} OTRO`, perfil: PerfilNegocio.Salon }).returning();
    const [servAjeno] = await adminDb
      .insert(servicio)
      .values({ negocioId: otro.id, nombre: 'Ajeno', precio: '1.00', duracionMin: 10 })
      .returning();
    await expect(equipo.asignarServicios(ctx, id, [servAjeno.id])).rejects.toThrow();
    await adminDb.delete(negocio).where(eq(negocio.id, otro.id));
  });

  it('un servicio desactivado deja de contarse como capacidad', async () => {
    const id = await crearEsp('Con servicio muerto', [corteId, tinteId]);
    await adminDb.update(servicio).set({ activo: false }).where(eq(servicio.id, tinteId));
    const lista = await equipo.listar(ctx);
    expect(lista.find((e) => e.id === id)!.servicioIds).toEqual([corteId]);
    await adminDb.update(servicio).set({ activo: true }).where(eq(servicio.id, tinteId));
  });

  // ── Baja con citas futuras (D7) ────────────────────────────────────────────

  it('sin citas futuras, la baja es directa', async () => {
    const id = await crearEsp('Se va limpio');
    const r = await equipo.darDeBaja(ctx, id);
    expect(r).toEqual({ reasignadas: 0, canceladas: 0 });
    const [e] = await adminDb.select({ activo: especialista.activo }).from(especialista).where(eq(especialista.id, id));
    expect(e.activo).toBe(false);
  });

  it('con citas futuras y sin acción, la baja se rechaza con el conteo', async () => {
    const id = await crearEsp('Tiene agenda');
    await citaFutura(id, corteId, 48);
    await expect(equipo.darDeBaja(ctx, id)).rejects.toMatchObject({
      response: { citasFuturas: 1 },
    });
    // Y NO se dio de baja: el rechazo debe ser inocuo.
    const [e] = await adminDb.select({ activo: especialista.activo }).from(especialista).where(eq(especialista.id, id));
    expect(e.activo).toBe(true);
  });

  it('las citas PASADAS no cuentan ni bloquean la baja', async () => {
    const id = await crearEsp('Solo pasado');
    const inicio = new Date(Date.now() - 72 * 3600_000);
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId, sucursalId, especialistaId: id, inicio,
        fin: new Date(inicio.getTime() + 30 * 60_000),
        estado: EstadoCita.Completada, origen: OrigenCita.CreacionInterna,
      })
      .returning();
    await adminDb.insert(citaServicio).values({ citaId: c.id, servicioId: corteId, precioAplicado: '20000.00' });
    expect((await equipo.citasFuturas(ctx, id)).total).toBe(0);
    await expect(equipo.darDeBaja(ctx, id)).resolves.toEqual({ reasignadas: 0, canceladas: 0 });
  });

  it('acción "reasignar": mueve la cita a alguien capacitado', async () => {
    const saliente = await crearEsp('Saliente', [corteId]);
    await crearEsp('Relevo', [corteId]);
    const citaId = await citaFutura(saliente, corteId, 72);

    const r = await equipo.darDeBaja(ctx, saliente, 'reasignar');
    expect(r.reasignadas).toBe(1);
    expect(r.canceladas).toBe(0);
    const [c] = await adminDb.select({ esp: cita.especialistaId, estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(c.esp).not.toBe(saliente);
    expect(c.estado).toBe(EstadoCita.Confirmada); // sigue viva
  });

  it('acción "reasignar" sin nadie capacitado: cancela y avisa al cliente', async () => {
    // Sede aparte donde es el ÚNICO: así no hay relevo posible (los candidatos
    // se buscan siempre dentro de la sucursal de la cita).
    const [sedeSola] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede aislada' }).returning();
    const soloTinte = (await equipo.crear(ctx, 'Único tinte', undefined, [sedeSola.id], { servicioIds: [tinteId] })).id;
    const [cli] = await adminDb
      .insert(cliente)
      .values({ negocioId, nombre: 'Cliente Tinte', telefono: '+573001112233' })
      .returning();
    const inicio = new Date(Date.now() + 96 * 3600_000);
    const [cSola] = await adminDb.insert(cita).values({
      negocioId, sucursalId: sedeSola.id, especialistaId: soloTinte, inicio,
      fin: new Date(inicio.getTime() + 60 * 60_000),
      estado: EstadoCita.Confirmada, origen: OrigenCita.CreacionInterna, clienteId: cli.id,
    }).returning();
    const citaId = cSola.id;
    await adminDb.insert(citaServicio).values({ citaId, servicioId: tinteId, precioAplicado: '60000.00' });
    avisos.length = 0;

    const r = await equipo.darDeBaja(ctx, soloTinte, 'reasignar');
    expect(r.reasignadas).toBe(0);
    expect(r.canceladas).toBe(1);
    const [c] = await adminDb.select({ estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(c.estado).toBe(EstadoCita.Cancelada);
    expect(avisos).toContain('+573001112233'); // al cliente SÍ se le avisa
  });

  it('acción "cancelar": cancela todas las futuras', async () => {
    const id = await crearEsp('Cancelador', [corteId]);
    await crearEsp('Podría cubrir', [corteId]); // existe relevo, pero se pidió cancelar
    const citaId = await citaFutura(id, corteId, 120);

    const r = await equipo.darDeBaja(ctx, id, 'cancelar');
    expect(r.canceladas).toBe(1);
    expect(r.reasignadas).toBe(0);
    const [c] = await adminDb.select({ estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(c.estado).toBe(EstadoCita.Cancelada);
  });

  it('quitar un servicio NO toca las citas ya agendadas', async () => {
    const id = await crearEsp('Pierde servicio', [corteId, tinteId]);
    const citaId = await citaFutura(id, tinteId, 144);
    await equipo.asignarServicios(ctx, id, [corteId]); // ya no hace Tinte
    const [c] = await adminDb.select({ estado: cita.estado, esp: cita.especialistaId }).from(cita).where(eq(cita.id, citaId));
    expect(c.estado).toBe(EstadoCita.Confirmada);
    expect(c.esp).toBe(id);
  });

  it('citasFuturas devuelve el detalle para el aviso al admin', async () => {
    const id = await crearEsp('Con detalle', [corteId]);
    await citaFutura(id, corteId, 168);
    const r = await equipo.citasFuturas(ctx, id);
    expect(r.total).toBe(1);
    expect(r.muestra[0].servicios).toContain('Corte');
  });

  it('el alta con verificación conserva los servicios del borrador', async () => {
    // `crear` es el punto donde aterriza el borrador jsonb de la verificación.
    const e = await equipo.crear(ctx, 'Desde borrador', undefined, [sucursalId], { servicioIds: [tinteId] });
    const lista = await equipo.listar(ctx);
    expect(lista.find((x) => x.id === e.id)!.servicioIds).toEqual([tinteId]);
    // Y el horario por defecto se creó igual (no se rompió el alta).
    const disp = await adminDb.select().from(disponibilidad).where(eq(disponibilidad.especialistaId, e.id));
    expect(disp.length).toBeGreaterThan(0);
    // La relación queda enlazada a la sede, como el resto del alta.
    const sedes = await adminDb.select().from(especialistaSucursal).where(eq(especialistaSucursal.especialistaId, e.id));
    expect(sedes).toHaveLength(1);
    const caps = await adminDb.select().from(especialistaServicio).where(eq(especialistaServicio.especialistaId, e.id));
    expect(caps).toHaveLength(1);
  });
});
