import { expect, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';

/**
 * Credenciales y login del seed de desarrollo (apps/api/src/db/seed.ts).
 * Centraliza lo que en la v2 vivía en e2e/helpers.ts (FASE-00 v3).
 */
export const PASSWORD = 'Orkalis2026!';

export const USERS = {
  adminBarberia: 'admin@orkalis.demo',
  recepcion: 'recepcion@barberia.orkalis.demo',
  especialista: 'carlos@barberia.orkalis.demo',
  adminSalon: 'admin@salon.orkalis.demo',
  recepcionSalon: 'recepcion@salon.orkalis.demo',
  especialistaSalon: 'valentina@salon.orkalis.demo',
  operador: 'operador@orkalis.demo',
} as const;

export type RoleKey = keyof typeof USERS;

/** Ruta del panel a la que aterriza cada rol tras el login. */
export const HOME_BY_ROLE: Record<RoleKey, RegExp> = {
  adminBarberia: /\/admin/,
  recepcion: /\/recepcion/,
  especialista: /\/especialista/,
  adminSalon: /\/admin/,
  recepcionSalon: /\/recepcion/,
  especialistaSalon: /\/especialista/,
  operador: /\/plataforma/,
};

/** Login por la UI: rellena el formulario y espera la navegación al panel. */
export async function loginUI(page: Page, email: string, password = PASSWORD) {
  // El tutorial guiado auto-abre en el primer ingreso; en E2E lo marcamos como
  // visto para que su overlay no bloquee la interacción con el panel.
  await page.addInitScript(() => { try { localStorage.setItem('orkalis:tour:admin:v1', '1'); } catch { /* noop */ } });
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

/** Token de acceso vía API (oráculo: sembrar/leer datos en pruebas). */
export async function loginAPI(request: APIRequestContext, email: string, password = PASSWORD) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login API ${email}`).toBeTruthy();
  return (await res.json()).accessToken as string;
}

/** Una sesión de navegador (contexto aislado) ya logueada por rol. */
export interface SesionRol {
  role: RoleKey;
  context: BrowserContext;
  page: Page;
}

/**
 * Abre varias sesiones simultáneas, una por rol, cada una en su propio
 * BrowserContext (cookies/localStorage aislados). Imprescindible para los
 * flujos cruzados (un actor + varios observadores). Recuerda cerrarlas con
 * `cerrarRoles(...)`.
 */
export async function abrirRoles(browser: Browser, roles: RoleKey[]): Promise<Record<string, SesionRol>> {
  const out: Record<string, SesionRol> = {};
  for (const role of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUI(page, USERS[role]);
    out[role] = { role, context, page };
  }
  return out;
}

export async function cerrarRoles(sesiones: Record<string, SesionRol>) {
  await Promise.all(Object.values(sesiones).map((s) => s.context.close()));
}
