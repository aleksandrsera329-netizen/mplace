import { Logger } from '@nestjs/common';

const log = new Logger('Sentry');

/**
 * Optional Sentry bootstrap (TZ2 Stage 2 monitoring).
 * Set SENTRY_DSN to enable. No-op when unset.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    log.debug('SENTRY_DSN not set — Sentry disabled');
    return;
  }

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      release: process.env.SENTRY_RELEASE || undefined,
    });
    log.log('Sentry initialized');
  } catch (e) {
    log.warn(`Sentry init failed: ${(e as Error).message}`);
  }
}
