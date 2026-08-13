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

    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const tenantId = getCurrentTenantId();

    if (!tenantId) {
      if (!user) return true;
      throw new ForbiddenException('Tenant не определён');
    }

    if (user?.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Нет доступа к этому tenant');
    }

    return true;
  }
}
