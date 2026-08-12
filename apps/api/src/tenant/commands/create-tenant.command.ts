export class CreateTenantCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly ownerEmail: string,
    public readonly ownerPassword: string,
    public readonly ownerName?: string,
    public readonly plan: string = 'STARTER',
  ) {}
}
