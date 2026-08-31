import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShopStatus, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { FALLBACK_SHOPS } from '../catalog/fallback-catalog';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtPayload | null) {
    try {
      const where =
        user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
          ? {}
          : { status: ShopStatus.ACTIVE };

      const shops = await this.prisma.shop.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { products: true, orders: true } },
        },
      });
      if (!shops.length) {
        return FALLBACK_SHOPS.map((s) => ({
          ...s,
          owner: { id: s.id, name: s.name, email: "" },
          _count: { products: 0, orders: 0 },
        }));
      }
      return shops;
    } catch (e) {
      this.logger.error(
        `list shops failed, serving fallback: ${e instanceof Error ? e.message : e}`,
      );
      return FALLBACK_SHOPS.map((s) => ({
        ...s,
        owner: { id: s.id, name: s.name, email: "" },
        _count: { products: 0, orders: 0 },
      }));
    }
  }

  async get(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async updateStatus(
    user: JwtPayload,
    id: string,
    status: ShopStatus,
    rejectionReason?: string,
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    await this.get(id);
    if (status === ShopStatus.REJECTED && !rejectionReason?.trim()) {
      throw new ForbiddenException('rejectionReason required');
    }
    const shop = await this.prisma.shop.update({
      where: { id },
      data: {
        status,
        verified: status === ShopStatus.ACTIVE,
        rejectionReason:
          status === ShopStatus.REJECTED ? rejectionReason || null : null,
      },
    });
    // demote products if shop not active
    if (status !== ShopStatus.ACTIVE) {
      await this.prisma.product.updateMany({
        where: { shopId: id, status: 'ACTIVE' },
        data: { status: 'DRAFT' },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'shop.status_change',
        entityType: 'Shop',
        entityId: id,
        meta: JSON.stringify({ status, rejectionReason }),
      },
    });
    return shop;
  }

  async updateProfile(
    user: JwtPayload,
    data: {
      description?: string;
      legalName?: string;
      taxId?: string;
      country?: string;
      address?: string;
      payoutDetails?: string;
    },
  ) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException();
    }
    return this.prisma.shop.update({
      where: { id: user.shopId },
      data: {
        description: data.description,
        legalName: data.legalName,
        taxId: data.taxId,
        country: data.country,
        address: data.address,
        payoutDetails: data.payoutDetails,
      },
    });
  }

  myShop(user: JwtPayload) {
    if (!user.shopId) throw new NotFoundException('No shop linked');
    return this.get(user.shopId);
  }
}
