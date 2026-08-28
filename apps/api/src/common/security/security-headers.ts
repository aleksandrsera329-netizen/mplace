import type { HelmetOptions } from 'helmet';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Stage 22 — Permissions-Policy (restrict powerful browser features) */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()';

/**
 * Helmet options for Nest API.
 * CSP is API-oriented (JSON + Swagger); browser storefront should also set CSP via Next/nginx.
 */
export function buildHelmetOptions(opts?: {
  /** When true, slightly relax CSP for Swagger UI at /api/docs */
  enableSwagger?: boolean;
  isProduction?: boolean;
}): HelmetOptions {
  const enableSwagger = opts?.enableSwagger !== false;
  const isProduction = !!opts?.isProduction;

  return {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        // Swagger UI needs inline styles/scripts when served from same origin
        scriptSrc: enableSwagger
          ? ["'self'", "'unsafe-inline'"]
          : ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        // Stripe Checkout / Elements if ever embedded
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
        ...(isProduction
          ? { upgradeInsecureRequests: [] as string[] }
          : {}),
      },
    },
    strictTransportSecurity: {
      maxAge: 31_536_000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Avoid breaking Swagger / multi-origin tooling
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    xssFilter: true,
  };
}

/** Default local allowlist — never includes `*` */
export const DEFAULT_CORS_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:8088',
  'http://127.0.0.1:8088',
  'https://mplace-vu4o.onrender.com',
] as const;

/**
 * Parse CORS_ORIGINS env.
 * Never returns `true` / `*` when credentials are required — rejects wildcard.
 */
export function resolveCorsOrigins(
  raw: string | undefined,
  nodeEnv?: string,
): string[] {
  const isProd = (nodeEnv || process.env.NODE_ENV) === 'production';
  const defaults = [...DEFAULT_CORS_ORIGINS];

  if (!raw || !raw.trim()) {
    return defaults;
  }

  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (list.length === 0) return defaults;

  if (list.includes('*')) {
    // Never allow * with credentials:true — fall back to allowlist
    void isProd;
    return withPublicOrigins(defaults);
  }

  return withPublicOrigins(list);
}

function withPublicOrigins(list: string[]): string[] {
  const out = [...list];
  for (const key of ['APP_PUBLIC_URL', 'RENDER_EXTERNAL_URL'] as const) {
    const v = (process.env[key] || '').trim().replace(/\/$/, '');
    if (v.startsWith('http') && !out.includes(v)) out.push(v);
  }
  return out;
}

export function buildCorsOptions(
  origins: string[],
  extraHeaders: string[] = [],
): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      // Same-origin / server-to-server / curl (no Origin header)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Key',
      'X-Order-Access-Token',
      'Idempotency-Key',
      'X-Idempotency-Key',
      'X-Request-Id',
      ...extraHeaders,
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'X-Request-Id',
      'X-Correlation-Id',
    ],
    maxAge: 600,
  };
}
