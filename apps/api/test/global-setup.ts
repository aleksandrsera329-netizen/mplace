import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Prepare isolated SQLite DB + apply migrations before the e2e suite.
 */
export default async function globalSetup() {
  const testDb = join(__dirname, '..', 'prisma', 'test.e2e.db');
  const journal = `${testDb}-journal`;

  for (const f of [testDb, journal]) {
    if (existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore locked */
      }
    }
  }

  const databaseUrl = `file:${testDb.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.E2E_DATABASE_URL = databaseUrl;

  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
