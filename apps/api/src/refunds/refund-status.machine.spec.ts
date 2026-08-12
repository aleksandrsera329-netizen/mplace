import { RefundStatus } from '@prisma/client';
import {
  canTransitionRefund,
  PROVIDER_CONFIRMABLE,
} from './refund-status.machine';

describe('Refund status machine (Stage 8)', () => {
  it('allows REQUESTED → APPROVED / REJECTED', () => {
    expect(
      canTransitionRefund(RefundStatus.REQUESTED, RefundStatus.APPROVED),
    ).toBe(true);
    expect(
      canTransitionRefund(RefundStatus.REQUESTED, RefundStatus.REJECTED),
    ).toBe(true);
  });

  it('forbids REQUESTED → COMPLETED (admin cannot complete)', () => {
    expect(
      canTransitionRefund(RefundStatus.REQUESTED, RefundStatus.COMPLETED),
    ).toBe(false);
  });

  it('forbids APPROVED → COMPLETED (must go via provider)', () => {
    expect(
      canTransitionRefund(RefundStatus.APPROVED, RefundStatus.COMPLETED),
    ).toBe(false);
  });

  it('allows APPROVED → PROVIDER_REQUESTED', () => {
    expect(
      canTransitionRefund(
        RefundStatus.APPROVED,
        RefundStatus.PROVIDER_REQUESTED,
      ),
    ).toBe(true);
  });

  it('allows PROVIDER_REQUESTED → COMPLETED (webhook path)', () => {
    expect(
      canTransitionRefund(
        RefundStatus.PROVIDER_REQUESTED,
        RefundStatus.COMPLETED,
      ),
    ).toBe(true);
  });

  it('COMPLETED is terminal', () => {
    expect(
      canTransitionRefund(RefundStatus.COMPLETED, RefundStatus.APPROVED),
    ).toBe(false);
  });

  it('provider confirmable set includes PROVIDER_REQUESTED', () => {
    expect(PROVIDER_CONFIRMABLE).toContain(RefundStatus.PROVIDER_REQUESTED);
    expect(PROVIDER_CONFIRMABLE).not.toContain(RefundStatus.REQUESTED);
  });
});
