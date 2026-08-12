import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Stage 27: record http_requests_total + http_request_duration_seconds.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      route?: { path?: string };
      path?: string;
      originalUrl?: string;
      baseUrl?: string;
    }>();
    const res = http.getResponse<{ statusCode?: number }>();

    // Prefer Nest route template (low cardinality) over raw URL
    const route =
      req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : (req.path || req.originalUrl || 'unknown').split('?')[0];

    // Skip metrics endpoint itself to avoid noise
    if (route.includes('/metrics')) {
      return next.handle();
    }

    const started = process.hrtime.bigint();
    const method = req.method || 'GET';

    return next.handle().pipe(
      tap({
        next: () => {
          const sec = Number(process.hrtime.bigint() - started) / 1e9;
          this.metrics.observeHttp(
            method,
            route,
            res.statusCode || 200,
            sec,
          );
        },
        error: (err: { status?: number; statusCode?: number }) => {
          const sec = Number(process.hrtime.bigint() - started) / 1e9;
          const code = err?.status || err?.statusCode || res.statusCode || 500;
          this.metrics.observeHttp(method, route, code, sec);
        },
      }),
    );
  }
}
