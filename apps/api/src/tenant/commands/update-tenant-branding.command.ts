export type TenantBrandingData = {
  name?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string | null;
  emailFromName?: string | null;
  emailFromAddress?: string | null;
  domain?: string | null;
};

export class UpdateTenantBrandingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly data: TenantBrandingData,
    /** SUPER_ADMIN may update any tenant */
    public readonly actorRole?: string,
    public readonly actorTenantId?: string | null,
    public readonly logoFile?: Express.Multer.File,
    public readonly faviconFile?: Express.Multer.File,
  ) {}
}
