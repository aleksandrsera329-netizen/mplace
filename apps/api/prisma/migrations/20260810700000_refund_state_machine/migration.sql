-- Stage 8: Refund state machine (safe enum rewrite for PostgreSQL)

-- 1) New enum with full state machine
DO $$ BEGIN
  CREATE TYPE "RefundStatus_new" AS ENUM (
    'REQUESTED',
    'APPROVED',
    'PROVIDER_REQUESTED',
    'PROVIDER_CONFIRMED',
    'COMPLETED',
    'REJECTED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Convert column via text (maps legacy PENDING → REQUESTED)
ALTER TABLE "Refund" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Refund" ALTER COLUMN "status" TYPE TEXT USING ("status"::text);
UPDATE "Refund" SET "status" = 'REQUESTED' WHERE "status" = 'PENDING';
UPDATE "Refund" SET "status" = 'REQUESTED' WHERE "status" NOT IN (
  'REQUESTED', 'APPROVED', 'PROVIDER_REQUESTED', 'PROVIDER_CONFIRMED',
  'COMPLETED', 'REJECTED', 'FAILED'
);

ALTER TABLE "Refund" ALTER COLUMN "status" TYPE "RefundStatus_new"
  USING ("status"::"RefundStatus_new");

-- 3) Replace old enum type name
DROP TYPE IF EXISTS "RefundStatus";
ALTER TYPE "RefundStatus_new" RENAME TO "RefundStatus";

ALTER TABLE "Refund" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- 4) Extra columns for provider confirmation
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "requestedById" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "providerRequestedAt" TIMESTAMP(3);
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "providerConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

UPDATE "Refund"
SET "stripeRefundId" = substring("adminNote" from 'stripe_refund=([a-zA-Z0-9_]+)')
WHERE "stripeRefundId" IS NULL AND "adminNote" IS NOT NULL AND "adminNote" LIKE 'stripe_refund=%';

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "Refund_stripeRefundId_idx" ON "Refund"("stripeRefundId");
