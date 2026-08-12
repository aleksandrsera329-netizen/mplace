import { UserRole } from '@prisma/client';

/** Invite role aliases map to UserRole on accept */
export type InviteRoleInput = 'BUYER' | 'MERCHANT' | 'TENANT_ADMIN' | UserRole;

export class CreateInviteCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly role: InviteRoleInput,
    public readonly invitedById: string,
  ) {}
}
