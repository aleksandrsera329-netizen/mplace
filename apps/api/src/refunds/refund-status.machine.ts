import { RefundStatus } from '@prisma/client';

/**
 * Allowed transitions for Refund 2.0.
 * COMPLETED is only reachable via provider confirmation (webhook), never direct admin.
 */
const TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatus.REQUESTED]: [
    RefundStatus.APPROVED,
    RefundStatus.REJECTED,
  ],
  [RefundStatus.APPROVED]: [
    RefundStatus.PROVIDER_REQUESTED,
    RefundStatus.REJECTED,
    RefundStatus.FAILED,
  ],
  [RefundStatus.PROVIDER_REQUESTED]: [
    RefundStatus.PROVIDER_CONFIRMED,
    RefundStatus.COMPLETED, // atomic path webhook may jump via confirm
    RefundStatus.FAILED,
  ],
  [RefundStatus.PROVIDER_CONFIRMED]: [RefundStatus.COMPLETED],
  [RefundStatus.COMPLETED]: [],
  [RefundStatus.REJECTED]: [],
  [RefundStatus.FAILED]: [RefundStatus.APPROVED], // allow re-approve after fail
};

export function canTransitionRefund(
  from: RefundStatus,
  to: RefundStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses that may be confirmed by Stripe webhook into COMPLETED */
export const PROVIDER_CONFIRMABLE: RefundStatus[] = [
  RefundStatus.PROVIDER_REQUESTED,
  RefundStatus.APPROVED, // race: webhook before we stored PROVIDER_REQUESTED
  RefundStatus.PROVIDER_CONFIRMED,
];
