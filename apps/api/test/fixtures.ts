import {
  ProductStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';

export type E2EFixtures = {
  tenantAId: string;
  tenantBId: string;
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
  // Delete in FK-safe order
  await prisma.ticketMessage.deleteMany().catch(() => undefined);
  await prisma.ticket.deleteMany().catch(() => undefined);
  await prisma.refund.deleteMany().catch(() => undefined);
  await prisma.dispute.deleteMany().catch(() => undefined);
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.wishlistItem.deleteMany().catch(() => undefined);
  await prisma.savedSearch.deleteMany().catch(() => undefined);
  await prisma.productDocument.deleteMany().catch(() => undefined);
  await prisma.kycDocument.deleteMany().catch(() => undefined);
  await prisma.rfqMessage.deleteMany().catch(() => undefined);
  await prisma.rfqOfferItem.deleteMany().catch(() => undefined);
  await prisma.rfqOffer.deleteMany().catch(() => undefined);
  await prisma.rfqMatch.deleteMany().catch(() => undefined);
  await prisma.rfqAttachment.deleteMany().catch(() => undefined);
  await prisma.rfqItem.deleteMany().catch(() => undefined);
  await prisma.rfqRequest.deleteMany().catch(() => undefined);
  await prisma.refreshToken.deleteMany().catch(() => undefined);
  await prisma.auditLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.stripeConnectedAccount.deleteMany().catch(() => undefined);
  await prisma.shop.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A', slug: 'tenant-a-e2e' },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B', slug: 'tenant-b-e2e' },
  });

  const shopA = await prisma.shop.create({
    data: {
      name: 'Shop A',
      slug: 'shop-a-e2e',
      tenantId: tenantA.id,
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const shopB = await prisma.shop.create({
    data: {
      name: 'Shop B',
      slug: 'shop-b-e2e',
      tenantId: tenantB.id,
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
      tenantId: tenantA.id,
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
      tenantId: tenantB.id,
    },
  });
  await prisma.user.create({
    data: {
      email: customerAEmail,
      passwordHash,
      name: 'Customer A',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      tenantId: tenantA.id,
    },
  });
  await prisma.user.create({
    data: {
      email: customerBEmail,
      passwordHash,
      name: 'Customer B',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      tenantId: tenantB.id,
    },
  });

  const cat = await prisma.category.create({
    data: { name: 'E2E Cat', slug: 'e2e-cat' },
  });

  const productA = await prisma.product.create({
    data: {
      shopId: shopA.id,
      tenantId: tenantA.id,
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
      tenantId: tenantB.id,
      categoryId: cat.id,
      name: 'Product B',
      slug: 'product-b',
      priceCents: 2000,
      stock: 3,
      status: ProductStatus.ACTIVE,
    },
  });

  return {
    tenantAId: tenantA.id,
    tenantBId: tenantB.id,
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
