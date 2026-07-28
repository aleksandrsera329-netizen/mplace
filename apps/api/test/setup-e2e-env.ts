import { join } from 'path';

/**
 * Runs before any e2e test file loads AppModule.
 * Isolates e2e from development dev.db.
 */
const testDb = join(__dirname, '..', 'prisma', 'test.e2e.db');

process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL || `file:${testDb.replace(/\\/g, '/')}`;
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'e2e_jwt_secret_32_chars_minimum_xx';
process.env.PAYMENT_PROVIDER = 'dev';
process.env.ALLOW_DEV_PAYMENTS = 'true';
process.env.NODE_ENV = 'development';
process.env.DEV_PAYMENT_SECRET = 'e2e_dev_secret';
process.env.LOCAL_DEV_CONFIRM_LOOPBACK = 'false';
