import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { getCurrentTenantId } from './tenant.context';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; tenantId?: string | null };
    }>();
    const user = request.user;

    // Super Admin can operate across tenants without context
    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const tenantId = getCurrentTenantId();

    // Authenticated non-super user must have resolved tenant (header/subdomain/ALS)
    if (!tenantId) {
      if (!user) {
        // Public route with TenantGuard still applied — allow
        return true;
      }
      throw new ForbiddenException('Tenant не определён');
    }

    // User must belong to the resolved tenant
    if (user?.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Нет доступа к этому tenant');
    }

    return true;
  }
}
