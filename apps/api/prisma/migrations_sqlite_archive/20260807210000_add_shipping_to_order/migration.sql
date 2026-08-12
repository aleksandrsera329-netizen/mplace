-- Shipping fields on Order

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingMethodId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingRateId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingPriceCents" INTEGER DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingDaysMin" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingDaysMax" INTEGER;

CREATE INDEX IF NOT EXISTS "Order_shippingMethodId_idx" ON "Order"("shippingMethodId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMethodId_fkey"
    FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
