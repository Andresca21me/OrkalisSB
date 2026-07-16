import { defineConfig, devices } from '@playwright/test';

/**
 * E2E por rol contra la API real (FASE-14, RNF-016). Requisitos:
 *  1. Docker DB arriba + `pnpm --filter api db:seed` (datos de demo).
 *  2. API en :3000 (`pnpm --filter api start`).
 * El webServer arranca Vite (:5173) que proxya `/api` → :3000.
 *
 * En CI se levantan DB+API antes de `playwright test` (ver ci.yml).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
