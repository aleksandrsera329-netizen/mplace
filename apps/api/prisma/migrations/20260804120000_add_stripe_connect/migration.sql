-- AlterTable Shop: Stripe Connect fields
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "stripeOnboardedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "chargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Shop_stripeAccountId_key" ON "Shop"("stripeAccountId");

-- CreateTable StripeConnectedAccount
CREATE TABLE IF NOT EXISTS "StripeConnectedAccount" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'express',
    "status" TEXT,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeConnectedAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectedAccount_shopId_key" ON "StripeConnectedAccount"("shopId");
CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectedAccount_stripeAccountId_key" ON "StripeConnectedAccount"("stripeAccountId");

DO $$ BEGIN
  ALTER TABLE "StripeConnectedAccount" ADD CONSTRAINT "StripeConnectedAccount_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
