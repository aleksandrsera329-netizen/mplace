import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  RfqOfferStatus,
  RfqStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { patchRequestContext } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { DomainEventService } from '../events/domain-event.service';
import { DomainEvents } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRfqDto,
  CreateRfqOfferDto,
  RfqMessageDto,
} from './dto/rfq.dto';

const COMMISSION_BPS = 1000;

@Injectable()
export class RfqService {
  private readonly slog: StructuredLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: DomainEventService,
    structuredLogger: StructuredLogger,
  ) {
    this.slog = structuredLogger.child('RfqService');
  }

  /**
   * Stage 13: atomic RFQ number via PostgreSQL sequence (no count()+1 races).
   * Format: RFQ-YYYY-00001
   */
  async generateRfqNumber(
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx || this.prisma;
    try {
      const result = await db.$queryRaw<{ nextval: bigint }[]>`
        SELECT nextval('rfq_number_seq') AS nextval
      `;
      const n = result[0]?.nextval ?? BigInt(1);
      const year = new Date().getFullYear();
      return `RFQ-${year}-${n.toString().padStart(5, '0')}`;
    } catch {
      // Fallback if sequence missing (dev / pre-migration): unique suffix, never count()
      const year = new Date().getFullYear();
      const suffix = randomBytes(4).toString('hex').toUpperCase();
      return `RFQ-${year}-${suffix}`;
    }
  }

  async create(user: JwtPayload, dto: CreateRfqDto) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only buyers can create RFQ');
    }

    const started = Date.now();
    patchRequestContext({ userId: user.sub });

    // Number + create in one transaction (retry on rare unique race)
    let rfqId: string | null = null;
    let rfqNumber: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const number = await this.generateRfqNumber(tx);
          return tx.rfqRequest.create({
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
            select: { id: true, number: true, title: true },
          });
        });
        rfqId = created.id;
        rfqNumber = created.number;
        break;
      } catch (e) {
        lastErr = e;
        const code =
          e && typeof e === 'object' && 'code' in e
            ? String((e as { code?: string }).code)
            : '';
        if (code !== 'P2002') throw e;
      }
    }
    if (!rfqId || !rfqNumber) {
      throw lastErr instanceof Error
        ? lastErr
        : new BadRequestException('Failed to create RFQ');
    }

    const matches = await this.matchVendors(rfqId);
    await this.prisma.rfqRequest.update({
      where: { id: rfqId },
      data: { status: matches.length ? RfqStatus.MATCHED : RfqStatus.OPEN },
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'RFQ_CREATE',
      entityType: 'Rfq',
      entityId: rfqId,
      meta: {
        title: dto.title.trim(),
        number: rfqNumber,
        itemsCount: dto.items.length,
        matches: matches.length,
      },
    });

    this.events.emit(DomainEvents.RfqCreated, {
      rfqId,
      number: rfqNumber,
      buyerId: user.sub,
      title: dto.title.trim(),
      itemsCount: dto.items.length,
    });

    patchRequestContext({ rfqId });
    this.slog.info('RFQ created', {
      rfqId,
      userId: user.sub,
      status: 'created',
      durationMs: Date.now() - started,
    });

    return this.get(rfqId, user);
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

  async listForUser(
    user: JwtPayload,
    opts?: {
      cursor?: string;
      limit?: number;
      status?: string;
      /** When true, force merchant "incoming" list (matched/offers for shop) */
      incoming?: boolean;
    },
  ) {
    const limit = opts?.limit ?? 20;
    const empty = { items: [] as unknown[], nextCursor: null, hasMore: false };

    const pageOpts = {
      take: limit,
      ...(opts?.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    };

    const statusFilter =
      opts?.status && opts.status in RfqStatus
        ? (opts.status as RfqStatus)
        : undefined;

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      const items = await this.prisma.rfqRequest.findMany({
        where: statusFilter ? { status: statusFilter } : undefined,
        ...pageOpts,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          items: true,
          _count: { select: { offers: true, matches: true, messages: true } },
        },
      });
      const nextCursor =
        items.length === limit ? items[items.length - 1].id : null;
      return {
        items: items.map((r) => ({ ...r, itemsCount: r.items?.length ?? 0 })),
        nextCursor,
        hasMore: !!nextCursor,
      };
    }

    // MERCHANT (and ?incoming=1): RFQs matched to shop or with offers from shop
    if (user.role === UserRole.MERCHANT) {
      if (!user.shopId) return empty;
      const items = await this.prisma.rfqRequest.findMany({
        where: {
          OR: [
            { matches: { some: { shopId: user.shopId } } },
            { offers: { some: { shopId: user.shopId } } },
          ],
          status: statusFilter
            ? statusFilter
            : { notIn: [RfqStatus.DRAFT, RfqStatus.CANCELLED] },
        },
        ...pageOpts,
        include: {
          items: true,
          offers: { where: { shopId: user.shopId } },
          _count: { select: { offers: true, messages: true, matches: true } },
        },
      });
      const nextCursor =
        items.length === limit ? items[items.length - 1].id : null;
      return {
        items: items.map((r) => ({ ...r, itemsCount: r.items?.length ?? 0 })),
        nextCursor,
        hasMore: !!nextCursor,
      };
    }

    // CUSTOMER: own RFQs
    const items = await this.prisma.rfqRequest.findMany({
      where: {
        buyerId: user.sub,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      ...pageOpts,
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
    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;
    return {
      items: items.map((r) => ({ ...r, itemsCount: r.items?.length ?? 0 })),
      nextCursor,
      hasMore: !!nextCursor,
    };
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

    await this.audit.log({
      actorId: user.sub,
      action: 'RFQ_OFFER',
      entityType: 'RfqOffer',
      entityId: offer.id,
      meta: {
        rfqId,
        shopId: user.shopId,
        totalCents: offer.totalCents,
        lines: dto.items.length,
      },
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

  /**
   * Stage 12: Award offer → RFQ AWARDED + Order PENDING_PAYMENT (payment next).
   * Race-safe via Product/RFQ FOR UPDATE + status guard.
   */
  async award(rfqId: string, offerId: string, user: JwtPayload) {
    const started = Date.now();
    patchRequestContext({ rfqId, userId: user.sub });
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock RFQ row
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "RfqRequest" WHERE id = ${rfqId} FOR UPDATE`,
        );

        const rfq = await tx.rfqRequest.findUnique({
          where: { id: rfqId },
          include: {
            items: true,
            offers: {
              include: {
                items: { include: { rfqItem: true } },
                shop: { select: { id: true, name: true, status: true } },
              },
            },
          },
        });
        if (!rfq) throw new NotFoundException('RFQ not found');

        if (
          rfq.buyerId !== user.sub &&
          user.role !== UserRole.ADMIN &&
          user.role !== UserRole.SUPER_ADMIN
        ) {
          throw new ForbiddenException('Not your RFQ');
        }

        if (rfq.status === RfqStatus.AWARDED) {
          throw new ConflictException('RFQ already awarded');
        }

        const openForAward: RfqStatus[] = [
          RfqStatus.OPEN,
          RfqStatus.MATCHED,
          RfqStatus.QUOTED,
        ];
        if (!openForAward.includes(rfq.status)) {
          throw new BadRequestException(
            `RFQ is not open for awarding (status=${rfq.status})`,
          );
        }

        const offer = rfq.offers.find((o) => o.id === offerId);
        if (!offer) throw new NotFoundException('Offer not found');
        if (offer.status !== RfqOfferStatus.PENDING) {
          throw new BadRequestException(
            `Offer is not pending (status=${offer.status})`,
          );
        }

        // Accept offer, reject others, mark RFQ awarded
        await tx.rfqOffer.update({
          where: { id: offerId },
          data: { status: RfqOfferStatus.ACCEPTED },
        });
        await tx.rfqOffer.updateMany({
          where: {
            rfqId,
            id: { not: offerId },
            status: RfqOfferStatus.PENDING,
          },
          data: { status: RfqOfferStatus.REJECTED },
        });
        await tx.rfqRequest.update({
          where: { id: rfqId },
          data: { status: RfqStatus.AWARDED, awardedOfferId: offerId },
        });

        const subtotalCents = offer.totalCents;
        const commissionCents = Math.round(
          (subtotalCents * COMMISSION_BPS) / 10000,
        );
        const totalCents = subtotalCents;
        const orderNumber = `ORD-RFQ-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

        // Build order lines from offer items (or single line from total)
        const lineItems =
          offer.items.length > 0
            ? offer.items.map((oi) => ({
                productId: null as string | null,
                productName: oi.rfqItem?.name || 'RFQ item',
                unitPriceCents: oi.unitPriceCents,
                quantity: oi.quantity,
                lineTotalCents: oi.unitPriceCents * oi.quantity,
              }))
            : [
                {
                  productId: null as string | null,
                  productName: rfq.title,
                  unitPriceCents: totalCents,
                  quantity: 1,
                  lineTotalCents: totalCents,
                },
              ];

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: rfq.buyerId,
            shopId: offer.shopId,
            status: OrderStatus.PENDING_PAYMENT,
            currency: offer.currency || rfq.currency || 'USD',
            subtotalCents,
            taxCents: 0,
            commissionCents,
            totalCents,
            customerEmail: null,
            customerName: null,
            source: 'RFQ',
            rfqId: rfq.id,
            offerId: offer.id,
            items: {
              create: lineItems.map((l) => ({
                productId: l.productId,
                productName: l.productName,
                unitPriceCents: l.unitPriceCents,
                quantity: l.quantity,
                lineTotalCents: l.lineTotalCents,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: OrderStatus.PENDING_PAYMENT,
                actorId: user.sub,
                reason: `RFQ award ${rfq.number} offer ${offerId}`,
              },
            },
          },
          include: {
            shop: { select: { id: true, name: true } },
            items: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            action: 'RFQ_AWARD',
            entityType: 'Rfq',
            entityId: rfqId,
            meta: JSON.stringify({
              offerId,
              shopId: offer.shopId,
              totalCents: offer.totalCents,
              orderId: order.id,
              orderNumber: order.orderNumber,
              fromStatus: rfq.status,
            }),
          },
        });

        return {
          rfqId,
          offerId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          shopId: offer.shopId,
          totalCents: order.totalCents,
          currency: order.currency,
          status: OrderStatus.PENDING_PAYMENT,
          order,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 20000,
      },
    );

    this.events.emit(DomainEvents.RfqAwarded, {
      rfqId,
      offerId,
      orderId: result.orderId,
      shopId: result.shopId,
      buyerId: user.sub,
      totalCents: result.totalCents,
    });

    patchRequestContext({
      rfqId,
      orderId: result.orderId,
      shopId: result.shopId,
    });
    this.slog.info('RFQ awarded', {
      rfqId,
      orderId: result.orderId,
      shopId: result.shopId,
      userId: user.sub,
      status: 'awarded',
      durationMs: Date.now() - started,
    });

    return result;
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
