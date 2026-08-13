import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  getCurrentTenantId,
  setCurrentTenantId,
} from './tenant.context';

type AuthenticatedRequest = {
  user?: {
    role?: string;
    tenantId?: string | null;
  };
};

/**
 * Global post-authentication tenant enforcement.
 *
 * Middleware resolves a tenant from the host/header before Passport runs.
 * This interceptor runs after route guards, so req.user is authoritative.
 * For tenant users without an explicit host/header it fills ALS from JWT.
 * Any explicit tenant mismatch is rejected before controller/business logic.
 */
@Injectable()
export class TenantIsolationInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (
      !user ||
      user.role === 'SUPER_ADMIN' ||
      (user.role === 'ADMIN' && !user.tenantId)
    ) {
      return next.handle();
    }

    const resolvedTenantId = getCurrentTenantId();
    const userTenantId = user.tenantId ?? null;

    if (resolvedTenantId && userTenantId && resolvedTenantId !== userTenantId) {
      throw new ForbiddenException('Нет доступа к этому tenant');
    }

    if (!resolvedTenantId && userTenantId) {
      setCurrentTenantId(userTenantId);
    }

    if (!getCurrentTenantId()) {
      throw new ForbiddenException('Tenant не определён');
    }

    return next.handle();
  }
}
