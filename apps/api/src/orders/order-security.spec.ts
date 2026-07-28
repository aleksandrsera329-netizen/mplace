import { OrderStatus, UserRole } from '@prisma/client';
import { canTransition } from './order-status.machine';
import { atomicStockDecrementSql } from '../common/db.util';
import { Prisma } from '@prisma/client';

describe('order security invariants', () => {
  it('merchant cannot jump PENDING_PAYMENT → SHIPPED', () => {
    expect(
      canTransition(
        UserRole.MERCHANT,
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.SHIPPED,
      ),
    ).toBe(false);
  });

  it('customer cannot mark own order PAID via status machine', () => {
    expect(
      canTransition(UserRole.CUSTOMER, OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).toBe(false);
  });

  it('only SYSTEM may set PAID from PENDING_PAYMENT', () => {
    expect(
      canTransition('SYSTEM', OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).toBe(true);
    expect(
      canTransition(UserRole.ADMIN, OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).toBe(false);
  });

  it('atomic stock SQL uses parameterized Prisma.sql values', () => {
    const sql = atomicStockDecrementSql('prod_1', 2);
    expect(sql).toBeDefined();
    expect(Array.isArray(sql.values)).toBe(true);
    // values embedded as parameters, not string-concatenated ids in text only
    expect(sql.values).toEqual(expect.arrayContaining([2, 2, 'prod_1', 2]));
    const text = typeof sql.sql === 'string' ? sql.sql : String(sql);
    expect(text.toUpperCase()).toContain('UPDATE');
    expect(text).toContain('stock');
  });
});

describe('stripe webhook validation helpers', () => {
  function validateStripePi(
    pi: {
      amount_received?: number;
      currency?: string;
      metadata?: { orderId?: string };
    },
    payment: { orderId: string; amountCents: number; currency: string },
  ): string | null {
    const metaOrderId = pi.metadata?.orderId?.trim() || '';
    if (!metaOrderId || metaOrderId !== payment.orderId) return 'orderId_mismatch';
    if (pi.amount_received !== payment.amountCents) return 'amount_mismatch';
    if ((pi.currency || '').toLowerCase() !== payment.currency.toLowerCase()) {
      return 'currency_mismatch';
    }
    return null;
  }

  it('rejects amount mismatch', () => {
    expect(
      validateStripePi(
        { amount_received: 100, currency: 'usd', metadata: { orderId: 'o1' } },
        { orderId: 'o1', amountCents: 999, currency: 'USD' },
      ),
    ).toBe('amount_mismatch');
  });

  it('rejects currency mismatch', () => {
    expect(
      validateStripePi(
        { amount_received: 100, currency: 'eur', metadata: { orderId: 'o1' } },
        { orderId: 'o1', amountCents: 100, currency: 'USD' },
      ),
    ).toBe('currency_mismatch');
  });

  it('rejects orderId mismatch', () => {
    expect(
      validateStripePi(
        { amount_received: 100, currency: 'usd', metadata: { orderId: 'other' } },
        { orderId: 'o1', amountCents: 100, currency: 'USD' },
      ),
    ).toBe('orderId_mismatch');
  });

  it('accepts matching payment', () => {
    expect(
      validateStripePi(
        { amount_received: 100, currency: 'usd', metadata: { orderId: 'o1' } },
        { orderId: 'o1', amountCents: 100, currency: 'USD' },
      ),
    ).toBeNull();
  });
});
