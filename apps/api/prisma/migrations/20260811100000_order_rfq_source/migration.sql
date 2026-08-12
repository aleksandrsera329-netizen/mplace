-- Stage 12: Order source RFQ + links

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CART';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "rfqId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offerId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_rfqId_idx" ON "Order"("rfqId");
CREATE INDEX IF NOT EXISTS "Order_source_idx" ON "Order"("source");
