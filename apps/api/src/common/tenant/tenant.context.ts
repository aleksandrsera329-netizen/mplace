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

export function runWithTenant<T>(data: TenantContextData, fn: () => T): T {
  return TenantStorage.run(data, fn);
}
