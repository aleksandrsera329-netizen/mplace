export class CreateWarehouseCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly merchantId: string,
    public readonly data: {
      name: string;
      code?: string;
      address?: string;
      city?: string;
      country?: string;
      isDefault?: boolean;
    },
  ) {}
}
