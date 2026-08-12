-- Tenant invites

CREATE TABLE IF NOT EXISTS "tenant_invites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_token_key" ON "tenant_invites"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_tenantId_email_key" ON "tenant_invites"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "tenant_invites_token_idx" ON "tenant_invites"("token");
CREATE INDEX IF NOT EXISTS "tenant_invites_tenantId_idx" ON "tenant_invites"("tenantId");

DO $$ BEGIN
  ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
