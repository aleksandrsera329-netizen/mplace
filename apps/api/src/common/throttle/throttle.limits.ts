/**
 * Stage 23 — named rate-limit profiles for @Throttle({ default: {...} }).
 * Global baseline is registered in AppModule (120 / min).
 *
 * TTL values are milliseconds (NestJS Throttler v6).
 */
export const ThrottleLimits = {
  /** Login: 5 / 15 min */
  LOGIN: { default: { limit: 5, ttl: 15 * 60 * 1000 } },

  /** Password forgot / reset: 3 / hour */
  PASSWORD_RESET: { default: { limit: 3, ttl: 60 * 60 * 1000 } },

  /** OTP / MFA verify & setup: 5 / 10 min */
  MFA: { default: { limit: 5, ttl: 10 * 60 * 1000 } },

  /** Registration (customer + merchant): 5 / hour */
  REGISTER: { default: { limit: 5, ttl: 60 * 60 * 1000 } },

  /** Token refresh — slightly looser than login */
  REFRESH: { default: { limit: 30, ttl: 15 * 60 * 1000 } },

  /** RFQ create: 10 / hour */
  RFQ_CREATE: { default: { limit: 10, ttl: 60 * 60 * 1000 } },

  /** Checkout / payment-intent: 10 / 15 min */
  PAYMENT: { default: { limit: 10, ttl: 15 * 60 * 1000 } },

  /** Media / product image / CSV import upload: 20 / hour */
  UPLOAD: { default: { limit: 20, ttl: 60 * 60 * 1000 } },

  /** Search / autocomplete: 60 / min */
  SEARCH: { default: { limit: 60, ttl: 60 * 1000 } },
} as const;

/** Global API baseline (AppModule ThrottlerModule) */
export const GLOBAL_THROTTLE = {
  name: 'default' as const,
  ttl: 60 * 1000,
  limit: 120, // 120 / min (within 100–300 / min TZ band)
};
