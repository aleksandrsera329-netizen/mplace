import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from './tenant.context';

type RequestWithUser = Request & {
  user?: { role?: string; tenantId?: string | null };
};

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    // 1. Header (API clients / white-label frontends)
    let tenantId = (req.headers['x-tenant-id'] as string) || undefined;
    let tenantSlug: string | undefined;

    // 2. Subdomain: acme.mplace.energy → slug "acme"
    const host = (req.headers.host || '').split(':')[0];
    const parts = host.split('.');
    const subdomain = parts.length >= 3 ? parts[0] : undefined;

    if (
      !tenantId &&
      subdomain &&
      subdomain !== 'www' &&
      subdomain !== 'api' &&
      subdomain !== 'localhost'
    ) {
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { slug: subdomain },
        });
        if (tenant) {
          tenantId = tenant.id;
          tenantSlug = tenant.slug;
        }
      } catch {
        // Table may not exist yet during migrate — continue without tenant
      }
    }

    // 3. Custom domain
    if (!tenantId && host && host !== 'localhost') {
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { domain: host },
        });
        if (tenant) {
          tenantId = tenant.id;
          tenantSlug = tenant.slug;
        }
      } catch {
        // ignore
      }
    }

    // JWT usually runs after middleware; still read if already present
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    runWithTenant(
      {
        tenantId: tenantId || null,
        tenantSlug,
        isSuperAdmin,
      },
      () => next(),
    );
  }
}
