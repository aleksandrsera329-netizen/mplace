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
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = __importStar(require("bcrypt"));
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var passwordHash, bigShop, amz, lady, customer, electronics, fashion, sports, catalog, createdProducts, _i, catalog_1, p, _a, _b, p0, p1;
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
                                name: 'Big Shop',
                                slug: 'big-shop',
                                description: 'Top marketplace vendor',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 19:
                    bigShop = _c.sent();
                    return [4 /*yield*/, prisma.shop.create({
                            data: {
                                name: 'Amz Mart',
                                slug: 'amz-mart',
                                description: 'Everyday essentials',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 20:
                    amz = _c.sent();
                    return [4 /*yield*/, prisma.shop.create({
                            data: {
                                name: 'Lady Charm',
                                slug: 'lady-charm',
                                description: 'Fashion & accessories',
                                status: client_1.ShopStatus.ACTIVE,
                                verified: true,
                            },
                        })];
                case 21:
                    lady = _c.sent();
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
                                name: 'Merchant Demo',
                                role: client_1.UserRole.MERCHANT,
                                status: client_1.UserStatus.ACTIVE,
                                shopId: bigShop.id,
                            },
                        })];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'amz@demo.com',
                                passwordHash: passwordHash,
                                name: 'Amz Owner',
                                role: client_1.UserRole.MERCHANT,
                                status: client_1.UserStatus.ACTIVE,
                                shopId: amz.id,
                            },
                        })];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                email: 'customer@demo.com',
                                passwordHash: passwordHash,
                                name: 'Demo Customer',
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
                                name: 'Jhon Doe',
                                role: client_1.UserRole.CUSTOMER,
                                status: client_1.UserStatus.ACTIVE,
                            },
                        })];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Electronics', slug: 'electronics' },
                        })];
                case 27:
                    electronics = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Fashion', slug: 'fashion' },
                        })];
                case 28:
                    fashion = _c.sent();
                    return [4 /*yield*/, prisma.category.create({
                            data: { name: 'Sports', slug: 'sports' },
                        })];
                case 29:
                    sports = _c.sent();
                    catalog = [
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
                    createdProducts = [];
                    _i = 0, catalog_1 = catalog;
                    _c.label = 30;
                case 30:
                    if (!(_i < catalog_1.length)) return [3 /*break*/, 33];
                    p = catalog_1[_i];
                    _b = (_a = createdProducts).push;
                    return [4 /*yield*/, prisma.product.create({
                            data: __assign(__assign({}, p), { description: "".concat(p.name, " \u2014 demo product for Mplace."), currency: 'USD', status: client_1.ProductStatus.ACTIVE, sku: p.slug.toUpperCase().slice(0, 12) }),
                        })];
                case 31:
                    _b.apply(_a, [_c.sent()]);
                    _c.label = 32;
                case 32:
                    _i++;
                    return [3 /*break*/, 30];
                case 33:
                    p0 = createdProducts[0];
                    p1 = createdProducts[1];
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                orderNumber: 'MP-1001',
                                customerId: customer.id,
                                shopId: bigShop.id,
                                status: client_1.OrderStatus.PROCESSING,
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
                        })];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                orderNumber: 'MP-1002',
                                customerId: customer.id,
                                shopId: amz.id,
                                status: client_1.OrderStatus.SHIPPED,
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
                        })];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, prisma.ticket.createMany({
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
                        })];
                case 36:
                    _c.sent();
                    // eslint-disable-next-line no-console
                    console.log('Seed OK:', {
                        admin: 'superadmin@demo.com / 123456',
                        merchant: 'merchant@demo.com / 123456',
                        customer: 'customer@demo.com / 123456',
                        products: createdProducts.length,
                        shops: 3,
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
