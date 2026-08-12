import { AsyncLocalStorage } from 'async_hooks';

/**
 * Stage 26 — per-request context (requestId / correlationId / actor / domain ids).
 * Populated by middleware + interceptors; read by StructuredLogger.
 */
export type RequestContextData = {
  requestId: string;
  correlationId: string;
  userId?: string;
  shopId?: string;
  orderId?: string;
  rfqId?: string;
  payoutId?: string;
  paymentId?: string;
  refundId?: string;
  path?: string;
  method?: string;
};

export const RequestContextStorage =
  new AsyncLocalStorage<RequestContextData>();

export function getRequestContext(): RequestContextData | undefined {
  return RequestContextStorage.getStore();
}

export function runWithRequestContext<T>(
  data: RequestContextData,
  fn: () => T,
): T {
  return RequestContextStorage.run(data, fn);
}

/** Merge fields into the active store (no-op outside a request). */
export function patchRequestContext(
  patch: Partial<RequestContextData>,
): void {
  const store = RequestContextStorage.getStore();
  if (!store) return;
  Object.assign(store, patch);
}

export function contextFields(): Record<string, string | undefined> {
  const c = getRequestContext();
  if (!c) return {};
  return {
    requestId: c.requestId,
    correlationId: c.correlationId,
    userId: c.userId,
    shopId: c.shopId,
    orderId: c.orderId,
    rfqId: c.rfqId,
    payoutId: c.payoutId,
    paymentId: c.paymentId,
    refundId: c.refundId,
  };
}
