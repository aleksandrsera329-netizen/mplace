import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string | null;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
}

export const TenantStorage = new AsyncLocalStorage<TenantContextData>();

export function getCurrentTenantId(): string | null {
  return TenantStorage.getStore()?.tenantId ?? null;
}

export function getTenantContext(): TenantContextData | undefined {
  return TenantStorage.getStore();
}

/** Update the active request tenant after authentication has populated req.user. */
export function setCurrentTenantId(
  tenantId: string | null,
  tenantSlug?: string,
): void {
  const store = TenantStorage.getStore();
  if (!store) {
    throw new Error('Tenant context is not initialized');
  }
  store.tenantId = tenantId;
  if (tenantSlug !== undefined) store.tenantSlug = tenantSlug;
}

export function runWithTenant<T>(data: TenantContextData, fn: () => T): T {
  return TenantStorage.run(data, fn);
}
