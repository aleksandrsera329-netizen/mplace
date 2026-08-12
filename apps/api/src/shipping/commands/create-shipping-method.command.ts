export class CreateShippingMethodCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly merchantId: string | null,
    public readonly data: {
      name: string;
      code?: string;
      description?: string;
      isActive?: boolean;
    },
  ) {}
}
