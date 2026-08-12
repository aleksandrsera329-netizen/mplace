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
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DomainEventService } from '../events/domain-event.service';
import { DomainEvents } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/cart.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { canTransition } from './order-status.machine';
import {
  releaseReservation,
  resolveDefaultWarehouse,
  totalAvailableForProduct,
} from '../warehouse/warehouse-stock.util';
import { InventoryService } from '../warehouse/inventory.service';
import { TaxService } from '../tax/tax.service';
import { getCurrentTenantId } from '../common/tenant/tenant.context';

const COMMISSION_BPS = 1000;
const PAYMENT_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly events: DomainEventService,
    private readonly tax: TaxService,
  ) {}

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

    // re-validate every line (available = quantity - reserved across warehouses)
    for (const item of cart.items) {
      const fresh = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { shop: true },
      });
      this.assertProductSellable(fresh);
      const available = await totalAvailableForProduct(
        this.prisma,
        item.productId,
        fresh!.stock,
      );
      if (available < item.quantity) {
        throw new BadRequestException(
          `Недостаточно товара «${fresh!.name}». Доступно: ${available}`,
        );
      }
    }

    const byShop = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const sid = item.product.shopId;
      if (!byShop.has(sid)) byShop.set(sid, []);
      byShop.get(sid)!.push(item);
    }

    // Shipping applied once (first shop order) for multi-shop checkout
    const shipping = dto.shipping;
    let shippingPriceCents = 0;
    let shippingMethodId: string | null = null;
    let shippingRateId: string | null = null;
    let shippingDaysMin: number | null = null;
    let shippingDaysMax: number | null = null;

    if (shipping?.rateId && shipping.priceCents != null) {
      const rate = await this.prisma.shippingRate.findUnique({
        where: { id: shipping.rateId },
        include: { method: true },
      });
      if (!rate || !rate.isActive) {
        throw new BadRequestException('Выбранный тариф доставки недоступен');
      }
      shippingPriceCents = Math.max(0, Math.floor(shipping.priceCents));
      shippingMethodId = shipping.methodId || rate.shippingMethodId;
      shippingRateId = rate.id;
      shippingDaysMin =
        shipping.daysMin ?? rate.estimatedDaysMin ?? null;
      shippingDaysMax =
        shipping.daysMax ?? rate.estimatedDaysMax ?? null;
    }

    const result: Array<{
      id: string;
      orderNumber: string;
      totalCents: number;
      currency: string;
      status: OrderStatus;
      shop: { id: string; name: string } | null;
      paymentToken?: string;
      shippingPriceCents?: number;
    }> = [];

    let shippingAssigned = false;

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

        const applyShipping = !shippingAssigned && shippingPriceCents > 0;
        if (applyShipping) shippingAssigned = true;
        const orderShipping = applyShipping ? shippingPriceCents : 0;

        const plainToken = randomBytes(32).toString('hex');
        const paymentTokenHash = await bcrypt.hash(plainToken, 10);
        const paymentTokenExpiresAt = new Date(
          Date.now() + PAYMENT_TOKEN_TTL_MS,
        );

        // Resolve warehouse per line (reservation happens after order id exists)
        const lineMeta: Array<{
          productId: string;
          productName: string;
          unitPriceCents: number;
          quantity: number;
          lineTotalCents: number;
          warehouseId: string | null;
          taxRateId: string | null;
          taxCents: number;
        }> = [];

        for (const i of items) {
          const product = await tx.product.findUnique({
            where: { id: i.productId },
          });
          if (!product) {
            throw new NotFoundException(`Товар ${i.productId} не найден`);
          }

          const warehouse = await resolveDefaultWarehouse(tx, shopId);
          const warehouseId = warehouse?.id ?? null;

          // Stage 11: stock is NOT decremented here — only reserved after order create
          const avail = await this.inventory.getAvailable(i.productId, tx);
          if (avail.available < i.quantity) {
            throw new BadRequestException(
              `Недостаточно товара «${product.name}». Доступно: ${avail.available}`,
            );
          }

          lineMeta.push({
            productId: i.productId,
            productName: product.name,
            unitPriceCents: product.priceCents,
            quantity: i.quantity,
            lineTotalCents: product.priceCents * i.quantity,
            warehouseId,
            taxRateId: null,
            taxCents: 0,
          });
        }

        // VAT / НДС per line
        const tenantId =
          getCurrentTenantId() || user?.tenantId || null;
        const taxCalc = await this.tax.calculate(
          tenantId,
          lineMeta.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            priceCents: l.unitPriceCents,
          })),
          dto.taxCountry || 'RU',
        );
        const taxByProduct = new Map(
          taxCalc.items.map((t) => [t.productId, t]),
        );
        for (const line of lineMeta) {
          const t = taxByProduct.get(line.productId);
          if (t) {
            line.taxRateId = t.taxRateId;
            line.taxCents = t.taxCents;
          }
        }
        const orderTaxCents = taxCalc.taxCents;
        const totalCents = subtotalCents + orderTaxCents + orderShipping;

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: user?.sub ?? null,
            shopId,
            status: OrderStatus.PENDING_PAYMENT,
            subtotalCents,
            taxCents: orderTaxCents,
            commissionCents,
            totalCents,
            customerEmail: dto.customerEmail || user?.email || null,
            customerName: dto.customerName || null,
            paymentTokenHash,
            paymentTokenExpiresAt,
            shippingMethodId: applyShipping ? shippingMethodId : null,
            shippingRateId: applyShipping ? shippingRateId : null,
            shippingPriceCents: applyShipping ? orderShipping : 0,
            shippingDaysMin: applyShipping ? shippingDaysMin : null,
            shippingDaysMax: applyShipping ? shippingDaysMax : null,
            items: {
              create: lineMeta.map((i) => ({
                productId: i.productId,
                productName: i.productName,
                unitPriceCents: i.unitPriceCents,
                quantity: i.quantity,
                lineTotalCents: i.lineTotalCents,
                warehouseId: i.warehouseId,
                taxRateId: i.taxRateId,
                taxCents: i.taxCents,
              })),
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: OrderStatus.PENDING_PAYMENT,
                actorId: user?.sub ?? null,
                reason: dto.comment
                  ? `checkout: ${dto.comment.slice(0, 500)}`
                  : 'checkout',
              },
            },
          },
          include: {
            shop: { select: { id: true, name: true } },
            shippingMethod: { select: { id: true, name: true, code: true } },
          },
        });

        // Stage 11: InventoryReservation ACTIVE (stock not decremented until pay)
        for (const line of lineMeta) {
          await this.inventory.reserve({
            productId: line.productId,
            quantity: line.quantity,
            orderId: order.id,
            warehouseId: line.warehouseId,
            productName: line.productName,
            ttlMinutes: Math.ceil(PAYMENT_TOKEN_TTL_MS / 60000),
            tx,
          });
        }

        result.push({
          id: order.id,
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          currency: order.currency,
          status: order.status,
          shop: order.shop,
          paymentToken: plainToken,
          shippingPriceCents: order.shippingPriceCents ?? 0,
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });

    for (const o of result) {
      await this.audit.log({
        actorId: user?.sub ?? null,
        action: 'CREATE',
        entityType: 'Order',
        entityId: o.id,
        meta: {
          orderNumber: o.orderNumber,
          totalCents: o.totalCents,
          shopId: o.shop?.id,
          status: o.status,
          guest: !user?.sub,
        },
      });
      this.events.emit(DomainEvents.OrderCreated, {
        orderId: o.id,
        orderNumber: o.orderNumber,
        totalCents: o.totalCents,
        shopId: o.shop?.id,
        customerId: user?.sub ?? null,
      });
    }

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
        shippingMethod: {
          select: { id: true, name: true, code: true, description: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertCanAccessOrder(user, order, paymentToken);
    const { paymentTokenHash: _, ...safe } = order;
    return safe;
  }

  async listOrders(
    user: JwtPayload,
    opts?: {
      cursor?: string;
      limit?: number;
      status?: string;
      search?: string;
    },
  ) {
    const limit = opts?.limit ?? 20;
    const where: Record<string, unknown> =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN
        ? {}
        : user.role === UserRole.MERCHANT
          ? { shopId: user.shopId ?? '__none__' }
          : { customerId: user.sub };

    // Map UI aliases onto real OrderStatus
    let statusFilter = opts?.status;
    if (statusFilter === 'NEW') statusFilter = OrderStatus.PENDING_PAYMENT;

    if (statusFilter && statusFilter in OrderStatus) {
      where.status = statusFilter as OrderStatus;
    }

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' as const } },
        { id: { contains: q } },
        { customerEmail: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const items = await this.prisma.order.findMany({
      where,
      take: limit,
      ...(opts?.cursor
        ? {
            skip: 1,
            cursor: { id: opts.cursor },
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        shop: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        items: true,
        _count: { select: { items: true } },
      },
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore: !!nextCursor,
    };
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
      const full = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!full) throw new NotFoundException('Order not found');

      // Cancel / refund: release InventoryReservation or restock if already paid
      const cancelLike =
        toStatus === OrderStatus.CANCELLED ||
        toStatus === OrderStatus.REFUNDED;
      if (cancelLike) {
        const paidStatuses: OrderStatus[] = [
          OrderStatus.PAID,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.COMPLETED,
          OrderStatus.DISPUTED,
        ];
        const wasPaid = paidStatuses.includes(order.status);
        if (!wasPaid) {
          // Stage 11: free ACTIVE holds (no stock decrement yet)
          await this.inventory.releaseOrder(id, tx);
        } else {
          for (const item of full.items) {
            if (!item.productId) continue;
            await releaseReservation(tx, {
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
              restock: true,
            });
          }
        }
      }

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
      return o;
    });

    await this.audit.log({
      actorId: user.sub,
      action: 'STATUS_CHANGE',
      entityType: 'Order',
      entityId: id,
      meta: {
        from: order.status,
        to: toStatus,
        reason: reason?.trim() || null,
      },
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
        // Stage 11: confirm InventoryReservation → decrement stock
        await this.inventory.confirm(orderId, tx);

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
