-- Stage 11: InventoryReservation for checkout hold / payment confirm

DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM (
    'ACTIVE', 'CONFIRMED', 'EXPIRED', 'RELEASED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reservedStock" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "inventory_reservations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "warehouseId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_reservations_productId_status_idx"
  ON "inventory_reservations"("productId", "status");
CREATE INDEX IF NOT EXISTS "inventory_reservations_orderId_idx"
  ON "inventory_reservations"("orderId");
CREATE INDEX IF NOT EXISTS "inventory_reservations_expiresAt_idx"
  ON "inventory_reservations"("expiresAt");
CREATE INDEX IF NOT EXISTS "inventory_reservations_status_expiresAt_idx"
  ON "inventory_reservations"("status", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
