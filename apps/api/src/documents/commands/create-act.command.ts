export class CreateActCommand {
  constructor(
    public readonly orderId: string,
    public readonly tenantId: string | null,
    public readonly userId?: string,
    public readonly role?: string,
    public readonly shopId?: string | null,
  ) {}
}
