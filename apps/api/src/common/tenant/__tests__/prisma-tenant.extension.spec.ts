import {
  createTenantExtension,
  hasTenantField,
  withTenantCreateData,
  withTenantUpdateData,
  withTenantUniqueWhere,
  withTenantWhere,
} from '../prisma-tenant.extension';
import { runWithTenant } from '../tenant.context';

describe('Prisma Tenant Extension (isolation)', () => {
  const tenantA = 'tenant-a-id';
  const tenantB = 'tenant-b-id';

  it('hasTenantField covers key models', () => {
    expect(hasTenantField('Product')).toBe(true);
    expect(hasTenantField('Shop')).toBe(true);
    expect(hasTenantField('User')).toBe(true);
    expect(hasTenantField('RefreshToken')).toBe(true);
    expect(hasTenantField('Document')).toBe(true);
    expect(hasTenantField('Notification')).toBe(true);
    expect(hasTenantField('TaxRate')).toBe(true);
    expect(hasTenantField('TenantInvite')).toBe(true);
    expect(hasTenantField('Warehouse')).toBe(true);
    expect(hasTenantField('ShippingMethod')).toBe(true);
    expect(hasTenantField('ShippingZone')).toBe(true);
    expect(hasTenantField('RfqRequest')).toBe(true);
    expect(hasTenantField('Order')).toBe(true);
    expect(hasTenantField('RfqRequest')).toBe(true);
    expect(hasTenantField('Outbox')).toBe(false);
  });

  it('should filter products by current tenant A', () => {
    runWithTenant({ tenantId: tenantA }, () => {
      const where = withTenantWhere('Product', { status: 'ACTIVE' });
      expect(where).toEqual({ status: 'ACTIVE', tenantId: tenantA });
    });
  });

  it('should filter products by current tenant B (isolation)', () => {
    runWithTenant({ tenantId: tenantB }, () => {
      const where = withTenantWhere('Product', undefined);
      expect(where).toEqual({ tenantId: tenantB });
    });
  });

  it('SUPER_ADMIN / no tenant context — no filter', () => {
    // outside ALS — clear context
    const where = withTenantWhere('Product', { status: 'ACTIVE' });
    expect(where).toEqual({ status: 'ACTIVE' });
    expect((where as { tenantId?: string }).tenantId).toBeUndefined();
  });

  it('should scope unique reads and mutations', () => {
    runWithTenant({ tenantId: tenantA }, () => {
      expect(withTenantUniqueWhere('Product', { id: 'p1' })).toEqual({
        id: 'p1',
        tenantId: tenantA,
      });
      expect(
        withTenantUpdateData('Product', { name: 'changed', tenantId: tenantB }),
      ).toEqual({ name: 'changed', tenantId: tenantA });
    });
  });

  it('should inject tenantId on create', () => {
    runWithTenant({ tenantId: tenantA }, () => {
      const data = withTenantCreateData('Product', {
        name: 'P1',
        priceCents: 1000,
      });
      expect(data).toEqual({
        name: 'P1',
        priceCents: 1000,
        tenantId: tenantA,
      });
    });
  });

  it('does not inject tenantId for models without field', () => {
    runWithTenant({ tenantId: tenantA }, () => {
      const where = withTenantWhere('Outbox', { status: 'PENDING' });
      expect(where).toEqual({ status: 'PENDING' });
    });
  });

  it('createTenantExtension is defined (Prisma defineExtension)', () => {
    const ext = createTenantExtension();
    expect(ext).toBeDefined();
  });

  it('simulates multi-tenant product lists', () => {
    const all = [
      { name: 'Product A1', tenantId: tenantA },
      { name: 'Product A2', tenantId: tenantA },
      { name: 'Product B1', tenantId: tenantB },
    ];

    const forA = runWithTenant({ tenantId: tenantA }, () => {
      const filter = withTenantWhere('Product', {}) as { tenantId: string };
      return all.filter((p) => p.tenantId === filter.tenantId);
    });
    expect(forA).toHaveLength(2);
    expect(forA.every((p) => p.tenantId === tenantA)).toBe(true);

    const forB = runWithTenant({ tenantId: tenantB }, () => {
      const filter = withTenantWhere('Product', {}) as { tenantId: string };
      return all.filter((p) => p.tenantId === filter.tenantId);
    });
    expect(forB).toHaveLength(1);
    expect(forB[0].name).toBe('Product B1');

    // no context — see everything
    const unscoped = all.filter(() => true);
    expect(unscoped.length).toBeGreaterThanOrEqual(3);
  });
});
