import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RfqOfferStatus,
  RfqStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRfqDto,
  CreateRfqOfferDto,
  RfqMessageDto,
} from './dto/rfq.dto';

@Injectable()
export class RfqService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextNumber(): Promise<string> {
    const n = await this.prisma.rfqRequest.count();
    return `RFQ-${Date.now().toString(36).toUpperCase()}-${(n + 1).toString().padStart(4, '0')}`;
  }

  async create(user: JwtPayload, dto: CreateRfqDto) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only buyers can create RFQ');
    }
    const number = await this.nextNumber();
    const rfq = await this.prisma.rfqRequest.create({
      data: {
        number,
        buyerId: user.sub,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        status: RfqStatus.OPEN,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        items: {
          create: dto.items.map((it) => ({
            name: it.name.trim(),
            quantity: it.quantity,
            unit: it.unit || 'pcs',
            categoryId: it.categoryId,
            specs: it.specs,
          })),
        },
        attachments: dto.attachmentPaths?.length
          ? {
              create: dto.attachmentPaths.map((p, i) => ({
                fileName: `attachment-${i + 1}`,
                filePath: p,
              })),
            }
          : undefined,
      },
      include: { items: true, attachments: true },
    });

    const matches = await this.matchVendors(rfq.id);
    await this.prisma.rfqRequest.update({
      where: { id: rfq.id },
      data: { status: matches.length ? RfqStatus.MATCHED : RfqStatus.OPEN },
    });

    return this.get(rfq.id, user);
  }

  /** Simple matching: active verified shops with products in same categories */
  async matchVendors(rfqId: string) {
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: rfqId },
      include: { items: true },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const categoryIds = rfq.items
      .map((i) => i.categoryId)
      .filter((id): id is string => !!id);

    const shops = await this.prisma.shop.findMany({
      where: {
        status: ShopStatus.ACTIVE,
        ...(categoryIds.length
          ? { products: { some: { categoryId: { in: categoryIds }, status: 'ACTIVE' } } }
          : { products: { some: { status: 'ACTIVE' } } }),
      },
      take: 50,
    });

    const rows = [];
    for (const shop of shops) {
      let score = 10;
      if (shop.verified) score += 20;
      if (categoryIds.length) {
        const cnt = await this.prisma.product.count({
          where: {
            shopId: shop.id,
            status: 'ACTIVE',
            categoryId: { in: categoryIds },
          },
        });
        score += Math.min(50, cnt * 5);
      }
      const row = await this.prisma.rfqMatch.upsert({
        where: { rfqId_shopId: { rfqId, shopId: shop.id } },
        create: {
          rfqId,
          shopId: shop.id,
          score,
          reason: categoryIds.length
            ? 'category_product_match'
            : 'active_shop',
        },
        update: { score },
      });
      rows.push(row);
    }
    return rows;
  }

  async listForUser(user: JwtPayload) {
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      return this.prisma.rfqRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          items: true,
          _count: { select: { offers: true, matches: true, messages: true } },
        },
      });
    }
    if (user.role === UserRole.MERCHANT) {
      if (!user.shopId) return [];
      return this.prisma.rfqRequest.findMany({
        where: {
          OR: [
            { matches: { some: { shopId: user.shopId } } },
            { offers: { some: { shopId: user.shopId } } },
          ],
          status: { notIn: [RfqStatus.DRAFT, RfqStatus.CANCELLED] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          offers: { where: { shopId: user.shopId } },
          _count: { select: { offers: true, messages: true } },
        },
      });
    }
    // buyer
    return this.prisma.rfqRequest.findMany({
      where: { buyerId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        offers: {
          include: {
            shop: { select: { id: true, name: true, slug: true } },
            items: true,
          },
        },
        _count: { select: { offers: true, matches: true, messages: true } },
      },
    });
  }

  async get(id: string, user: JwtPayload) {
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        items: { include: { category: true } },
        attachments: true,
        matches: {
          include: { shop: { select: { id: true, name: true, slug: true, status: true } } },
          orderBy: { score: 'desc' },
        },
        offers: {
          include: {
            shop: { select: { id: true, name: true, slug: true } },
            vendor: { select: { id: true, name: true } },
            items: { include: { rfqItem: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    this.assertCanView(rfq, user);
    return rfq;
  }

  private assertCanView(
    rfq: {
      buyerId: string;
      matches?: { shopId: string }[];
      offers?: { shopId: string }[];
    },
    user: JwtPayload,
  ) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.CUSTOMER && rfq.buyerId === user.sub) return;
    if (
      user.role === UserRole.MERCHANT &&
      user.shopId &&
      (rfq.matches?.some((m) => m.shopId === user.shopId) ||
        rfq.offers?.some((o) => o.shopId === user.shopId))
    ) {
      return;
    }
    // reload matches if not included
    throw new ForbiddenException('Not allowed to view this RFQ');
  }

  async createOffer(user: JwtPayload, rfqId: string, dto: CreateRfqOfferDto) {
    if (user.role !== UserRole.MERCHANT || !user.shopId) {
      throw new ForbiddenException('Only merchants can offer');
    }
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: rfqId },
      include: { items: true, matches: true },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    const openStatuses: RfqStatus[] = [
      RfqStatus.OPEN,
      RfqStatus.MATCHED,
      RfqStatus.QUOTED,
    ];
    if (!openStatuses.includes(rfq.status)) {
      throw new BadRequestException('RFQ not open for offers');
    }
    if (rfq.deadline && rfq.deadline < new Date()) {
      throw new BadRequestException('RFQ deadline passed');
    }

    const itemIds = new Set(rfq.items.map((i) => i.id));
    for (const line of dto.items) {
      if (!itemIds.has(line.rfqItemId)) {
        throw new BadRequestException(`Unknown rfqItemId ${line.rfqItemId}`);
      }
    }

    const totalCents = dto.items.reduce(
      (s, l) => s + l.unitPriceCents * l.quantity,
      0,
    );

    const offer = await this.prisma.rfqOffer.upsert({
      where: {
        rfqId_shopId: { rfqId, shopId: user.shopId },
      },
      create: {
        rfqId,
        shopId: user.shopId,
        vendorId: user.sub,
        message: dto.message,
        totalCents,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: RfqOfferStatus.PENDING,
        items: {
          create: dto.items.map((l) => ({
            rfqItemId: l.rfqItemId,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            note: l.note,
            alternative: l.alternative,
          })),
        },
      },
      update: {
        message: dto.message,
        totalCents,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        status: RfqOfferStatus.PENDING,
        items: {
          deleteMany: {},
          create: dto.items.map((l) => ({
            rfqItemId: l.rfqItemId,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            note: l.note,
            alternative: l.alternative,
          })),
        },
      },
      include: { items: true, shop: true },
    });

    await this.prisma.rfqRequest.update({
      where: { id: rfqId },
      data: { status: RfqStatus.QUOTED },
    });

    // ensure match row
    await this.prisma.rfqMatch.upsert({
      where: { rfqId_shopId: { rfqId, shopId: user.shopId } },
      create: { rfqId, shopId: user.shopId, score: 100, reason: 'submitted_offer' },
      update: { score: 100, reason: 'submitted_offer' },
    });

    return offer;
  }

  async comparison(rfqId: string, user: JwtPayload) {
    const rfq = await this.get(rfqId, user);
    const rows = rfq.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      offers: rfq.offers.map((o) => {
        const line = o.items.find((li) => li.rfqItemId === item.id);
        return {
          offerId: o.id,
          shopId: o.shopId,
          shopName: o.shop.name,
          unitPriceCents: line?.unitPriceCents ?? null,
          quantity: line?.quantity ?? null,
          alternative: line?.alternative ?? null,
          note: line?.note ?? null,
          totalLineCents:
            line != null ? line.unitPriceCents * line.quantity : null,
        };
      }),
    }));
    return {
      rfqId: rfq.id,
      number: rfq.number,
      title: rfq.title,
      status: rfq.status,
      offers: rfq.offers.map((o) => ({
        id: o.id,
        shopId: o.shopId,
        shopName: o.shop.name,
        totalCents: o.totalCents,
        status: o.status,
        message: o.message,
      })),
      matrix: rows,
    };
  }

  async award(rfqId: string, offerId: string, user: JwtPayload) {
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: rfqId },
    });
    if (!rfq) throw new NotFoundException();
    if (
      rfq.buyerId !== user.sub &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException();
    }
    const offer = await this.prisma.rfqOffer.findFirst({
      where: { id: offerId, rfqId },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    await this.prisma.$transaction([
      this.prisma.rfqOffer.update({
        where: { id: offerId },
        data: { status: RfqOfferStatus.ACCEPTED },
      }),
      this.prisma.rfqOffer.updateMany({
        where: { rfqId, id: { not: offerId } },
        data: { status: RfqOfferStatus.REJECTED },
      }),
      this.prisma.rfqRequest.update({
        where: { id: rfqId },
        data: { status: RfqStatus.AWARDED, awardedOfferId: offerId },
      }),
    ]);
    return this.get(rfqId, user);
  }

  async postMessage(rfqId: string, user: JwtPayload, dto: RfqMessageDto) {
    // load with matches/offers for ACL
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: rfqId },
      include: { matches: true, offers: true },
    });
    if (!rfq) throw new NotFoundException();
    this.assertCanView(rfq, user);
    return this.prisma.rfqMessage.create({
      data: {
        rfqId,
        authorId: user.sub,
        body: dto.body.trim(),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
