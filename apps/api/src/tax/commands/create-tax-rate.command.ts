export class CreateTaxRateCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly data: {
      name: string;
      code?: string;
      rate: number;
      country: string;
      isDefault?: boolean;
    },
  ) {}
}
