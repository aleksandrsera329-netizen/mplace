import {
  contextFields,
  getRequestContext,
  patchRequestContext,
  runWithRequestContext,
} from './request-context';
import { requestIdMiddleware } from './request-id.middleware';
import type { Request, Response } from 'express';

describe('Request context (Stage 26)', () => {
  it('runWithRequestContext isolates store', () => {
    expect(getRequestContext()).toBeUndefined();
    runWithRequestContext(
      { requestId: 'r1', correlationId: 'c1', userId: 'u1' },
      () => {
        expect(getRequestContext()?.requestId).toBe('r1');
        patchRequestContext({ shopId: 's1', orderId: 'o1' });
        expect(contextFields()).toEqual(
          expect.objectContaining({
            requestId: 'r1',
            correlationId: 'c1',
            userId: 'u1',
            shopId: 's1',
            orderId: 'o1',
          }),
        );
      },
    );
    expect(getRequestContext()).toBeUndefined();
  });

  it('requestIdMiddleware sets headers and ALS', () => {
    const headers: Record<string, string> = {};
    const req = {
      headers: {
        'x-request-id': 'client-req',
        'x-correlation-id': 'client-corr',
      },
      method: 'GET',
      originalUrl: '/api/health',
    } as unknown as Request;
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as Response;

    let seen: string | undefined;
    requestIdMiddleware(req as never, res, () => {
      seen = getRequestContext()?.requestId;
    });

    expect(headers['X-Request-Id']).toBe('client-req');
    expect(headers['X-Correlation-Id']).toBe('client-corr');
    expect(seen).toBe('client-req');
    expect((req as { requestId?: string }).requestId).toBe('client-req');
  });

  it('generates ids when headers missing', () => {
    const headers: Record<string, string> = {};
    const req = {
      headers: {},
      method: 'POST',
      originalUrl: '/api/auth/login',
    } as unknown as Request;
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as Response;

    requestIdMiddleware(req as never, res, () => {
      expect(getRequestContext()?.requestId).toBeTruthy();
      expect(getRequestContext()?.correlationId).toBe(
        getRequestContext()?.requestId,
      );
    });
    expect(headers['X-Request-Id']).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});
