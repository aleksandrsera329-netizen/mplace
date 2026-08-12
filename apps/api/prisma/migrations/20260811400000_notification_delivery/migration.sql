-- Stage 18: NotificationType/Channel enums + NotificationDelivery

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'ORDER_CREATED',
    'ORDER_PAID',
    'ORDER_SHIPPED',
    'ORDER_CANCELLED',
    'ORDER_STATUS',
    'RFQ_CREATED',
    'RFQ_OFFER_RECEIVED',
    'RFQ_AWARDED',
    'RFQ_NEW',
    'RFQ_RESPONSE',
    'PAYOUT_REQUESTED',
    'PAYOUT_COMPLETED',
    'PAYOUT',
    'KYC_APPROVED',
    'KYC_REJECTED',
    'PASSWORD_CHANGED',
    'INVITE',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM (
    'IN_APP',
    'EMAIL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Normalize legacy free-text types before cast
UPDATE "notifications"
SET "type" = CASE
  WHEN "type" IN (
    'ORDER_CREATED','ORDER_PAID','ORDER_SHIPPED','ORDER_CANCELLED','ORDER_STATUS',
    'RFQ_CREATED','RFQ_OFFER_RECEIVED','RFQ_AWARDED','RFQ_NEW','RFQ_RESPONSE',
    'PAYOUT_REQUESTED','PAYOUT_COMPLETED','PAYOUT',
    'KYC_APPROVED','KYC_REJECTED','PASSWORD_CHANGED','INVITE','SYSTEM'
  ) THEN "type"
  WHEN "type" ILIKE '%ORDER%' THEN 'ORDER_STATUS'
  WHEN "type" ILIKE '%RFQ%' THEN 'RFQ_NEW'
  WHEN "type" ILIKE '%PAYOUT%' THEN 'PAYOUT'
  WHEN "type" ILIKE '%KYC%APPROV%' THEN 'KYC_APPROVED'
  WHEN "type" ILIKE '%KYC%REJECT%' THEN 'KYC_REJECTED'
  ELSE 'SYSTEM'
END
WHERE "type" IS NOT NULL;

-- 3) Convert type column to enum
ALTER TABLE "notifications"
  ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::"NotificationType");

-- 4) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_idx"
  ON "notifications"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications"("userId", "createdAt");

-- 5) Delivery table
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_deliveries_notificationId_idx"
  ON "notification_deliveries"("notificationId");
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_idx"
  ON "notification_deliveries"("status");

DO $$ BEGIN
  ALTER TABLE "notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "notifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
