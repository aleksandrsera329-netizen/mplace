-- Stage 9: double-entry financial ledger

DO $$ BEGIN
  CREATE TYPE "FinancialTransactionType" AS ENUM (
    'PAYMENT', 'REFUND', 'PAYOUT', 'COMMISSION', 'ADJUSTMENT', 'CHARGEBACK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialTransactionStatus" AS ENUM (
    'PENDING', 'POSTED', 'REVERSED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM (
    'PLATFORM_CLEARING',
    'PLATFORM_COMMISSION',
    'VENDOR_PAYABLE',
    'VENDOR_AVAILABLE',
    'CUSTOMER_BALANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EntryDirection" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "financial_transactions" (
    "id" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "account" "AccountType" NOT NULL,
    "shopId" TEXT,
    "direction" "EntryDirection" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_transactions_referenceType_referenceId_idx"
  ON "financial_transactions"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "financial_transactions_type_idx"
  ON "financial_transactions"("type");
CREATE INDEX IF NOT EXISTS "financial_transactions_status_idx"
  ON "financial_transactions"("status");

CREATE INDEX IF NOT EXISTS "financial_entries_transactionId_idx"
  ON "financial_entries"("transactionId");
CREATE INDEX IF NOT EXISTS "financial_entries_account_shopId_idx"
  ON "financial_entries"("account", "shopId");
CREATE INDEX IF NOT EXISTS "financial_entries_shopId_idx"
  ON "financial_entries"("shopId");

DO $$ BEGIN
  ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
