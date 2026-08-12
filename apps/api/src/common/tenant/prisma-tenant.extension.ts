import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from './tenant.context';

/** Models that have optional tenantId column */
const MODELS_WITH_TENANT = new Set([
  'User',
  'Shop',
  'Product',
  'Order',
  'RfqRequest',
  'Warehouse',
]);

export function hasTenantField(model: string): boolean {
  return MODELS_WITH_TENANT.has(model);
}

/** Pure helper — used by extension and unit tests */
export function withTenantWhere<T extends Record<string, unknown> | undefined>(
  model: string,
  where: T,
): T | (T & { tenantId: string }) | { tenantId: string } {
  const tenantId = getCurrentTenantId();
  if (tenantId && hasTenantField(model)) {
    return { ...(where || {}), tenantId } as T & { tenantId: string };
  }
  return where as T;
}

export function withTenantCreateData<T extends Record<string, unknown>>(
  model: string,
  data: T,
): T {
  const tenantId = getCurrentTenantId();
  if (tenantId && hasTenantField(model)) {
    return { ...data, tenantId };
  }
  return data;
}

/**
 * Prisma Client Extension: auto-filter / inject tenantId from AsyncLocalStorage.
 * When no tenant is in context, queries pass through unchanged (single-tenant / SUPER_ADMIN).
 */
export function createTenantExtension() {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          args.where = withTenantWhere(model, args.where as any) as any;
          return query(args);
        },
        async findFirst({ args, query, model }) {
          args.where = withTenantWhere(model, args.where as any) as any;
          return query(args);
        },
        async count({ args, query, model }) {
          args.where = withTenantWhere(model, args.where as any) as any;
          return query(args);
        },
        async create({ args, query, model }) {
          args.data = withTenantCreateData(
            model,
            args.data as Record<string, unknown>,
          ) as typeof args.data;
          return query(args);
        },
        async createMany({ args, query, model }) {
          const tenantId = getCurrentTenantId();
          if (tenantId && hasTenantField(model) && Array.isArray(args.data)) {
            args.data = args.data.map((item: Record<string, unknown>) => ({
              ...item,
              tenantId,
            })) as typeof args.data;
          }
          return query(args);
        },
        async updateMany({ args, query, model }) {
          args.where = withTenantWhere(model, args.where as any) as any;
          return query(args);
        },
        async deleteMany({ args, query, model }) {
          args.where = withTenantWhere(model, args.where as any) as any;
          return query(args);
        },
      },
    },
  });
}

/** Alias from ТЗ samples */
export const createPrismaTenantExtension = createTenantExtension;
