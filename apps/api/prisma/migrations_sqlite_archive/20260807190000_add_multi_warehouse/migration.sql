-- Multi-warehouse

CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'RU',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_stocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_merchantId_code_key" ON "warehouses"("merchantId", "code");
CREATE INDEX IF NOT EXISTS "warehouses_tenantId_idx" ON "warehouses"("tenantId");
CREATE INDEX IF NOT EXISTS "warehouses_merchantId_idx" ON "warehouses"("merchantId");

CREATE UNIQUE INDEX IF NOT EXISTS "product_stocks_productId_warehouseId_key" ON "product_stocks"("productId", "warehouseId");
CREATE INDEX IF NOT EXISTS "product_stocks_warehouseId_idx" ON "product_stocks"("warehouseId");

DO $$ BEGIN
  ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
