import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  RequestContextData,
  RequestContextStorage,
} from './request-context';

export type RequestWithIds = Request & {
  requestId?: string;
  correlationId?: string;
  id?: string;
};

function pickHeader(
  req: Request,
  name: string,
): string | undefined {
  const raw = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  if (typeof raw === 'string') {
    const v = raw.trim();
    return v || undefined;
  }
  return undefined;
}

/**
 * Stage 26: assign requestId + correlationId, expose as response headers,
 * bind AsyncLocalStorage for the rest of the request.
 */
export function requestIdMiddleware(
  req: RequestWithIds,
  res: Response,
  next: NextFunction,
): void {
  const requestId =
    pickHeader(req, 'x-request-id') ||
    pickHeader(req, 'x-requestid') ||
    randomUUID();
  const correlationId =
    pickHeader(req, 'x-correlation-id') ||
    pickHeader(req, 'x-correlationid') ||
    requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;
  // nestjs-pino / genReqId often reads req.id
  req.id = requestId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  const ctx: RequestContextData = {
    requestId,
    correlationId,
    path: req.originalUrl || req.url,
    method: req.method,
  };

  RequestContextStorage.run(ctx, () => next());
}
