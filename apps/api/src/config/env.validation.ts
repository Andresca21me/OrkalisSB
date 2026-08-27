import { z } from 'zod';

/**
 * Esquema de validación de variables de entorno (FASE-01, §6).
 *
 * Solo se exigen las variables necesarias HOY. El resto (auth, Twilio, Wompi…)
 * se irán marcando como requeridas en su fase correspondiente. Mantener en
 * sincronía con `apps/api/.env.example`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate limiting (RNF-011). Defaults de producción: 120 req/min por IP. Se
  // exponen como env para poder subir el techo en entornos donde varios
  // usuarios comparten IP (NAT de un negocio) o en pruebas E2E (un solo origen).
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  // Base de datos (FASE-02): opcional aún en FASE-01.
  DATABASE_URL: z.string().optional(),
  // Conexión admin (FASE-04): migraciones/seed/fixtures con el rol dueño.
  DATABASE_URL_ADMIN: z.string().optional(),

  // Auth (FASE-05): requeridos. Secretos largos y aleatorios (RNF-012).
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener ≥32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener ≥32 caracteres'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),

  // OTP / SMS / WhatsApp — Twilio. Todas OPCIONALES: sin las tres primeras
  // (SID/TOKEN/FROM) la mensajería corre en MockAdapter (Plan-Mensajeria FASE-00).
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  // Messaging Service (pooling/entregabilidad; primitivo ISV-ready FASE-11).
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  // WhatsApp Business sender ('whatsapp:+…') y verificación OTP (Verify).
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  // Callback de estado de entrega (delivered/failed) → outbox/auditoría FASE-02.
  TWILIO_STATUS_CALLBACK_URL: z.string().optional(),
  // Content SIDs de plantillas WhatsApp aprobadas (Twilio Content Builder).
  TWILIO_WA_TPL_CONFIRMACION: z.string().optional(),
  TWILIO_WA_TPL_RECORDATORIO: z.string().optional(),
  TWILIO_WA_TPL_AVISO: z.string().optional(),
  TWILIO_WA_TPL_AVISO_ESPECIALISTA: z.string().optional(),
  TWILIO_WA_TPL_MARKETING: z.string().optional(),

  // Email (FASE-11 / Plan-Correo) — SendGrid (opcional).
  SENDGRID_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  // Alias de MAIL_FROM: es el nombre que ya vive en Railway (Plan-Correo D6).
  FROM_EMAIL: z.string().optional(),
  // Base pública del frontend para los enlaces de los correos (verificación,
  // restablecer contraseña, invitación). Sin ella se usa el primer origen de
  // CORS_ORIGIN, que en dev apunta al Vite local.
  APP_URL: z.string().optional(),

  // Pasarela de suscripción — Mercado Pago (Plan-Pagos FASE-02). Opcionales:
  // sin ellas el cliente opera en modo INACTIVO (no cobra, no llama a la API).
  MP_PUBLIC_KEY: z.string().optional(), // TEST-… / APP_USR-… (tokenización en el front)
  MP_ACCESS_TOKEN: z.string().optional(), // credencial privada del backend
  MP_WEBHOOK_SECRET: z.string().optional(), // clave secreta para verificar x-signature
  MP_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
})
  // MAIL_FROM y FROM_EMAIL son la misma cosa con dos nombres (el segundo es el
  // que quedó configurado en Railway): el resto del código lee solo MAIL_FROM.
  .transform((env) => ({ ...env, MAIL_FROM: env.MAIL_FROM ?? env.FROM_EMAIL }));

export type Env = z.infer<typeof envSchema>;

/** Validador para `@nestjs/config` (`validate`). Lanza si algo no cuadra. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return result.data;
}
