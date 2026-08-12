-- Stage 7: durable payment webhook events (idempotency)

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadHash" TEXT,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "orderId" TEXT,
    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_externalId_key"
  ON "payment_webhook_events"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_eventType_idx"
  ON "payment_webhook_events"("eventType");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_status_idx"
  ON "payment_webhook_events"("status");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_orderId_idx"
  ON "payment_webhook_events"("orderId");
