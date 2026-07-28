import { UserRole } from '@prisma/client';

/** Runtime class so emitDecoratorMetadata works with isolatedModules */
export class JwtPayload {
  sub!: string;
  email!: string;
  role!: UserRole;
  shopId!: string | null;
}
