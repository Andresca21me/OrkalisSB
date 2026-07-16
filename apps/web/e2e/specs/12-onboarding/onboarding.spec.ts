import { test, expect, type Page } from '@playwright/test';
import { loginUI, USERS } from '../../fixtures/roles';
import { GestionPage } from '../../pages/gestion.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-12 v3 · Onboarding del negocio (HU-ADM-001). El asistente (`/onboarding`)
 * configura el negocio del admin logueado (perfil, sucursal, módulos, equipo) y
 * aterriza en `/admin`. Es DESTRUCTIVO (muta el tenant barbería) → reseed por
 * prueba; el otro tenant no se toca.
 */
test.describe('Onboarding del negocio', () => {
  test.beforeEach(async () => { reseed(); });
  // El onboarding deja el tenant mutado: re-siembra al cerrar la fase.
  test.afterAll(async () => { reseed(); });

  async function irAOnboarding(page: Page) {
    await loginUI(page, USERS.adminBarberia);
    await page.goto('/onboarding');
    await expect(page.getByText('Cuéntanos de tu negocio')).toBeVisible({ timeout: 15_000 });
  }
  const continuar = (page: Page) => page.getByRole('button', { name: 'Continuar' }).click();
  const atras = (page: Page) => page.getByRole('button', { name: 'Atrás' }).click();

  test('flujo feliz (barbería): activa un módulo y aterriza en el panel', async ({ page }) => {
    await irAOnboarding(page);
    // Paso 1 · perfil (barbería ya es el perfil) → continuar.
    await page.getByRole('button', { name: /Barbería/ }).click();
    await continuar(page);
    // Paso 2 · sucursal (nombre precargado) → continuar.
    await expect(page.getByText('Tu primera sucursal')).toBeVisible({ timeout: 15_000 });
    await continuar(page);
    // Paso 3 · módulos: activar Inventario.
    await expect(page.getByText('Activa lo que necesitas')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('onb-modulo-modulo.inventario').click();
    await expect(page.getByTestId('onb-modulo-modulo.inventario')).toHaveAttribute('aria-checked', 'true');
    await continuar(page);
    // Paso 4 · equipo (opcional) → finalizar/omitir.
    await expect(page.getByText('Agrega tu equipo')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Finalizar' }).click();
    // Paso 5 · listo → ir al panel.
    await page.getByRole('button', { name: 'Ir a mi panel' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

    // El módulo elegido quedó activo: Gestión muestra la pestaña Inventario.
    const g = new GestionPage(page);
    await g.abrir();
    await expect(page.getByRole('button', { name: 'Inventario', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('validación: no avanza sin nombre de sucursal', async ({ page }) => {
    await irAOnboarding(page);
    await continuar(page); // paso 1 → 2
    await expect(page.getByText('Tu primera sucursal')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder(/La Navaja|Estudio Aura/).fill('');
    await continuar(page);
    await expect(page.getByText(/Ponle un nombre a la sucursal/)).toBeVisible({ timeout: 15_000 });
  });

  test('atrás/adelante conserva el módulo activado', async ({ page }) => {
    await irAOnboarding(page);
    await continuar(page); // 1 → 2
    await continuar(page); // 2 → 3
    await page.getByTestId('onb-modulo-modulo.cierre_periodo').click();
    await expect(page.getByTestId('onb-modulo-modulo.cierre_periodo')).toHaveAttribute('aria-checked', 'true');
    await atras(page); // 3 → 2
    await continuar(page); // 2 → 3 de nuevo
    await expect(page.getByTestId('onb-modulo-modulo.cierre_periodo')).toHaveAttribute('aria-checked', 'true');
  });

  test('perfil salón usa la terminología de "especialista"', async ({ page }) => {
    await irAOnboarding(page);
    await page.getByRole('button', { name: /Salón de belleza/ }).click();
    await continuar(page); // 1 → 2
    await continuar(page); // 2 → 3
    await continuar(page); // 3 → 4 (equipo)
    await expect(page.getByText('Nombre del especialista')).toBeVisible({ timeout: 15_000 });
  });
});
