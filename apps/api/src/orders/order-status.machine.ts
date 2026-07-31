import { OrderStatus, UserRole } from '@prisma/client';

/** Allowed transitions by actor role. Empty = not allowed. */
const MERCHANT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PAID]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
};

const CUSTOMER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.CANCELLED, OrderStatus.DISPUTED],
  [OrderStatus.PROCESSING]: [OrderStatus.DISPUTED],
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
};

/** Admin can cancel/dispute/refund with reason; not invent arbitrary skips like PENDING→SHIPPED */
const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
    OrderStatus.DISPUTED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.DISPUTED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.SHIPPED]: [
    OrderStatus.COMPLETED,
    OrderStatus.DISPUTED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED, OrderStatus.PARTIALLY_REFUNDED],
  [OrderStatus.DISPUTED]: [
    OrderStatus.REFUNDED,
    OrderStatus.PARTIALLY_REFUNDED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
};

/** System/payment provider only */
export const SYSTEM_PAID_FROM = OrderStatus.PENDING_PAYMENT;

export function allowedTransitions(
  role: UserRole | 'SYSTEM',
  from: OrderStatus,
): OrderStatus[] {
  if (role === 'SYSTEM') {
    if (from === OrderStatus.PENDING_PAYMENT) return [OrderStatus.PAID];
    return [];
  }
  if (role === UserRole.MERCHANT) return MERCHANT_TRANSITIONS[from] ?? [];
  if (role === UserRole.CUSTOMER) return CUSTOMER_TRANSITIONS[from] ?? [];
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
    return ADMIN_TRANSITIONS[from] ?? [];
  }
  return [];
}

export function canTransition(
  role: UserRole | 'SYSTEM',
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return allowedTransitions(role, from).includes(to);
}
