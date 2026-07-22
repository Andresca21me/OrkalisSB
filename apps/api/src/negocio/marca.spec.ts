import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { PerfilNegocio, RolUsuario } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { negocio, negocioLogo } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { MarcaService } from './negocio.service';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Marca del negocio (branding dinámico)', () => {
  const NOMBRE = 'Negocio MARCA TEST';
  const OTRO = 'Negocio MARCA AJENO';
  let negocioId: string;
  let ajenoId: string;
  let ctx: TenantContext;
  const marca = new MarcaService();

  beforeAll(async () => {
    for (const n of [NOMBRE, OTRO]) await adminDb.delete(negocio).where(eq(negocio.nombre, n));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
    const [otro] = await adminDb.insert(negocio).values({ nombre: OTRO, perfil: PerfilNegocio.Salon }).returning();
    ajenoId = otro.id;
    ctx = { negocioId, sucursalIds: null, rol: RolUsuario.Admin };
  });

  afterAll(async () => {
    for (const n of [NOMBRE, OTRO]) await adminDb.delete(negocio).where(eq(negocio.nombre, n));
    await adminClient.end();
    await client.end();
  });

  it('guarda descripción y color, y los devuelve', async () => {
    await marca.actualizar(ctx, { descripcion: '  Barbería clásica en Chapinero.  ', colorPrimario: '#FF6600' });
    const m = await marca.marcaDe(negocioId);
    expect(m!.descripcion).toBe('Barbería clásica en Chapinero.'); // recortado
    expect(m!.colorPrimario).toBe('#ff6600'); // normalizado a minúsculas
    expect(m!.nombre).toBe(NOMBRE);
  });

  it('rechaza un color que no sea hex de 6 dígitos', async () => {
    // Importa porque este valor acaba dentro de una variable CSS en el
    // navegador del cliente final: no puede colarse texto arbitrario.
    for (const malo of ['rojo', '#fff', 'red; background:url(x)', '#12345g', 'var(--x)']) {
      await expect(marca.actualizar(ctx, { colorPrimario: malo })).rejects.toThrow(/#RRGGBB/);
    }
  });

  it('permite dejar la marca sin color ni descripción (vuelve al valor por defecto)', async () => {
    await marca.actualizar(ctx, { descripcion: '', colorPrimario: null });
    const m = await marca.marcaDe(negocioId);
    expect(m!.descripcion).toBeNull();
    expect(m!.colorPrimario).toBeNull();
  });

  it('guarda el logo, lo sirve y mueve la versión al reemplazarlo', async () => {
    const { logoVersion } = await marca.guardarLogo(ctx, PNG_1X1);
    const l = await marca.leerLogo(negocioId);
    expect(l!.mime).toBe('image/png');
    expect(l!.datos.toString('base64')).toBe(PNG_1X1.split(',')[1]);

    await new Promise((r) => setTimeout(r, 5));
    const segunda = await marca.guardarLogo(ctx, PNG_1X1);
    expect(new Date(segunda.logoVersion).getTime()).toBeGreaterThan(new Date(logoVersion).getTime());

    const filas = await adminDb.select().from(negocioLogo).where(eq(negocioLogo.negocioId, negocioId));
    expect(filas).toHaveLength(1); // reemplaza, no acumula
  });

  it('rechaza un logo que no sea imagen admitida o pese demasiado', async () => {
    await expect(marca.guardarLogo(ctx, 'data:text/html;base64,QQ==')).rejects.toThrow(/JPEG, PNG o WebP/i);
    await expect(marca.guardarLogo(ctx, 'data:image/png;base64,' + 'A'.repeat(600_000))).rejects.toThrow(/pesa demasiado/i);
  });

  it('la marca de un negocio NO se mezcla con la de otro', async () => {
    const ajeno = await marca.marcaDe(ajenoId);
    expect(ajeno!.colorPrimario).toBeNull();
    expect(ajeno!.logoVersion).toBeNull();

    // Escribir con el contexto del primero no puede tocar al segundo: RLS acota
    // el UPDATE al negocio del token.
    await marca.actualizar(ctx, { colorPrimario: '#123456' });
    expect((await marca.marcaDe(ajenoId))!.colorPrimario).toBeNull();
  });

  it('quitar el logo lo borra', async () => {
    await marca.borrarLogo(ctx);
    expect(await marca.leerLogo(negocioId)).toBeNull();
    expect((await marca.marcaDe(negocioId))!.logoVersion).toBeNull();
  });

  it('al borrar el negocio se va su logo (cascade)', async () => {
    await marca.guardarLogo(ctx, PNG_1X1);
    await adminDb.delete(negocio).where(eq(negocio.id, negocioId));
    const filas = await adminDb.select().from(negocioLogo).where(eq(negocioLogo.negocioId, negocioId));
    expect(filas).toHaveLength(0);
  });
});
