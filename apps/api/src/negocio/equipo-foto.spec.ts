import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { especialista, especialistaFoto, negocio, suscripcion } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { PlanService } from '../plans/plan.service';
import { EquipoService } from './equipo.service';

/** PNG de 1x1 real (el más pequeño válido), en data URL. */
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Foto del especialista', () => {
  const NOMBRE = 'Negocio FOTO TEST';
  const OTRO = 'Negocio FOTO AJENO';
  let negocioId: string;
  let ajenoId: string;
  let espId: string;
  let espAjenoId: string;
  let ctx: TenantContext;
  let equipo: EquipoService;

  beforeAll(async () => {
    for (const n of [NOMBRE, OTRO]) await adminDb.delete(negocio).where(eq(negocio.nombre, n));

    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 5 });
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Laura' }).returning();
    espId = esp.id;

    const [otro] = await adminDb.insert(negocio).values({ nombre: OTRO, perfil: PerfilNegocio.Salon }).returning();
    ajenoId = otro.id;
    const [espAjeno] = await adminDb.insert(especialista).values({ negocioId: ajenoId, nombre: 'Ajeno' }).returning();
    espAjenoId = espAjeno.id;

    ctx = { negocioId, sucursalIds: null, rol: RolUsuario.Admin };
    equipo = new EquipoService(new PlanService());
  });

  afterAll(async () => {
    for (const n of [NOMBRE, OTRO]) await adminDb.delete(negocio).where(eq(negocio.nombre, n));
    await adminClient.end();
    await client.end();
  });

  it('guarda la foto y la devuelve con su mime', async () => {
    const { fotoVersion } = await equipo.guardarFoto(ctx, espId, PNG_1X1);
    expect(new Date(fotoVersion).getTime()).toBeLessThanOrEqual(Date.now());

    const f = await equipo.leerFoto(espId);
    expect(f!.mime).toBe('image/png');
    expect(f!.datos.length).toBeGreaterThan(0);
    // Los bytes vuelven idénticos a los que se subieron.
    expect(f!.datos.toString('base64')).toBe(PNG_1X1.split(',')[1]);
  });

  it('subir otra foto REEMPLAZA la anterior y mueve la versión', async () => {
    const antes = await equipo.leerFoto(espId);
    await new Promise((r) => setTimeout(r, 5));
    const { fotoVersion } = await equipo.guardarFoto(ctx, espId, PNG_1X1);

    const filas = await adminDb.select().from(especialistaFoto).where(eq(especialistaFoto.especialistaId, espId));
    expect(filas).toHaveLength(1); // no acumula filas
    expect(new Date(fotoVersion).getTime()).toBeGreaterThan(antes!.actualizadoEn.getTime());
  });

  it('el listado trae la versión de la foto, nunca los bytes', async () => {
    const [e] = await equipo.listar(ctx);
    expect(e.fotoVersion).toBeTruthy();
    expect(JSON.stringify(e)).not.toContain('iVBORw0KG'); // la imagen no viaja aquí
  });

  it('rechaza lo que no sea una imagen admitida', async () => {
    await expect(equipo.guardarFoto(ctx, espId, 'data:application/pdf;base64,QQ==')).rejects.toThrow(/JPEG, PNG o WebP/i);
    await expect(equipo.guardarFoto(ctx, espId, 'no soy un data url')).rejects.toThrow(/JPEG, PNG o WebP/i);
    await expect(equipo.guardarFoto(ctx, espId, 'data:image/png;base64,')).rejects.toThrow(/JPEG, PNG o WebP/i);
  });

  it('rechaza una imagen demasiado pesada aunque el navegador se la salte', async () => {
    const gigante = 'data:image/jpeg;base64,' + 'A'.repeat(600_000);
    await expect(equipo.guardarFoto(ctx, espId, gigante)).rejects.toThrow(/pesa demasiado/i);
  });

  it('NO deja poner foto a un especialista de otro negocio', async () => {
    await expect(equipo.guardarFoto(ctx, espAjenoId, PNG_1X1)).rejects.toThrow(/no encontrado/i);
    expect(await equipo.leerFoto(espAjenoId)).toBeNull();
  });

  it('quitar la foto la borra y el avatar vuelve a la inicial', async () => {
    await equipo.borrarFoto(ctx, espId);
    expect(await equipo.leerFoto(espId)).toBeNull();
    const [e] = await equipo.listar(ctx);
    expect(e.fotoVersion).toBeNull();
  });

  it('al borrar el especialista se va su foto (cascade)', async () => {
    await equipo.guardarFoto(ctx, espId, PNG_1X1);
    await adminDb.delete(especialista).where(eq(especialista.id, espId));
    const filas = await adminDb.select().from(especialistaFoto).where(eq(especialistaFoto.especialistaId, espId));
    expect(filas).toHaveLength(0);
  });
});
