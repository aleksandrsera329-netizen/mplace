import { UserRole } from '@prisma/client';

/** Runtime class so emitDecoratorMetadata works with isolatedModules */
export class JwtPayload {
  sub!: string;
  email!: string;
  role!: UserRole;
  shopId!: string | null;
  /** Multi-tenant: null for platform SUPER_ADMIN / legacy users */
  tenantId?: string | null;
}
