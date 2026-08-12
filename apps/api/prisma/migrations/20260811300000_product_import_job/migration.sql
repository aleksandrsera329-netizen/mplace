-- Stage 16: product import jobs for merchant bulk CSV

CREATE TABLE IF NOT EXISTS "product_import_jobs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER,
    "validRows" INTEGER,
    "errorRows" INTEGER,
    "errors" JSONB,
    "preview" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "product_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_import_jobs_shopId_status_idx"
  ON "product_import_jobs"("shopId", "status");
CREATE INDEX IF NOT EXISTS "product_import_jobs_createdAt_idx"
  ON "product_import_jobs"("createdAt");

DO $$ BEGIN
  ALTER TABLE "product_import_jobs" ADD CONSTRAINT "product_import_jobs_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Product_shopId_sku_idx" ON "Product"("shopId", "sku");
