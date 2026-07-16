import { config as loadEnv } from 'dotenv';
loadEnv(); // health.controller importa db/client (requiere DATABASE_URL).

import { HealthController } from './health.controller';
import { adminClient } from '../db/admin-client';
import { client } from '../db/client';

describe('HealthController', () => {
  afterAll(async () => {
    await client.end();
    await adminClient.end();
  });

  it('liveness responde estado ok', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('orkalis-api');
  });

  it('readiness verifica la BD', async () => {
    const controller = new HealthController();
    const r = await controller.ready();
    expect(r.status).toBe('ok');
    expect(r.db).toBe('up');
  });
});
