import '../load-env';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminDb } from './admin-client';
import { negocio, suscripcion, usuario } from './schema';

/**
 * Bootstrap del OPERADOR DE PLATAFORMA (apto para producción, a diferencia del
 * seed). Crea —o restablece— el usuario transversal que gestiona las
 * suscripciones de los negocios registrados (/plataforma).
 *
 * Credenciales por variables de entorno (nunca quemadas en el repo):
 *
 *   OPERADOR_EMAIL=ops@midominio.com \
 *   OPERADOR_PASSWORD='una-larga-y-unica' \
 *   node dist/db/operador.js
 *
 * Idempotente: si el email ya es un operador, solo restablece su contraseña.
 * Si el email pertenece a una cuenta de negocio, aborta (el email es único
 * global). El negocio "Plataforma Orkalis" se crea una sola vez y su
 * suscripción queda `activa` sin `trial_fin`: el operador nunca se bloquea.
 */
async function run(): Promise<void> {
  const email = (process.env.OPERADOR_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.OPERADOR_PASSWORD ?? '';
  const nombre = (process.env.OPERADOR_NOMBRE ?? 'Operador Plataforma').trim();

  if (!/.+@.+\..+/.test(email)) throw new Error('Define OPERADOR_EMAIL con un correo válido.');
  if (password.length < 12) {
    throw new Error('OPERADOR_PASSWORD debe tener al menos 12 caracteres (es la cuenta que manda sobre todas).');
  }

  const hash = await argon2.hash(password);

  const resultado = await adminDb.transaction(async (tx) => {
    const [existente] = await tx
      .select({ id: usuario.id, rol: usuario.rol })
      .from(usuario)
      .where(eq(usuario.email, email))
      .limit(1);

    if (existente) {
      if (existente.rol !== RolUsuario.OperadorPlataforma) {
        throw new Error(`El email ${email} ya pertenece a una cuenta con rol "${existente.rol}"; usa otro correo.`);
      }
      await tx
        .update(usuario)
        .set({ nombre, passwordHash: hash, activo: true })
        .where(eq(usuario.id, existente.id));
      return 'restablecido';
    }

    // Un operador previo ancla el negocio plataforma; si no hay, se crea.
    const [previo] = await tx
      .select({ negocioId: usuario.negocioId })
      .from(usuario)
      .where(eq(usuario.rol, RolUsuario.OperadorPlataforma))
      .limit(1);

    let negocioId = previo?.negocioId;
    if (!negocioId) {
      const [plataforma] = await tx
        .insert(negocio)
        .values({ nombre: 'Plataforma Orkalis', perfil: PerfilNegocio.Salon })
        .returning();
      negocioId = plataforma.id;
      await tx
        .insert(suscripcion)
        .values({ negocioId, plan: PlanSuscripcion.Empresarial, numEspecialistas: 0 });
    }

    await tx.insert(usuario).values({
      negocioId,
      nombre,
      email,
      passwordHash: hash,
      rol: RolUsuario.OperadorPlataforma,
    });
    return 'creado';
  });

  // eslint-disable-next-line no-console
  console.log(`Operador ${resultado}: ${email} → entra por /login y aterriza en /plataforma.`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
