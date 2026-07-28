import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayoutStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async shopBalance(shopId: string) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { shopId, account: 'VENDOR' },
    });
    const earned = entries
      .filter((e) => e.entryType === 'VENDOR_EARNING')
      .reduce((s, e) => s + e.amountCents, 0);
    const paidOut = entries
      .filter((e) => e.entryType === 'PAYOUT')
      .reduce((s, e) => s + Math.abs(e.amountCents), 0);
    const pendingPayouts = await this.prisma.payoutRequest.aggregate({
      where: { shopId, status: PayoutStatus.PENDING },
      _sum: { amountCents: true },
    });
    const held = pendingPayouts._sum.amountCents ?? 0;
    const available = earned - paidOut - held;
    return {
      shopId,
      earnedCents: earned,
      paidOutCents: paidOut,
      pendingPayoutCents: held,
      availableCents: Math.max(0, available),
    };
  }

  async myBalance(user: JwtPayload) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException();
    }
    return this.shopBalance(user.shopId);
  }

  async listPayouts(user: JwtPayload) {
    if (user.role === UserRole.ADMIN) {
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

  async requestPayout(user: JwtPayload, amountCents: number, note?: string) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException();
    }
    if (!amountCents || amountCents <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    const bal = await this.shopBalance(user.shopId);
    if (amountCents > bal.availableCents) {
      throw new BadRequestException('Amount exceeds available balance');
    }
    const row = await this.prisma.payoutRequest.create({
      data: {
        shopId: user.shopId,
        amountCents,
        note: note || null,
        status: PayoutStatus.PENDING,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'payout.request',
        entityType: 'PayoutRequest',
        entityId: row.id,
        meta: JSON.stringify({ amountCents }),
      },
    });
    return row;
  }

  async decidePayout(
    user: JwtPayload,
    id: string,
    decision: 'APPROVED' | 'REJECTED' | 'PAID',
    adminNote?: string,
  ) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();

    if (decision === 'PAID') {
      if (row.status !== PayoutStatus.APPROVED && row.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('Invalid payout state');
      }
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.payoutRequest.update({
          where: { id },
          data: {
            status: PayoutStatus.PAID,
            adminNote: adminNote || null,
            processedAt: new Date(),
          },
        });
        await tx.ledgerEntry.create({
          data: {
            shopId: row.shopId,
            account: 'VENDOR',
            entryType: 'PAYOUT',
            amountCents: -row.amountCents,
            description: `Payout ${id}`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            action: 'payout.paid',
            entityType: 'PayoutRequest',
            entityId: id,
          },
        });
        return updated;
      });
    }

    const status =
      decision === 'APPROVED' ? PayoutStatus.APPROVED : PayoutStatus.REJECTED;
    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: { status, adminNote: adminNote || null },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: `payout.${decision.toLowerCase()}`,
        entityType: 'PayoutRequest',
        entityId: id,
      },
    });
    return updated;
  }

  async listLedger(user: JwtPayload, shopId?: string) {
    if (user.role === UserRole.ADMIN) {
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
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException();
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
