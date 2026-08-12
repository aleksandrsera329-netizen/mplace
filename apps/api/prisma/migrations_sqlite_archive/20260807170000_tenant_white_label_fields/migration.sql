-- White-label branding fields on tenants

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT DEFAULT '#0f172a';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emailFromName" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emailFromAddress" TEXT;
