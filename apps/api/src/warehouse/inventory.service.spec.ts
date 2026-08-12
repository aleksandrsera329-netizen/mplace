import { BadRequestException } from '@nestjs/common';
import {
  PrismaClient,
  ProductStatus,
  ShopStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { InventoryService } from './inventory.service';

describe('InventoryService (Stage 11)', () => {
  const prisma = new PrismaClient();
  let inventory: InventoryService;
  let shopId: string;
  let productId: string;

  beforeAll(async () => {
    inventory = new InventoryService(prisma as never);
    const shop = await prisma.shop.create({
      data: {
        name: `Inv Shop ${randomUUID().slice(0, 6)}`,
        slug: `inv-${randomUUID().slice(0, 8)}`,
        status: ShopStatus.ACTIVE,
        verified: true,
      },
    });
    shopId = shop.id;
    const product = await prisma.product.create({
      data: {
        shopId,
        name: 'Last Unit Widget',
        slug: `widget-${randomUUID().slice(0, 8)}`,
        priceCents: 1000,
        stock: 1,
        status: ProductStatus.ACTIVE,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    try {
      await prisma.inventoryReservation.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.shop.delete({ where: { id: shopId } });
    } catch {
      /* cleanup */
    }
    await prisma.$disconnect();
  });

  it('does not decrement stock on reserve', async () => {
    const orderId = randomUUID();
    // need a real order for FK? orderId is optional SetNull — can use fake if no FK strict... schema has FK to Order
    const order = await prisma.order.create({
      data: {
        orderNumber: `INV-${randomUUID().slice(0, 8)}`,
        shopId,
        subtotalCents: 1000,
        totalCents: 1000,
        status: 'PENDING_PAYMENT',
      },
    });

    const r = await inventory.reserve({
      productId,
      quantity: 1,
      orderId: order.id,
      productName: 'Last Unit Widget',
    });
    expect(r.status).toBe('ACTIVE');

    const p = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(p.stock).toBe(1); // not decremented
    expect(p.reservedStock).toBeGreaterThanOrEqual(1);

    const avail = await inventory.getAvailable(productId);
    expect(avail.available).toBe(0);

    // cleanup for next tests
    await inventory.releaseOrder(order.id);
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('prevents concurrent double-reserve of last unit', async () => {
    // reset product
    await prisma.inventoryReservation.deleteMany({ where: { productId } });
    await prisma.product.update({
      where: { id: productId },
      data: { stock: 1, reservedStock: 0 },
    });

    const o1 = await prisma.order.create({
      data: {
        orderNumber: `A-${randomUUID().slice(0, 8)}`,
        shopId,
        subtotalCents: 1000,
        totalCents: 1000,
        status: 'PENDING_PAYMENT',
      },
    });
    const o2 = await prisma.order.create({
      data: {
        orderNumber: `B-${randomUUID().slice(0, 8)}`,
        shopId,
        subtotalCents: 1000,
        totalCents: 1000,
        status: 'PENDING_PAYMENT',
      },
    });

    const [a, b] = await Promise.allSettled([
      inventory.reserve({
        productId,
        quantity: 1,
        orderId: o1.id,
      }),
      inventory.reserve({
        productId,
        quantity: 1,
        orderId: o2.id,
      }),
    ]);

    const ok = [a, b].filter((x) => x.status === 'fulfilled');
    const fail = [a, b].filter((x) => x.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    if (fail[0].status === 'rejected') {
      expect(fail[0].reason).toBeInstanceOf(BadRequestException);
    }

    // cleanup
    await inventory.releaseOrder(o1.id);
    await inventory.releaseOrder(o2.id);
    await prisma.order.deleteMany({
      where: { id: { in: [o1.id, o2.id] } },
    });
  });

  it('confirm decrements stock; releaseExpired frees hold', async () => {
    await prisma.inventoryReservation.deleteMany({ where: { productId } });
    await prisma.product.update({
      where: { id: productId },
      data: { stock: 5, reservedStock: 0 },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `C-${randomUUID().slice(0, 8)}`,
        shopId,
        subtotalCents: 2000,
        totalCents: 2000,
        status: 'PENDING_PAYMENT',
      },
    });

    await inventory.reserve({
      productId,
      quantity: 2,
      orderId: order.id,
      ttlMinutes: 30,
    });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(5);

    await inventory.confirm(order.id);
    const afterPay = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(afterPay.stock).toBe(3);

    // expiry path
    const order2 = await prisma.order.create({
      data: {
        orderNumber: `E-${randomUUID().slice(0, 8)}`,
        shopId,
        subtotalCents: 1000,
        totalCents: 1000,
        status: 'PENDING_PAYMENT',
      },
    });
    const res = await inventory.reserve({
      productId,
      quantity: 1,
      orderId: order2.id,
      ttlMinutes: 0, // expire immediately → expiresAt ~ now
    });
    // force expiresAt in past
    await prisma.inventoryReservation.update({
      where: { id: res.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const exp = await inventory.releaseExpired();
    expect(exp.expired).toBeGreaterThanOrEqual(1);
    expect(
      (await inventory.getAvailable(productId)).available,
    ).toBeGreaterThanOrEqual(2);

    await prisma.order.deleteMany({
      where: { id: { in: [order.id, order2.id] } },
    });
  });
});
