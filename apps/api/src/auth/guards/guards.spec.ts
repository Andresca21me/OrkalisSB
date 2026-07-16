import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@orkalis/shared';
import { RolesGuard } from './roles.guard';
import { SucursalScopeGuard } from './sucursal-scope.guard';
import type { TenantContext } from '../../db/tenant-context';

/** Construye un ExecutionContext falso con una request dada. */
function ctxConRequest(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const tenant = (rol: RolUsuario): TenantContext => ({
    negocioId: 'n1',
    sucursalIds: null,
    rol,
  });

  it('permite si no hay @Roles declarados', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctxConRequest({ tenantContext: tenant(RolUsuario.Especialista) }))).toBe(
      true,
    );
  });

  it('permite si el rol está autorizado', () => {
    const reflector = {
      getAllAndOverride: () => [RolUsuario.Admin],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctxConRequest({ tenantContext: tenant(RolUsuario.Admin) }))).toBe(true);
  });

  it('rechaza (403) si el rol NO está autorizado', () => {
    const reflector = {
      getAllAndOverride: () => [RolUsuario.Admin],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(ctxConRequest({ tenantContext: tenant(RolUsuario.Recepcionista) })),
    ).toThrow(ForbiddenException);
  });
});

describe('SucursalScopeGuard', () => {
  const guard = new SucursalScopeGuard();

  it('admin consolidado (sucursalIds=null) pasa siempre', () => {
    const req = { tenantContext: { negocioId: 'n', sucursalIds: null, rol: 'admin' }, params: { sucursalId: 'X' } };
    expect(guard.canActivate(ctxConRequest(req))).toBe(true);
  });

  it('permite si la sucursal pedida está en el alcance', () => {
    const req = { tenantContext: { negocioId: 'n', sucursalIds: ['A', 'B'], rol: 'especialista' }, params: { sucursalId: 'A' } };
    expect(guard.canActivate(ctxConRequest(req))).toBe(true);
  });

  it('rechaza (403) si la sucursal pedida está fuera del alcance', () => {
    const req = { tenantContext: { negocioId: 'n', sucursalIds: ['A'], rol: 'especialista' }, params: { sucursalId: 'Z' } };
    expect(() => guard.canActivate(ctxConRequest(req))).toThrow(ForbiddenException);
  });

  it('si no se pide sucursal explícita, no restringe', () => {
    const req = { tenantContext: { negocioId: 'n', sucursalIds: ['A'], rol: 'especialista' }, params: {}, query: {}, body: {} };
    expect(guard.canActivate(ctxConRequest(req))).toBe(true);
  });
});
