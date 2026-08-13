import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantIsolationInterceptor } from '../tenant-isolation.interceptor';
import { getCurrentTenantId, runWithTenant } from '../tenant.context';

describe('TenantIsolationInterceptor', () => {
  const interceptor = new TenantIsolationInterceptor();

  const ctx = (user?: { role?: string; tenantId?: string | null }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('hydrates ALS from the authenticated JWT tenant', () => {
    runWithTenant({ tenantId: null }, () => {
      interceptor.intercept(ctx({ role: 'MERCHANT', tenantId: 'tenant-A' }), {
        handle: () => of({}),
      } as any);
      expect(getCurrentTenantId()).toBe('tenant-A');
    });
  });

  it('rejects an explicit tenant mismatch', () => {
    runWithTenant({ tenantId: 'tenant-A' }, () => {
      expect(() =>
        interceptor.intercept(ctx({ role: 'MERCHANT', tenantId: 'tenant-B' }), {
          handle: () => of({}),
        } as any),
      ).toThrow('Нет доступа к этому tenant');
    });
  });

  it('allows platform ADMIN users that intentionally have no tenant', () => {
    runWithTenant({ tenantId: null }, () => {
      expect(
        interceptor.intercept(ctx({ role: 'ADMIN', tenantId: null }), {
          handle: () => of({}),
        } as any),
      ).toBeDefined();
    });
  });

  it('allows super admins without a tenant context', () => {
    runWithTenant({ tenantId: null }, () => {
      expect(
        interceptor.intercept(ctx({ role: 'SUPER_ADMIN', tenantId: null }), {
          handle: () => of({}),
        } as any),
      ).toBeDefined();
    });
  });
});
