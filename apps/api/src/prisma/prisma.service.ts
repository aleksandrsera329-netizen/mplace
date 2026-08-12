import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from '../common/tenant/prisma-tenant.extension';

/**
 * Prisma service with optional tenant isolation extension.
 *
 * We do NOT replace `this` with `$extends()` return value in the constructor
 * (breaks Nest DI / lifecycle). Instead we apply the extension once in
 * onModuleInit by rebinding model delegates from the extended client onto this.
 * When ALS has no tenantId, the extension is a no-op filter.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private tenantExtended = false;

  constructor() {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.applyTenantExtension();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private applyTenantExtension(): void {
    if (this.tenantExtended) return;
    try {
      const extended = this.$extends(createTenantExtension()) as unknown as Record<
        string,
        unknown
      >;
      // Rebind model delegates (user, order, shop, …) so queries go through extension
      for (const key of Object.keys(extended)) {
        if (key.startsWith('$') || key.startsWith('_')) continue;
        const value = extended[key];
        if (value && typeof value === 'object') {
          try {
            Object.defineProperty(this, key, {
              value,
              writable: true,
              configurable: true,
              enumerable: true,
            });
          } catch {
            // ignore non-configurable
          }
        }
      }
      this.tenantExtended = true;
    } catch (error) {
      // Tenant isolation is a security boundary: fail closed instead of
      // silently falling back to an unscoped Prisma client.
      throw new Error(
        `Failed to initialize tenant isolation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
