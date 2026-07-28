import {
  OrderStatus,
  PrismaClient,
  ProductStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 12);

  // clean demo data for clean seed (keep schema)
  await prisma.ticketMessage.deleteMany().catch(() => undefined);
  await prisma.ticket.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.orderStatusHistory.deleteMany().catch(() => undefined);
  await prisma.payment.deleteMany().catch(() => undefined);
  await prisma.ledgerEntry.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.auditLog.deleteMany();

  const bigShop = await prisma.shop.create({
    data: {
      name: 'Big Shop',
      slug: 'big-shop',
      description: 'Top marketplace vendor',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const amz = await prisma.shop.create({
    data: {
      name: 'Amz Mart',
      slug: 'amz-mart',
      description: 'Everyday essentials',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const lady = await prisma.shop.create({
    data: {
      name: 'Lady Charm',
      slug: 'lady-charm',
      description: 'Fashion & accessories',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'superadmin@demo.com',
      passwordHash,
      name: 'SuperAdmin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'merchant@demo.com',
      passwordHash,
      name: 'Merchant Demo',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: bigShop.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'amz@demo.com',
      passwordHash,
      name: 'Amz Owner',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: amz.id,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@demo.com',
      passwordHash,
      name: 'Demo Customer',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'jhondoe@demo.com',
      passwordHash,
      name: 'Jhon Doe',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics' },
  });
  const fashion = await prisma.category.create({
    data: { name: 'Fashion', slug: 'fashion' },
  });
  const sports = await prisma.category.create({
    data: { name: 'Sports', slug: 'sports' },
  });

  const catalog = [
    {
      shopId: bigShop.id,
      categoryId: electronics.id,
      name: 'Wireless Headphones Pro',
      slug: 'wireless-headphones-pro',
      priceCents: 8999,
      stock: 50,
      soldCount: 12,
      gtin: 'EAN 1234567890123',
    },
    {
      shopId: bigShop.id,
      categoryId: sports.id,
      name: 'Yoga Mat Premium',
      slug: 'yoga-mat-premium',
      priceCents: 2900,
      stock: 200,
      soldCount: 15,
      gtin: 'EAN 333',
    },
    {
      shopId: bigShop.id,
      categoryId: sports.id,
      name: 'Running Shoes X200',
      slug: 'running-shoes-x200',
      priceCents: 7950,
      stock: 100,
      soldCount: 22,
      gtin: 'EAN 222',
    },
    {
      shopId: lady.id,
      categoryId: fashion.id,
      name: 'Classic Leather Watch',
      slug: 'classic-leather-watch',
      priceCents: 14900,
      stock: 30,
      soldCount: 8,
      gtin: 'EAN 111',
    },
    {
      shopId: lady.id,
      categoryId: fashion.id,
      name: 'Aviator Sunglasses',
      slug: 'aviator-sunglasses',
      priceCents: 5900,
      stock: 80,
      soldCount: 18,
      gtin: 'EAN 444',
    },
    {
      shopId: amz.id,
      categoryId: electronics.id,
      name: 'Car Phone Mount',
      slug: 'car-phone-mount',
      priceCents: 1999,
      stock: 300,
      soldCount: 40,
      gtin: 'EAN 555',
    },
    {
      shopId: amz.id,
      categoryId: electronics.id,
      name: 'USB-C Hub 7-in-1',
      slug: 'usb-c-hub',
      priceCents: 4599,
      stock: 120,
      soldCount: 25,
      gtin: 'EAN 666',
    },
    {
      shopId: amz.id,
      categoryId: sports.id,
      name: 'Resistance Bands Set',
      slug: 'resistance-bands',
      priceCents: 2499,
      stock: 150,
      soldCount: 33,
      gtin: 'EAN 777',
    },
  ];

  const createdProducts = [];
  for (const p of catalog) {
    createdProducts.push(
      await prisma.product.create({
        data: {
          ...p,
          description: `${p.name} — demo product for Mplace.`,
          currency: 'USD',
          status: ProductStatus.ACTIVE,
          sku: p.slug.toUpperCase().slice(0, 12),
        },
      }),
    );
  }

  // sample paid order
  const p0 = createdProducts[0];
  const p1 = createdProducts[1];
  await prisma.order.create({
    data: {
      orderNumber: 'MP-1001',
      customerId: customer.id,
      shopId: bigShop.id,
      status: OrderStatus.PROCESSING,
      subtotalCents: p0.priceCents + p1.priceCents,
      commissionCents: Math.round((p0.priceCents + p1.priceCents) * 0.1),
      totalCents: p0.priceCents + p1.priceCents,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'mock_seed',
      items: {
        create: [
          {
            productId: p0.id,
            productName: p0.name,
            unitPriceCents: p0.priceCents,
            quantity: 1,
            lineTotalCents: p0.priceCents,
          },
          {
            productId: p1.id,
            productName: p1.name,
            unitPriceCents: p1.priceCents,
            quantity: 1,
            lineTotalCents: p1.priceCents,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: 'MP-1002',
      customerId: customer.id,
      shopId: amz.id,
      status: OrderStatus.SHIPPED,
      subtotalCents: createdProducts[5].priceCents * 2,
      commissionCents: Math.round(createdProducts[5].priceCents * 2 * 0.1),
      totalCents: createdProducts[5].priceCents * 2,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'mock_seed_2',
      items: {
        create: [
          {
            productId: createdProducts[5].id,
            productName: createdProducts[5].name,
            unitPriceCents: createdProducts[5].priceCents,
            quantity: 2,
            lineTotalCents: createdProducts[5].priceCents * 2,
          },
        ],
      },
    },
  });

  await prisma.ticket.createMany({
    data: [
      {
        subject: 'Payment Method',
        body: 'How do I change payment method?',
        type: 'General query',
        priority: 'HIGH',
      },
      {
        subject: 'How to payout',
        body: 'When do merchants get paid?',
        type: 'Merchant support',
        priority: 'HIGH',
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed OK:', {
    admin: 'superadmin@demo.com / 123456',
    merchant: 'merchant@demo.com / 123456',
    customer: 'customer@demo.com / 123456',
    products: createdProducts.length,
    shops: 3,
    orders: 2,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
