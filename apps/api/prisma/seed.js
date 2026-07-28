"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = __importStar(require("bcrypt"));
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var passwordHash, drillTech, pipeValve, fieldSafe, customer, drilling, pipeline, ppe, pumps, instruments, chemicals, catalog, createdProducts, _i, catalog_1, p, description, rest, _a, _b, p0, p1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, bcrypt.hash('123456', 12)];
                case 1:
                    passwordHash = _c.sent();
                    // clean demo data for clean seed (keep schema)
                    return [4 /*yield*/, prisma.ticketMessage.deleteMany().catch(function () { return undefined; })];
                case 2:
                    // clean demo data for clean seed (keep schema)
                    _c.sent();
                    return [4 /*yield*/, prisma.ticket.deleteMany()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, prisma.refund.deleteMany()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, prisma.dispute.deleteMany()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, prisma.orderStatusHistory.deleteMany().catch(function () { return undefined; })];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, prisma.payment.deleteMany().catch(function () { return undefined; })];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, prisma.ledgerEntry.deleteMany()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, prisma.orderItem.deleteMany()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, prisma.order.deleteMany()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, prisma.cartItem.deleteMany()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, prisma.cart.deleteMany()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, prisma.payoutRequest.deleteMany()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, prisma.product.deleteMany()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, prisma.category.deleteMany()];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.deleteMany()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, prisma.shop.deleteMany()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, prisma.auditLog.deleteMany()];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, prisma.shop.create({
                            data: {
                                name: 'DrillTech Supply',
                                slug: 'drilltech-supply',
                                description: 'BHA, bits and downhole tools for drilling contractors',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 19:
                    drillTech = _c.sent();
                    return [4 /*yield*/, prisma.shop.create({
                            data: {
                                name: 'Pipe & Valve Co',
                                slug: 'pipe-valve-co',
                                description: 'Pipeline valves, flanges and fittings API / ASME',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 20:
                    pipeValve = _c.sent();
                    return [4 /*yield*/, prisma.shop.create({
                            data: {
                                name: 'FieldSafe PPE',
                                slug: 'fieldsafe-ppe',
                                description: 'HSE PPE and field safety for oil & gas sites',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 21:
                    fieldSafe = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'superadmin@demo.com',
                                passwordHash: passwordHash,
                                name: 'SuperAdmin',
                                role: client_1.UserRole.ADMIN,
                                status: client_1.UserStatus.ACTIVE,
                            },
                        })];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'merchant@demo.com',
                                passwordHash: passwordHash,
                                name: 'DrillTech Merchant',
                                role: client_1.UserRole.MERCHANT,
                                status: client_1.UserStatus.ACTIVE,
                                shopId: drillTech.id,
                            },
                        })];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'amz@demo.com',
                                passwordHash: passwordHash,
                                name: 'PipeValve Owner',
                                role: client_1.UserRole.MERCHANT,
                                status: client_1.UserStatus.ACTIVE,
                                shopId: pipeValve.id,
                            },
                        })];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'customer@demo.com',
                                passwordHash: passwordHash,
                                name: 'Procurement Buyer',
                                role: client_1.UserRole.CUSTOMER,
                                status: client_1.UserStatus.ACTIVE,
                            },
                        })];
                case 25:
                    customer = _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'jhondoe@demo.com',
                                passwordHash: passwordHash,
                                name: 'Field Engineer',
                                role: client_1.UserRole.CUSTOMER,
                                status: client_1.UserStatus.ACTIVE,
                            },
                        })];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Drilling Equipment', slug: 'drilling-equipment' },
                        })];
                case 27:
                    drilling = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Pipeline & Valves', slug: 'pipeline-valves' },
                        })];
                case 28:
                    pipeline = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'PPE & HSE', slug: 'ppe-hse' },
                        })];
                case 29:
                    ppe = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Pumps & Compressors', slug: 'pumps-compressors' },
                        })];
                case 30:
                    pumps = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Instrumentation', slug: 'instrumentation' },
                        })];
                case 31:
                    instruments = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Chemicals & Fluids', slug: 'chemicals-fluids' },
                        })];
                case 32:
                    chemicals = _c.sent();
                    catalog = [
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
                            description: 'Matrix PDC bit 8-1/2" for medium-hard formations. API pin connection. Oilfield drilling BHA.',
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
                            description: 'Positive displacement mud motor 6-3/4", lobe 5:6, for directional drilling applications.',
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
                            description: 'API 600 cast steel gate valve, RF flanged, Class 600, carbon steel body for crude/product lines.',
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
                            description: 'Full-bore trunnion ball valve 4", fire-safe design, suitable for gas transmission manifolds.',
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
                            description: 'Flame-resistant coverall CAT2, antistatic, for oil & gas process units and wellsites.',
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
                            description: 'Emergency escape breathing apparatus for H2S-risk zones. Field HSE standard kit.',
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
                            description: 'ANSI process centrifugal pump for water injection / produced water transfer skids.',
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
                            description: 'Industrial pressure transmitter 0–100 bar, 4–20 mA HART, ATEX zone options on request.',
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
                            description: 'Bulk additive pack for water-based mud systems: viscosifier + fluid loss control (demo lot).',
                        },
                    ];
                    createdProducts = [];
                    _i = 0, catalog_1 = catalog;
                    _c.label = 33;
                case 33:
                    if (!(_i < catalog_1.length)) return [3 /*break*/, 36];
                    p = catalog_1[_i];
                    description = p.description, rest = __rest(p, ["description"]);
                    _b = (_a = createdProducts).push;
                    return [4 /*yield*/, prisma.product.create({
                            data: __assign(__assign({}, rest), { description: description ||
                                    "".concat(p.name, " \u2014 oil & gas supply catalog item (Mplace Energy)."), currency: 'USD', status: client_1.ProductStatus.ACTIVE, sku: p.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) }),
                        })];
                case 34:
                    _b.apply(_a, [_c.sent()]);
                    _c.label = 35;
                case 35:
                    _i++;
                    return [3 /*break*/, 33];
                case 36:
                    p0 = createdProducts[0];
                    p1 = createdProducts[2];
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                orderNumber: 'OG-1001',
                                customerId: customer.id,
                                shopId: drillTech.id,
                                status: client_1.OrderStatus.PROCESSING,
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
                        })];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                orderNumber: 'OG-1002',
                                customerId: customer.id,
                                shopId: pipeValve.id,
                                status: client_1.OrderStatus.SHIPPED,
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
                        })];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, prisma.ticket.createMany({
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
                        })];
                case 39:
                    _c.sent();
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
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
