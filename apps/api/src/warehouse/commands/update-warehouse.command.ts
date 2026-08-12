export class UpdateWarehouseCommand {
  constructor(
    public readonly warehouseId: string,
    public readonly merchantId: string,
    public readonly tenantId: string | null,
    public readonly data: Partial<{
      name: string;
      code: string;
      address: string;
      city: string;
      country: string;
      isDefault: boolean;
      isActive: boolean;
    }>,
  ) {}
}
