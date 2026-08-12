import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LedgerAccount,
  LedgerEntryType,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { patchRequestContext } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { LedgerService } from '../finance/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  canTransitionRefund,
  PROVIDER_CONFIRMABLE,
} from './refund-status.machine';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private readonly slog: StructuredLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    structuredLogger: StructuredLogger,
  ) {
    this.slog = structuredLogger.child('RefundsService');
  }

  async findById(id: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            status: true,
            customerId: true,
            shopId: true,
            currency: true,
          },
        },
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  async getOne(user: JwtPayload, id: string) {
    const refund = await this.findById(id);
    this.assertCanView(user, refund.order);
    return refund;
  }

  /**
   * 1. Buyer or Admin creates refund request — status REQUESTED only.
   */
  async requestRefund(
    user: JwtPayload,
    orderId: string,
    amountCents: number,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (user.role === UserRole.CUSTOMER && order.customerId !== user.sub) {
      throw new ForbiddenException();
    }
    if (
      user.role === UserRole.MERCHANT &&
      order.shopId !== user.shopId &&
      !isAdmin
    ) {
      throw new ForbiddenException();
    }

    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.PARTIALLY_REFUNDED &&
      order.status !== OrderStatus.PROCESSING &&
      order.status !== OrderStatus.SHIPPED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Order is not eligible for refund (must be paid/processed)',
      );
    }

    const paid = order.payments
      .filter((p) => p.status === PaymentStatus.SUCCEEDED)
      .reduce((s, p) => s + p.amountCents, 0);
    const alreadyRefunded = await this.prisma.refund.aggregate({
      where: {
        orderId,
        status: {
          in: [
            RefundStatus.REQUESTED,
            RefundStatus.APPROVED,
            RefundStatus.PROVIDER_REQUESTED,
            RefundStatus.PROVIDER_CONFIRMED,
            RefundStatus.COMPLETED,
          ],
        },
      },
      _sum: { amountCents: true },
    });
    const refundedSoFar = alreadyRefunded._sum.amountCents ?? 0;
    // Stage 25: paid base minus already-open/completed refunds (not `paid || total - refunded`)
    const paidBase = paid > 0 ? paid : order.totalCents;
    const maxRefundable = Math.max(paidBase - refundedSoFar, 0);

    if (amountCents <= 0 || amountCents > maxRefundable) {
      throw new BadRequestException(
        `Invalid refund amount (max ${maxRefundable} cents)`,
      );
    }

    const started = Date.now();
    patchRequestContext({
      orderId,
      shopId: order.shopId,
      userId: user.sub,
    });

    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        amountCents,
        currency: order.currency || 'USD',
        reason: reason || null,
        status: RefundStatus.REQUESTED,
        requestedById: user.sub,
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'REFUND_REQUESTED',
      entityType: 'Refund',
      entityId: refund.id,
      meta: { orderId, amountCents },
    });

    patchRequestContext({ refundId: refund.id });
    this.slog.info('Refund requested', {
      refundId: refund.id,
      orderId,
      shopId: order.shopId,
      userId: user.sub,
      status: RefundStatus.REQUESTED,
      durationMs: Date.now() - started,
    });

    return refund;
  }

  /**
   * 2. Admin approves — never COMPLETED.
   */
  async approveRefund(refundId: string, adminId: string) {
    const started = Date.now();
    const refund = await this.findById(refundId);
    patchRequestContext({
      refundId,
      orderId: refund.orderId,
      shopId: refund.order?.shopId,
      userId: adminId,
    });
    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException(
        `Invalid status ${refund.status}; expected REQUESTED`,
      );
    }
    if (!canTransitionRefund(refund.status, RefundStatus.APPROVED)) {
      throw new BadRequestException('Transition not allowed');
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    this.slog.info('Refund approved', {
      refundId,
      orderId: refund.orderId,
      shopId: refund.order?.shopId,
      userId: adminId,
      status: RefundStatus.APPROVED,
      durationMs: Date.now() - started,
    });

    await this.audit.log({
      actorId: adminId,
      action: 'REFUND_APPROVED',
      entityType: 'Refund',
      entityId: refundId,
    });

    return updated;
  }

  async rejectRefund(refundId: string, adminId: string, reason?: string) {
    const refund = await this.findById(refundId);
    if (
      refund.status !== RefundStatus.REQUESTED &&
      refund.status !== RefundStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot reject refund in status ${refund.status}`,
      );
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.REJECTED,
        approvedById: adminId,
        approvedAt: new Date(),
        adminNote: reason || refund.adminNote,
        failureReason: reason || null,
      },
    });

    await this.audit.log({
      actorId: adminId,
      action: 'REFUND_REJECTED',
      entityType: 'Refund',
      entityId: refundId,
      meta: { reason },
    });

    return updated;
  }

  /**
   * 3. Call Stripe refunds.create → PROVIDER_REQUESTED.
   * Does NOT set COMPLETED.
   */
  async requestProviderRefund(refundId: string, actorId?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: { include: { payments: true } },
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (refund.status !== RefundStatus.APPROVED) {
      throw new BadRequestException(
        `Must be APPROVED to request provider refund (got ${refund.status})`,
      );
    }

    const payment = refund.order.payments.find(
      (p) =>
        p.provider === 'stripe' && p.status === PaymentStatus.SUCCEEDED,
    );
    if (!payment?.providerPaymentId) {
      // Dev/local: mark FAILED if no Stripe payment
      if (this.config.get('PAYMENT_PROVIDER') === 'dev') {
        return this.prisma.refund.update({
          where: { id: refundId },
          data: {
            status: RefundStatus.FAILED,
            failureReason: 'No Stripe payment; use webhook sim or stripe mode',
          },
        });
      }
      throw new BadRequestException('No successful Stripe payment found');
    }

    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY not configured');
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(secret);

    let stripeRefund: { id: string; amount?: number; status?: string };
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: payment.providerPaymentId,
        amount: refund.amountCents,
        reason: 'requested_by_customer',
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: {
          refundId: refund.id,
          orderId: refund.orderId,
          orderNumber: refund.order.orderNumber,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.FAILED,
          failureReason: msg.slice(0, 500),
        },
      });
      throw new BadRequestException(`Stripe refund failed: ${msg}`);
    }

    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.PROVIDER_REQUESTED,
        stripeRefundId: stripeRefund.id,
        providerRequestedAt: new Date(),
        adminNote: `stripe_refund=${stripeRefund.id}`,
      },
    });

    await this.audit.log({
      actorId: actorId ?? null,
      action: 'REFUND_PROVIDER_REQUESTED',
      entityType: 'Refund',
      entityId: refundId,
      meta: { stripeRefundId: stripeRefund.id },
    });

    return updated;
  }

  /**
   * 4. Webhook only: PROVIDER_REQUESTED/APPROVED → COMPLETED + ledger reversal.
   * Idempotent if already COMPLETED.
   */
  async confirmProviderRefund(params: {
    stripeRefundId?: string | null;
    orderId?: string | null;
    amountCents?: number | null;
    refundIdFromMeta?: string | null;
  }) {
    let refund =
      (params.refundIdFromMeta
        ? await this.prisma.refund.findUnique({
            where: { id: params.refundIdFromMeta },
            include: { order: true },
          })
        : null) ||
      (params.stripeRefundId
        ? await this.prisma.refund.findFirst({
            where: { stripeRefundId: params.stripeRefundId },
            include: { order: true },
          })
        : null);

    // Legacy: match adminNote contains stripe id
    if (!refund && params.stripeRefundId) {
      refund = await this.prisma.refund.findFirst({
        where: {
          adminNote: { contains: params.stripeRefundId },
        },
        include: { order: true },
      });
    }

    // Out-of-band Stripe refund without prior request: create PROVIDER_REQUESTED then complete
    if (!refund && params.orderId && params.stripeRefundId) {
      refund = await this.prisma.refund.create({
        data: {
          orderId: params.orderId,
          amountCents: params.amountCents || 0,
          currency: 'USD',
          reason: 'stripe_webhook',
          status: RefundStatus.PROVIDER_REQUESTED,
          stripeRefundId: params.stripeRefundId,
          providerRequestedAt: new Date(),
          adminNote: `stripe_refund=${params.stripeRefundId}`,
        },
        include: { order: true },
      });
    }

    if (!refund) {
      this.logger.warn(
        `confirmProviderRefund: no refund for stripe=${params.stripeRefundId} order=${params.orderId}`,
      );
      return { ok: false, reason: 'refund_not_found' };
    }

    if (refund.status === RefundStatus.COMPLETED) {
      return { ok: true, already: true, refundId: refund.id };
    }

    if (!PROVIDER_CONFIRMABLE.includes(refund.status)) {
      this.logger.warn(
        `confirmProviderRefund: ignore status=${refund.status} id=${refund.id}`,
      );
      return { ok: false, reason: 'invalid_status', status: refund.status };
    }

    const amount =
      params.amountCents && params.amountCents > 0
        ? params.amountCents
        : refund.amountCents;

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund!.id },
        data: {
          status: RefundStatus.COMPLETED,
          stripeRefundId: params.stripeRefundId || refund!.stripeRefundId,
          providerConfirmedAt: new Date(),
          completedAt: new Date(),
          amountCents: amount,
        },
      });

      const order = refund!.order;
      const full = amount >= order.totalCents;
      if (
        order.status !== OrderStatus.REFUNDED &&
        order.status !== OrderStatus.PARTIALLY_REFUNDED
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: full
              ? OrderStatus.REFUNDED
              : OrderStatus.PARTIALLY_REFUNDED,
          },
        });
      } else if (!full && order.status === OrderStatus.REFUNDED) {
        // keep
      } else if (full) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.REFUNDED },
        });
      }

      // Legacy LedgerEntry (keep for compatibility)
      const metaKey = `refund:${refund!.id}`;
      const existingLedger = await tx.ledgerEntry.findFirst({
        where: {
          orderId: order.id,
          entryType: LedgerEntryType.REFUND,
          metadata: { contains: metaKey },
        },
      });
      const commissionCents = Math.round(
        amount * (order.totalCents > 0 ? (order.commissionCents ?? 0) / order.totalCents : 0.1),
      );
      if (!existingLedger) {
        await tx.ledgerEntry.create({
          data: {
            shopId: order.shopId,
            orderId: order.id,
            account: LedgerAccount.VENDOR,
            entryType: LedgerEntryType.REFUND,
            amountCents: -Math.abs(amount),
            currency: refund!.currency || order.currency || 'USD',
            description: `Refund ${refund!.id}`,
            metadata: JSON.stringify({
              key: metaKey,
              refundId: refund!.id,
              stripeRefundId: params.stripeRefundId,
            }),
          },
        });
        await tx.ledgerEntry.create({
          data: {
            shopId: order.shopId,
            orderId: order.id,
            account: LedgerAccount.PLATFORM,
            entryType: LedgerEntryType.REFUND,
            amountCents: -Math.abs(commissionCents || Math.round(amount * 0.1)),
            currency: refund!.currency || order.currency || 'USD',
            description: `Refund commission reverse ${refund!.id}`,
            metadata: JSON.stringify({
              key: `${metaKey}:commission`,
              refundId: refund!.id,
            }),
          },
        });
      }

      // Stage 9: double-entry FinancialTransaction (idempotent)
      const orderWithCommission = await tx.order.findUnique({
        where: { id: order.id },
        select: { commissionCents: true, totalCents: true },
      });
      const comm =
        orderWithCommission && orderWithCommission.totalCents > 0
          ? Math.round(
              (amount * orderWithCommission.commissionCents) /
                orderWithCommission.totalCents,
            )
          : Math.round(amount * 0.1);
      await this.ledger.postRefund({
        refundId: refund!.id,
        amountCents: amount,
        commissionCents: comm,
        shopId: order.shopId,
        currency: refund!.currency || order.currency,
        description: `Refund ${refund!.id}`,
        tx,
      });
    });

    await this.audit.log({
      action: 'REFUND_COMPLETED',
      entityType: 'Refund',
      entityId: refund.id,
      meta: {
        stripeRefundId: params.stripeRefundId,
        orderId: refund.orderId,
        amountCents: amount,
      },
    });

    return { ok: true, refundId: refund.id, status: RefundStatus.COMPLETED };
  }

  private assertCanView(
    user: JwtPayload,
    order: { customerId: string | null; shopId: string },
  ) {
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      return;
    }
    if (user.role === UserRole.MERCHANT && user.shopId === order.shopId) {
      return;
    }
    if (user.role === UserRole.CUSTOMER && order.customerId === user.sub) {
      return;
    }
    throw new ForbiddenException();
  }
}
