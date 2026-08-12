import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../tenant.guard';
import { runWithTenant } from '../tenant.context';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  const mockContext = (
    user: { role?: string; tenantId?: string | null } | undefined,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          user,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow when tenant is set for tenant admin', () => {
    runWithTenant({ tenantId: 'tenant-123' }, () => {
      expect(
        guard.canActivate(
          mockContext({ role: 'ADMIN', tenantId: 'tenant-123' }),
        ),
      ).toBe(true);
    });
  });

  it('should throw when no tenant and not SUPER_ADMIN', () => {
    expect(() =>
      guard.canActivate(mockContext({ role: 'ADMIN', tenantId: 'tenant-123' })),
    ).toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN without tenant', () => {
    expect(
      guard.canActivate(mockContext({ role: 'SUPER_ADMIN', tenantId: null })),
    ).toBe(true);
  });

  it('should forbid user from another tenant', () => {
    runWithTenant({ tenantId: 'tenant-A' }, () => {
      expect(() =>
        guard.canActivate(
          mockContext({ role: 'ADMIN', tenantId: 'tenant-B' }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  it('should allow public request without user when no tenant', () => {
    expect(guard.canActivate(mockContext(undefined))).toBe(true);
  });
});
