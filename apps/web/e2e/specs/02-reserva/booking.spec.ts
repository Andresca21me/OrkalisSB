import { test, expect } from '@playwright/test';
import { BookingPage } from '../../pages/booking.page';
import { USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, franjaLibre, sembrarReserva } from '../../fixtures/api';
import { telefonoUnico } from '../../fixtures/data';

/**
 * Reserva pública (FASE-02 v3, HU-CLI-001..004). Migrado de la v2. El flujo UI
 * paso a paso se amplía en la FASE-02; aquí se conserva: carga de la página +
 * reserva completa con OTP por API + concurrencia (no doble reserva).
 */

async function contexto(request: import('@playwright/test').APIRequestContext) {
  const sucursales = await sucursalesDe(request, USERS.adminBarberia);
  const sucursalId = sucursales[0].id;
  const servicios = await serviciosPublicos(request, sucursalId);
  return { sucursalId, servicioId: servicios[0].id };
}

test.describe('Reserva pública con OTP (cliente)', () => {
  test('la página pública de reserva carga el negocio y sus servicios', async ({ page, request }) => {
    const { sucursalId } = await contexto(request);
    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await expect(booking.servicioTexto(/corte/i)).toBeVisible({ timeout: 15_000 });
  });

  test('reserva completa con OTP → cita creada', async ({ request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const reserva = await sembrarReserva(request, sucursalId, servicioId);
    expect(reserva.citaId).toBeTruthy();
  });

  test('concurrencia: la misma franja no se reserva dos veces', async ({ request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const { franja } = await franjaLibre(request, sucursalId, servicioId);

    async function intentar(sufijo: string) {
      const telefono = telefonoUnico() + sufijo.slice(-1);
      const ret = await request.post(`/api/public/${sucursalId}/retener`, {
        data: { especialistaId: franja.especialistaId, inicio: franja.inicio, fin: franja.fin },
      });
      if (!ret.ok()) return { citaId: undefined as string | undefined };
      const { retencionId } = await ret.json();
      const otp = await request.post(`/api/public/${sucursalId}/otp/enviar`, { data: { telefono } });
      const { devCode } = await otp.json();
      const conf = await request.post(`/api/public/${sucursalId}/confirmar`, {
        data: { retencionId, telefono, nombre: `Race ${sufijo}`, codigoOtp: devCode, servicioIds: [servicioId] },
      });
      const body = conf.status() === 201 ? await conf.json() : null;
      return { citaId: body?.citaId as string | undefined };
    }

    const [a, b] = await Promise.all([intentar('1'), intentar('2')]);
    const idsUnicos = new Set([a.citaId, b.citaId].filter(Boolean));
    // Garantía anti-solape (EXCLUDE cita_no_solape): a lo sumo una cita nueva.
    expect(idsUnicos.size).toBeLessThanOrEqual(1);
  });
});
