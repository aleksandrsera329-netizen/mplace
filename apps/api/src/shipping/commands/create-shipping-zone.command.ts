export class CreateShippingZoneCommand {
  constructor(
    public readonly tenantId: string | null,
    public readonly data: {
      name: string;
      countries: string[];
      regions?: string[];
    },
  ) {}
}
