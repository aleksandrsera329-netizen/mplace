import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Ensure e2e Postgres DB exists and schema is applied.
 */
export default async function globalSetup() {
  const defaultE2eUrl =
    'postgresql://mplace:mplace@127.0.0.1:5433/mplace_e2e?schema=public';

  let databaseUrl =
    process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || defaultE2eUrl;

  if (databaseUrl.startsWith('file:') || databaseUrl.includes('sqlite')) {
    databaseUrl = defaultE2eUrl;
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.E2E_DATABASE_URL = databaseUrl;

  // Create database if missing (ignore errors if already exists / docker offline)
  try {
    execSync(
      'docker exec mplace-postgres psql -U mplace -d postgres -c "CREATE DATABASE mplace_e2e;"',
      { stdio: 'pipe' },
    );
  } catch {
    /* already exists or docker not running */
  }

  const cwd = join(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: databaseUrl };

  // E2E uses the same checked-in PostgreSQL migration history as production.
  execSync('npx prisma migrate deploy', {
    cwd,
    env,
    stdio: 'inherit',
  });
}
