import 'dotenv/config';
import * as argon2 from 'argon2';
import { inArray } from 'drizzle-orm';
import {
  EstadoCita,
  EstadoSuscripcion,
  MetodoPago,
  OrigenCita,
  PerfilNegocio,
  PlanSuscripcion,
  RolUsuario,
  SplitType,
  TipoGasto,
  TipoProducto,
} from '@orkalis/shared';
import { adminClient, adminDb } from './admin-client';
import {
  atencion,
  cita,
  citaServicio,
  cliente,
  disponibilidad,
  especialista,
  especialistaSucursal,
  gasto,
  liquidacion,
  movimientoInventario,
  negocio,
  producto,
  servicio,
  sucursal,
  suscripcion,
  usuario,
  usuarioSucursal,
} from './schema';

/**
 * Seed de desarrollo (FASE-00 v2).
 *
 * Siembra DOS tenants realistas — una **barbería** y un **salón** — para validar
 * cada pantalla de la v2 contra la API real (regla de oro: cero mock en
 * producción). Cada tenant trae: negocio + suscripción, 1–2 sucursales,
 * usuarios de cada rol (admin, recepcionista, especialista con login),
 * especialistas, catálogo de servicios con repartición, clientes, citas en
 * varios estados, atenciones completadas (incl. un período liquidable),
 * inventario con stock bajo y gastos. Más un negocio "plataforma" con el
 * operador transversal.
 *
 * - **Idempotente:** borra los negocios de demo por nombre antes de reinsertar
 *   (la cascada arrastra el resto de filas).
 * - **Solo desarrollo:** se niega a correr con NODE_ENV=production.
 * - Usa la conexión ADMIN (bypassea RLS): correcto para seed/migraciones.
 *
 * Credenciales documentadas en `Plan-Ejecucion-V2/_CREDENCIALES-SEED.md`.
 */

const PASSWORD = 'Orkalis2026!';

const NOMBRE_PLATAFORMA = 'Plataforma Orkalis';
const NOMBRE_BARBERIA = 'Barbería Orkalis Demo';
const NOMBRE_SALON = 'Salón Orkalis Demo';

// ---------------------------------------------------------------------------
// Helpers de tiempo y dinero
// ---------------------------------------------------------------------------

/** Fecha a las HH:MM de `diasDesdeHoy` (negativo = pasado). Hora local. */
function fechaA(diasDesdeHoy: number, hora: number, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + diasDesdeHoy);
  d.setHours(hora, min, 0, 0);
  return d;
}

function masMin(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

const cop = (n: number): string => n.toFixed(2);

/** Reparte el total entre profesional y salón según el split del servicio. */
function repartir(
  total: number,
  splitType: SplitType,
  splitValor: number,
): { ganProf: number; ganSalon: number } {
  const ganProf =
    splitType === SplitType.Porcentaje ? Math.round((total * splitValor) / 100) : splitValor;
  return { ganProf, ganSalon: total - ganProf };
}

// ---------------------------------------------------------------------------
// Configuración de cada tenant
// ---------------------------------------------------------------------------

interface ServicioCfg {
  nombre: string;
  precio: number;
  dur: number;
  categoria: string;
  splitType: SplitType;
  splitValor: number;
}
interface EspecialistaCfg {
  nombre: string;
  especialidad: string;
  email?: string; // si tiene login propio
  sucursales: number[]; // índices de sucursales donde opera
}
interface ProductoCfg {
  nombre: string;
  tipo: TipoProducto;
  cantidad: number;
  stockMin: number;
  costo: number;
  precioVenta: number;
}
interface TenantCfg {
  nombre: string;
  perfil: PerfilNegocio;
  plan: PlanSuscripcion;
  /** Estado de suscripción sembrado (Plan-Pagos FASE-00). Default: cortesía. */
  estadoSuscripcion?: EstadoSuscripcion;
  /** Si el estado es `prueba`, días que faltan para que venza (default 15). */
  trialDias?: number;
  sucursales: string[];
  admin: { nombre: string; email: string };
  recepcion: { nombre: string; email: string };
  especialistas: EspecialistaCfg[];
  servicios: ServicioCfg[];
  clientes: { nombre: string; telefono: string }[];
  productos: ProductoCfg[];
  gastos: { tipo: TipoGasto; categoria: string; monto: number; frecuencia?: string }[];
}

const BARBERIA: TenantCfg = {
  nombre: NOMBRE_BARBERIA,
  perfil: PerfilNegocio.Barberia,
  // Premium: admite 2 sucursales (la barbería demo tiene Centro + Norte). Antes
  // estaba en Pro (máx 1), inconsistente con sus 2 sedes (hallazgo FASE-01).
  plan: PlanSuscripcion.Premium,
  // Cortesía: el desarrollador entra con acceso completo y SIN cobro recurrente.
  estadoSuscripcion: EstadoSuscripcion.Cortesia,
  sucursales: ['Sede Centro', 'Sede Norte'],
  admin: { nombre: 'Admin Barbería', email: 'admin@orkalis.demo' },
  recepcion: { nombre: 'Recepción Barbería', email: 'recepcion@barberia.orkalis.demo' },
  especialistas: [
    {
      nombre: 'Carlos Barbero',
      especialidad: 'Cortes clásicos',
      email: 'carlos@barberia.orkalis.demo',
      sucursales: [0, 1],
    },
    { nombre: 'Diana Estilista', especialidad: 'Color y barba', sucursales: [0] },
  ],
  servicios: [
    {
      nombre: 'Corte de cabello',
      precio: 25000,
      dur: 30,
      categoria: 'Cabello',
      splitType: SplitType.Porcentaje,
      splitValor: 50,
    },
    {
      nombre: 'Arreglo de barba',
      precio: 15000,
      dur: 20,
      categoria: 'Barba',
      splitType: SplitType.Porcentaje,
      splitValor: 40,
    },
    {
      nombre: 'Corte + barba',
      precio: 35000,
      dur: 45,
      categoria: 'Combo',
      splitType: SplitType.Porcentaje,
      splitValor: 50,
    },
    {
      nombre: 'Tinte',
      precio: 60000,
      dur: 60,
      categoria: 'Color',
      splitType: SplitType.ValorFijo,
      splitValor: 20000,
    },
  ],
  clientes: [
    { nombre: 'Juan Pérez', telefono: '3001112233' },
    { nombre: 'María Gómez', telefono: '3004445566' },
    { nombre: 'Andrés Rojas', telefono: '3007778899' },
    { nombre: 'Felipe Torres', telefono: '3012223344' },
  ],
  productos: [
    {
      nombre: 'Cera para cabello',
      tipo: TipoProducto.Venta,
      cantidad: 24,
      stockMin: 6,
      costo: 8000,
      precioVenta: 18000,
    },
    {
      nombre: 'Shampoo profesional',
      tipo: TipoProducto.Venta,
      cantidad: 3,
      stockMin: 5, // STOCK BAJO (alerta)
      costo: 12000,
      precioVenta: 28000,
    },
    {
      nombre: 'Cuchillas (insumo)',
      tipo: TipoProducto.Servicio,
      cantidad: 40,
      stockMin: 10,
      costo: 1500,
      precioVenta: 0,
    },
  ],
  gastos: [
    { tipo: TipoGasto.Fijo, categoria: 'Arriendo', monto: 1800000, frecuencia: 'mensual' },
    { tipo: TipoGasto.Fijo, categoria: 'Servicios públicos', monto: 350000, frecuencia: 'mensual' },
    { tipo: TipoGasto.Variable, categoria: 'Insumos', monto: 220000 },
  ],
};

const SALON: TenantCfg = {
  nombre: NOMBRE_SALON,
  perfil: PerfilNegocio.Salon,
  plan: PlanSuscripcion.Premium,
  // En prueba (15 días por delante) para ejercitar el flujo de prueba gratis.
  estadoSuscripcion: EstadoSuscripcion.Prueba,
  trialDias: 15,
  sucursales: ['Salón Principal'],
  admin: { nombre: 'Admin Salón', email: 'admin@salon.orkalis.demo' },
  recepcion: { nombre: 'Recepción Salón', email: 'recepcion@salon.orkalis.demo' },
  especialistas: [
    {
      nombre: 'Valentina Ríos',
      especialidad: 'Colorimetría',
      email: 'valentina@salon.orkalis.demo',
      sucursales: [0],
    },
    { nombre: 'Sara Mendoza', especialidad: 'Manicure y spa', sucursales: [0] },
  ],
  servicios: [
    {
      nombre: 'Corte y peinado',
      precio: 45000,
      dur: 45,
      categoria: 'Cabello',
      splitType: SplitType.Porcentaje,
      splitValor: 45,
    },
    {
      nombre: 'Manicure',
      precio: 30000,
      dur: 40,
      categoria: 'Uñas',
      splitType: SplitType.Porcentaje,
      splitValor: 50,
    },
    {
      nombre: 'Tinte y mechas',
      precio: 120000,
      dur: 90,
      categoria: 'Color',
      splitType: SplitType.ValorFijo,
      splitValor: 40000,
    },
    {
      nombre: 'Tratamiento capilar',
      precio: 70000,
      dur: 60,
      categoria: 'Spa',
      splitType: SplitType.Porcentaje,
      splitValor: 40,
    },
  ],
  clientes: [
    { nombre: 'Laura Castro', telefono: '3101110011' },
    { nombre: 'Camila Vargas', telefono: '3102220022' },
    { nombre: 'Daniela Ruiz', telefono: '3103330033' },
  ],
  productos: [
    {
      nombre: 'Esmalte gel',
      tipo: TipoProducto.Venta,
      cantidad: 18,
      stockMin: 8,
      costo: 9000,
      precioVenta: 22000,
    },
    {
      nombre: 'Tinte profesional 60ml',
      tipo: TipoProducto.Servicio,
      cantidad: 2,
      stockMin: 6, // STOCK BAJO (alerta)
      costo: 15000,
      precioVenta: 0,
    },
    {
      nombre: 'Mascarilla capilar',
      tipo: TipoProducto.Venta,
      cantidad: 12,
      stockMin: 4,
      costo: 14000,
      precioVenta: 32000,
    },
  ],
  gastos: [
    { tipo: TipoGasto.Fijo, categoria: 'Arriendo', monto: 2500000, frecuencia: 'mensual' },
    { tipo: TipoGasto.Variable, categoria: 'Productos', monto: 600000 },
  ],
};

// ---------------------------------------------------------------------------
// Siembra de un tenant
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof adminDb.transaction>[0]>[0];

async function crearTenant(tx: Tx, cfg: TenantCfg, hash: string): Promise<void> {
  // Estado de suscripción sembrado (Plan-Pagos FASE-00): por defecto cortesía,
  // así el desarrollador entra con acceso completo y sin cobro recurrente.
  const estado = cfg.estadoSuscripcion ?? EstadoSuscripcion.Cortesia;
  const trialFin =
    estado === EstadoSuscripcion.Prueba ? fechaA(cfg.trialDias ?? 15, 23, 59) : null;

  const [neg] = await tx
    .insert(negocio)
    .values({ nombre: cfg.nombre, perfil: cfg.perfil, estadoSuscripcion: estado })
    .returning();

  await tx.insert(suscripcion).values({
    negocioId: neg.id,
    plan: cfg.plan,
    // Cupo PAGADO de especialistas (Plan-Pagos FASE-08). Con holgura sobre los
    // sembrados para que las pruebas E2E puedan crear más sin topar el cupo.
    numEspecialistas: cfg.especialistas.length + 4,
    estado,
    trialFin,
  });

  const sucs = await tx
    .insert(sucursal)
    .values(cfg.sucursales.map((nombre) => ({ negocioId: neg.id, nombre })))
    .returning();

  // Admin con alcance a TODAS las sucursales.
  const [admin] = await tx
    .insert(usuario)
    .values({
      negocioId: neg.id,
      nombre: cfg.admin.nombre,
      email: cfg.admin.email,
      passwordHash: hash,
      rol: RolUsuario.Admin,
    })
    .returning();
  await tx
    .insert(usuarioSucursal)
    .values(sucs.map((s) => ({ usuarioId: admin.id, sucursalId: s.id })));

  // Recepcionista en la primera sucursal.
  const [recep] = await tx
    .insert(usuario)
    .values({
      negocioId: neg.id,
      nombre: cfg.recepcion.nombre,
      email: cfg.recepcion.email,
      passwordHash: hash,
      rol: RolUsuario.Recepcionista,
    })
    .returning();
  await tx.insert(usuarioSucursal).values({ usuarioId: recep.id, sucursalId: sucs[0].id });

  // Especialistas (algunos con usuario de login).
  const espIds: string[] = [];
  for (const e of cfg.especialistas) {
    let usuarioId: string | undefined;
    if (e.email) {
      const [u] = await tx
        .insert(usuario)
        .values({
          negocioId: neg.id,
          nombre: e.nombre,
          email: e.email,
          passwordHash: hash,
          rol: RolUsuario.Especialista,
        })
        .returning();
      usuarioId = u.id;
      await tx
        .insert(usuarioSucursal)
        .values(e.sucursales.map((i) => ({ usuarioId: u.id, sucursalId: sucs[i].id })));
    }
    const [esp] = await tx
      .insert(especialista)
      .values({ negocioId: neg.id, nombre: e.nombre, especialidad: e.especialidad, usuarioId })
      .returning();
    espIds.push(esp.id);
    await tx
      .insert(especialistaSucursal)
      .values(e.sucursales.map((i) => ({ especialistaId: esp.id, sucursalId: sucs[i].id })));

    // Ventanas de disponibilidad recurrentes en cada sede, para que la reserva
    // pública tenga franjas reales (FASE-03). Cubren los 7 días y todo el horario
    // (00:00–23:59) a propósito: el seed es DATOS DE DEMO/PRUEBA y la
    // disponibilidad pública filtra las franjas pasadas según la hora real, así
    // que una ventana amplia evita que la suite E2E dependa de la hora del día o
    // del día de la semana (estabilidad en CI). Un negocio real define su horario.
    await tx.insert(disponibilidad).values(
      e.sucursales.flatMap((i) =>
        [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
          negocioId: neg.id,
          sucursalId: sucs[i].id,
          especialistaId: esp.id,
          diaSemana: dia,
          horaInicio: '00:00',
          horaFin: '23:59',
        })),
      ),
    );
  }

  // Servicios.
  const servs = await tx
    .insert(servicio)
    .values(
      cfg.servicios.map((s) => ({
        negocioId: neg.id,
        nombre: s.nombre,
        precio: cop(s.precio),
        duracionMin: s.dur,
        categoria: s.categoria,
        splitType: s.splitType,
        splitValor: cop(s.splitValor),
      })),
    )
    .returning();

  // Clientes.
  const clis = await tx
    .insert(cliente)
    .values(cfg.clientes.map((c) => ({ negocioId: neg.id, nombre: c.nombre, telefono: c.telefono })))
    .returning();

  // Inventario (productos) en la primera sucursal + un movimiento de entrada.
  const prods = await tx
    .insert(producto)
    .values(
      cfg.productos.map((p) => ({
        negocioId: neg.id,
        sucursalId: sucs[0].id,
        nombre: p.nombre,
        tipo: p.tipo,
        cantidad: p.cantidad,
        stockMin: p.stockMin,
        costo: cop(p.costo),
        precioVenta: cop(p.precioVenta),
      })),
    )
    .returning();
  await tx.insert(movimientoInventario).values(
    prods.map((p, i) => ({
      negocioId: neg.id,
      sucursalId: sucs[0].id,
      productoId: p.id,
      tipoMov: 'entrada' as const,
      cantidad: cfg.productos[i].cantidad,
      motivo: 'Carga inicial de inventario',
    })),
  );

  // Gastos.
  await tx.insert(gasto).values(
    cfg.gastos.map((g) => ({
      negocioId: neg.id,
      sucursalId: sucs[0].id,
      tipo: g.tipo,
      categoria: g.categoria,
      monto: cop(g.monto),
      frecuencia: g.frecuencia,
    })),
  );

  // ---- Citas + atenciones -------------------------------------------------
  const suc0 = sucs[0].id;
  const esp0 = espIds[0];
  const esp1 = espIds[1] ?? espIds[0];
  const s0 = cfg.servicios[0];
  const s1 = cfg.servicios[1] ?? cfg.servicios[0];

  // Citas de HOY en varios estados (esp0, sin solape entre confirmada/en_progreso).
  const hoy: {
    esp: string;
    cli: string | null;
    ini: Date;
    serv: ServicioCfg;
    estado: EstadoCita;
  }[] = [
    { esp: esp0, cli: clis[0].id, ini: fechaA(0, 9, 0), serv: s0, estado: EstadoCita.Solicitada },
    { esp: esp0, cli: clis[1].id, ini: fechaA(0, 10, 0), serv: s1, estado: EstadoCita.Confirmada },
    { esp: esp0, cli: clis[2 % clis.length].id, ini: fechaA(0, 11, 0), serv: s0, estado: EstadoCita.EnProgreso },
    { esp: esp1, cli: clis[0].id, ini: fechaA(0, 11, 30), serv: s1, estado: EstadoCita.Confirmada },
    { esp: esp0, cli: clis[1].id, ini: fechaA(0, 14, 0), serv: s0, estado: EstadoCita.Cancelada },
    { esp: esp0, cli: clis[0].id, ini: fechaA(0, 15, 0), serv: s1, estado: EstadoCita.NoAsistio },
  ];

  for (const c of hoy) {
    const fin = masMin(c.ini, c.serv.dur);
    const [ct] = await tx
      .insert(cita)
      .values({
        negocioId: neg.id,
        sucursalId: suc0,
        clienteId: c.cli,
        especialistaId: c.esp,
        inicio: c.ini,
        fin,
        estado: c.estado,
        origen: OrigenCita.AgendamientoPublico,
        precioEst: cop(c.serv.precio),
      })
      .returning();
    const srv = servs.find((s) => s.nombre === c.serv.nombre)!;
    await tx
      .insert(citaServicio)
      .values({ citaId: ct.id, servicioId: srv.id, precioAplicado: cop(c.serv.precio) });
  }

  // Una cita COMPLETADA hoy (con atención y cierre financiero).
  await completar(tx, neg.id, suc0, esp0, clis[0].id, servs, s0, fechaA(0, 8, 0), MetodoPago.Efectivo);

  // Período liquidable: atenciones completadas hace ~12 días (quincena anterior).
  await completar(tx, neg.id, suc0, esp0, clis[1].id, servs, s0, fechaA(-12, 9, 0), MetodoPago.Tarjeta);
  await completar(tx, neg.id, suc0, esp0, clis[2 % clis.length].id, servs, s1, fechaA(-12, 10, 0), MetodoPago.Efectivo);
  await completar(tx, neg.id, suc0, esp1, clis[0].id, servs, s1, fechaA(-11, 9, 0), MetodoPago.Nequi);
  await completar(tx, neg.id, suc0, esp1, clis[1].id, servs, s0, fechaA(-11, 11, 0), MetodoPago.Transferencia);

  console.log(
    `  ✓ ${cfg.nombre} · ${sucs.length} sucursal(es) · ${espIds.length} especialistas · ` +
      `${servs.length} servicios · ${clis.length} clientes · ${prods.length} productos · ` +
      `${hoy.length} citas hoy + 5 atenciones (incl. quincena liquidable)`,
  );
}

/** Crea una cita completada + su atención (cierre financiero). */
async function completar(
  tx: Tx,
  negocioId: string,
  sucursalId: string,
  especialistaId: string,
  clienteId: string,
  servs: { id: string; nombre: string }[],
  s: ServicioCfg,
  inicio: Date,
  metodoPago: MetodoPago,
): Promise<void> {
  const fin = masMin(inicio, s.dur);
  const [ct] = await tx
    .insert(cita)
    .values({
      negocioId,
      sucursalId,
      clienteId,
      especialistaId,
      inicio,
      fin,
      estado: EstadoCita.Completada,
      origen: OrigenCita.CreacionInterna,
      precioEst: cop(s.precio),
    })
    .returning();
  const srv = servs.find((x) => x.nombre === s.nombre)!;
  await tx.insert(citaServicio).values({ citaId: ct.id, servicioId: srv.id, precioAplicado: cop(s.precio) });

  const { ganProf, ganSalon } = repartir(s.precio, s.splitType, s.splitValor);
  await tx.insert(atencion).values({
    negocioId,
    sucursalId,
    citaId: ct.id,
    especialistaId,
    total: cop(s.precio),
    ganProf: cop(ganProf),
    ganSalon: cop(ganSalon),
    metodoPago,
    snapshotParam: { splitType: s.splitType, splitValor: s.splitValor, servicio: s.nombre },
  });
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed NO debe correr en producción (NODE_ENV=production).');
  }

  const hash = await argon2.hash(PASSWORD);

  await adminDb.transaction(async (tx) => {
    // Idempotencia: borra los negocios de demo por nombre (cascada borra el resto).
    await tx
      .delete(negocio)
      .where(inArray(negocio.nombre, [NOMBRE_PLATAFORMA, NOMBRE_BARBERIA, NOMBRE_SALON]));

    // Negocio "plataforma" + operador transversal.
    const [plataforma] = await tx
      .insert(negocio)
      .values({ nombre: NOMBRE_PLATAFORMA, perfil: PerfilNegocio.Salon })
      .returning();
    await tx
      .insert(suscripcion)
      .values({ negocioId: plataforma.id, plan: PlanSuscripcion.Empresarial, numEspecialistas: 0 });
    await tx.insert(usuario).values({
      negocioId: plataforma.id,
      nombre: 'Operador Plataforma',
      email: 'operador@orkalis.demo',
      passwordHash: hash,
      rol: RolUsuario.OperadorPlataforma,
    });

    await crearTenant(tx, BARBERIA, hash);
    await crearTenant(tx, SALON, hash);
  });

  console.log('\nSeed OK · 2 tenants (barbería + salón) + plataforma.');
  console.log(`  Contraseña común (dev): ${PASSWORD}`);
  console.log('  Credenciales completas en Plan-Ejecucion-V2/_CREDENCIALES-SEED.md');
}

seed()
  .then(() => adminClient.end())
  .catch(async (err) => {
    console.error('Seed falló:', err);
    await adminClient.end();
    process.exit(1);
  });
