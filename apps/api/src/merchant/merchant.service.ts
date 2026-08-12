import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  KycDocStatus,
  OrderStatus,
  PayoutStatus,
  RfqOfferStatus,
  RfqStatus,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { LedgerService } from '../finance/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

/** Paid funnel for GMV (money that moved / is in progress after pay) */
const GMV_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
];

const PENDING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
];

const OPEN_PAYOUT_STATUSES: PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.RESERVED,
  PayoutStatus.PROCESSING,
  PayoutStatus.APPROVED,
];

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  requireShopId(user: JwtPayload): string {
    if (!user.shopId) {
      throw new ForbiddenException('No shop linked to merchant');
    }
    return user.shopId;
  }

  async getDashboard(shopId: string) {
    const [
      gmvAgg,
      ordersCount,
      pendingOrders,
      completedOrders,
      productsCount,
      activeProducts,
      pendingPayouts,
      openOffers,
      awardedOffers,
      recentOrders,
      recentOffers,
      kycPending,
      kycApproved,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { shopId, status: { in: GMV_STATUSES } },
        _sum: { totalCents: true, commissionCents: true },
      }),
      this.prisma.order.count({ where: { shopId } }),
      this.prisma.order.count({
        where: { shopId, status: { in: PENDING_ORDER_STATUSES } },
      }),
      this.prisma.order.count({
        where: { shopId, status: OrderStatus.COMPLETED },
      }),
      this.prisma.product.count({ where: { shopId } }),
      this.prisma.product.count({
        where: { shopId, status: 'ACTIVE' },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { shopId, status: { in: OPEN_PAYOUT_STATUSES } },
        _sum: { amountCents: true },
      }),
      this.prisma.rfqOffer.count({
        where: { shopId, status: RfqOfferStatus.PENDING },
      }),
      this.prisma.rfqOffer.count({
        where: { shopId, status: RfqOfferStatus.ACCEPTED },
      }),
      this.prisma.order.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.rfqOffer.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          rfq: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              deadline: true,
            },
          },
        },
      }),
      this.prisma.kycDocument.count({
        where: { shopId, status: KycDocStatus.PENDING },
      }),
      this.prisma.kycDocument.count({
        where: { shopId, status: KycDocStatus.APPROVED },
      }),
    ]);

    const gmvCents = gmvAgg._sum.totalCents || 0;
    const commissionCents = gmvAgg._sum.commissionCents || 0;
    // Vendor revenue share after platform commission
    const revenueCents = Math.max(0, gmvCents - commissionCents);

    const availableBalanceCents =
      await this.ledger.getAvailableBalance(shopId);

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        verified: true,
      },
    });

    return {
      shop,
      stats: {
        gmvCents,
        revenueCents,
        commissionCents,
        ordersCount,
        pendingOrders,
        completedOrders,
        productsCount,
        activeProducts,
        availableBalanceCents,
        pendingPayoutsCents: pendingPayouts._sum.amountCents || 0,
        openOffers,
        awardedOffers,
        kycPending,
        kycApproved,
        conversionRate:
          ordersCount > 0
            ? Math.round((completedOrders / ordersCount) * 1000) / 10
            : 0,
      },
      recentOrders,
      recentOffers,
    };
  }

  async getOrders(shopId: string, statusFilter?: string) {
    const where: {
      shopId: string;
      status?: { in: OrderStatus[] } | OrderStatus;
    } = { shopId };

    const key = (statusFilter || '').toLowerCase();
    if (key === 'pending' || key === 'active') {
      where.status = { in: PENDING_ORDER_STATUSES };
    } else if (key === 'paid') {
      where.status = {
        in: [
          OrderStatus.PAID,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
        ],
      };
    } else if (key === 'completed') {
      where.status = OrderStatus.COMPLETED;
    } else if (key === 'cancelled') {
      where.status = {
        in: [
          OrderStatus.CANCELLED,
          OrderStatus.REFUNDED,
          OrderStatus.PARTIALLY_REFUNDED,
        ],
      };
    } else if (key && key.toUpperCase() in OrderStatus) {
      where.status = key.toUpperCase() as OrderStatus;
    }

    const items = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        items: true,
        customer: { select: { id: true, name: true, email: true } },
        payments: {
          select: { id: true, status: true, amountCents: true, provider: true },
        },
      },
    });

    return { items, filter: key || 'all', total: items.length, shopId };
  }

  /**
   * Merchant RFQ view: own offers + RFQs matched to this shop.
   */
  async getRfqs(shopId: string, statusFilter?: string) {
    const key = (statusFilter || '').toLowerCase();

    if (key === 'incoming' || key === 'matched') {
      const matches = await this.prisma.rfqMatch.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          rfq: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              deadline: true,
              createdAt: true,
              _count: { select: { offers: true } },
            },
          },
        },
      });
      return {
        items: matches
          .filter((m) => m.rfq && m.rfq.status !== RfqStatus.CANCELLED)
          .map((m) => ({
            ...m.rfq,
            matchScore: m.score,
            myOffer: null as null,
          })),
        filter: 'incoming',
        total: matches.length,
      };
    }

    const offerWhere: {
      shopId: string;
      status?: RfqOfferStatus | { in: RfqOfferStatus[] };
    } = { shopId };

    if (key === 'pending' || key === 'open') {
      offerWhere.status = RfqOfferStatus.PENDING;
    } else if (key === 'accepted' || key === 'awarded') {
      offerWhere.status = RfqOfferStatus.ACCEPTED;
    } else if (key === 'rejected') {
      offerWhere.status = RfqOfferStatus.REJECTED;
    }

    const offers = await this.prisma.rfqOffer.findMany({
      where: offerWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        rfq: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            deadline: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      items: offers.map((o) => ({
        id: o.rfq.id,
        number: o.rfq.number,
        title: o.rfq.title,
        status: o.rfq.status,
        deadline: o.rfq.deadline,
        createdAt: o.rfq.createdAt,
        myOffer: {
          id: o.id,
          status: o.status,
          totalCents: o.totalCents,
          currency: o.currency,
          createdAt: o.createdAt,
        },
      })),
      filter: key || 'offers',
      total: offers.length,
    };
  }

  async getKyc(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        status: true,
        verified: true,
        kycNotes: true,
        rejectionReason: true,
      },
    });
    if (!shop) throw new BadRequestException('Shop not found');

    const documents = await this.prisma.kycDocument.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        docType: true,
        fileName: true,
        status: true,
        notes: true,
        createdAt: true,
        reviewedAt: true,
        mediaAsset: {
          select: { id: true, mimeType: true, visibility: true, sizeBytes: true },
        },
      },
    });

    const pending = documents.filter((d) => d.status === KycDocStatus.PENDING)
      .length;
    const approved = documents.filter(
      (d) => d.status === KycDocStatus.APPROVED,
    ).length;
    const rejected = documents.filter(
      (d) => d.status === KycDocStatus.REJECTED,
    ).length;

    return {
      shop,
      documents: documents.map((d) => ({
        ...d,
        downloadPath: `/api/kyc/documents/${d.id}/download`,
      })),
      summary: {
        pending,
        approved,
        rejected,
        verified: shop.verified,
        shopStatus: shop.status,
      },
    };
  }
}
