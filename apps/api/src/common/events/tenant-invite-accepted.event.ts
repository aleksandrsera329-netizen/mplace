export class TenantInviteAcceptedEvent {
  constructor(
    public readonly inviteId: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
