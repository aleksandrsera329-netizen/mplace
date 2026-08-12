import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { patchRequestContext } from './request-context';
import { StructuredLogger } from './structured-logger.service';

/**
 * After JWT (if any): enrich ALS with userId/shopId.
 * Always: log request completion with durationMs + status.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly log = new StructuredLogger().child('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      user?: { sub?: string; shopId?: string | null };
      method?: string;
      originalUrl?: string;
      url?: string;
      requestId?: string;
    }>();
    const res = http.getResponse<{ statusCode?: number }>();

    if (req.user?.sub) {
      patchRequestContext({
        userId: req.user.sub,
        shopId: req.user.shopId || undefined,
      });
    }

    // Extract domain ids from common route params / body when present
    const params = (req as { params?: Record<string, string> }).params || {};
    const body = (req as { body?: Record<string, unknown> }).body || {};
    if (params.id && /order/i.test(req.originalUrl || req.url || '')) {
      patchRequestContext({ orderId: params.id });
    }
    if (params.orderId) patchRequestContext({ orderId: params.orderId });
    if (params.rfqId) patchRequestContext({ rfqId: params.rfqId });
    if (params.id && /rfq/i.test(req.originalUrl || '')) {
      patchRequestContext({ rfqId: params.id });
    }
    if (typeof body.orderId === 'string') {
      patchRequestContext({ orderId: body.orderId });
    }
    if (typeof body.rfqId === 'string') {
      patchRequestContext({ rfqId: body.rfqId });
    }

    const started = Date.now();
    const path = req.originalUrl || req.url || '';
    const method = req.method || 'GET';

    // Skip noisy health spam at info level
    const quiet =
      path.startsWith('/api/health') || path === '/api/health/status';

    return next.handle().pipe(
      tap({
        next: () => {
          if (quiet) return;
          this.log.info(`${method} ${path}`, {
            status: res.statusCode ?? 200,
            durationMs: Date.now() - started,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.log.error(`${method} ${path}`, {
            status: err?.status ?? res.statusCode ?? 500,
            durationMs: Date.now() - started,
            error: err?.message || 'error',
          });
        },
      }),
    );
  }
}
