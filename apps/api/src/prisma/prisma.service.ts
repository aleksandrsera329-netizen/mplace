import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  private readonly logger = new Logger(PrismaService.name);
  private tenantExtended = false;

  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
    this.applyTenantExtension();
  }

  /** Neon compute sleeps; first query after idle often fails. Retry so boot still works. */
  private async connectWithRetry(attempts = 6): Promise<void> {
    let last: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        if (i > 1) this.logger.log(`Postgres connected on attempt ${i}`);
        return;
      } catch (e) {
        last = e;
        this.logger.warn(
          `Postgres not ready (${i}/${attempts}): ${e instanceof Error ? e.message : e}`,
        );
        try {
          await this.$disconnect();
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, Math.min(8000, 400 * i)));
      }
    }
    this.logger.error(
      `Postgres still unreachable after ${attempts} attempts — public catalog will use fallback. ${
        last instanceof Error ? last.message : last
      }`,
    );
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
