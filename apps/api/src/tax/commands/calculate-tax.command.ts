export class CalculateTaxCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly items: Array<{
      productId: string;
      quantity: number;
      priceCents: number;
    }>,
    public readonly country: string = 'RU',
  ) {}
}
