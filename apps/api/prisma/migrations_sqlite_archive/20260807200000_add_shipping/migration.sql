-- Shipping / logistics

CREATE TABLE IF NOT EXISTS "shipping_methods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "merchantId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_zones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "countries" TEXT[],
    "regions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_rates" (
    "id" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "shippingZoneId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "minWeightKg" DOUBLE PRECISION DEFAULT 0,
    "maxWeightKg" DOUBLE PRECISION,
    "priceCents" INTEGER NOT NULL,
    "pricePerKgCents" INTEGER,
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shipping_methods_tenantId_idx" ON "shipping_methods"("tenantId");
CREATE INDEX IF NOT EXISTS "shipping_methods_merchantId_idx" ON "shipping_methods"("merchantId");
CREATE INDEX IF NOT EXISTS "shipping_zones_tenantId_idx" ON "shipping_zones"("tenantId");
CREATE INDEX IF NOT EXISTS "shipping_rates_shippingMethodId_idx" ON "shipping_rates"("shippingMethodId");
CREATE INDEX IF NOT EXISTS "shipping_rates_shippingZoneId_idx" ON "shipping_rates"("shippingZoneId");
CREATE INDEX IF NOT EXISTS "shipping_rates_warehouseId_idx" ON "shipping_rates"("warehouseId");

DO $$ BEGIN
  ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_shippingMethodId_fkey"
    FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_shippingZoneId_fkey"
    FOREIGN KEY ("shippingZoneId") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
