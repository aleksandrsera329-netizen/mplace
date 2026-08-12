export class CalculateShippingCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly data: {
      warehouseId?: string;
      country: string;
      region?: string;
      weightKg: number;
      merchantId?: string;
    },
  ) {}
}
