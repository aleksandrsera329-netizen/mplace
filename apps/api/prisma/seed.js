"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
/** Stage 6: full admin permission set for ADMIN + SUPER_ADMIN (guard bypasses SUPER_ADMIN) */
const ADMIN_PERMISSIONS = [
    client_1.Permission.users_read,
    client_1.Permission.users_write,
    client_1.Permission.shops_read,
    client_1.Permission.shops_verify,
    client_1.Permission.shops_suspend,
    client_1.Permission.orders_read,
    client_1.Permission.orders_refund,
    client_1.Permission.payments_read,
    client_1.Permission.payments_refund,
    client_1.Permission.payouts_read,
    client_1.Permission.payouts_approve,
    client_1.Permission.kyc_read,
    client_1.Permission.kyc_approve,
    client_1.Permission.disputes_read,
    client_1.Permission.disputes_resolve,
    client_1.Permission.audit_read,
];
async function seedRolePermissions() {
    for (const role of [client_1.UserRole.ADMIN, client_1.UserRole.SUPER_ADMIN]) {
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
    // Private demo only — never print on public pages. Override with DEMO_PASSWORD.
    const demoPassword = process.env.DEMO_PASSWORD || 'MplacePrivateDemo!';
    const passwordHash = await bcrypt.hash(demoPassword, 12);
    // clean demo data for clean seed (keep schema) — order respects FKs
    const wipe = async (fn) => {
        try {
            await fn();
        }
        catch {
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
    // Oil & Gas suppliers (5)
    const drillTech = await prisma.shop.create({
        data: {
            name: 'DrillTech Supply',
            slug: 'drilltech-supply',
            tenantId: demoTenant.id,
            description: 'BHA, bits and downhole tools for drilling contractors',
            status: client_1.ShopStatus.ACTIVE,
            verified: true,
        },
    });
    const pipeValve = await prisma.shop.create({
        data: {
            name: 'Pipe & Valve Co',
            slug: 'pipe-valve-co',
            tenantId: demoTenant.id,
            description: 'Pipeline valves, flanges and fittings API / ASME',
            status: client_1.ShopStatus.ACTIVE,
            verified: true,
        },
    });
    const fieldSafe = await prisma.shop.create({
        data: {
            name: 'FieldSafe PPE',
            slug: 'fieldsafe-ppe',
            tenantId: demoTenant.id,
            description: 'HSE PPE and field safety for oil & gas sites',
            status: client_1.ShopStatus.ACTIVE,
            verified: true,
        },
    });
    const petroFlow = await prisma.shop.create({
        data: {
            name: 'PetroFlow Instruments',
            slug: 'petroflow-instruments',
            tenantId: demoTenant.id,
            description: 'Pressure, flow and level instrumentation for upstream/midstream',
            status: client_1.ShopStatus.ACTIVE,
            verified: true,
        },
    });
    const mudChem = await prisma.shop.create({
        data: {
            name: 'MudChem Solutions',
            slug: 'mudchem-solutions',
            tenantId: demoTenant.id,
            description: 'Drilling fluids, chemicals and bulk additives',
            status: client_1.ShopStatus.ACTIVE,
            verified: true,
        },
    });
    await prisma.user.create({
        data: {
            email: 'superadmin@demo.com',
            passwordHash,
            name: 'Platform Admin',
            role: client_1.UserRole.SUPER_ADMIN,
            status: client_1.UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
        },
    });
    const merchantDrill = await prisma.user.create({
        data: {
            email: 'merchant@demo.com',
            passwordHash,
            name: 'Elena Petrova',
            role: client_1.UserRole.MERCHANT,
            status: client_1.UserStatus.ACTIVE,
            tenantId: demoTenant.id,
            shopId: drillTech.id,
        },
    });
    const merchantValve = await prisma.user.create({
        data: {
            email: 'valves@demo.com',
            passwordHash,
            name: 'James Okonkwo',
            role: client_1.UserRole.MERCHANT,
            status: client_1.UserStatus.ACTIVE,
            tenantId: demoTenant.id,
            shopId: pipeValve.id,
        },
    });
    await prisma.user.create({
        data: {
            email: 'ppe@demo.com',
            passwordHash,
            name: 'Sara Al-Hassan',
            role: client_1.UserRole.MERCHANT,
            status: client_1.UserStatus.ACTIVE,
            tenantId: demoTenant.id,
            shopId: fieldSafe.id,
        },
    });
    const customer = await prisma.user.create({
        data: {
            email: 'customer@demo.com',
            passwordHash,
            name: 'Marcus Chen',
            role: client_1.UserRole.CUSTOMER,
            status: client_1.UserStatus.ACTIVE,
            tenantId: demoTenant.id,
        },
    });
    await prisma.user.create({
        data: {
            email: 'buyer@demo.com',
            passwordHash,
            name: 'Nadia Volkov',
            role: client_1.UserRole.CUSTOMER,
            status: client_1.UserStatus.ACTIVE,
            tenantId: demoTenant.id,
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
    };
    const catalog = [
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'PDC Drill Bit 8-1/2"', slug: 'pdc-drill-bit-8-5', priceCents: 1250000, stock: 12, soldCount: 4, gtin: 'OG-BIT-085', imageUrl: img.bit, description: 'Matrix PDC bit 8-1/2" for medium-hard formations. API pin. Oilfield BHA.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'PDC Drill Bit 12-1/4"', slug: 'pdc-drill-bit-12-25', priceCents: 1890000, stock: 8, soldCount: 2, gtin: 'OG-BIT-1225', imageUrl: img.bit, description: 'Large-diameter PDC bit 12-1/4" for surface hole sections.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'Mud Motor 6-3/4" 5:6', slug: 'mud-motor-6-75', priceCents: 8900000, stock: 4, soldCount: 1, gtin: 'OG-MM-675', imageUrl: img.motor, description: 'PDM mud motor 6-3/4", lobe 5:6, directional drilling.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'Mud Motor 4-3/4" 7:8', slug: 'mud-motor-4-75', priceCents: 6200000, stock: 5, soldCount: 1, gtin: 'OG-MM-475', imageUrl: img.motor, description: 'Compact PDM 4-3/4" for slim-hole and re-entry work.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: drilling.id, name: 'Stabilizer 8-1/2" Spiral', slug: 'stabilizer-8-5-spiral', priceCents: 980000, stock: 10, soldCount: 3, gtin: 'OG-STB-85', imageUrl: img.bit, description: 'Integral spiral stabilizer 8-1/2" for BHA centralization.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: pumps.id, name: 'Centrifugal Process Pump 4x3-10', slug: 'centrifugal-pump-4x3', priceCents: 1560000, stock: 6, soldCount: 2, gtin: 'OG-PMP-4310', imageUrl: img.pump, description: 'ANSI process pump for water injection / produced water skids.' },
        { tenantId: demoTenant.id, shopId: drillTech.id, categoryId: pumps.id, name: 'Triplex Mud Pump Liner Set', slug: 'triplex-mud-pump-liners', priceCents: 420000, stock: 15, soldCount: 6, gtin: 'OG-PMP-LIN', imageUrl: img.pump, description: 'Chrome liner set for triplex mud pumps, common field sizes.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Gate Valve 6" Class 600', slug: 'gate-valve-6-cl600', priceCents: 245000, stock: 28, soldCount: 9, gtin: 'OG-GV-6006', imageUrl: img.gate, description: 'API 600 cast steel gate valve, RF flanged, Class 600.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Gate Valve 4" Class 300', slug: 'gate-valve-4-cl300', priceCents: 165000, stock: 36, soldCount: 12, gtin: 'OG-GV-3004', imageUrl: img.gate, description: 'API 600 gate valve 4" Class 300 for product pipelines.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Ball Valve 4" Full Bore', slug: 'ball-valve-4-fb', priceCents: 189000, stock: 40, soldCount: 14, gtin: 'OG-BV-4FB', imageUrl: img.ball, description: 'Full-bore trunnion ball valve 4", fire-safe design.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Ball Valve 2" Reduced Bore', slug: 'ball-valve-2-rb', priceCents: 78000, stock: 55, soldCount: 20, gtin: 'OG-BV-2RB', imageUrl: img.ball, description: 'Reduced-bore ball valve 2" for instrument take-offs.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Weld Neck Flange 8" Sch 40', slug: 'wn-flange-8-sch40', priceCents: 42000, stock: 120, soldCount: 55, gtin: 'OG-WN-8', imageUrl: img.flange, description: 'ASME B16.5 WN flange 8" Class 150, A105, raised face.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Blind Flange 6" Class 600', slug: 'blind-flange-6-cl600', priceCents: 38000, stock: 90, soldCount: 30, gtin: 'OG-BL-6600', imageUrl: img.flange, description: 'ASME B16.5 blind flange 6" Class 600 for line isolation.' },
        { tenantId: demoTenant.id, shopId: pipeValve.id, categoryId: pipeline.id, name: 'Check Valve 3" Swing', slug: 'check-valve-3-swing', priceCents: 112000, stock: 22, soldCount: 7, gtin: 'OG-CV-3SW', imageUrl: img.gate, description: 'Swing check valve 3" Class 300, carbon steel body.' },
        { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'FR Coverall CAT2 (M–XXL)', slug: 'fr-coverall-cat2', priceCents: 18900, stock: 200, soldCount: 67, gtin: 'OG-PPE-FR', imageUrl: img.coverall, description: 'Flame-resistant coverall CAT2, antistatic, process units and wellsites.' },
        { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'FR Coverall CAT3 Arc Flash', slug: 'fr-coverall-cat3', priceCents: 26500, stock: 80, soldCount: 18, gtin: 'OG-PPE-FR3', imageUrl: img.coverall, description: 'Arc-rated FR coverall CAT3 for electrical and process hazards.' },
        { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'H2S Escape Respirator Kit', slug: 'h2s-escape-kit', priceCents: 32000, stock: 80, soldCount: 22, gtin: 'OG-H2S-KIT', imageUrl: img.h2s, description: 'Emergency escape BA for H2S-risk zones. Field HSE kit.' },
        { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'Safety Helmet + Chin Strap', slug: 'safety-helmet-chin', priceCents: 4500, stock: 300, soldCount: 95, gtin: 'OG-PPE-HLM', imageUrl: img.coverall, description: 'Industrial safety helmet with chin strap for rig floor.' },
        { tenantId: demoTenant.id, shopId: fieldSafe.id, categoryId: ppe.id, name: 'Gas Detector 4-Gas Portable', slug: 'gas-detector-4gas', priceCents: 89000, stock: 45, soldCount: 15, gtin: 'OG-PPE-GAS', imageUrl: img.h2s, description: 'Portable multi-gas detector O2/LEL/H2S/CO for confined space.' },
        { tenantId: demoTenant.id, shopId: petroFlow.id, categoryId: instruments.id, name: 'Pressure Transmitter 0–100 bar', slug: 'pt-0-100bar', priceCents: 87500, stock: 35, soldCount: 11, gtin: 'OG-PT-100', imageUrl: img.tx, description: 'Industrial PT 0–100 bar, 4–20 mA HART, ATEX options.' },
        { tenantId: demoTenant.id, shopId: petroFlow.id, categoryId: instruments.id, name: 'Pressure Transmitter 0–400 bar', slug: 'pt-0-400bar', priceCents: 112000, stock: 20, soldCount: 5, gtin: 'OG-PT-400', imageUrl: img.tx, description: 'High-pressure transmitter 0–400 bar for wellhead and choke.' },
        { tenantId: demoTenant.id, shopId: petroFlow.id, categoryId: instruments.id, name: 'Flow Meter Coriolis DN50', slug: 'flow-coriolis-dn50', priceCents: 1850000, stock: 6, soldCount: 2, gtin: 'OG-FM-C50', imageUrl: img.tx, description: 'Coriolis mass flow meter DN50 for custody transfer applications.' },
        { tenantId: demoTenant.id, shopId: petroFlow.id, categoryId: instruments.id, name: 'Level Transmitter Radar 80 GHz', slug: 'level-radar-80ghz', priceCents: 245000, stock: 14, soldCount: 4, gtin: 'OG-LT-80', imageUrl: img.tx, description: 'Non-contact radar level transmitter for tanks and separators.' },
        { tenantId: demoTenant.id, shopId: mudChem.id, categoryId: chemicals.id, name: 'Drilling Fluid Additive Pack (1 t)', slug: 'drilling-fluid-pack-1t', priceCents: 210000, stock: 18, soldCount: 5, gtin: 'OG-CHEM-1T', imageUrl: img.chem, description: 'WBM additive pack: viscosifier + fluid loss control (demo lot).' },
        { tenantId: demoTenant.id, shopId: mudChem.id, categoryId: chemicals.id, name: 'Barite API Grade (1 t)', slug: 'barite-api-1t', priceCents: 95000, stock: 40, soldCount: 12, gtin: 'OG-CHEM-BAR', imageUrl: img.chem, description: 'API-grade barite weighting agent, bulk bags for mud plants.' },
        { tenantId: demoTenant.id, shopId: mudChem.id, categoryId: chemicals.id, name: 'Corrosion Inhibitor Drum 200 L', slug: 'corrosion-inhibitor-200l', priceCents: 68000, stock: 50, soldCount: 16, gtin: 'OG-CHEM-CI', imageUrl: img.chem, description: 'Film-forming corrosion inhibitor for production chemical programs.' },
    ];
    const createdProducts = [];
    for (const p of catalog) {
        const { description, ...rest } = p;
        createdProducts.push(await prisma.product.create({
            data: {
                ...rest,
                description: description ||
                    `${p.name} — oil & gas supply catalog item (Mplace Energy).`,
                currency: 'USD',
                status: client_1.ProductStatus.ACTIVE,
                sku: p.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16),
            },
        }));
    }
    // Sample orders (buyer procurement)
    const p0 = createdProducts[0];
    const pGate = createdProducts.find((p) => p.slug === 'gate-valve-6-cl600');
    const pPpe = createdProducts.find((p) => p.slug === 'fr-coverall-cat2');
    const pTx = createdProducts.find((p) => p.slug === 'pt-0-100bar');
    await prisma.order.create({
        data: {
            orderNumber: 'OG-1001',
            customerId: customer.id,
            tenantId: demoTenant.id,
            shopId: drillTech.id,
            status: client_1.OrderStatus.PROCESSING,
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
            status: client_1.OrderStatus.SHIPPED,
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
            status: client_1.OrderStatus.COMPLETED,
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
    await prisma.order.create({
        data: {
            orderNumber: 'OG-1004',
            customerId: customer.id,
            tenantId: demoTenant.id,
            shopId: petroFlow.id,
            status: client_1.OrderStatus.PENDING_PAYMENT,
            subtotalCents: pTx.priceCents * 3,
            commissionCents: Math.round(pTx.priceCents * 3 * 0.1),
            totalCents: pTx.priceCents * 3,
            customerEmail: customer.email,
            customerName: customer.name,
            paymentRef: 'demo_seed_og_1004',
            items: {
                create: [
                    {
                        productId: pTx.id,
                        productName: pTx.name,
                        unitPriceCents: pTx.priceCents,
                        quantity: 3,
                        lineTotalCents: pTx.priceCents * 3,
                    },
                ],
            },
        },
    });
    // RFQ: open request with two supplier offers
    const rfqOpen = await prisma.rfqRequest.create({
        data: {
            number: 'RFQ-2026-001',
            buyerId: customer.id,
            tenantId: demoTenant.id,
            title: 'Wellsite valve package — Class 600',
            description: 'Request quotes for gate and ball valves for a drilling location package. Delivery to yard within 30 days preferred.',
            status: client_1.RfqStatus.QUOTED,
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
            status: client_1.RfqOfferStatus.PENDING,
            message: 'Can supply full package from stock. Certificates included.',
            totalCents: pGate.priceCents * 4 + 189000 * 6,
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
                        unitPriceCents: 189000,
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
            status: client_1.RfqOfferStatus.PENDING,
            message: 'Ball valves via partner; gate valves 3-week lead time.',
            totalCents: Math.round(pGate.priceCents * 4 * 1.08) + Math.round(189000 * 6 * 1.05),
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
                        unitPriceCents: Math.round(189000 * 1.05),
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
            status: client_1.RfqStatus.AWARDED,
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
            vendorId: (await prisma.user.findFirst({ where: { email: 'ppe@demo.com' } })).id,
            status: client_1.RfqOfferStatus.ACCEPTED,
            message: 'Full HSE package ready to ship.',
            totalCents: pPpe.priceCents * 40 + 32000 * 20,
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
                        unitPriceCents: 32000,
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
        admin: 'superadmin@demo.com',
        merchant: 'merchant@demo.com',
        customer: 'customer@demo.com',
        demoPassword: process.env.DEMO_PASSWORD ? '(from DEMO_PASSWORD)' : 'MplacePrivateDemo!',
        products: createdProducts.length,
        shops: 5,
        categories: 6,
        orders: 4,
        rfqs: 2,
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
