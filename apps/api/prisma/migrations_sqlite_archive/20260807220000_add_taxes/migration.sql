-- Tax / VAT

CREATE TABLE IF NOT EXISTS "tax_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "rate" DECIMAL(5,4) NOT NULL,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_taxes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_taxes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_rates_tenantId_idx" ON "tax_rates"("tenantId");
CREATE INDEX IF NOT EXISTS "tax_rates_country_idx" ON "tax_rates"("country");
CREATE UNIQUE INDEX IF NOT EXISTS "product_taxes_productId_taxRateId_key" ON "product_taxes"("productId", "taxRateId");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "taxRateId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "taxCents" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "OrderItem_taxRateId_idx" ON "OrderItem"("taxRateId");

DO $$ BEGIN
  ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_taxes" ADD CONSTRAINT "product_taxes_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_taxes" ADD CONSTRAINT "product_taxes_taxRateId_fkey"
    FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_taxRateId_fkey"
    FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed platform default RU VAT 20%
INSERT INTO "tax_rates" ("id", "tenantId", "name", "code", "rate", "country", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT 'seed_vat20_ru', NULL, 'НДС 20%', 'VAT20', 0.2000, 'RU', true, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "tax_rates" WHERE "code" = 'VAT20' AND "country" = 'RU' AND "tenantId" IS NULL);
