-- Stage 10: payout concurrency — RESERVED status + reserve fields

DO $$ BEGIN
  ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'FAILED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_stripeTransferId_key"
  ON "PayoutRequest"("stripeTransferId");
CREATE INDEX IF NOT EXISTS "PayoutRequest_status_idx" ON "PayoutRequest"("status");
