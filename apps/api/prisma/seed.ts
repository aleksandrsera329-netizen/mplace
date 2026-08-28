import {
  OrderStatus,
  Permission,
  PrismaClient,
  ProductStatus,
  RfqOfferStatus,
  RfqStatus,
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
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'mplace-demo' },
    update: { name: 'Mplace Demo' },
    create: { name: 'Mplace Demo', slug: 'mplace-demo', status: 'ACTIVE', plan: 'BUSINESS' },
  });

  // Spec: local/dev password is 123456. Override with DEMO_PASSWORD. Never use in production.
  const demoPassword = process.env.DEMO_PASSWORD || '123456';
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const localAdminHash = await bcrypt.hash('Adm#Mplace2026', 12);

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
  await wipe(() => prisma.inventoryReservation.deleteMany());
  await wipe(() => prisma.mediaAsset.deleteMany());
  await wipe(() => prisma.productStock.deleteMany());
  await wipe(() => prisma.productImportJob.deleteMany());
  await wipe(() => prisma.notificationDelivery.deleteMany());
  await wipe(() => prisma.notification.deleteMany());
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

  // Spec §7: three ACTIVE + KYC-approved shops
  const drillTech = await prisma.shop.create({
    data: {
      name: 'DrillTech Supply',
      slug: 'drilltech-supply',
      tenantId: demoTenant.id,
      description: 'BHA, bits and downhole tools for drilling contractors',
      status: ShopStatus.ACTIVE,
      verified: true,
      country: 'RU',
    },
  });
  const fieldSafe = await prisma.shop.create({
    data: {
      name: 'FieldSafe PPE',
      slug: 'fieldsafe-ppe',
      tenantId: demoTenant.id,
      description: 'HSE PPE and field safety for oil & gas sites',
      status: ShopStatus.ACTIVE,
      verified: true,
      country: 'RU',
    },
  });
  const pipeValve = await prisma.shop.create({
    data: {
      name: 'Pipe & Valve Co',
      slug: 'pipe-valve-co',
      tenantId: demoTenant.id,
      description: 'Pipeline valves, flanges and fittings API / ASME',
      status: ShopStatus.ACTIVE,
      verified: true,
      country: 'RU',
    },
  });

  await prisma.user.create({
    data: {
      email: 'superadmin@demo.com',
      passwordHash,
      name: 'Platform Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash,
      name: 'Administrator',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  // Extra local staff login (same role, independent of spec demo password)
  await prisma.user.create({
    data: {
      email: 'admin@mplace.local',
      passwordHash: localAdminHash,
      name: 'Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const merchantDrill = await prisma.user.create({
    data: {
      email: 'merchant@demo.com',
      passwordHash,
      name: 'Elena Petrova',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      tenantId: demoTenant.id,
      shopId: drillTech.id,
      emailVerifiedAt: new Date(),
    },
  });

  const merchantPpe = await prisma.user.create({
    data: {
      email: 'merchant2@demo.com',
      passwordHash,
      name: 'Sara Al-Hassan',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      tenantId: demoTenant.id,
      shopId: fieldSafe.id,
      emailVerifiedAt: new Date(),
    },
  });

  const merchantValve = await prisma.user.create({
    data: {
      email: 'merchant3@demo.com',
      passwordHash,
      name: 'James Okonkwo',
      role: UserRole.MERCHANT,
      status: UserStatus.ACTIVE,
      tenantId: demoTenant.id,
      shopId: pipeValve.id,
      emailVerifiedAt: new Date(),
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@demo.com',
      passwordHash,
      name: 'Marcus Chen',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      tenantId: demoTenant.id,
      emailVerifiedAt: new Date(),
    },
  });

  const drilling = await prisma.category.create({
    data: { name: 'Буровое оборудование', slug: 'drilling-equipment' },
  });
  const pipeline = await prisma.category.create({
    data: { name: 'Трубопроводы и арматура', slug: 'pipeline-valves' },
  });
  const ppe = await prisma.category.create({
    data: { name: 'СИЗ и HSE', slug: 'ppe-hse' },
  });
  const pumps = await prisma.category.create({
    data: { name: 'Насосы и компрессоры', slug: 'pumps-compressors' },
  });
  const instruments = await prisma.category.create({
    data: { name: 'КИПиА', slug: 'instrumentation' },
  });
  const chemicals = await prisma.category.create({
    data: { name: 'Химия и жидкости', slug: 'chemicals-fluids' },
  });

  type CatalogItem = {
    tenantId: string;
    shopId: string;
    categoryId: string;
    name: string;
    slug: string;
    sku: string;
    priceCents: number;
    stock: number;
    soldCount: number;
    gtin: string;
    imageUrl: string;
    description: string;
  };

  const img = {
    bit: '/assets/img/photos/drill-bit.jpg',
    motor: '/assets/img/photos/mud-motor.jpg',
    gate: '/assets/img/photos/gate-valve.jpg',
    ball: '/assets/img/photos/ball-valve.jpg',
    flange: '/assets/img/photos/flange.jpg',
    coverall: '/assets/img/photos/coverall-fr.jpg',
    h2s: '/assets/img/photos/respirator.jpg',
    pump: '/assets/img/photos/pump.jpg',
    tx: '/assets/img/photos/transmitter.jpg',
    chem: '/assets/img/photos/chemicals.jpg',
    gloves: '/assets/img/photos/gloves.jpg',
    harness: '/assets/img/photos/harness.jpg',
  };

  const catalog: CatalogItem[] = [
    { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'Mud Motor 6-3/4" 5:6', slug: 'mud-motor-6-75', sku: 'DTS-DRL-001', priceCents: 485_000_000, stock: 3, soldCount: 1, gtin: 'OG-MM-675', imageUrl: img.motor, description: 'PDM mud motor 6-3/4", lobe 5:6, directional drilling.' },
    { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'PDC Drill Bit 8-1/2"', slug: 'pdc-drill-bit-8-5', sku: 'DTS-DRL-002', priceCents: 192_000_000, stock: 5, soldCount: 2, gtin: 'OG-BIT-085', imageUrl: img.bit, description: 'Matrix PDC bit 8-1/2" for medium-hard formations. API pin. Oilfield BHA.' },
    { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: pumps.id, name: 'Centrifugal Process Pump 4x3-10', slug: 'centrifugal-pump-4x3', sku: 'DTS-PMP-001', priceCents: 143_520_000, stock: 2, soldCount: 1, gtin: 'OG-PMP-4310', imageUrl: img.pump, description: 'ANSI process pump for water injection / produced water skids.' },
    { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: chemicals.id, name: 'Drilling Fluid Additive Pack (1 t)', slug: 'drilling-fluid-pack-1t', sku: 'DTS-CHM-001', priceCents: 19_320_000, stock: 20, soldCount: 4, gtin: 'OG-CHEM-1T', imageUrl: img.chem, description: 'WBM additive pack: viscosifier + fluid loss control (demo lot).' },

    { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'H2S Escape Respirator Kit', slug: 'h2s-escape-kit', sku: 'FSP-PPE-001', priceCents: 2_944_000, stock: 40, soldCount: 8, gtin: 'OG-H2S-KIT', imageUrl: img.h2s, description: 'Emergency escape BA for H2S-risk zones. Field HSE kit.' },
    { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'FR Coverall CAT2', slug: 'fr-coverall-cat2', sku: 'FSP-PPE-002', priceCents: 1_738_800, stock: 80, soldCount: 22, gtin: 'OG-PPE-FR', imageUrl: img.coverall, description: 'Flame-resistant coverall CAT2, antistatic, process units and wellsites.' },
    { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'Chemical Gloves Class B', slug: 'chemical-gloves-class-b', sku: 'FSP-PPE-003', priceCents: 490_000, stock: 200, soldCount: 40, gtin: 'OG-PPE-GLV', imageUrl: img.gloves, description: 'Chemical-resistant gloves Class B for process handling.' },
    { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'Safety Harness EN 361', slug: 'safety-harness-en361', sku: 'FSP-PPE-004', priceCents: 1_275_000, stock: 35, soldCount: 9, gtin: 'OG-PPE-HRN', imageUrl: img.harness, description: 'Full-body safety harness EN 361 for work at height.' },

    { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: instruments.id, name: 'Pressure Transmitter 0–100 bar', slug: 'pt-0-100bar', sku: 'PVC-INS-001', priceCents: 8_050_000, stock: 15, soldCount: 3, gtin: 'OG-PT-100', imageUrl: img.tx, description: 'Industrial PT 0–100 bar, 4–20 mA HART, ATEX options.' },
    { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Weld Neck Flange 8" Sch 40', slug: 'wn-flange-8-sch40', sku: 'PVC-VLV-001', priceCents: 4_620_000, stock: 25, soldCount: 11, gtin: 'OG-WN-8', imageUrl: img.flange, description: 'ASME B16.5 WN flange 8" Class 150, A105, raised face.' },
    { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Ball Valve 4"', slug: 'ball-valve-4-fb', sku: 'PVC-VLV-002', priceCents: 6_380_000, stock: 18, soldCount: 6, gtin: 'OG-BV-4FB', imageUrl: img.ball, description: 'Full-bore trunnion ball valve 4", fire-safe design.' },
    { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Gate Valve 6"', slug: 'gate-valve-6-cl600', sku: 'PVC-VLV-003', priceCents: 9_140_000, stock: 12, soldCount: 4, gtin: 'OG-GV-6006', imageUrl: img.gate, description: 'API 600 cast steel gate valve, RF flanged, Class 600.' },
  ];

  const createdProducts = [];
  for (const p of catalog) {
    const { description, sku, ...rest } = p;
    createdProducts.push(
      await prisma.product.create({
        data: {
          ...rest,
          sku,
          description:
            description ||
            `${p.name} — oil & gas supply catalog item (Mplace Energy).`,
          currency: 'RUB',
          status: ProductStatus.ACTIVE,
          moq: 1,
        },
      }),
    );
  }

  // Sample orders (buyer procurement)
  const p0 = createdProducts.find((p) => p.slug === 'pdc-drill-bit-8-5')!;
  const pGate = createdProducts.find((p) => p.slug === 'gate-valve-6-cl600')!;
  const pPpe = createdProducts.find((p) => p.slug === 'fr-coverall-cat2')!;
  const pH2s = createdProducts.find((p) => p.slug === 'h2s-escape-kit')!;
  const pBall = createdProducts.find((p) => p.slug === 'ball-valve-4-fb')!;

  await prisma.order.create({
    data: {
      orderNumber: 'OG-1001',
      customerId: customer.id,
      tenantId: demoTenant.id,
      shopId: drillTech.id,
      status: OrderStatus.PROCESSING,
      currency: 'RUB',
      subtotalCents: p0.priceCents,
      commissionCents: Math.round(p0.priceCents * 0.1),
      totalCents: p0.priceCents,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'demo_seed_og_1001',
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
      tenantId: demoTenant.id,
      shopId: pipeValve.id,
      status: OrderStatus.SHIPPED,
      currency: 'RUB',
      subtotalCents: pGate.priceCents * 2,
      commissionCents: Math.round(pGate.priceCents * 2 * 0.1),
      totalCents: pGate.priceCents * 2,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'demo_seed_og_1002',
      items: {
        create: [
          {
            productId: pGate.id,
            productName: pGate.name,
            unitPriceCents: pGate.priceCents,
            quantity: 2,
            lineTotalCents: pGate.priceCents * 2,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: 'OG-1003',
      customerId: customer.id,
      tenantId: demoTenant.id,
      shopId: fieldSafe.id,
      status: OrderStatus.COMPLETED,
      currency: 'RUB',
      subtotalCents: pPpe.priceCents * 50,
      commissionCents: Math.round(pPpe.priceCents * 50 * 0.1),
      totalCents: pPpe.priceCents * 50,
      customerEmail: customer.email,
      customerName: customer.name,
      paymentRef: 'demo_seed_og_1003',
      items: {
        create: [
          {
            productId: pPpe.id,
            productName: pPpe.name,
            unitPriceCents: pPpe.priceCents,
            quantity: 50,
            lineTotalCents: pPpe.priceCents * 50,
          },
        ],
      },
    },
  });

  // RFQ: quoted request with two supplier offers (buyer can Award)
  const rfqOpen = await prisma.rfqRequest.create({
    data: {
      number: 'RFQ-2026-001',
      buyerId: customer.id,
      tenantId: demoTenant.id,
      title: 'Wellsite valve package — Class 600',
      description:
        'Request quotes for gate and ball valves for a drilling location package. Delivery to yard within 30 days preferred.',
      status: RfqStatus.QUOTED,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      items: {
        create: [
          {
            name: 'Gate Valve 6" Class 600',
            quantity: 4,
            unit: 'pcs',
            categoryId: pipeline.id,
            specs: 'API 600, RF flanged, carbon steel',
          },
          {
            name: 'Ball Valve 4" Full Bore',
            quantity: 6,
            unit: 'pcs',
            categoryId: pipeline.id,
            specs: 'Fire-safe, trunnion, gas service',
          },
        ],
      },
    },
    include: { items: true },
  });

  await prisma.rfqMatch.createMany({
    data: [
      { rfqId: rfqOpen.id, shopId: pipeValve.id, score: 92, reason: 'Category + stock match' },
      { rfqId: rfqOpen.id, shopId: drillTech.id, score: 55, reason: 'Partial catalog overlap' },
    ],
  });

  const offerValve = await prisma.rfqOffer.create({
    data: {
      rfqId: rfqOpen.id,
      shopId: pipeValve.id,
      vendorId: merchantValve.id,
      status: RfqOfferStatus.PENDING,
      message: 'Can supply full package from stock. Certificates included.',
      totalCents: pGate.priceCents * 4 + pBall.priceCents * 6,
      currency: 'USD',
      validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            rfqItemId: rfqOpen.items[0].id,
            unitPriceCents: pGate.priceCents,
            quantity: 4,
            note: 'Ex-works, 2 weeks',
          },
          {
            rfqItemId: rfqOpen.items[1].id,
            unitPriceCents: pBall.priceCents,
            quantity: 6,
            note: 'Fire-safe certified',
          },
        ],
      },
    },
  });

  await prisma.rfqOffer.create({
    data: {
      rfqId: rfqOpen.id,
      shopId: drillTech.id,
      vendorId: merchantDrill.id,
      status: RfqOfferStatus.PENDING,
      message: 'Ball valves via partner; gate valves 3-week lead time.',
      totalCents: Math.round(pGate.priceCents * 4 * 1.08) + Math.round(pBall.priceCents * 6 * 1.05),
      currency: 'USD',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            rfqItemId: rfqOpen.items[0].id,
            unitPriceCents: Math.round(pGate.priceCents * 1.08),
            quantity: 4,
          },
          {
            rfqItemId: rfqOpen.items[1].id,
            unitPriceCents: Math.round(pBall.priceCents * 1.05),
            quantity: 6,
          },
        ],
      },
    },
  });

  // Second RFQ: awarded
  const rfqAwarded = await prisma.rfqRequest.create({
    data: {
      number: 'RFQ-2026-002',
      buyerId: customer.id,
      tenantId: demoTenant.id,
      title: 'HSE kit for 40-person camp',
      description: 'FR coveralls and H2S escape kits for temporary camp.',
      status: RfqStatus.AWARDED,
      deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      items: {
        create: [
          {
            name: 'FR Coverall CAT2',
            quantity: 40,
            unit: 'pcs',
            categoryId: ppe.id,
          },
          {
            name: 'H2S Escape Kit',
            quantity: 20,
            unit: 'pcs',
            categoryId: ppe.id,
          },
        ],
      },
    },
    include: { items: true },
  });

  const awardOffer = await prisma.rfqOffer.create({
    data: {
      rfqId: rfqAwarded.id,
      shopId: fieldSafe.id,
      vendorId: merchantPpe.id,
      status: RfqOfferStatus.ACCEPTED,
      message: 'Full HSE package ready to ship.',
      totalCents: pPpe.priceCents * 40 + pH2s.priceCents * 20,
      currency: 'USD',
      items: {
        create: [
          {
            rfqItemId: rfqAwarded.items[0].id,
            unitPriceCents: pPpe.priceCents,
            quantity: 40,
          },
          {
            rfqItemId: rfqAwarded.items[1].id,
            unitPriceCents: pH2s.priceCents,
            quantity: 20,
          },
        ],
      },
    },
  });

  await prisma.rfqRequest.update({
    where: { id: rfqAwarded.id },
    data: { awardedOfferId: awardOffer.id },
  });

  // Spec: one sample OPEN RFQ (merchants can still offer)
  const rfqFresh = await prisma.rfqRequest.create({
    data: {
      number: 'RFQ-2026-003',
      buyerId: customer.id,
      tenantId: demoTenant.id,
      title: 'Mud motor for directional section',
      description: 'Need 6-3/4" 5:6 mud motor, certificates and 30-day delivery.',
      status: RfqStatus.OPEN,
      deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      items: {
        create: [
          {
            name: 'Mud Motor 6-3/4" 5:6',
            quantity: 1,
            unit: 'pcs',
            categoryId: drilling.id,
            specs: 'Lobe 5:6, API connections',
          },
        ],
      },
    },
  });
  await prisma.rfqMatch.createMany({
    data: [
      { rfqId: rfqFresh.id, shopId: drillTech.id, score: 95, reason: 'Exact SKU match' },
      { rfqId: rfqFresh.id, shopId: pipeValve.id, score: 20, reason: 'Weak catalog overlap' },
    ],
  });

  await prisma.ticket.createMany({
    data: [
      {
        subject: 'Material certificates — Gate Valve 6"',
        body: 'Please attach mill test certificates for order OG-1002.',
        type: 'Procurement',
        priority: 'HIGH',
      },
      {
        subject: 'Lead time for mud motor 6-3/4"',
        body: 'Need confirmed delivery to yard for next well program.',
        type: 'Merchant support',
        priority: 'HIGH',
      },
      {
        subject: 'RFQ-2026-001 clarification',
        body: 'Can suppliers confirm fire-safe documentation with quote?',
        type: 'RFQ',
        priority: 'NORMAL',
      },
    ],
  });

  void offerValve;

  // eslint-disable-next-line no-console
  console.log('Seed OK (Oil & Gas demo):', {
    superadmin: 'superadmin@demo.com',
    admin: 'admin@demo.com',
    merchant: 'merchant@demo.com',
    merchant2: 'merchant2@demo.com',
    merchant3: 'merchant3@demo.com',
    customer: 'customer@demo.com',
    demoPassword: process.env.DEMO_PASSWORD ? '(from DEMO_PASSWORD)' : '123456',
    products: createdProducts.length,
    shops: 3,
    categories: 6,
    orders: 3,
    rfqs: 3,
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
