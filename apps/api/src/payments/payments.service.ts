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
import {
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  patchRequestContext,
} from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { DomainEventService } from '../events/domain-event.service';
import { DomainEvents } from '../events/domain-events';
import { MetricsService } from '../metrics/metrics.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../finance/ledger.service';
import { RefundsService } from '../refunds/refunds.service';
import { StripeConnectService } from './stripe-connect.service';

function isLocalRuntime(nodeEnv: string | undefined, allowLocal: string | undefined) {
  if (nodeEnv === 'production' || nodeEnv === 'staging') return false;
  // Explicit flag required for dev-confirm endpoint
  return allowLocal === 'true' || allowLocal === '1';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly slog: StructuredLogger;
  private readonly provider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => StripeConnectService))
    private readonly stripeConnect: StripeConnectService,
    private readonly audit: AuditService,
    private readonly refundsService: RefundsService,
    private readonly ledger: LedgerService,
    private readonly events: DomainEventService,
    structuredLogger: StructuredLogger,
    private readonly metrics: MetricsService,
  ) {
    this.provider = (
      this.config.get<string>('PAYMENT_PROVIDER') || 'dev'
    ).toLowerCase();
    this.slog = structuredLogger.child('PaymentsService');
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
   * Admin convenience: request → approve → provider (Stage 8 state machine).
   * COMPLETED only arrives via Stripe webhook.
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

    const amt = amountCents ?? payment.amountCents;
    if (amt <= 0 || amt > payment.amountCents) {
      throw new BadRequestException('Invalid refund amount');
    }

    if (!actorId) {
      throw new BadRequestException('actorId required for refund flow');
    }

    const user = {
      sub: actorId,
      role: UserRole.ADMIN,
      email: '',
      shopId: null,
    } as JwtPayload;

    const requested = await this.refundsService.requestRefund(
      user,
      orderId,
      amt,
      reason,
    );
    await this.refundsService.approveRefund(requested.id, actorId);
    const provider = await this.refundsService.requestProviderRefund(
      requested.id,
      actorId,
    );

    return {
      ok: true,
      refundId: provider.id,
      stripeRefundId: provider.stripeRefundId,
      amountCents: provider.amountCents,
      status: provider.status,
      message:
        'Refund PROVIDER_REQUESTED — COMPLETED only after Stripe webhook',
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
   * Stripe webhook — durable PaymentWebhookEvent + idempotency (Stage 7).
   * Events: account.updated, payment_intent.succeeded, refunds/disputes.
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    const apiKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret || !apiKey) {
      throw new ServiceUnavailableException('Stripe webhook not configured');
    }
    if (!signature?.trim()) {
      throw new BadRequestException('Invalid webhook signature');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    const stripe = new Stripe(apiKey);
    let event: {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
      this.logger.warn(`Stripe signature failed: ${e}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!event?.id) {
      throw new BadRequestException('Stripe event missing id');
    }

    return this.processVerifiedStripeEvent(event, rawBody);
  }

  /**
   * After signature verification: store event, process once, mark status.
   * Exported for unit tests (inject pre-built event without Stripe crypto).
   */
  async processVerifiedStripeEvent(
    event: {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    },
    rawBody?: Buffer,
  ) {
    this.logger.log(`Stripe webhook ${event.type} id=${event.id}`);

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_externalId: {
          provider: 'stripe',
          externalId: event.id,
        },
      },
    });

    if (existing?.status === 'processed' || existing?.status === 'ignored') {
      this.metrics.incWebhookProcessed('already_processed');
      return {
        received: true,
        status: 'already_processed' as const,
        type: event.type,
        eventId: event.id,
      };
    }

    const orderIdHint = this.extractOrderIdFromEvent(event);
    const payloadHash = rawBody
      ? createHash('sha256').update(rawBody).digest('hex')
      : null;

    const webhookEvent = await this.prisma.paymentWebhookEvent.upsert({
      where: {
        provider_externalId: {
          provider: 'stripe',
          externalId: event.id,
        },
      },
      create: {
        provider: 'stripe',
        externalId: event.id,
        eventType: event.type,
        status: 'received',
        payloadHash,
        orderId: orderIdHint,
      },
      update: {
        // retry after failed: reset error, keep received
        status: 'received',
        errorMessage: null,
        orderId: orderIdHint ?? undefined,
        payloadHash: payloadHash ?? undefined,
      },
    });

    try {
      const processResult = await this.processStripeEvent(
        event,
        webhookEvent.id,
      );

      const finalStatus =
        processResult.status === 'ignored' ? 'ignored' : 'processed';

      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: finalStatus,
          processedAt: new Date(),
          orderId: processResult.orderId ?? orderIdHint ?? undefined,
          errorMessage: null,
        },
      });

      this.metrics.incWebhookProcessed(finalStatus);

      return {
        received: true,
        status: finalStatus as 'processed' | 'ignored',
        type: event.type,
        eventId: event.id,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          errorMessage: message.slice(0, 500),
        },
      });
      this.metrics.incWebhookFailed(message.slice(0, 64));
      // Re-throw so Stripe retries
      throw error;
    }
  }

  private extractOrderIdFromEvent(event: {
    type: string;
    data: { object: Record<string, unknown> };
  }): string | null {
    const obj = event.data?.object || {};
    const meta = (obj.metadata || {}) as Record<string, string>;
    if (meta.orderId?.trim()) return meta.orderId.trim();
    return null;
  }

  /**
   * Business handlers. Returns 'ignored' for unhandled types.
   */
  private async processStripeEvent(
    event: {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    },
    _webhookEventId: string,
  ): Promise<{ status: 'ok' | 'ignored'; orderId?: string | null }> {
    switch (event.type) {
      case 'account.updated': {
        await this.handleConnectAccountUpdated(
          event.data.object as {
            id: string;
            metadata?: Record<string, string>;
          },
        );
        return { status: 'ok' };
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as {
          id: string;
          amount?: number;
          amount_received?: number;
          currency?: string;
          metadata?: Record<string, string>;
          transfer_data?: { destination?: string };
          application_fee_amount?: number;
        };
        const result = await this.completeStripeSucceeded(pi);
        const orderId =
          pi.metadata?.orderId?.trim() ||
          (result && 'orderId' in result
            ? (result as { orderId?: string }).orderId
            : null);
        return { status: 'ok', orderId };
      }
      case 'payment_intent.payment_failed': {
        await this.handlePaymentIntentFailed(
          event.data.object as {
            id?: string;
            metadata?: Record<string, string>;
            last_payment_error?: { message?: string };
          },
        );
        return {
          status: 'ok',
          orderId: (
            event.data.object.metadata as { orderId?: string } | undefined
          )?.orderId,
        };
      }
      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated': {
        await this.handleStripeRefundEvent(
          event.type,
          event.data.object as Record<string, unknown>,
        );
        const meta = (event.data.object.metadata || {}) as Record<
          string,
          string
        >;
        return { status: 'ok', orderId: meta.orderId };
      }
      case 'payout.paid':
      case 'payout.failed': {
        this.logger.log(
          `Stripe payout ${event.type} id=${String(event.data.object?.id)} status=${String(event.data.object?.status)}`,
        );
        return { status: 'ok' };
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated': {
        await this.handleStripeDispute(
          event.type,
          event.data.object as Record<string, unknown>,
        );
        return { status: 'ok' };
      }
      default:
        this.logger.debug(`Stripe event ignored: ${event.type}`);
        return { status: 'ignored' };
    }
  }

  private async handlePaymentIntentFailed(pi: {
    id?: string;
    metadata?: Record<string, string>;
    last_payment_error?: { message?: string };
  }) {
    const providerPaymentId = String(pi.id || '');
    const orderId = pi.metadata?.orderId?.trim();
    if (!providerPaymentId && !orderId) return;

    const payment = providerPaymentId
      ? await this.prisma.payment.findFirst({
          where: { provider: 'stripe', providerPaymentId },
        })
      : orderId
        ? await this.prisma.payment.findFirst({
            where: {
              orderId,
              provider: 'stripe',
              status: PaymentStatus.PENDING,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

    if (payment && payment.status === PaymentStatus.PENDING) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          rawPayload: JSON.stringify({
            reason: 'payment_intent.payment_failed',
            message: pi.last_payment_error?.message,
            pi,
          }),
        },
      });
    }
    this.logger.warn(
      `payment_intent.payment_failed pi=${providerPaymentId} orderId=${orderId || 'n/a'}`,
    );
  }

  /**
   * Stage 8: only webhook confirms refund → COMPLETED (via RefundsService).
   * Supports Refund object (refund.*) and Charge (charge.refunded).
   */
  private async handleStripeRefundEvent(
    type: string,
    obj: Record<string, unknown>,
  ) {
    const meta = (obj.metadata || {}) as Record<string, string>;
    let orderId = meta.orderId?.trim() || '';
    const refundIdFromMeta = meta.refundId?.trim() || '';
    const paymentIntentId = String(
      obj.payment_intent || obj.paymentIntent || '',
    );

    // charge.refunded: id is charge; nested refunds.data[0].id may be refund
    let stripeRefundId = String(obj.id || '');
    const nested = obj.refunds as
      | { data?: Array<{ id?: string; amount?: number }> }
      | undefined;
    if (type === 'charge.refunded' && nested?.data?.[0]?.id) {
      stripeRefundId = String(nested.data[0].id);
    }
    // For refund.* events, obj.id is the refund id
    if (type.startsWith('refund.')) {
      stripeRefundId = String(obj.id || '');
    }

    const amount =
      typeof obj.amount === 'number'
        ? obj.amount
        : typeof obj.amount_refunded === 'number'
          ? obj.amount_refunded
          : nested?.data?.[0]?.amount ?? null;

    if (!orderId && paymentIntentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { provider: 'stripe', providerPaymentId: paymentIntentId },
      });
      orderId = payment?.orderId || '';
    }

    this.logger.log(
      `Refund event ${type} stripeRefund=${stripeRefundId} orderId=${orderId || 'n/a'} amount=${amount}`,
    );

    await this.refundsService.confirmProviderRefund({
      stripeRefundId: stripeRefundId || null,
      orderId: orderId || null,
      amountCents: amount,
      refundIdFromMeta: refundIdFromMeta || null,
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
      return { ok: false, reason: 'payment_not_found', orderId: metaOrderId || null };
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return { ok: true, already: true, orderId: payment.orderId };
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
      return { ok: false as const, reason, orderId: payment!.orderId };
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
    patchRequestContext({ orderId, paymentId: payment.id });
    const payStarted = Date.now();
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
      this.slog.error('Payment mark paid failed', {
        orderId,
        paymentId: payment.id,
        status: 'failed',
        durationMs: Date.now() - payStarted,
        error: result.reason,
      });
      this.metrics.incPaymentFailed(result.reason || 'mark_paid_failed');
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

    // Stage 9: double-entry financial ledger (idempotent by Order id)
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          shopId: true,
          customerId: true,
          tenantId: true,
          totalCents: true,
          commissionCents: true,
          currency: true,
          orderNumber: true,
        },
      });
      if (order) {
        patchRequestContext({ shopId: order.shopId, orderId: order.id });
        await this.ledger.postPayment({
          orderId: order.id,
          amountCents: order.totalCents,
          commissionCents: order.commissionCents,
          shopId: order.shopId,
          currency: order.currency,
          description: `Payment ${order.orderNumber}`,
        });

        // Stage 18: durable ORDER_PAID notifications (buyer + merchant)
        this.events.emit(DomainEvents.OrderPaid, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          shopId: order.shopId,
          customerId: order.customerId,
          tenantId: order.tenantId,
          totalCents: order.totalCents,
        });

        this.slog.info('Payment succeeded', {
          orderId: order.id,
          paymentId: payment.id,
          shopId: order.shopId,
          status: 200,
          durationMs: Date.now() - payStarted,
        });
        this.metrics.incPaymentSucceeded();
      }
    } catch (e) {
      this.logger.error(
        `Ledger postPayment failed order=${orderId}: ${e instanceof Error ? e.message : e}`,
      );
      this.slog.error('Payment ledger post failed', {
        orderId,
        paymentId: payment.id,
        status: 'error',
        durationMs: Date.now() - payStarted,
        error: e instanceof Error ? e.message : String(e),
      });
      this.metrics.incPaymentFailed('ledger_post_failed');
      // Do not roll back payment success — money movement already confirmed
      // Still try to emit OrderPaid for notifications
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            shopId: true,
            customerId: true,
            tenantId: true,
            orderNumber: true,
            totalCents: true,
          },
        });
        if (order) {
          this.events.emit(DomainEvents.OrderPaid, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shopId: order.shopId,
            customerId: order.customerId,
            tenantId: order.tenantId,
            totalCents: order.totalCents,
          });
        }
      } catch {
        /* ignore secondary emit failures */
      }
    }

    return { ok: true, orderId };
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
