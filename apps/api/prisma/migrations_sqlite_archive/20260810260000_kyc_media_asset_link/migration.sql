-- Stage 2: Private KYC — link KycDocument ↔ MediaAsset

-- Legacy filePath becomes optional (new uploads use mediaAsset only)
ALTER TABLE "KycDocument" ALTER COLUMN "filePath" DROP NOT NULL;

-- Optional 1:1 MediaAsset for private storage + ACL
ALTER TABLE "KycDocument" ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "KycDocument_mediaAssetId_key" ON "KycDocument"("mediaAssetId");
CREATE INDEX IF NOT EXISTS "KycDocument_status_idx" ON "KycDocument"("status");

DO $$ BEGIN
  ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
