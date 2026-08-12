import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../jwt-payload.interface';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // SUPER_ADMIN has all permissions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Only ADMIN/SUPER_ADMIN should hit permission-protected admin routes
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { role: user.role },
      select: { permission: true },
    });
    const granted = new Set(rows.map((r) => r.permission));
    const hasAll = required.every((p) => granted.has(p));
    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions: need ${required.join(', ')}`,
      );
    }
    return true;
  }
}
