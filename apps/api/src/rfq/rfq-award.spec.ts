import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  OrderStatus,
  PrismaClient,
  ProductStatus,
  RfqOfferStatus,
  RfqStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RfqService } from './rfq.service';

describe('RFQ award → Order (Stage 12)', () => {
  const prisma = new PrismaClient();
  let rfqService: RfqService;
  let buyerId: string;
  let vendorId: string;
  let shopId: string;
  let rfqId: string;
  let offerId: string;
  let offer2Id: string;

  beforeAll(async () => {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const events = { emit: jest.fn() };
    const slog = {
      child: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    };
    rfqService = new RfqService(
      prisma as never,
      audit as never,
      events as never,
      slog as never,
    );

    const passwordHash = await bcrypt.hash('123456', 10);
    const suffix = randomUUID().slice(0, 8);

    const shop = await prisma.shop.create({
      data: {
        name: `Award Shop ${suffix}`,
        slug: `award-shop-${suffix}`,
        status: ShopStatus.ACTIVE,
        verified: true,
      },
    });
    shopId = shop.id;

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-award-${suffix}@test.local`,
        passwordHash,
        name: 'Buyer Award',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    buyerId = buyer.id;

    const vendor = await prisma.user.create({
      data: {
        email: `vendor-award-${suffix}@test.local`,
        passwordHash,
        name: 'Vendor Award',
        role: UserRole.MERCHANT,
        status: UserStatus.ACTIVE,
        shopId,
      },
    });
    vendorId = vendor.id;

    const rfq = await prisma.rfqRequest.create({
      data: {
        number: `RFQ-AWD-${suffix}`,
        buyerId,
        title: 'Need valves',
        status: RfqStatus.OPEN,
        items: {
          create: [
            { name: 'Gate valve 2"', quantity: 10, unit: 'pcs' },
          ],
        },
      },
      include: { items: true },
    });
    rfqId = rfq.id;
    const itemId = rfq.items[0].id;

    const offer = await prisma.rfqOffer.create({
      data: {
        rfqId,
        shopId,
        vendorId,
        status: RfqOfferStatus.PENDING,
        totalCents: 50000,
        currency: 'USD',
        items: {
          create: [
            {
              rfqItemId: itemId,
              unitPriceCents: 5000,
              quantity: 10,
            },
          ],
        },
      },
    });
    offerId = offer.id;

    // Second shop/offer for reject-others check
    const shop2 = await prisma.shop.create({
      data: {
        name: `Award Shop2 ${suffix}`,
        slug: `award-shop2-${suffix}`,
        status: ShopStatus.ACTIVE,
        verified: true,
      },
    });
    const vendor2 = await prisma.user.create({
      data: {
        email: `vendor2-award-${suffix}@test.local`,
        passwordHash,
        name: 'Vendor2',
        role: UserRole.MERCHANT,
        status: UserStatus.ACTIVE,
        shopId: shop2.id,
      },
    });
    const offer2 = await prisma.rfqOffer.create({
      data: {
        rfqId,
        shopId: shop2.id,
        vendorId: vendor2.id,
        status: RfqOfferStatus.PENDING,
        totalCents: 60000,
        items: {
          create: [
            {
              rfqItemId: itemId,
              unitPriceCents: 6000,
              quantity: 10,
            },
          ],
        },
      },
    });
    offer2Id = offer2.id;
  });

  afterAll(async () => {
    try {
      await prisma.orderItem.deleteMany({
        where: { order: { rfqId } },
      });
      await prisma.orderStatusHistory.deleteMany({
        where: { order: { rfqId } },
      });
      await prisma.order.deleteMany({ where: { rfqId } });
      await prisma.rfqOfferItem.deleteMany({
        where: { offer: { rfqId } },
      });
      await prisma.rfqOffer.deleteMany({ where: { rfqId } });
      await prisma.rfqItem.deleteMany({ where: { rfqId } });
      await prisma.rfqRequest.deleteMany({ where: { id: rfqId } });
      await prisma.auditLog.deleteMany({
        where: { entityId: rfqId },
      });
      const shops = await prisma.shop.findMany({
        where: { slug: { startsWith: 'award-shop' } },
      });
      for (const s of shops) {
        await prisma.user.deleteMany({ where: { shopId: s.id } });
        await prisma.shop.delete({ where: { id: s.id } }).catch(() => null);
      }
      await prisma.user.deleteMany({
        where: { email: { contains: 'award-' } },
      });
    } catch {
      /* cleanup best-effort */
    }
    await prisma.$disconnect();
  });

  const buyer = () =>
    ({
      sub: buyerId,
      email: 'b@t.com',
      role: UserRole.CUSTOMER,
      shopId: null,
    }) as const;

  it('award creates Order PENDING_PAYMENT with source RFQ', async () => {
    const result = await rfqService.award(rfqId, offerId, buyer() as never);

    expect(result.orderId).toBeDefined();
    expect(result.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(result.totalCents).toBe(50000);

    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: { items: true },
    });
    expect(order?.source).toBe('RFQ');
    expect(order?.rfqId).toBe(rfqId);
    expect(order?.offerId).toBe(offerId);
    expect(order?.shopId).toBe(shopId);
    expect(order?.customerId).toBe(buyerId);
    expect(order?.items.length).toBeGreaterThan(0);

    const rfq = await prisma.rfqRequest.findUnique({ where: { id: rfqId } });
    expect(rfq?.status).toBe(RfqStatus.AWARDED);
    expect(rfq?.awardedOfferId).toBe(offerId);

    const accepted = await prisma.rfqOffer.findUnique({
      where: { id: offerId },
    });
    expect(accepted?.status).toBe(RfqOfferStatus.ACCEPTED);

    const other = await prisma.rfqOffer.findUnique({
      where: { id: offer2Id },
    });
    expect(other?.status).toBe(RfqOfferStatus.REJECTED);
  });

  it('second award returns 409 Conflict', async () => {
    await expect(
      rfqService.award(rfqId, offerId, buyer() as never),
    ).rejects.toThrow(ConflictException);
  });

  it('non-owner cannot award', async () => {
    // create open RFQ for isolation
    const suffix = randomUUID().slice(0, 6);
    const stranger = await prisma.user.create({
      data: {
        email: `stranger-${suffix}@test.local`,
        passwordHash: await bcrypt.hash('x', 10),
        name: 'X',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
    const rfq2 = await prisma.rfqRequest.create({
      data: {
        number: `RFQ-X-${suffix}`,
        buyerId,
        title: 'Other',
        status: RfqStatus.OPEN,
        items: { create: [{ name: 'Item', quantity: 1 }] },
      },
      include: { items: true },
    });
    const of = await prisma.rfqOffer.create({
      data: {
        rfqId: rfq2.id,
        shopId,
        vendorId,
        totalCents: 100,
        status: RfqOfferStatus.PENDING,
        items: {
          create: [
            {
              rfqItemId: rfq2.items[0].id,
              unitPriceCents: 100,
              quantity: 1,
            },
          ],
        },
      },
    });

    await expect(
      rfqService.award(rfq2.id, of.id, {
        sub: stranger.id,
        email: stranger.email,
        role: UserRole.CUSTOMER,
        shopId: null,
      } as never),
    ).rejects.toThrow(ForbiddenException);

    await prisma.rfqOfferItem.deleteMany({ where: { offerId: of.id } });
    await prisma.rfqOffer.delete({ where: { id: of.id } });
    await prisma.rfqItem.deleteMany({ where: { rfqId: rfq2.id } });
    await prisma.rfqRequest.delete({ where: { id: rfq2.id } });
    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
