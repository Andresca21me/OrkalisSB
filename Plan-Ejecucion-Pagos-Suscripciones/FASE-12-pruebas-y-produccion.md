# FASE-12 · Pruebas, gate y paso a producción

## Objetivo
Cerrar la funcionalidad: batería de **pruebas** (unitarias + E2E) del ciclo completo en **modo test/mocks**, gate verde, y el **paso controlado a producción** de Mercado Pago (guiado).

## Prerrequisitos
- FASES 00–11.

## Pasos

### 🤖 Pruebas (modo test / mocks)
1. **Unitarias:** máquina de estados (todas las transiciones), `cargoMensual`, `puedeAgregarEspecialista`, `moduloPermitido`, verificación de la firma del webhook (`x-signature` HMAC), cálculo de `proximo_cobro` (aniversario), corte de gracia a 7 días.
2. **E2E del ciclo completo** (con Mercado Pago en modo mock/test y un "reloj" inyectable):
   - Registro **prueba** → opera 15 días → vence → bloqueo → paga → `activa`.
   - Registro **pagar ya** → `activa` desde el inicio.
   - Cobro recurrente: avanzar el reloj al aniversario → cobra → `proximo_cobro` +1 mes.
   - Morosidad: pago rechazado (titular `OTHE`/`FUND`) → `en_gracia` → 7 días → `suspendida` → paga → `activa`.
   - Límites: básico bloquea inventario / cupo de especialistas; upgrade los habilita.
   - Operador: cortesía Pro (sin cobro, fuera del cron); quitar cortesía.
   - Webhook idempotente (por `referencia`/`mp_payment_id`); aislamiento entre tenants.
3. **Mock de Mercado Pago para CI:** un doble del `MercadoPagoClient` que simula `approved`/`rejected` según el "titular" de la tarjeta, para correr E2E **sin** llamar a Mercado Pago real. (El modo test real se prueba manualmente con ngrok.)
4. **Gate:** la suite completa (incluida la V3 anterior) en verde; tsc + lint limpios.

### 🧑‍💻 TÚ · Paso a producción (`_GUIA-MERCADOPAGO` PASO 6)
5. Completar la **homologación/activación** de la aplicación en producción si Mercado Pago la exige (datos legales + cuenta bancaria para los retiros + certificación de calidad de la integración desde el panel).
6. Copiar las **credenciales de producción** (`APP_USR-...`): poner `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN` y `VITE_MP_PUBLIC_KEY` de producción en los `.env` y `MP_ENV=production`. (La URL del API **no cambia**.) Configurar el **webhook de producción** al dominio real y copiar su **clave secreta** a `MP_WEBHOOK_SECRET`.
7. **Compra real de prueba** pequeña → verificar cobro + acreditación/retiro + notificación en producción.
8. (Recomendado) Monitoreo/alertas de cobros fallidos y del cron.

## ✅ Verificación / Done
- Todo el ciclo verde en pruebas; mock de Mercado Pago en CI; modo test real probado con ngrok.
- Documento de hallazgos del módulo de pagos y checklist de producción completos.
- Tablero `PLAN-PAGOS §6` en ✅.

## Trazabilidad
- RNF-016 (gate), `_GUIA-MERCADOPAGO` PASO 6, ADR-P5. Cierra el plan de pagos.
