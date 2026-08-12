-- Stage 6: granular permissions + admin TOTP metadata

DO $$ BEGIN
  CREATE TYPE "Permission" AS ENUM (
    'users_read',
    'users_write',
    'shops_read',
    'shops_verify',
    'shops_suspend',
    'orders_read',
    'orders_refund',
    'payments_read',
    'payments_refund',
    'payouts_read',
    'payouts_approve',
    'kyc_read',
    'kyc_approve',
    'disputes_read',
    'disputes_resolve',
    'audit_read'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permission_key"
  ON "RolePermission"("role", "permission");
CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission"("role");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpVerifiedAt" TIMESTAMP(3);
