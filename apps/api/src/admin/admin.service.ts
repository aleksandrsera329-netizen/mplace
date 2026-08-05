import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  OrderStatus,
  PayoutStatus,
  ProductStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** UI may send BLOCKED; Prisma uses SUSPENDED */
function normalizeUserStatus(status: string): string {
  if (status === 'BLOCKED') return UserStatus.SUSPENDED;
  return status;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      customers,
      merchants,
      products,
      orders,
      pendingShops,
      openDisputes,
      todayAgg,
      gmvAll,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({ where: { role: UserRole.MERCHANT } }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.order.count(),
      this.prisma.shop.count({ where: { status: ShopStatus.PENDING } }),
      this.prisma.dispute.count({
        where: { status: { in: [DisputeStatus.OPEN, DisputeStatus.APPEALED] } },
      }),
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfDay },
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT],
          },
        },
        _sum: { totalCents: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT],
          },
        },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      customers,
      merchants,
      products,
      orders,
      pendingShops,
      openDisputes,
      gmvCents: gmvAll._sum.totalCents || 0,
      today: {
        orders: todayAgg._count,
        gmvCents: todayAgg._sum.totalCents || 0,
      },
    };
  }

  async listUsers(params: {
    role?: string;
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const where: Record<string, unknown> = {};

    if (params.role && params.role in UserRole) {
      where.role = params.role as UserRole;
    }
    if (params.status) {
      const st = normalizeUserStatus(params.status);
      if (st in UserStatus) {
        where.status = st as UserStatus;
      }
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.user.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        shop: { select: { id: true, name: true, status: true } },
        _count: { select: { orders: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async updateUserStatus(userId: string, status: string, actorId: string) {
    const normalized = normalizeUserStatus(status);
    if (!(normalized in UserStatus)) {
      throw new BadRequestException('Invalid status');
    }
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: normalized as UserStatus },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    await this.audit.log({
      actorId,
      action: 'USER_STATUS_CHANGE',
      entityType: 'User',
      entityId: userId,
      meta: { from: existing.status, newStatus: normalized },
    });

    return user;
  }

  async updateUserRole(userId: string, role: string, actorId: string) {
    if (!(role in UserRole)) {
      throw new BadRequestException('Invalid role');
    }
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new NotFoundException('User not found');

    if (
      existing.role === UserRole.SUPER_ADMIN &&
      role !== UserRole.SUPER_ADMIN
    ) {
      const supers = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      });
      if (supers <= 1) {
        throw new BadRequestException('Cannot demote the last SUPER_ADMIN');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    await this.audit.log({
      actorId,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: userId,
      meta: { from: existing.role, newRole: role },
    });

    return user;
  }

  async listShops(params: {
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const where: Record<string, unknown> = {};
    if (params.status && params.status in ShopStatus) {
      where.status = params.status as ShopStatus;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.shop.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { products: true, orders: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async updateShopStatus(shopId: string, status: string, actorId: string) {
    if (!(status in ShopStatus)) {
      throw new BadRequestException('Invalid shop status');
    }
    const existing = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });
    if (!existing) throw new NotFoundException('Shop not found');

    const shop = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        status: status as ShopStatus,
        ...(status === ShopStatus.ACTIVE ? { verified: true } : {}),
      },
    });

    await this.audit.log({
      actorId,
      action: 'SHOP_STATUS_CHANGE',
      entityType: 'Shop',
      entityId: shopId,
      meta: { from: existing.status, newStatus: status },
    });

    return shop;
  }

  async listOrders(params: {
    status?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const where: Record<string, unknown> = {};

    if (params.status && params.status in OrderStatus) {
      where.status = params.status as OrderStatus;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { id: { contains: q } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.order.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        customer: { select: { id: true, email: true, name: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async listDisputes(params: {
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const where: Record<string, unknown> = {};
    if (params.status && params.status in DisputeStatus) {
      where.status = params.status as DisputeStatus;
    }

    const items = await this.prisma.dispute.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            status: true,
            customerEmail: true,
            shop: { select: { id: true, name: true } },
          },
        },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async resolveDispute(
    disputeId: string,
    resolution: string,
    note: string,
    actorId: string,
  ) {
    const existing = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!existing) throw new NotFoundException('Dispute not found');

    // Map task resolutions onto DisputeStatus + free-text resolution field
    let status: DisputeStatus = DisputeStatus.RESOLVED;
    if (resolution === 'CLOSED') status = DisputeStatus.CLOSED;
    else if (resolution === 'APPEALED') status = DisputeStatus.APPEALED;
    else if (resolution === 'OPEN') status = DisputeStatus.OPEN;
    else status = DisputeStatus.RESOLVED;

    const resolutionText = [resolution, note].filter(Boolean).join(': ').slice(0, 2000);

    const dispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: resolutionText || resolution,
      },
    });

    await this.audit.log({
      actorId,
      action: 'DISPUTE_RESOLVED',
      entityType: 'Dispute',
      entityId: disputeId,
      meta: { resolution, note, status },
    });

    return dispute;
  }

  async listPayouts(params: {
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 20, 100);
    const where: Record<string, unknown> = {};
    if (params.status && params.status in PayoutStatus) {
      where.status = params.status as PayoutStatus;
    }

    const items = await this.prisma.payoutRequest.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            owner: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async processPayout(
    payoutId: string,
    status: string,
    adminNote: string,
    actorId: string,
  ) {
    if (!(status in PayoutStatus)) {
      throw new BadRequestException('Invalid payout status');
    }
    const row = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });
    if (!row) throw new NotFoundException('Payout not found');

    const next = status as PayoutStatus;

    if (next === PayoutStatus.PAID) {
      if (
        row.status !== PayoutStatus.APPROVED &&
        row.status !== PayoutStatus.PENDING
      ) {
        throw new BadRequestException('Payout must be APPROVED (or PENDING) to mark PAID');
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        const payout = await tx.payoutRequest.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.PAID,
            adminNote: adminNote || row.adminNote,
            processedAt: new Date(),
          },
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                owner: { select: { email: true } },
              },
            },
          },
        });
        await tx.ledgerEntry.create({
          data: {
            shopId: row.shopId,
            account: 'VENDOR',
            entryType: 'PAYOUT',
            amountCents: -row.amountCents,
            description: `Payout ${payoutId}`,
          },
        });
        return payout;
      });

      await this.audit.log({
        actorId,
        action: 'PAYOUT_PAID',
        entityType: 'PayoutRequest',
        entityId: payoutId,
        meta: { amountCents: row.amountCents, adminNote },
      });

      return updated;
    }

    if (next === PayoutStatus.APPROVED || next === PayoutStatus.REJECTED) {
      if (row.status !== PayoutStatus.PENDING && row.status !== PayoutStatus.APPROVED) {
        throw new BadRequestException('Only PENDING (or APPROVED) payouts can be decided');
      }
      const updated = await this.prisma.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: next,
          adminNote: adminNote || null,
          ...(next === PayoutStatus.REJECTED ? { processedAt: new Date() } : {}),
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      });

      await this.audit.log({
        actorId,
        action: next === PayoutStatus.APPROVED ? 'PAYOUT_APPROVED' : 'PAYOUT_REJECTED',
        entityType: 'PayoutRequest',
        entityId: payoutId,
        meta: { adminNote },
      });

      return updated;
    }

    throw new BadRequestException('Unsupported payout status transition');
  }

  async listAudit(params: {
    action?: string;
    entityType?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 30, 100);
    const where: Record<string, unknown> = {};

    if (params.action?.trim()) {
      where.action = {
        contains: params.action.trim(),
        mode: 'insensitive',
      };
    }
    if (params.entityType?.trim()) {
      where.entityType = params.entityType.trim();
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      take: limit,
      ...(params.cursor
        ? { skip: 1, cursor: { id: params.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }
}
