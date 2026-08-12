import { Injectable } from '@nestjs/common';
import { OrderStatus, RfqStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
];

const COMPLETED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.REFUNDED,
  OrderStatus.PARTIALLY_REFUNDED,
];

const CANCELLED_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED];

@Injectable()
export class BuyerService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(buyerId: string) {
    const [
      activeOrders,
      pendingRfqs,
      recentOrders,
      wishlistCount,
      openRfqsWithOffers,
      recentRfqs,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          customerId: buyerId,
          status: { in: ACTIVE_ORDER_STATUSES },
        },
      }),
      this.prisma.rfqRequest.count({
        where: {
          buyerId,
          status: {
            in: [
              RfqStatus.DRAFT,
              RfqStatus.OPEN,
              RfqStatus.MATCHED,
              RfqStatus.QUOTED,
            ],
          },
        },
      }),
      this.prisma.order.findMany({
        where: { customerId: buyerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: true,
          shop: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.wishlistItem.count({ where: { userId: buyerId } }),
      this.prisma.rfqRequest.count({
        where: {
          buyerId,
          status: { in: [RfqStatus.QUOTED, RfqStatus.MATCHED, RfqStatus.OPEN] },
          offers: { some: { status: 'PENDING' } },
        },
      }),
      this.prisma.rfqRequest.findMany({
        where: { buyerId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          createdAt: true,
          deadline: true,
          _count: { select: { offers: true } },
        },
      }),
      this.prisma.notification.count({
        where: { userId: buyerId, isRead: false },
      }),
    ]);

    return {
      stats: {
        activeOrders,
        pendingRfqs,
        wishlistCount,
        rfqsWithOffers: openRfqsWithOffers,
        unreadNotifications,
      },
      recentOrders,
      recentRfqs,
    };
  }

  async getOrders(
    buyerId: string,
    statusFilter?: string,
  ) {
    const where: {
      customerId: string;
      status?: { in: OrderStatus[] };
    } = { customerId: buyerId };

    const key = (statusFilter || '').toLowerCase();
    if (key === 'active') {
      where.status = { in: ACTIVE_ORDER_STATUSES };
    } else if (key === 'completed') {
      where.status = { in: COMPLETED_ORDER_STATUSES };
    } else if (key === 'cancelled') {
      where.status = { in: CANCELLED_ORDER_STATUSES };
    } else if (key && key in OrderStatus) {
      where.status = { in: [key as OrderStatus] };
    }

    const items = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        items: true,
        payments: {
          select: {
            id: true,
            status: true,
            amountCents: true,
            provider: true,
          },
        },
      },
    });

    return { items, filter: key || 'all', total: items.length };
  }

  async getRfqs(buyerId: string, statusFilter?: string) {
    const where: {
      buyerId: string;
      status?: { in: RfqStatus[] } | RfqStatus;
    } = { buyerId };

    const key = (statusFilter || '').toLowerCase();
    if (key === 'draft') {
      where.status = RfqStatus.DRAFT;
    } else if (key === 'open') {
      where.status = {
        in: [RfqStatus.OPEN, RfqStatus.MATCHED, RfqStatus.QUOTED],
      };
    } else if (key === 'offers') {
      // RFQs that have pending offers
      const items = await this.prisma.rfqRequest.findMany({
        where: {
          buyerId,
          offers: { some: { status: 'PENDING' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          items: true,
          offers: {
            select: {
              id: true,
              status: true,
              totalCents: true,
              shopId: true,
              shop: { select: { id: true, name: true } },
            },
          },
          _count: { select: { offers: true } },
        },
      });
      return { items, filter: 'offers', total: items.length };
    } else if (key === 'awarded') {
      where.status = { in: [RfqStatus.AWARDED, RfqStatus.CLOSED] };
    } else if (key && key.toUpperCase() in RfqStatus) {
      where.status = key.toUpperCase() as RfqStatus;
    }

    const items = await this.prisma.rfqRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        items: true,
        offers: {
          select: {
            id: true,
            status: true,
            totalCents: true,
            shopId: true,
            shop: { select: { id: true, name: true } },
          },
        },
        _count: { select: { offers: true } },
      },
    });

    return { items, filter: key || 'all', total: items.length };
  }
}
