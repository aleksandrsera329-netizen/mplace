/** Domain event names (TZ2 Stage 3 — Event Bus) */
export const DomainEvents = {
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductDeleted: 'product.deleted',
  OrderCreated: 'order.created',
  OrderPaid: 'order.paid',
  OrderStatusChanged: 'order.status_changed',
  ShipmentCreated: 'shipment.created',
  RfqCreated: 'rfq.created',
  RfqOfferCreated: 'rfq.offer_created',
  RfqAwarded: 'rfq.awarded',
  RefundCreated: 'refund.created',
  MerchantApproved: 'merchant.approved',
  UserRegistered: 'user.registered',
  PayoutRequested: 'payout.requested',
  PayoutCompleted: 'payout.completed',
} as const;

export type DomainEventName =
  (typeof DomainEvents)[keyof typeof DomainEvents];
