import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

/**
 * Env shape validated at ConfigModule boot.
 * Production fail-fast: missing or weak secrets → process.exit(1).
 */
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  /** Required in production; optional in development/test if Redis not used */
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  MEILI_MASTER_KEY?: string;

  @IsOptional()
  @IsString()
  MEILISEARCH_API_KEY?: string;

  @IsOptional()
  @IsString()
  STORAGE_SIGN_SECRET?: string;

  @IsOptional()
  @IsString()
  POSTGRES_PASSWORD?: string;

  @IsOptional()
  @IsString()
  PAYMENT_PROVIDER?: string;
}

const WEAK_JWT = new Set([
  'dev-secret',
  'change_me',
  'secret',
  'jwt_secret',
  'test-secret',
  'e2e_jwt_secret_32_chars_minimum_xx',
]);

const WEAK_MEILI = new Set([
  'masterKeyChangeMe_at_least_16_chars',
  'masterKey',
  'change_me',
]);

const WEAK_PASSWORDS = new Set([
  'mplace',
  'password',
  'postgres',
  '123456',
  'admin',
  'root',
]);

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === '';
}

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`❌ CRITICAL: ${message}`);
  process.exit(1);
}

/**
 * NestJS ConfigModule `validate` hook.
 * Returns full config (not stripped) so optional vars remain available.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = String(config.NODE_ENV || process.env.NODE_ENV || 'development');

  const validated = plainToInstance(
    EnvironmentVariables,
    { ...config, NODE_ENV: nodeEnv },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  // ── Production fail-fast (no defaults, no weak secrets) ───────────
  // ALLOW_PILOT=true — cheap public demo (Neon/Render/Vercel) without Stripe/Redis/Meili.
  // Still requires strong JWT + real DATABASE_URL. Do not use for real money.
  const pilotMode = ['true', '1', 'yes'].includes(
    String(config.ALLOW_PILOT ?? process.env.ALLOW_PILOT ?? '')
      .toLowerCase()
      .trim(),
  );

  if (nodeEnv === 'production') {
    const required = pilotMode
      ? (['JWT_SECRET', 'DATABASE_URL'] as const)
      : ([
          'JWT_SECRET',
          'DATABASE_URL',
          'REDIS_URL',
          'MEILI_MASTER_KEY',
          'STRIPE_SECRET_KEY',
          'STRIPE_WEBHOOK_SECRET',
        ] as const);

    const missing = required.filter((key) => {
      const fromConfig = config[key];
      const fromEnv = process.env[key];
      return isBlank(fromConfig) && isBlank(fromEnv);
    });

    if (missing.length > 0) {
      fail(
        `Missing required production secrets: ${missing.join(', ')}. ` +
          'Set them via environment / secret manager — no defaults allowed.',
      );
    }

    const jwt = String(config.JWT_SECRET ?? process.env.JWT_SECRET ?? '');
    const jwtLower = jwt.toLowerCase();
    if (
      WEAK_JWT.has(jwt) ||
      WEAK_JWT.has(jwtLower) ||
      jwtLower.includes('change_me') ||
      jwt.length < 32
    ) {
      fail(
        'JWT_SECRET is missing, too short (<32), or using a default/insecure value',
      );
    }

    if (!pilotMode) {
      const meili = String(
        config.MEILI_MASTER_KEY ?? process.env.MEILI_MASTER_KEY ?? '',
      );
      if (WEAK_MEILI.has(meili) || meili.length < 16) {
        fail('MEILI_MASTER_KEY is using a default or weak value');
      }
    }

    const pgPass = String(
      config.POSTGRES_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? '',
    );
    if (pgPass && WEAK_PASSWORDS.has(pgPass)) {
      fail('POSTGRES_PASSWORD is using a default insecure value');
    }

    const dbUrl = String(config.DATABASE_URL ?? process.env.DATABASE_URL ?? '');
    // Detect common default credentials embedded in DATABASE_URL
    if (
      /:\/\/[^:]+:(mplace|password|postgres|123456)@/i.test(dbUrl) ||
      dbUrl.includes('CHANGE_ME')
    ) {
      fail(
        'DATABASE_URL embeds a default/weak password — use a strong credential',
      );
    }

    if (!pilotMode) {
      const paymentProvider = String(
        config.PAYMENT_PROVIDER ?? process.env.PAYMENT_PROVIDER ?? 'stripe',
      ).toLowerCase();
      if (paymentProvider === 'dev') {
        fail(
          'PAYMENT_PROVIDER=dev is forbidden in production — use stripe (or a real provider)',
        );
      }

      const allowDev = String(
        config.ALLOW_DEV_PAYMENTS ?? process.env.ALLOW_DEV_PAYMENTS ?? '',
      ).toLowerCase();
      if (allowDev === 'true' || allowDev === '1') {
        fail('ALLOW_DEV_PAYMENTS must not be true in production');
      }

      const stripeKey = String(
        config.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? '',
      );
      if (!stripeKey.startsWith('sk_')) {
        fail('STRIPE_SECRET_KEY must be a live/test Stripe secret (sk_...)');
      }
    }
  }

  return config;
}
