-- Stage 5: Refresh token family + rotation tracking

-- familyId: one login session chain (required after backfill)
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "replacedBy" TEXT;

-- Backfill existing rows: each token is its own family (legacy sessions)
UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;

ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
-- tokenHash already has unique index; keep extra lookup index only if missing
CREATE INDEX IF NOT EXISTS "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
