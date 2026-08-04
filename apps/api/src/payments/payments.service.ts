import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, RefundStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeConnectService } from './stripe-connect.service';

function isLocalRuntime(nodeEnv: string | undefined, allowLocal: string | undefined) {
  if (nodeEnv === 'production' || nodeEnv === 'staging') return false;
  // Explicit flag required for dev-confirm endpoint
  return allowLocal === 'true' || allowLocal === '1';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => StripeConnectService))
    private readonly stripeConnect: StripeConnectService,
    private readonly audit: AuditService,
  ) {
    this.provider = (
      this.config.get<string>('PAYMENT_PROVIDER') || 'dev'
    ).toLowerCase();
  }

  private stripeClient() {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY not configured');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    return new Stripe(secret);
  }

  /**
   * Refund via Stripe (full or partial). Destination charges: reverse_transfer.
   */
  async refundPayment(
    orderId: string,
    amountCents?: number,
    reason?: string,
    actorId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const payment = order.payments.find(
      (p) =>
        p.provider === 'stripe' && p.status === PaymentStatus.SUCCEEDED,
    );
    if (!payment?.providerPaymentId) {
      throw new BadRequestException('No successful Stripe payment found');
    }

    if (
      amountCents != null &&
      (amountCents <= 0 || amountCents > payment.amountCents)
    ) {
      throw new BadRequestException('Invalid refund amount');
    }

    const stripe = this.stripeClient();
    const stripeReason =
      reason === 'fraudulent' || reason === 'duplicate'
        ? reason
        : 'requested_by_customer';

    const refund = await stripe.refunds.create({
      payment_intent: payment.providerPaymentId,
      ...(amountCents != null ? { amount: amountCents } : {}),
      reason: stripeReason,
      // Destination charges: pull funds back from connected account
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
      },
    });

    const refundAmount =
      typeof refund.amount === 'number' ? refund.amount : amountCents ?? payment.amountCents;
    const full = refundAmount >= payment.amountCents;

    const refundRow = await this.prisma.refund.create({
      data: {
        orderId: order.id,
        amountCents: refundAmount,
        reason: reason || stripeReason,
        status: RefundStatus.COMPLETED,
        adminNote: `stripe_refund=${refund.id}`,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: full ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED,
      },
    });

    await this.audit.log({
      actorId: actorId ?? null,
      action: 'PAYMENT',
      entityType: 'Refund',
      entityId: refundRow.id,
      meta: {
        orderId: order.id,
        stripeRefundId: refund.id,
        amountCents: refundAmount,
        full,
      },
    });

    return {
      ok: true,
      refundId: refundRow.id,
      stripeRefundId: refund.id,
      amountCents: refundAmount,
      status: refund.status,
      orderStatus: full ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED,
    };
  }

  /** Whether browser-facing dev confirm is enabled (never in production/staging). */
  isDevConfirmEnabled(): boolean {
    return (
      this.provider === 'dev' &&
      isLocalRuntime(
        this.config.get<string>('NODE_ENV'),
        this.config.get<string>('ALLOW_DEV_PAYMENTS'),
      )
    );
  }

  async createPaymentIntent(
    user: JwtPayload | null,
    orderId: string,
    paymentToken?: string,
    idempotencyKey?: string,
  ) {
    const order = await this.orders.assertCanPayOrder(
      user,
      orderId,
      paymentToken,
    );

    const key = idempotencyKey || `pi_${orderId}_${randomUUID()}`;

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      return this.toClientPayment(existing, order);
    }

    if (this.provider === 'stripe') {
      return this.createStripeIntent(order, key);
    }

    if (this.provider !== 'dev') {
      throw new ServiceUnavailableException(
        `Unknown PAYMENT_PROVIDER: ${this.provider}`,
      );
    }

    // Local-only path: payment stays PENDING until a local server-side tool
    // confirms (CLI/script with secret — never from public browser secret).
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'dev',
        providerPaymentId: `dev_${randomUUID()}`,
        status: PaymentStatus.PENDING,
        amountCents: order.totalCents,
        currency: order.currency,
        idempotencyKey: key,
      },
    });

    return {
      ...this.toClientPayment(payment, order),
      mode: 'dev',
      // No secret, no auto-confirm URL for browsers
      message:
        'Dev provider: confirm only via local script with DEV_PAYMENT_SECRET (not exposed to browser). Set PAYMENT_PROVIDER=stripe for real cards.',
      localConfirmEnabled: this.isDevConfirmEnabled(),
    };
  }

  private async createStripeIntent(
    order: {
      id: string;
      totalCents: number;
      currency: string;
      orderNumber: string;
      shopId: string | null;
      commissionCents?: number;
      shop?: {
        id: string;
        stripeAccountId: string | null;
        chargesEnabled: boolean;
        name?: string;
      } | null;
    },
    idempotencyKey: string,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY not configured');
    }

    // Load shop Connect flags if not included
    let shop = order.shop;
    if (!shop && order.shopId) {
      shop = await this.prisma.shop.findUnique({
        where: { id: order.shopId },
        select: {
          id: true,
          stripeAccountId: true,
          chargesEnabled: true,
          name: true,
        },
      });
    }

    if (!shop?.stripeAccountId || !shop.chargesEnabled) {
      throw new BadRequestException(
        'Seller is not ready to accept payments via Stripe Connect (complete onboarding: chargesEnabled)',
      );
    }

    // Platform fee: PLATFORM_COMMISSION_PERCENT (default 10) or order.commissionCents
    const commissionPercent = Number(
      this.config.get<string | number>('PLATFORM_COMMISSION_PERCENT') ?? 10,
    );
    const applicationFee =
      order.commissionCents != null && order.commissionCents > 0
        ? order.commissionCents
        : Math.round(order.totalCents * (commissionPercent / 100));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(secret);

    // Destination charge: funds → connected account, platform keeps application_fee
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: shop.stripeAccountId,
        },
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shopId: shop.id,
          amountCents: String(order.totalCents),
          applicationFeeCents: String(applicationFee),
          currency: order.currency.toUpperCase(),
        },
      },
      { idempotencyKey },
    );

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        providerPaymentId: intent.id,
        status: PaymentStatus.PENDING,
        amountCents: order.totalCents,
        currency: order.currency,
        idempotencyKey,
        rawPayload: JSON.stringify({
          client_secret: 'redacted',
          destination: shop.stripeAccountId,
          application_fee_amount: applicationFee,
        }),
      },
    });

    return {
      ...this.toClientPayment(payment, order),
      mode: 'stripe',
      clientSecret: intent.client_secret as string,
      publishableKey: this.config.get<string>('STRIPE_PUBLISHABLE_KEY') || null,
      applicationFeeCents: applicationFee,
      destinationAccountId: shop.stripeAccountId,
    };
  }

  /**
   * Stripe webhook — Connect + payments.
   * Events: account.updated, payment_intent.succeeded, refunds/disputes (logged).
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret || !apiKey) {
      throw new ServiceUnavailableException('Stripe webhook not configured');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(apiKey);
    let event: {
      id?: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
      this.logger.warn(`Stripe signature failed: ${e}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook ${event.type} id=${event.id || 'n/a'}`);

    switch (event.type) {
      case 'account.updated': {
        await this.handleConnectAccountUpdated(
          event.data.object as {
            id: string;
            metadata?: Record<string, string>;
          },
        );
        break;
      }
      case 'payment_intent.succeeded': {
        // Works with Destination Charges — amount/currency/metadata.orderId still validated
        const pi = event.data.object as {
          id: string;
          amount?: number;
          amount_received?: number;
          currency?: string;
          metadata?: Record<string, string>;
          transfer_data?: { destination?: string };
          application_fee_amount?: number;
        };
        await this.completeStripeSucceeded(pi);
        break;
      }
      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated': {
        await this.handleStripeRefundEvent(
          event.type,
          event.data.object as Record<string, unknown>,
        );
        break;
      }
      case 'payout.paid':
      case 'payout.failed': {
        this.logger.log(
          `Stripe payout ${event.type} id=${String(event.data.object?.id)} status=${String(event.data.object?.status)}`,
        );
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated': {
        await this.handleStripeDispute(
          event.type,
          event.data.object as Record<string, unknown>,
        );
        break;
      }
      default:
        this.logger.debug(`Stripe event ignored: ${event.type}`);
    }

    return { received: true, type: event.type };
  }

  /**
   * Apply refund side-effects from Stripe webhooks.
   * Supports Refund object (refund.*) and Charge (charge.refunded).
   */
  private async handleStripeRefundEvent(
    type: string,
    obj: Record<string, unknown>,
  ) {
    const meta = (obj.metadata || {}) as Record<string, string>;
    let orderId = meta.orderId?.trim() || '';
    const paymentIntentId = String(
      obj.payment_intent || obj.paymentIntent || '',
    );
    const refundId = String(obj.id || '');
    const amount =
      typeof obj.amount === 'number'
        ? obj.amount
        : typeof obj.amount_refunded === 'number'
          ? obj.amount_refunded
          : null;

    if (!orderId && paymentIntentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { provider: 'stripe', providerPaymentId: paymentIntentId },
      });
      orderId = payment?.orderId || '';
    }

    this.logger.log(
      `Refund event ${type} refund=${refundId} orderId=${orderId || 'n/a'} amount=${amount}`,
    );

    if (!orderId) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) return;

    const payment = order.payments.find(
      (p) => p.status === PaymentStatus.SUCCEEDED,
    );
    const refundAmount = amount ?? payment?.amountCents ?? order.totalCents;
    const full = refundAmount >= order.totalCents;

    // Idempotent: avoid duplicate Refund rows for same stripe id
    const existing = await this.prisma.refund.findFirst({
      where: {
        orderId,
        adminNote: { contains: refundId },
      },
    });
    if (!existing && refundId) {
      await this.prisma.refund.create({
        data: {
          orderId,
          amountCents: refundAmount,
          reason: type,
          status: RefundStatus.COMPLETED,
          adminNote: `stripe_refund=${refundId}`,
        },
      });
    }

    if (
      order.status !== OrderStatus.REFUNDED &&
      order.status !== OrderStatus.PARTIALLY_REFUNDED
    ) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: full ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED,
        },
      });
    }

    await this.audit.log({
      action: 'PAYMENT',
      entityType: 'Order',
      entityId: orderId,
      meta: {
        event: type,
        stripeRefundId: refundId,
        amountCents: refundAmount,
        full,
      },
    });
  }

  private async handleStripeDispute(
    type: string,
    dispute: Record<string, unknown>,
  ) {
    const paymentIntentId = String(dispute.payment_intent || '');
    const disputeId = String(dispute.id || '');
    const amount =
      typeof dispute.amount === 'number' ? dispute.amount : undefined;

    this.logger.warn(
      `Dispute ${type}: id=${disputeId} pi=${paymentIntentId} amount=${amount}`,
    );

    let orderId: string | undefined;
    if (paymentIntentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { provider: 'stripe', providerPaymentId: paymentIntentId },
      });
      orderId = payment?.orderId;
    }

    if (orderId) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DISPUTED },
      });
      await this.prisma.dispute
        .create({
          data: {
            orderId,
            reason: `stripe_dispute=${disputeId}`,
            status: 'OPEN',
          },
        })
        .catch(() => undefined);

      await this.audit.log({
        action: 'STATUS_CHANGE',
        entityType: 'Order',
        entityId: orderId,
        meta: {
          event: type,
          disputeId,
          amount,
          to: OrderStatus.DISPUTED,
        },
      });
    }
  }

  /** Sync Shop Connect flags when Stripe account changes */
  private async handleConnectAccountUpdated(account: {
    id: string;
    metadata?: Record<string, string>;
  }) {
    const shopIdFromMeta = account.metadata?.shopId?.trim();
    if (shopIdFromMeta) {
      await this.stripeConnect.syncAccountStatus(shopIdFromMeta);
      this.logger.log(
        `Connect account.updated synced shopId=${shopIdFromMeta} account=${account.id}`,
      );
      return;
    }

    const shop = await this.prisma.shop.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (shop) {
      await this.stripeConnect.syncAccountStatus(shop.id);
      this.logger.log(
        `Connect account.updated synced via stripeAccountId shopId=${shop.id}`,
      );
      return;
    }

    this.logger.warn(
      `account.updated: no shop for account ${account.id} (missing metadata.shopId)`,
    );
  }

  /**
   * Strict validation: amount_received, currency, metadata.orderId must match
   * Payment + Order records before PAID.
   */
  async completeStripeSucceeded(pi: {
    id: string;
    amount?: number;
    amount_received?: number;
    currency?: string;
    metadata?: Record<string, string>;
  }) {
    const providerPaymentId = String(pi.id);
    const metaOrderId = pi.metadata?.orderId?.trim() || '';
    const amountReceived =
      typeof pi.amount_received === 'number'
        ? pi.amount_received
        : typeof pi.amount === 'number'
          ? pi.amount
          : null;
    const currency = (pi.currency || '').toLowerCase();

    let payment = await this.prisma.payment.findFirst({
      where: { provider: 'stripe', providerPaymentId },
      include: { order: true },
    });

    if (!payment && metaOrderId) {
      payment = await this.prisma.payment.findFirst({
        where: {
          orderId: metaOrderId,
          provider: 'stripe',
          status: PaymentStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
        include: { order: true },
      });
    }

    if (!payment) {
      this.logger.error(
        `Stripe PI ${providerPaymentId}: payment row not found orderId=${metaOrderId}`,
      );
      return { ok: false, reason: 'payment_not_found' };
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return { ok: true, already: true };
    }

    const fail = async (reason: string) => {
      await this.prisma.payment.update({
        where: { id: payment!.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: JSON.stringify({ reason, pi }),
        },
      });
      this.logger.error(
        `Stripe validation failed payment=${payment!.id}: ${reason}`,
      );
      return { ok: false as const, reason };
    };

    if (!metaOrderId || metaOrderId !== payment.orderId) {
      return fail(
        `orderId_mismatch meta=${metaOrderId} payment.orderId=${payment.orderId}`,
      );
    }

    if (amountReceived === null || amountReceived !== payment.amountCents) {
      return fail(
        `amount_mismatch received=${amountReceived} expected=${payment.amountCents}`,
      );
    }

    if (currency !== payment.currency.toLowerCase()) {
      return fail(
        `currency_mismatch received=${currency} expected=${payment.currency}`,
      );
    }

    const order = payment.order;
    if (!order || order.id !== metaOrderId) {
      return fail('order_row_mismatch');
    }
    if (order.totalCents !== payment.amountCents) {
      return fail(
        `order_amount_mismatch order=${order.totalCents} payment=${payment.amountCents}`,
      );
    }
    if (order.currency.toLowerCase() !== payment.currency.toLowerCase()) {
      return fail('order_currency_mismatch');
    }

    return this.completePayment({
      provider: 'stripe',
      providerPaymentId,
      orderId: payment.orderId,
      paymentId: payment.id,
      expectedAmountCents: payment.amountCents,
      expectedCurrency: payment.currency,
      rawPayload: JSON.stringify(pi),
    });
  }

  /**
   * Local-only confirmation. Secret never goes to browsers.
   * Use: scripts/dev-confirm-payment.ps1 or curl from localhost tooling.
   * Disabled unless ALLOW_DEV_PAYMENTS=true and NODE_ENV is not production/staging.
   */
  async devConfirm(params: {
    orderId: string;
    paymentToken?: string;
    user: JwtPayload | null;
    secretHeader?: string;
    idempotencyKey?: string;
    clientIp?: string;
  }) {
    if (!this.isDevConfirmEnabled()) {
      throw new NotFoundException();
    }

    // Optional: only accept from loopback when LOCAL_DEV_CONFIRM_LOOPBACK=true
    const loopbackOnly =
      this.config.get<string>('LOCAL_DEV_CONFIRM_LOOPBACK') === 'true';
    if (loopbackOnly && params.clientIp) {
      const ip = params.clientIp.replace('::ffff:', '');
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== 'localhost') {
        throw new BadRequestException('Dev confirm only from localhost');
      }
    }

    const expected = this.config.get<string>('DEV_PAYMENT_SECRET') || '';
    if (!expected || !params.secretHeader) {
      throw new BadRequestException('Missing dev payment secret');
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(params.secretHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid dev payment secret');
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { id: params.orderId },
    });
    if (!existingOrder) {
      throw new BadRequestException('Order not found');
    }

    if (existingOrder.status === 'PAID') {
      return this.orders.getOrder(
        params.user,
        params.orderId,
        params.paymentToken,
      );
    }

    await this.orders.assertCanPayOrder(
      params.user,
      params.orderId,
      params.paymentToken,
    );

    const key =
      params.idempotencyKey || `dev_confirm_${params.orderId}_${randomUUID()}`;

    let payment = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
    });
    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: params.orderId,
          provider: 'dev',
          providerPaymentId: `dev_${randomUUID()}`,
          status: PaymentStatus.PENDING,
          amountCents: existingOrder.totalCents,
          currency: existingOrder.currency,
          idempotencyKey: key,
        },
      });
    }

    await this.completePayment({
      provider: 'dev',
      providerPaymentId: payment.providerPaymentId || payment.id,
      orderId: params.orderId,
      paymentId: payment.id,
      expectedAmountCents: existingOrder.totalCents,
      expectedCurrency: existingOrder.currency,
      rawPayload: JSON.stringify({ dev: true, at: new Date().toISOString() }),
    });

    return this.orders.getOrder(
      params.user,
      params.orderId,
      params.paymentToken,
    );
  }

  async completePayment(input: {
    provider: string;
    providerPaymentId: string;
    orderId?: string;
    paymentId?: string;
    expectedAmountCents?: number;
    expectedCurrency?: string;
    rawPayload?: string;
  }) {
    let payment = input.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: input.paymentId } })
      : await this.prisma.payment.findFirst({
          where: {
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
          },
        });

    if (!payment && input.orderId) {
      payment = await this.prisma.payment.findFirst({
        where: {
          orderId: input.orderId,
          provider: input.provider,
          status: PaymentStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!payment) {
      this.logger.warn('Payment not found');
      return { ok: false, reason: 'payment_not_found' };
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return { ok: true, already: true };
    }

    if (
      input.expectedAmountCents !== undefined &&
      input.expectedAmountCents !== payment.amountCents
    ) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: input.rawPayload || payment.rawPayload,
        },
      });
      return { ok: false, reason: 'amount_mismatch' };
    }

    if (
      input.expectedCurrency &&
      input.expectedCurrency.toLowerCase() !== payment.currency.toLowerCase()
    ) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: input.rawPayload || payment.rawPayload,
        },
      });
      return { ok: false, reason: 'currency_mismatch' };
    }

    if (input.orderId && input.orderId !== payment.orderId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: input.rawPayload || payment.rawPayload,
        },
      });
      return { ok: false, reason: 'orderId_mismatch' };
    }

    const orderId = payment.orderId;
    const result = await this.orders.markPaidFromPayment(
      orderId,
      input.providerPaymentId,
    );

    if (!result.ok) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: input.rawPayload || payment.rawPayload,
        },
      });
      this.logger.error(
        `markPaid failed order=${orderId} reason=${result.reason}`,
      );
      return result;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        providerPaymentId: input.providerPaymentId,
        paidAt: new Date(),
        rawPayload: input.rawPayload || payment.rawPayload,
      },
    });

    return { ok: true };
  }

  verifyHmac(payload: string, signature: string, secret: string): boolean {
    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private toClientPayment(
    p: {
      id: string;
      orderId: string;
      provider: string;
      providerPaymentId: string | null;
      status: PaymentStatus;
      amountCents: number;
      currency: string;
      idempotencyKey: string;
    },
    _order?: { orderNumber?: string },
  ) {
    return {
      id: p.id,
      orderId: p.orderId,
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
      idempotencyKey: p.idempotencyKey,
    };
  }
}
