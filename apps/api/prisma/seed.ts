import {
  OrderStatus,
  Permission,
  PrismaClient,
  ProductStatus,
  ShopStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Stage 6: full admin permission set for ADMIN + SUPER_ADMIN (guard bypasses SUPER_ADMIN) */
const ADMIN_PERMISSIONS: Permission[] = [
  Permission.users_read,
  Permission.users_write,
  Permission.shops_read,
  Permission.shops_verify,
  Permission.shops_suspend,
  Permission.orders_read,
  Permission.orders_refund,
  Permission.payments_read,
  Permission.payments_refund,
  Permission.payouts_read,
  Permission.payouts_approve,
  Permission.kyc_read,
  Permission.kyc_approve,
  Permission.disputes_read,
  Permission.disputes_resolve,
  Permission.audit_read,
];

async function seedRolePermissions() {
  for (const role of [UserRole.ADMIN, UserRole.SUPER_ADMIN] as const) {
    for (const permission of ADMIN_PERMISSIONS) {
      await prisma.rolePermission.upsert({
        where: {
          role_permission: { role, permission },
        },
        create: { role, permission },
        update: {},
      });
    }
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('123456', 12);

  // clean demo data for clean seed (keep schema) — order respects FKs
  const wipe = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* table may not exist yet */
    }
  };
  await wipe(() => prisma.ticketMessage.deleteMany());
  await wipe(() => prisma.ticket.deleteMany());
  await wipe(() => prisma.refund.deleteMany());
  await wipe(() => prisma.dispute.deleteMany());
  await wipe(() => prisma.orderStatusHistory.deleteMany());
  await wipe(() => prisma.payment.deleteMany());
  await wipe(() => prisma.ledgerEntry.deleteMany());
  await wipe(() => prisma.orderItem.deleteMany());
  await wipe(() => prisma.order.deleteMany());
  await wipe(() => prisma.cartItem.deleteMany());
  await wipe(() => prisma.cart.deleteMany());
  await wipe(() => prisma.payoutRequest.deleteMany());
  await wipe(() => prisma.rfqOfferItem.deleteMany());
  await wipe(() => prisma.rfqOffer.deleteMany());
  await wipe(() => prisma.rfqMessage.deleteMany());
  await wipe(() => prisma.rfqMatch.deleteMany());
  await wipe(() => prisma.rfqAttachment.deleteMany());
  await wipe(() => prisma.rfqItem.deleteMany());
  await wipe(() => prisma.rfqRequest.deleteMany());
  await wipe(() => prisma.wishlistItem.deleteMany());
  await wipe(() => prisma.savedSearch.deleteMany());
  await wipe(() => prisma.productDocument.deleteMany());
  await wipe(() => prisma.productImage.deleteMany());
  await wipe(() => prisma.product.deleteMany());
  await wipe(() => prisma.category.deleteMany());
  await wipe(() => prisma.kycDocument.deleteMany());
  await wipe(() => prisma.refreshToken.deleteMany());
  await wipe(() => prisma.rolePermission.deleteMany());
  await wipe(() => prisma.auditLog.deleteMany());
  await wipe(() => prisma.user.deleteMany());
  await wipe(() => prisma.shop.deleteMany());

  // Stage 6: role → permission matrix
  await seedRolePermissions();

  // Oil & Gas suppliers
  const drillTech = await prisma.shop.create({
    data: {
      name: 'DrillTech Supply',
      slug: 'drilltech-supply',
      description: 'BHA, bits and downhole tools for drilling contractors',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const pipeValve = await prisma.shop.create({
    data: {
      name: 'Pipe & Valve Co',
      slug: 'pipe-valve-co',
      description: 'Pipeline valves, flanges and fittings API / ASME',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });
  const fieldSafe = await prisma.shop.create({
    data: {
      name: 'FieldSafe PPE',
      slug: 'fieldsafe-ppe',
      description: 'HSE PPE and field safety for oil & gas sites',
      status: ShopStatus.ACTIVE,
      verified: true,
    },
  });

  await prisma.user.create({
    data: {
      email: 'superadmin@demo.com',
      passwordHash,
      name: 'SuperAdmin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      email: 'merchant@demo.com',
      passwordHash,
      name: 'DrillTech Merchant',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: drillTech.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'amz@demo.com',
      passwordHash,
      name: 'PipeValve Owner',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      shopId: pipeValve.id,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@demo.com',
      passwordHash,
      name: 'Procurement Buyer',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'jhondoe@demo.com',
      passwordHash,
      name: 'Field Engineer',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const drilling = await prisma.category.create({
    data: { name: 'Drilling Equipment', slug: 'drilling-equipment' },
  });
  const pipeline = await prisma.category.create({
    data: { name: 'Pipeline & Valves', slug: 'pipeline-valves' },
  });
  const ppe = await prisma.category.create({
    data: { name: 'PPE & HSE', slug: 'ppe-hse' },
  });
  const pumps = await prisma.category.create({
    data: { name: 'Pumps & Compressors', slug: 'pumps-compressors' },
  });
  const instruments = await prisma.category.create({
    data: { name: 'Instrumentation', slug: 'instrumentation' },
  });
  const chemicals = await prisma.category.create({
    data: { name: 'Chemicals & Fluids', slug: 'chemicals-fluids' },
  });

  const catalog = [
    {
      shopId: drillTech.id,
      categoryId: drilling.id,
      name: 'PDC Drill Bit 8-1/2"',
      slug: 'pdc-drill-bit-8-5',
      priceCents: 1250000,
      stock: 12,
      soldCount: 4,
      gtin: 'OG-BIT-085',
      imageUrl: '/assets/img/products/drill-bit.svg',
      description:
        'Matrix PDC bit 8-1/2" for medium-hard formations. API pin connection. Oilfield drilling BHA.',
    },
    {
      shopId: drillTech.id,
      categoryId: drilling.id,
      name: 'Mud Motor 6-3/4" 5:6',
      slug: 'mud-motor-6-75',
      priceCents: 8900000,
      stock: 4,
      soldCount: 1,
      gtin: 'OG-MM-675',
      imageUrl: '/assets/img/products/mud-motor.svg',
      description:
        'Positive displacement mud motor 6-3/4", lobe 5:6, for directional drilling applications.',
    },
    {
      shopId: pipeValve.id,
      categoryId: pipeline.id,
      name: 'Gate Valve 6" Class 600',
      slug: 'gate-valve-6-cl600',
      priceCents: 245000,
      stock: 28,
      soldCount: 9,
      gtin: 'OG-GV-6006',
      imageUrl: '/assets/img/products/gate-valve.svg',
      description:
        'API 600 cast steel gate valve, RF flanged, Class 600, carbon steel body for crude/product lines.',
    },
    {
      shopId: pipeValve.id,
      categoryId: pipeline.id,
      name: 'Ball Valve 4" Full Bore',
      slug: 'ball-valve-4-fb',
      priceCents: 189000,
      stock: 40,
      soldCount: 14,
      gtin: 'OG-BV-4FB',
      imageUrl: '/assets/img/products/ball-valve.svg',
      description:
        'Full-bore trunnion ball valve 4", fire-safe design, suitable for gas transmission manifolds.',
    },
    {
      shopId: pipeValve.id,
      categoryId: pipeline.id,
      name: 'Weld Neck Flange 8" Sch 40',
      slug: 'wn-flange-8-sch40',
      priceCents: 42000,
      stock: 120,
      soldCount: 55,
      gtin: 'OG-WN-8',
      imageUrl: '/assets/img/products/flange.svg',
      description: 'ASME B16.5 WN flange 8" Class 150, A105, raised face.',
    },
    {
      shopId: fieldSafe.id,
      categoryId: ppe.id,
      name: 'FR Coverall CAT2 (M–XXL)',
      slug: 'fr-coverall-cat2',
      priceCents: 18900,
      stock: 200,
      soldCount: 67,
      gtin: 'OG-PPE-FR',
      imageUrl: '/assets/img/products/fr-coverall.svg',
      description:
        'Flame-resistant coverall CAT2, antistatic, for oil & gas process units and wellsites.',
    },
    {
      shopId: fieldSafe.id,
      categoryId: ppe.id,
      name: 'H2S Escape Respirator Kit',
      slug: 'h2s-escape-kit',
      priceCents: 32000,
      stock: 80,
      soldCount: 22,
      gtin: 'OG-H2S-KIT',
      imageUrl: '/assets/img/products/h2s-kit.svg',
      description:
        'Emergency escape breathing apparatus for H2S-risk zones. Field HSE standard kit.',
    },
    {
      shopId: drillTech.id,
      categoryId: pumps.id,
      name: 'Centrifugal Process Pump 4x3-10',
      slug: 'centrifugal-pump-4x3',
      priceCents: 1560000,
      stock: 6,
      soldCount: 2,
      gtin: 'OG-PMP-4310',
      imageUrl: '/assets/img/products/pump.svg',
      description:
        'ANSI process centrifugal pump for water injection / produced water transfer skids.',
    },
    {
      shopId: pipeValve.id,
      categoryId: instruments.id,
      name: 'Pressure Transmitter 0–100 bar',
      slug: 'pt-0-100bar',
      priceCents: 87500,
      stock: 35,
      soldCount: 11,
      gtin: 'OG-PT-100',
      imageUrl: '/assets/img/products/transmitter.svg',
      description:
        'Industrial pressure transmitter 0–100 bar, 4–20 mA HART, ATEX zone options on request.',
    },
    {
      shopId: fieldSafe.id,
      categoryId: chemicals.id,
      name: 'Drilling Fluid Additive Pack (1 t)',
      slug: 'drilling-fluid-pack-1t',
      priceCents: 210000,
      stock: 18,
      soldCount: 5,
      gtin: 'OG-CHEM-1T',
      imageUrl: '/assets/img/products/chemicals.svg',
      description:
        'Bulk additive pack for water-based mud systems: viscosifier + fluid loss control (demo lot).',
    },
  ];

  const createdProducts = [];
  for (const p of catalog) {
    const { description, ...rest } = p;
    createdProducts.push(
      await prisma.product.create({
        data: {
          ...rest,
          description:
            description ||
            `${p.name} — oil & gas supply catalog item (Mplace Energy).`,
          currency: 'USD',
          status: ProductStatus.ACTIVE,
          sku: p.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16),
        },
      }),
    );
  }

  // sample paid order
  const p0 = createdProducts[0];
  const p1 = createdProducts[2];
  await prisma.order.create({
    data: {
      orderNumber: 'OG-1001',
      customerId: customer.id,
      shopId: drillTech.id,
      status: OrderStatus.PROCESSING,
      subtotalCents: p0.priceCents,
      commissionCents: Math.round(p0.priceCents * 0.1),
      totalCents: p0.priceCents,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'mock_seed_og',
      items: {
        create: [
          {
            productId: p0.id,
            productName: p0.name,
            unitPriceCents: p0.priceCents,
            quantity: 1,
            lineTotalCents: p0.priceCents,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: 'OG-1002',
      customerId: customer.id,
      shopId: pipeValve.id,
      status: OrderStatus.SHIPPED,
      subtotalCents: p1.priceCents * 2,
      commissionCents: Math.round(p1.priceCents * 2 * 0.1),
      totalCents: p1.priceCents * 2,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'mock_seed_og_2',
      items: {
        create: [
          {
            productId: p1.id,
            productName: p1.name,
            unitPriceCents: p1.priceCents,
            quantity: 2,
            lineTotalCents: p1.priceCents * 2,
          },
        ],
      },
    },
  });

  await prisma.ticket.createMany({
    data: [
      {
        subject: 'API certificate request',
        body: 'Need material certificates for Gate Valve 6" Class 600.',
        type: 'Procurement',
        priority: 'HIGH',
      },
      {
        subject: 'Lead time for mud motor',
        body: 'What is the delivery lead time to yard?',
        type: 'Merchant support',
        priority: 'HIGH',
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed OK (Oil & Gas):', {
    admin: 'superadmin@demo.com / 123456',
    merchant: 'merchant@demo.com / 123456',
    customer: 'customer@demo.com / 123456',
    products: createdProducts.length,
    shops: 3,
    categories: 6,
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
