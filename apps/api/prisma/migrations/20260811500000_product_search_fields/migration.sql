-- Stage 17: product fields for Meilisearch facets/filters

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "moq" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "attributes" JSONB;

CREATE INDEX IF NOT EXISTS "Product_brand_idx" ON "Product"("brand");
