export class CreateShippingRateCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly data: {
      shippingMethodId: string;
      shippingZoneId: string;
      warehouseId?: string;
      minWeightKg?: number;
      maxWeightKg?: number;
      priceCents: number;
      pricePerKgCents?: number;
      estimatedDaysMin?: number;
      estimatedDaysMax?: number;
    },
  ) {}
}
