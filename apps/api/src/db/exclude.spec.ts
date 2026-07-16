import { config as loadEnv } from 'dotenv';
loadEnv();

import { eq } from 'drizzle-orm';
import { EstadoCita, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from './admin-client';
import { cita, especialista, negocio, sucursal } from './schema';

/**
 * Verificación FASE-03: el constraint EXCLUDE `cita_no_solape` impide dos
 * citas confirmadas solapadas para el mismo especialista/sucursal.
 * Requiere Postgres local levantado y la migración aplicada.
 *
 * Usa el cliente ADMIN: el EXCLUDE es independiente de RLS y así se evita
 * montar contexto de tenant solo para sembrar los fixtures (FASE-04).
 */
describe('cita_no_solape (EXCLUDE anti doble-reserva)', () => {
  const NOMBRE = 'Negocio Test EXCLUDE';
  let negocioId: string;
  let sucursalId: string;
  let especialistaId: string;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb
      .insert(negocio)
      .values({ nombre: NOMBRE, perfil: PerfilNegocio.Barberia })
      .returning();
    negocioId = neg.id;
    const [suc] = await adminDb
      .insert(sucursal)
      .values({ negocioId, nombre: 'Sede Test' })
      .returning();
    sucursalId = suc.id;
    const [esp] = await adminDb
      .insert(especialista)
      .values({ negocioId, nombre: 'Esp Test' })
      .returning();
    especialistaId = esp.id;
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
  });

  const base = (inicio: string, fin: string) => ({
    negocioId,
    sucursalId,
    especialistaId,
    inicio: new Date(inicio),
    fin: new Date(fin),
    estado: EstadoCita.Confirmada,
    origen: OrigenCita.CreacionInterna,
  });

  it('permite la primera cita confirmada', async () => {
    const [c] = await adminDb
      .insert(cita)
      .values(base('2030-01-01T10:00:00Z', '2030-01-01T10:30:00Z'))
      .returning();
    expect(c.id).toBeDefined();
  });

  it('rechaza una segunda cita confirmada solapada (mismo especialista/sucursal)', async () => {
    await expect(
      adminDb.insert(cita).values(base('2030-01-01T10:15:00Z', '2030-01-01T10:45:00Z')),
    ).rejects.toThrow();
  });

  it('permite una cita contigua no solapada', async () => {
    const [c] = await adminDb
      .insert(cita)
      .values(base('2030-01-01T10:30:00Z', '2030-01-01T11:00:00Z'))
      .returning();
    expect(c.id).toBeDefined();
  });

  it('permite una cita cancelada solapada (el WHERE excluye estados no activos)', async () => {
    const [c] = await adminDb
      .insert(cita)
      .values({ ...base('2030-01-01T10:10:00Z', '2030-01-01T10:20:00Z'), estado: EstadoCita.Cancelada })
      .returning();
    expect(c.id).toBeDefined();
  });
});
