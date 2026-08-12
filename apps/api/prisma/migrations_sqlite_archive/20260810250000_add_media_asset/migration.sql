-- Media ownership (Stage 1)

DO $$ BEGIN
  CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'KYC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "shopId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_storageKey_key" ON "media_assets"("storageKey");
CREATE INDEX IF NOT EXISTS "media_assets_ownerId_idx" ON "media_assets"("ownerId");
CREATE INDEX IF NOT EXISTS "media_assets_shopId_idx" ON "media_assets"("shopId");
CREATE INDEX IF NOT EXISTS "media_assets_entityType_entityId_idx" ON "media_assets"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
