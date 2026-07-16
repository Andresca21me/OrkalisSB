import { PlanSuscripcion } from '@orkalis/shared';
import { PlanService } from './plan.service';

describe('PlanService', () => {
  const svc = new PlanService();

  it('cargo base cuando hay ≤ especialistas incluidos', () => {
    expect(svc.calcularCargo(PlanSuscripcion.Basico, 0)).toBe(80000);
    expect(svc.calcularCargo(PlanSuscripcion.Basico, 2)).toBe(80000);
  });

  it('suma costo por especialista adicional sobre los incluidos', () => {
    // Básico: base 80k, incluidos 2, extra 15k.
    expect(svc.calcularCargo(PlanSuscripcion.Basico, 3)).toBe(95000);
    expect(svc.calcularCargo(PlanSuscripcion.Basico, 5)).toBe(80000 + 3 * 15000);
    // Pro: base 130k, extra 18k.
    expect(svc.calcularCargo(PlanSuscripcion.Pro, 4)).toBe(130000 + 2 * 18000);
    // Empresarial: incluidos 15, base 720k, extra 25k.
    expect(svc.calcularCargo(PlanSuscripcion.Empresarial, 15)).toBe(720000);
    expect(svc.calcularCargo(PlanSuscripcion.Empresarial, 16)).toBe(745000);
  });

  it('máximo de sucursales por plan', () => {
    expect(svc.maxSucursales(PlanSuscripcion.Basico)).toBe(1);
    expect(svc.maxSucursales(PlanSuscripcion.Pro)).toBe(1);
    expect(svc.maxSucursales(PlanSuscripcion.Premium)).toBe(2);
    expect(svc.maxSucursales(PlanSuscripcion.Empresarial)).toBe(Infinity);
  });

  it('permiteSucursales respeta el tope del plan', () => {
    expect(svc.permiteSucursales(PlanSuscripcion.Basico, 1)).toBe(true);
    expect(svc.permiteSucursales(PlanSuscripcion.Basico, 2)).toBe(false);
    expect(svc.permiteSucursales(PlanSuscripcion.Premium, 2)).toBe(true);
    expect(svc.permiteSucursales(PlanSuscripcion.Empresarial, 50)).toBe(true);
  });

  it('cupos de mensajería: base + adicional por especialista extra', () => {
    // Básico base utility 600, +200 por extra; con 3 especialistas (1 extra) → 800.
    expect(svc.cuposMensajeria(PlanSuscripcion.Basico, 3).whatsappUtility).toBe(800);
    expect(svc.cuposMensajeria(PlanSuscripcion.Basico, 2).whatsappUtility).toBe(600);
    expect(svc.cuposMensajeria(PlanSuscripcion.Basico, 4).sms).toBe(40 + 2 * 15);
  });

  it('moduloPermitido: Básico no incluye módulos avanzados; Pro+ sí', () => {
    // Básico bloquea los tres módulos avanzados.
    expect(svc.moduloPermitido(PlanSuscripcion.Basico, 'modulo.inventario')).toBe(false);
    expect(svc.moduloPermitido(PlanSuscripcion.Basico, 'modulo.particion_por_especialista')).toBe(
      false,
    );
    expect(svc.moduloPermitido(PlanSuscripcion.Basico, 'modulo.cierre_periodo')).toBe(false);
    // Pro / Premium / Empresarial los incluyen.
    for (const plan of [PlanSuscripcion.Pro, PlanSuscripcion.Premium, PlanSuscripcion.Empresarial]) {
      expect(svc.moduloPermitido(plan, 'modulo.inventario')).toBe(true);
      expect(svc.moduloPermitido(plan, 'modulo.cierre_periodo')).toBe(true);
    }
    // Las claves no premium (operativas) se permiten en cualquier plan.
    expect(svc.moduloPermitido(PlanSuscripcion.Basico, 'agendamiento.aprobacion_manual')).toBe(true);
  });

  it('modulosPermitidos lista los módulos avanzados del plan', () => {
    expect(svc.modulosPermitidos(PlanSuscripcion.Basico)).toEqual([]);
    expect(svc.modulosPermitidos(PlanSuscripcion.Pro).sort()).toEqual(
      ['modulo.cierre_periodo', 'modulo.inventario', 'modulo.particion_por_especialista'].sort(),
    );
  });

  it('puedeAgregarEspecialista: bloquea al alcanzar el cupo', () => {
    expect(svc.puedeAgregarEspecialista(1, 2)).toBe(true);
    expect(svc.puedeAgregarEspecialista(2, 2)).toBe(false);
    expect(svc.puedeAgregarEspecialista(3, 2)).toBe(false);
  });

  it('cupoEspecialistas: el mayor entre pagados e incluidos del plan', () => {
    // Básico incluye 2: aunque se paguen 0, el cupo efectivo es 2.
    expect(svc.cupoEspecialistas(PlanSuscripcion.Basico, 0)).toBe(2);
    expect(svc.cupoEspecialistas(PlanSuscripcion.Basico, 5)).toBe(5);
    // Empresarial incluye 15.
    expect(svc.cupoEspecialistas(PlanSuscripcion.Empresarial, 3)).toBe(15);
  });

  // ── B1 · profundización: catálogo y matriz cruzada de cargos ───────────────

  it('catálogo: 4 planes con forma y valores correctos', () => {
    const cat = svc.catalogo();
    expect(cat.map((p) => p.plan)).toEqual([
      PlanSuscripcion.Basico,
      PlanSuscripcion.Pro,
      PlanSuscripcion.Premium,
      PlanSuscripcion.Empresarial,
    ]);
    const byPlan = Object.fromEntries(cat.map((p) => [p.plan, p]));
    // Empresarial: sucursales ilimitadas se exponen como null (sin Infinity en JSON).
    expect(byPlan[PlanSuscripcion.Empresarial].maxSucursales).toBeNull();
    expect(byPlan[PlanSuscripcion.Basico].maxSucursales).toBe(1);
    expect(byPlan[PlanSuscripcion.Premium].maxSucursales).toBe(2);
    // Módulos avanzados por plan.
    expect(byPlan[PlanSuscripcion.Basico].modulos).toEqual([]);
    expect(byPlan[PlanSuscripcion.Pro].modulos).toHaveLength(3);
    // `funciones` no filtra `maxSucursales` (va aparte) y trae las banderas clave.
    const f = byPlan[PlanSuscripcion.Premium].funciones as Record<string, unknown>;
    expect(f.maxSucursales).toBeUndefined();
    expect(f).toMatchObject({ api: true, fidelizacion: true, reportes: 'avanzado', smsRespaldo: true });
    // Básico: sin reportes, sin api, sin fidelización.
    expect(byPlan[PlanSuscripcion.Basico].funciones).toMatchObject({ api: false, fidelizacion: false, reportes: 'no' });
  });

  it('matriz cruzada: calcularCargo == base + max(0, n−incluidos)·adicional (sin deriva)', () => {
    for (const p of svc.catalogo()) {
      for (const n of [0, 1, 2, 3, 14, 15, 16, 30]) {
        const esperado = p.precioBase + Math.max(0, n - p.especialistasIncluidos) * p.costoEspecialistaAdicional;
        expect(svc.calcularCargo(p.plan, n)).toBe(esperado);
      }
    }
  });

  it('el cargo nunca baja al subir el nº de especialistas (monotonía)', () => {
    for (const p of svc.catalogo()) {
      let previo = -1;
      for (let n = 0; n <= 40; n++) {
        const cargo = svc.calcularCargo(p.plan, n);
        expect(cargo).toBeGreaterThanOrEqual(previo);
        previo = cargo;
      }
    }
  });
});
