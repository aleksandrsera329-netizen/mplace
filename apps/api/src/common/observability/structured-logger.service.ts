import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { contextFields, getRequestContext } from './request-context';

export type LogFields = Record<string, unknown> & {
  msg?: string;
  status?: string | number;
  durationMs?: number;
  orderId?: string;
  rfqId?: string;
  shopId?: string;
  userId?: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  error?: string;
};

/**
 * Stage 26 — structured JSON-friendly logging with request context.
 * Prefer this for money / RFQ / KYC / auth over ad-hoc Logger.log strings.
 */
@Injectable()
export class StructuredLogger {
  private readonly nest = new Logger('App');

  child(context: string): StructuredLogger {
    const child = new StructuredLogger();
    (child as unknown as { nest: Logger }).nest = new Logger(context);
    return child;
  }

  private emit(
    level: 'log' | 'warn' | 'error' | 'debug' | 'verbose',
    message: string,
    fields?: LogFields,
  ) {
    const payload = {
      ...contextFields(),
      ...fields,
      msg: fields?.msg ?? message,
      // keep Nest message human-readable
    };
    // Nest/pino serializes objects when passed as first arg in many setups;
    // use message + object as second context.
    const line = message;
    switch (level) {
      case 'warn':
        this.nest.warn(payload as never, line);
        break;
      case 'error':
        this.nest.error(payload as never, line);
        break;
      case 'debug':
        this.nest.debug?.(payload as never, line);
        break;
      case 'verbose':
        this.nest.verbose?.(payload as never, line);
        break;
      default:
        this.nest.log(payload as never, line);
    }
  }

  info(message: string, fields?: LogFields) {
    this.emit('log', message, fields);
  }

  warn(message: string, fields?: LogFields) {
    this.emit('warn', message, fields);
  }

  error(message: string, fields?: LogFields) {
    this.emit('error', message, fields);
  }

  debug(message: string, fields?: LogFields) {
    this.emit('debug', message, fields);
  }

  /**
   * Time an async operation and log success/failure with durationMs.
   */
  async timed<T>(
    message: string,
    fields: LogFields | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      this.info(message, {
        ...fields,
        durationMs: Date.now() - started,
        status: fields?.status ?? 'ok',
      });
      return result;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.error(message, {
        ...fields,
        durationMs: Date.now() - started,
        status: 'error',
        error: err,
      });
      throw e;
    }
  }

  /** Snapshot of active context (tests / debugging). */
  currentContext() {
    return getRequestContext();
  }
}

/** Lightweight functional helper when DI is awkward */
export function slog(
  logger: Logger,
  level: LogLevel | 'log',
  message: string,
  fields?: LogFields,
) {
  const payload = { ...contextFields(), ...fields, msg: message };
  if (level === 'error') logger.error(payload as never, message);
  else if (level === 'warn') logger.warn(payload as never, message);
  else if (level === 'debug') logger.debug?.(payload as never, message);
  else logger.log(payload as never, message);
}
