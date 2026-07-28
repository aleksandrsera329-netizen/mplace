import { OrderStatus, UserRole } from '@prisma/client';
import { canTransition } from './order-status.machine';

describe('order status machine', () => {
  it('blocks PENDING_PAYMENT → SHIPPED for everyone', () => {
    expect(
      canTransition(UserRole.ADMIN, OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED),
    ).toBe(false);
    expect(
      canTransition(UserRole.MERCHANT, OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED),
    ).toBe(false);
    expect(
      canTransition('SYSTEM', OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED),
    ).toBe(false);
  });

  it('allows SYSTEM PENDING_PAYMENT → PAID only', () => {
    expect(
      canTransition('SYSTEM', OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).toBe(true);
    expect(canTransition('SYSTEM', OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(
      false,
    );
  });

  it('allows merchant PAID → PROCESSING → SHIPPED', () => {
    expect(
      canTransition(UserRole.MERCHANT, OrderStatus.PAID, OrderStatus.PROCESSING),
    ).toBe(true);
    expect(
      canTransition(
        UserRole.MERCHANT,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
      ),
    ).toBe(true);
    expect(
      canTransition(UserRole.MERCHANT, OrderStatus.SHIPPED, OrderStatus.COMPLETED),
    ).toBe(false);
  });

  it('allows customer SHIPPED → COMPLETED and cancel before ship', () => {
    expect(
      canTransition(
        UserRole.CUSTOMER,
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      canTransition(UserRole.CUSTOMER, OrderStatus.SHIPPED, OrderStatus.COMPLETED),
    ).toBe(true);
  });
});
