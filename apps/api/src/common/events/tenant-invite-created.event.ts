export class TenantInviteCreatedEvent {
  constructor(
    public readonly inviteId: string,
    public readonly tenantId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly token: string,
    public readonly tenantName?: string,
  ) {}
}
