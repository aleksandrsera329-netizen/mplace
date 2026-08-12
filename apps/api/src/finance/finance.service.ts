import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PayoutStatus, Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { patchRequestContext } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { DomainEventService } from '../events/domain-event.service';
import { DomainEvents } from '../events/domain-events';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';

/** Statuses that hold reserved funds (not available for new payouts) */
const OPEN_PAYOUT_STATUSES: PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.RESERVED,
  PayoutStatus.PROCESSING,
  PayoutStatus.APPROVED,
];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly slog: StructuredLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventService,
    private readonly ledger: LedgerService,
    structuredLogger: StructuredLogger,
    private readonly metrics: MetricsService,
  ) {
    this.slog = structuredLogger.child('FinanceService');
  }

  async shopBalance(shopId: string) {
    const availableCents = await this.ledger.getAvailableBalance(shopId);
    const deBalance = await this.ledger.vendorPayableBalanceCents(shopId);
    const deCount = await this.prisma.financialEntry.count({
      where: { shopId, account: 'VENDOR_PAYABLE' },
    });

    const pendingPayouts = await this.prisma.payoutRequest.aggregate({
      where: { shopId, status: { in: OPEN_PAYOUT_STATUSES } },
      _sum: { amountCents: true },
    });
    const held = pendingPayouts._sum.amountCents ?? 0;

    return {
      shopId,
      earnedCents: deCount > 0 ? Math.max(0, deBalance + held) : undefined,
      paidOutCents: undefined,
      pendingPayoutCents: held,
      availableCents,
      ledger: deCount > 0 ? 'double_entry' : 'legacy',
      vendorPayableCents: deBalance,
    };
  }

  async myBalance(user: JwtPayload) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException();
    }
    return this.shopBalance(user.shopId);
  }

  async listPayouts(user: JwtPayload) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.payoutRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: { shop: { select: { id: true, name: true } } },
      });
    }
    if (user.role === UserRole.MERCHANT && user.shopId) {
      return this.prisma.payoutRequest.findMany({
        where: { shopId: user.shopId },
        orderBy: { createdAt: 'desc' },
      });
    }
    throw new ForbiddenException();
  }

  /**
   * Stage 10: atomic reserve under Shop row lock.
   * Concurrent requests for the same shop serialize; second sees reduced balance.
   */
  async requestPayout(user: JwtPayload, amountCents: number, note?: string) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException();
    }
    return this.requestPayoutAtomic(user.shopId, amountCents, user.sub, note);
  }

  /**
   * Core atomic API (also used by concurrency tests).
   */
  async requestPayoutAtomic(
    shopId: string,
    amountCents: number,
    userId?: string,
    note?: string,
  ) {
    if (!amountCents || amountCents <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const maxAttempts = 5;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const row = await this.prisma.$transaction(
          async (tx) => {
            // Row lock — concurrent payouts for this shop wait here
            await tx.$executeRaw(
              Prisma.sql`SELECT id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`,
            );

            const available = await this.ledger.getAvailableBalance(
              shopId,
              tx,
            );
            if (available < amountCents) {
              throw new BadRequestException(
                `Insufficient balance. Available: ${available}`,
              );
            }

            const payout = await tx.payoutRequest.create({
              data: {
                shopId,
                amountCents,
                note: note || null,
                status: PayoutStatus.RESERVED,
                reservedAt: new Date(),
                requestedById: userId || null,
              },
            });

            // Double-entry reserve (drops VENDOR_PAYABLE available)
            await this.ledger.postPayoutReserve({
              payoutId: payout.id,
              shopId,
              amountCents,
              tx,
            });

            // Legacy mirror for old balance readers
            await tx.ledgerEntry.create({
              data: {
                shopId,
                account: 'VENDOR',
                entryType: 'PAYOUT',
                amountCents: -amountCents,
                description: `Payout reserve ${payout.id}`,
                metadata: JSON.stringify({
                  payoutId: payout.id,
                  phase: 'reserve',
                }),
              },
            });

            // actorId only when looks like a real user id (avoid FK on demo/test ids)
            const actorId =
              userId && userId.length >= 20 ? userId : null;
            await tx.auditLog.create({
              data: {
                actorId,
                action: 'payout.reserved',
                entityType: 'PayoutRequest',
                entityId: payout.id,
                meta: JSON.stringify({ amountCents, availableBefore: available }),
              },
            });

            return payout;
          },
          {
            // Row lock is primary; ReadCommitted + FOR UPDATE is enough and
            // avoids both sides failing under Serializable aborts.
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            maxWait: 5000,
            timeout: 15000,
          },
        );

        this.events.emit(DomainEvents.PayoutRequested, {
          payoutId: row.id,
          shopId,
          amountCents,
        });
        return row;
      } catch (e) {
        lastError = e;
        // Retry serialization / deadlock failures
        const code =
          e && typeof e === 'object' && 'code' in e
            ? String((e as { code?: string }).code)
            : '';
        const msg = e instanceof Error ? e.message : String(e);
        const retryable =
          code === 'P2034' ||
          msg.includes('could not serialize') ||
          msg.includes('deadlock') ||
          msg.includes('40001');
        if (!retryable) throw e;
        this.logger.warn(
          `Payout reserve retry ${attempt + 1}/${maxAttempts} shop=${shopId}`,
        );
        await new Promise((r) => setTimeout(r, 20 + attempt * 30));
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new BadRequestException('Payout reservation failed');
  }

  /**
   * Mark payout PROCESSING (provider transfer in flight).
   */
  async markPayoutProcessing(payoutId: string, actorId?: string) {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });
    if (!row) throw new NotFoundException();
    if (
      row.status !== PayoutStatus.RESERVED &&
      row.status !== PayoutStatus.APPROVED &&
      row.status !== PayoutStatus.PENDING
    ) {
      throw new BadRequestException(`Invalid status ${row.status}`);
    }
    return this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.PROCESSING,
        processedAt: new Date(),
        adminNote: actorId ? `processing by ${actorId}` : row.adminNote,
      },
    });
  }

  /**
   * Provider success → COMPLETED + finalize ledger (VENDOR_AVAILABLE → CLEARING).
   */
  async completePayout(
    payoutId: string,
    stripeTransferId?: string,
    actorId?: string,
  ) {
    const started = Date.now();
    patchRequestContext({ payoutId });
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });
    if (!row) throw new NotFoundException();
    patchRequestContext({ shopId: row.shopId, payoutId: row.id });
    if (
      row.status !== PayoutStatus.RESERVED &&
      row.status !== PayoutStatus.PROCESSING &&
      row.status !== PayoutStatus.APPROVED &&
      row.status !== PayoutStatus.PENDING
    ) {
      if (
        row.status === PayoutStatus.COMPLETED ||
        row.status === PayoutStatus.PAID
      ) {
        return row; // idempotent
      }
      throw new BadRequestException(`Cannot complete from ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM "Shop" WHERE id = ${row.shopId} FOR UPDATE`,
      );

      // Ensure reserve ledger exists (legacy PENDING path without reserve)
      if (row.status === PayoutStatus.PENDING || row.status === PayoutStatus.APPROVED) {
        const available = await this.ledger.getAvailableBalance(
          row.shopId,
          tx,
        );
        if (available < row.amountCents) {
          throw new BadRequestException('Insufficient balance to complete');
        }
        await this.ledger.postPayoutReserve({
          payoutId: row.id,
          shopId: row.shopId,
          amountCents: row.amountCents,
          tx,
        });
      }

      await this.ledger.postPayoutCompleted({
        payoutId: row.id,
        shopId: row.shopId,
        amountCents: row.amountCents,
        tx,
      });

      const rowUpdated = await tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          completedAt: new Date(),
          processedAt: row.processedAt ?? new Date(),
          stripeTransferId: stripeTransferId || row.stripeTransferId,
          adminNote: actorId ? `completed by ${actorId}` : row.adminNote,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'payout.completed',
          entityType: 'PayoutRequest',
          entityId: payoutId,
          meta: JSON.stringify({ stripeTransferId }),
        },
      });
      return rowUpdated;
    });

    // Stage 18: notify merchant owners after commit
    this.events.emit(DomainEvents.PayoutCompleted, {
      payoutId: updated.id,
      shopId: updated.shopId,
      amountCents: updated.amountCents,
    });
    this.slog.info('Payout completed', {
      payoutId: updated.id,
      shopId: updated.shopId,
      status: 'COMPLETED',
      durationMs: Date.now() - started,
    });
    return updated;
  }

  /**
   * Provider failure → FAILED + release reserve back to VENDOR_PAYABLE.
   */
  async failPayout(payoutId: string, reason: string, actorId?: string) {
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });
    if (!row) throw new NotFoundException();
    if (
      row.status === PayoutStatus.COMPLETED ||
      row.status === PayoutStatus.PAID ||
      row.status === PayoutStatus.FAILED ||
      row.status === PayoutStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot fail from ${row.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM "Shop" WHERE id = ${row.shopId} FOR UPDATE`,
      );

      if (
        row.status === PayoutStatus.RESERVED ||
        row.status === PayoutStatus.PROCESSING
      ) {
        await this.ledger.releasePayoutReserve({
          payoutId: row.id,
          shopId: row.shopId,
          amountCents: row.amountCents,
          tx,
        });
        // reverse legacy reserve entry
        await tx.ledgerEntry.create({
          data: {
            shopId: row.shopId,
            account: 'VENDOR',
            entryType: 'PAYOUT',
            amountCents: row.amountCents,
            description: `Payout reserve release ${row.id}`,
            metadata: JSON.stringify({
              payoutId: row.id,
              phase: 'release',
            }),
          },
        });
      }

      const rowUpdated = await tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: reason.slice(0, 500),
          adminNote: actorId ? `failed by ${actorId}` : row.adminNote,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'payout.failed',
          entityType: 'PayoutRequest',
          entityId: payoutId,
          meta: JSON.stringify({ reason }),
        },
      });
      return rowUpdated;
    });
    this.metrics.incPayoutFailed(reason.slice(0, 64));
    return updated;
  }

  async decidePayout(
    user: JwtPayload,
    id: string,
    decision: 'APPROVED' | 'REJECTED' | 'PAID',
    adminNote?: string,
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();

    if (decision === 'PAID') {
      return this.completePayout(id, undefined, user.sub);
    }

    if (decision === 'REJECTED') {
      if (
        row.status === PayoutStatus.RESERVED ||
        row.status === PayoutStatus.PROCESSING
      ) {
        return this.failPayout(id, adminNote || 'rejected', user.sub);
      }
      const updated = await this.prisma.payoutRequest.update({
        where: { id },
        data: {
          status: PayoutStatus.REJECTED,
          adminNote: adminNote || null,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'payout.rejected',
          entityType: 'PayoutRequest',
          entityId: id,
        },
      });
      return updated;
    }

    // APPROVED: if still PENDING without reserve, reserve now
    if (row.status === PayoutStatus.PENDING) {
      // re-request path: reserve under lock
      const reserved = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "Shop" WHERE id = ${row.shopId} FOR UPDATE`,
        );
        const available = await this.ledger.getAvailableBalance(
          row.shopId,
          tx,
        );
        if (available < row.amountCents) {
          throw new BadRequestException(
            `Insufficient balance. Available: ${available}`,
          );
        }
        await this.ledger.postPayoutReserve({
          payoutId: row.id,
          shopId: row.shopId,
          amountCents: row.amountCents,
          tx,
        });
        return tx.payoutRequest.update({
          where: { id },
          data: {
            status: PayoutStatus.RESERVED,
            reservedAt: new Date(),
            adminNote: adminNote || null,
          },
        });
      });
      return reserved;
    }

    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PayoutStatus.APPROVED,
        adminNote: adminNote || null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'payout.approved',
        entityType: 'PayoutRequest',
        entityId: id,
      },
    });
    return updated;
  }

  async listLedger(user: JwtPayload, shopId?: string) {
    if ((user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)) {
      return this.prisma.ledgerEntry.findMany({
        where: shopId ? { shopId } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    }
    if (user.role === UserRole.MERCHANT && user.shopId) {
      return this.prisma.ledgerEntry.findMany({
        where: { shopId: user.shopId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    }
    throw new ForbiddenException();
  }

  async reportsSummary(user: JwtPayload) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) throw new ForbiddenException();
    const [orders, gmv, shops, products, pendingPayouts] = await Promise.all([
      this.prisma.order.count({
        where: { status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
      }),
      this.prisma.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
        _sum: { totalCents: true },
      }),
      this.prisma.shop.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payoutRequest.count({ where: { status: 'PENDING' } }),
    ]);
    return {
      paidOrders: orders,
      gmvCents: gmv._sum.totalCents ?? 0,
      activeShops: shops,
      activeProducts: products,
      pendingPayouts,
    };
  }
}
