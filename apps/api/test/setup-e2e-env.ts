/**
 * Runs before any e2e test file loads AppModule.
 * Uses PostgreSQL (matches prisma schema). Prefer E2E_DATABASE_URL,
 * then local docker default mplace_e2e DB.
 */
// Host port 5433 → docker postgres (see docker-compose.yml)
const defaultE2eUrl =
  'postgresql://mplace:mplace@127.0.0.1:5433/mplace_e2e?schema=public';

process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  process.env.DATABASE_URL ||
  defaultE2eUrl;

// Force isolated e2e URL when still pointing at sqlite leftovers
if (
  process.env.DATABASE_URL.startsWith('file:') ||
  process.env.DATABASE_URL.includes('sqlite')
) {
  process.env.DATABASE_URL = defaultE2eUrl;
}

process.env.E2E_DATABASE_URL = process.env.DATABASE_URL;
// Never NODE_ENV=production in e2e — Stage 4 fail-fast would require Stripe etc.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e_jwt_secret_32_chars_minimum_xx';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.MEILI_MASTER_KEY =
  process.env.MEILI_MASTER_KEY || 'e2e_meili_master_key_16';
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'dev';
process.env.ALLOW_DEV_PAYMENTS = 'true';
process.env.DEV_PAYMENT_SECRET =
  process.env.DEV_PAYMENT_SECRET || 'e2e_dev_secret';
process.env.LOCAL_DEV_CONFIRM_LOOPBACK = 'false';
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
process.env.MEILISEARCH_URL =
  process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
