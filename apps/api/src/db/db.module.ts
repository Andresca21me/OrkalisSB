import { Global, Module } from '@nestjs/common';
import { db } from './client';

/** Token de inyección para la instancia Drizzle. */
export const DRIZZLE = Symbol('DRIZZLE');

/**
 * Módulo global de base de datos (FASE-02, paso 9).
 *
 * Provee la instancia Drizzle (`db`) vía el token `DRIZZLE`. La construcción
 * del `TenantContext` por request se conecta a Auth en FASE-05; de momento el
 * acceso scoped se hace a través de `runInTenantTx` (ver `tx.ts`).
 */
@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
