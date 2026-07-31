import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  ProductStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/cart.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { atomicStockDecrementSql } from '../common/db.util';
import { canTransition } from './order-status.machine';

const COMMISSION_BPS = 1000;
const PAYMENT_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cart ───────────────────────────────────────────────

  async getOrCreateCart(user: JwtPayload | null, sessionKey?: string) {
    if (user?.sub) {
      let cart = await this.prisma.cart.findUnique({
        where: { userId: user.sub },
        include: this.cartInclude(),
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId: user.sub },
          include: this.cartInclude(),
        });
      }
      return cart;
    }
    if (!sessionKey) {
      throw new BadRequestException('sessionKey required for guests');
    }
    let cart = await this.prisma.cart.findUnique({
      where: { sessionKey },
      include: this.cartInclude(),
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { sessionKey },
        include: this.cartInclude(),
      });
    }
    return cart;
  }

  async addItem(
    user: JwtPayload | null,
    sessionKey: string | undefined,
    dto: AddCartItemDto,
  ) {
    const cart = await this.getOrCreateCart(user, sessionKey);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { shop: true },
    });
    this.assertProductSellable(product);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId: product!.id },
      },
    });
    const nextQty = (existing?.quantity ?? 0) + dto.quantity;
    if (nextQty > product!.stock) {
      throw new BadRequestException('Insufficient stock');
    }

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: cart.id, productId: product!.id },
      },
      create: {
        cartId: cart.id,
        productId: product!.id,
        quantity: dto.quantity,
      },
      update: { quantity: nextQty },
    });

    return this.getCart(user, sessionKey);
  }

  async updateItem(
    user: JwtPayload | null,
    sessionKey: string | undefined,
    itemId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateCart(user, sessionKey);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: { include: { shop: true } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      return this.getCart(user, sessionKey);
    }

    this.assertProductSellable(item.product);
    if (quantity > item.product.stock) {
      throw new BadRequestException('Insufficient stock');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    return this.getCart(user, sessionKey);
  }

  async clearCart(user: JwtPayload | null, sessionKey?: string) {
    const cart = await this.getOrCreateCart(user, sessionKey);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(user, sessionKey);
  }

  async getCart(user: JwtPayload | null, sessionKey?: string) {
    const cart = await this.getOrCreateCart(user, sessionKey);
    const subtotalCents = cart.items.reduce(
      (s, i) => s + i.product.priceCents * i.quantity,
      0,
    );
    return {
      ...cart,
      subtotalCents,
      subtotal: (subtotalCents / 100).toFixed(2),
      itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
    };
  }

  // ── Checkout ───────────────────────────────────────────

  async checkout(
    user: JwtPayload | null,
    sessionKey: string | undefined,
    dto: CheckoutDto,
  ) {
    const cart = await this.getCart(user, sessionKey);
    if (!cart.items.length) {
      throw new BadRequestException('Cart is empty');
    }

    // re-validate every line
    for (const item of cart.items) {
      const fresh = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { shop: true },
      });
      this.assertProductSellable(fresh);
      if (fresh!.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${fresh!.name}`,
        );
      }
    }

    const byShop = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const sid = item.product.shopId;
      if (!byShop.has(sid)) byShop.set(sid, []);
      byShop.get(sid)!.push(item);
    }

    const result: Array<{
      id: string;
      orderNumber: string;
      totalCents: number;
      currency: string;
      status: OrderStatus;
      shop: { id: string; name: string } | null;
      paymentToken?: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [shopId, items] of byShop) {
        const subtotalCents = items.reduce(
          (s, i) => s + i.product.priceCents * i.quantity,
          0,
        );
        const commissionCents = Math.round(
          (subtotalCents * COMMISSION_BPS) / 10000,
        );
        const orderNumber = this.generateOrderNumber();

        const plainToken = randomBytes(32).toString('hex');
        const paymentTokenHash = await bcrypt.hash(plainToken, 10);
        const paymentTokenExpiresAt = new Date(
          Date.now() + PAYMENT_TOKEN_TTL_MS,
        );

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: user?.sub ?? null,
            shopId,
            status: OrderStatus.PENDING_PAYMENT,
            subtotalCents,
            commissionCents,
            totalCents: subtotalCents,
            customerEmail: dto.customerEmail || user?.email || null,
            customerName: dto.customerName || null,
            paymentTokenHash,
            paymentTokenExpiresAt,
            items: {
              create: items.map((i) => ({
                productId: i.productId,
                productName: i.product.name,
                unitPriceCents: i.product.priceCents,
                quantity: i.quantity,
                lineTotalCents: i.product.priceCents * i.quantity,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: OrderStatus.PENDING_PAYMENT,
                actorId: user?.sub ?? null,
                reason: 'checkout',
              },
            },
          },
          include: {
            shop: { select: { id: true, name: true } },
          },
        });

        result.push({
          id: order.id,
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          currency: order.currency,
          status: order.status,
          shop: order.shop,
          paymentToken: plainToken,
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });

    return {
      orders: result,
      message:
        'Orders created. Create a payment intent with order id + paymentToken (or as logged-in customer).',
    };
  }

  // ── Access control ─────────────────────────────────────

  async getOrder(
    user: JwtPayload | null,
    id: string,
    paymentToken?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        shop: { select: { id: true, name: true, status: true } },
        customer: { select: { id: true, name: true, email: true } },
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, take: 50 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertCanAccessOrder(user, order, paymentToken);
    const { paymentTokenHash: _, ...safe } = order;
    return safe;
  }

  async listOrders(user: JwtPayload) {
    const where =
      (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)
        ? {}
        : user.role === UserRole.MERCHANT
          ? { shopId: user.shopId ?? '__none__' }
          : { customerId: user.sub };

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        items: true,
        _count: { select: { items: true } },
      },
    });
  }

  /**
   * Verify caller may act on payment for this order.
   * Customer must own; guest must present valid paymentToken.
   */
  async assertCanPayOrder(
    user: JwtPayload | null,
    orderId: string,
    paymentToken?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shop: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment');
    }
    await this.assertCanAccessOrder(user, order, paymentToken);
    return order;
  }

  async updateStatus(
    user: JwtPayload,
    id: string,
    statusRaw: string,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (user.role === UserRole.MERCHANT) {
      if (order.shopId !== user.shopId) throw new ForbiddenException();
    } else if (user.role === UserRole.CUSTOMER) {
      if (order.customerId !== user.sub) throw new ForbiddenException();
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException();
    }

    if (!(statusRaw in OrderStatus)) {
      throw new BadRequestException('Invalid status');
    }
    const toStatus = statusRaw as OrderStatus;

    if (!canTransition(user.role, order.status, toStatus)) {
      throw new BadRequestException(
        `Cannot move from ${order.status} to ${toStatus}`,
      );
    }

    if (
      (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) &&
      (toStatus === OrderStatus.CANCELLED ||
        toStatus === OrderStatus.REFUNDED ||
        toStatus === OrderStatus.PARTIALLY_REFUNDED) &&
      !reason?.trim()
    ) {
      throw new BadRequestException('Reason required for admin cancel/refund');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: { status: toStatus },
        include: {
          shop: { select: { id: true, name: true } },
          items: true,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus,
          actorId: user.sub,
          reason: reason?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'order.status_change',
          entityType: 'Order',
          entityId: id,
          meta: JSON.stringify({
            from: order.status,
            to: toStatus,
            reason,
          }),
        },
      });
      return o;
    });

    return updated;
  }

  // ── Fulfilment after confirmed payment (called by PaymentsService) ──

  async markPaidFromPayment(
    orderId: string,
    paymentRef: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, reason: 'order_not_found' };
    if (order.status === OrderStatus.PAID) return { ok: true }; // idempotent
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return { ok: false, reason: `invalid_status_${order.status}` };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (!item.productId) continue;
          // Atomic stock guard — Prisma.sql works on SQLite and PostgreSQL
          const affected = await tx.$executeRaw(
            atomicStockDecrementSql(item.productId, item.quantity),
          );
          if (Number(affected) === 0) {
            throw new Error(`stock_fail_${item.productId}`);
          }
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PAID,
            paymentRef,
            // keep paymentToken until TTL so guest can view receipt once after pay
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: OrderStatus.PENDING_PAYMENT,
            toStatus: OrderStatus.PAID,
            actorId: null,
            reason: 'payment_provider_webhook',
          },
        });

        const vendorAmount = order.totalCents - order.commissionCents;
        await tx.ledgerEntry.createMany({
          data: [
            {
              shopId: order.shopId,
              orderId: order.id,
              account: 'VENDOR',
              entryType: 'VENDOR_EARNING',
              amountCents: vendorAmount,
              description: `Earning ${order.orderNumber}`,
            },
            {
              shopId: order.shopId,
              orderId: order.id,
              account: 'PLATFORM',
              entryType: 'COMMISSION',
              amountCents: order.commissionCents,
              description: `Commission ${order.orderNumber}`,
            },
            {
              shopId: order.shopId,
              orderId: order.id,
              account: 'EXTERNAL',
              entryType: 'ORDER_PAYMENT',
              amountCents: order.totalCents,
              description: `Payment ${order.orderNumber}`,
            },
          ],
        });
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      return { ok: false, reason: msg };
    }
  }

  // ── helpers ────────────────────────────────────────────

  private cartInclude() {
    return {
      items: {
        include: {
          product: {
            include: {
              shop: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }

  private generateOrderNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = createHash('sha256')
      .update(randomBytes(16))
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    return `MP-${stamp}-${rand}`;
  }

  private assertProductSellable(
    product:
      | {
          status: ProductStatus;
          stock: number;
          name: string;
          shop: { status: ShopStatus };
        }
      | null,
  ): asserts product is NonNullable<typeof product> {
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not available');
    }
    if (product.shop.status !== ShopStatus.ACTIVE) {
      throw new BadRequestException('Shop is not active');
    }
  }

  private async assertCanAccessOrder(
    user: JwtPayload | null,
    order: {
      customerId: string | null;
      shopId: string;
      paymentTokenHash: string | null;
      paymentTokenExpiresAt: Date | null;
    },
    paymentToken?: string,
  ) {
    if ((user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN)) return;
    if (
      user?.role === UserRole.MERCHANT &&
      user.shopId &&
      user.shopId === order.shopId
    ) {
      return;
    }
    if (
      user?.role === UserRole.CUSTOMER &&
      order.customerId &&
      order.customerId === user.sub
    ) {
      return;
    }
    // Guest / owner with payment token
    if (paymentToken && order.paymentTokenHash) {
      if (
        order.paymentTokenExpiresAt &&
        order.paymentTokenExpiresAt.getTime() < Date.now()
      ) {
        throw new ForbiddenException('Payment token expired');
      }
      const ok = await bcrypt.compare(paymentToken, order.paymentTokenHash);
      if (ok) return;
    }
    throw new ForbiddenException('Not allowed to access this order');
  }
}
