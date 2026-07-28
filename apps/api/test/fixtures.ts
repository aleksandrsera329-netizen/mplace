import {
  ProductStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';

export type E2EFixtures = {
  shopAId: string;
  shopBId: string;
  merchantAEmail: string;
  merchantBEmail: string;
  customerAEmail: string;
  customerBEmail: string;
  password: string;
  productAId: string;
  productBId: string;
};

const PASSWORD = 'TestPass123!';

/** Wipe transactional data and create deterministic users/shops/products. */
export async function resetAndSeedFixtures(
  prisma: PrismaService,
): Promise<E2EFixtures> {
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const shopA = await prisma.shop.create({
    data: {
      name: 'Shop A',
      slug: 'shop-a-e2e',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const shopB = await prisma.shop.create({
    data: {
      name: 'Shop B',
      slug: 'shop-b-e2e',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });

  const merchantAEmail = 'merchant-a-e2e@example.com';
  const merchantBEmail = 'merchant-b-e2e@example.com';
  const customerAEmail = 'customer-a-e2e@example.com';
  const customerBEmail = 'customer-b-e2e@example.com';

  await prisma.user.create({
    data: {
      email: 'admin-e2e@example.com',
      passwordHash,
      name: 'Admin E2E',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.user.create({
    data: {
      email: merchantAEmail,
      passwordHash,
      name: 'Merchant A',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: shopA.id,
    },
  });
  await prisma.user.create({
    data: {
      email: merchantBEmail,
      passwordHash,
      name: 'Merchant B',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: shopB.id,
    },
  });
  await prisma.user.create({
    data: {
      email: customerAEmail,
      passwordHash,
      name: 'Customer A',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.user.create({
    data: {
      email: customerBEmail,
      passwordHash,
      name: 'Customer B',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const cat = await prisma.category.create({
    data: { name: 'E2E Cat', slug: 'e2e-cat' },
  });

  const productA = await prisma.product.create({
    data: {
      shopId: shopA.id,
      categoryId: cat.id,
      name: 'Product A',
      slug: 'product-a',
      priceCents: 1000,
      stock: 5,
      status: ProductStatus.ACTIVE,
    },
  });
  const productB = await prisma.product.create({
    data: {
      shopId: shopB.id,
      categoryId: cat.id,
      name: 'Product B',
      slug: 'product-b',
      priceCents: 2000,
      stock: 3,
      status: ProductStatus.ACTIVE,
    },
  });

  return {
    shopAId: shopA.id,
    shopBId: shopB.id,
    merchantAEmail,
    merchantBEmail,
    customerAEmail,
    customerBEmail,
    password: PASSWORD,
    productAId: productA.id,
    productBId: productB.id,
  };
}
