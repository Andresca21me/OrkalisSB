import { test as base, type Page } from '@playwright/test';
import { USERS, loginUI, type RoleKey } from './roles';

/**
 * Fixtures de página ya logueada por rol (FASE-00 v3). Cada una vive en su
 * propio BrowserContext (el fixture `page` de Playwright ya es por test, pero
 * para varios roles a la vez usar `abrirRoles` de roles.ts).
 *
 * Uso: `test('...', async ({ adminPage }) => { ... })`.
 */
type Fixtures = {
  adminPage: Page;
  espPage: Page;
  recepcionPage: Page;
  operadorPage: Page;
};

async function paginaLogueada(browser: import('@playwright/test').Browser, role: RoleKey, use: (p: Page) => Promise<void>) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginUI(page, USERS[role]);
  await use(page);
  await context.close();
}

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    await paginaLogueada(browser, 'adminBarberia', use);
  },
  espPage: async ({ browser }, use) => {
    await paginaLogueada(browser, 'especialista', use);
  },
  recepcionPage: async ({ browser }, use) => {
    await paginaLogueada(browser, 'recepcion', use);
  },
  operadorPage: async ({ browser }, use) => {
    await paginaLogueada(browser, 'operador', use);
  },
});

export { expect } from '@playwright/test';
