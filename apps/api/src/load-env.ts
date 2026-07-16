import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Carga el `.env` de `apps/api` como SIDE EFFECT, resuelto relativo a este
 * archivo (no al cwd), para que `node dist/main.js` funcione desde cualquier
 * directorio. Debe importarse ANTES que cualquier módulo que lea
 * `process.env` en tiempo de import (p. ej. `db/client.ts`).
 *
 * En producción las variables las inyecta la plataforma (Railway, FASE-14);
 * dotenv no sobrescribe variables ya presentes y es inocuo si no hay `.env`.
 */
loadDotenv({ path: resolve(__dirname, '../.env') });
