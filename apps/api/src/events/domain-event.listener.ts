import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { DomainEvents } from './domain-events';
import { QueueProducer } from '../queue/queue.producer';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fan-out: durable in-app+email notifications + BullMQ + WebSocket (Stage 18).
 */
@Injectable()
export class DomainEventListener {
  private readonly logger = new Logger(DomainEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly queues?: QueueProducer,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  @OnEvent(DomainEvents.OrderCreated)
  async onOrderCreated(payload: Record<string, unknown>) {
    this.logger.log(`OrderCreated ${JSON.stringify(payload)}`);
    await this.queues?.enqueueNotification({
      userId: (payload.customerId as string) || undefined,
      channel: 'order',
      title: 'Order created',
      body: String(payload.orderNumber || payload.orderId || ''),
      meta: payload,
    });
    this.realtime?.notifyOrderStatus({
      orderId: String(payload.orderId || ''),
      shopId: payload.shopId as string | undefined,
      customerId: (payload.customerId as string) || null,
      status: 'PENDING_PAYMENT',
      orderNumber: payload.orderNumber as string | undefined,
    });
  }

  @OnEvent(DomainEvents.OrderPaid)
  async onOrderPaid(payload: Record<string, unknown>) {
    this.logger.log(`OrderPaid ${JSON.stringify(payload)}`);
    const orderId = String(payload.orderId || '');
    const orderNumber = String(
      payload.orderNumber || orderId.slice(0, 8) || '',
    );
    let customerId = (payload.customerId as string) || null;
    let shopId = (payload.shopId as string) || null;
    let tenantId = (payload.tenantId as string) || null;

    if (orderId && (!customerId || !shopId)) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          customerId: true,
          shopId: true,
          tenantId: true,
          orderNumber: true,
        },
      });
      if (order) {
        customerId = customerId || order.customerId;
        shopId = shopId || order.shopId;
        tenantId = tenantId || order.tenantId;
      }
    }

    const title = 'Заказ оплачен';
    const body = `Заказ №${orderNumber || orderId} успешно оплачен`;
    const data = {
      orderId,
      orderNumber,
      shopId,
    };

    if (customerId) {
      await this.notifications.notify({
        userId: customerId,
        type: NotificationType.ORDER_PAID,
        title,
        body,
        data,
        tenantId,
        link: `/orders/${orderId}`,
      });
    }

    if (shopId) {
      await this.notifications.notifyShopOwners(shopId, {
        tenantId,
        type: NotificationType.ORDER_PAID,
        title: 'Новая оплата заказа',
        message: body,
        data,
        link: `/merchant/orders/${orderId}`,
      });
    }

    await this.queues?.enqueueNotification({
      userId: customerId || undefined,
      channel: 'order',
      title: 'Order paid',
      body: orderId,
      meta: payload,
    });
    this.realtime?.notifyOrderStatus({
      orderId,
      shopId: shopId || undefined,
      customerId,
      status: 'PAID',
      orderNumber: orderNumber || undefined,
    });
  }

  @OnEvent(DomainEvents.ProductCreated)
  async onProductCreated(payload: Record<string, unknown>) {
    this.logger.log(`ProductCreated ${JSON.stringify(payload)}`);
    if (payload.productId && payload.status === 'ACTIVE') {
      await this.queues?.enqueueSearchIndex({
        action: 'index',
        productId: String(payload.productId),
      });
    }
  }

  @OnEvent(DomainEvents.ProductUpdated)
  async onProductUpdated(payload: Record<string, unknown>) {
    this.logger.log(`ProductUpdated ${JSON.stringify(payload)}`);
    if (!payload.productId) return;
    const action =
      payload.status && payload.status !== 'ACTIVE' ? 'remove' : 'index';
    await this.queues?.enqueueSearchIndex({
      action,
      productId: String(payload.productId),
    });
  }

  @OnEvent(DomainEvents.ProductDeleted)
  async onProductDeleted(payload: Record<string, unknown>) {
    this.logger.log(`ProductDeleted ${JSON.stringify(payload)}`);
    if (payload.productId) {
      await this.queues?.enqueueSearchIndex({
        action: 'remove',
        productId: String(payload.productId),
      });
    }
  }

  @OnEvent(DomainEvents.RfqCreated)
  async onRfqCreated(payload: Record<string, unknown>) {
    this.logger.log(`RfqCreated ${JSON.stringify(payload)}`);
    this.realtime?.notifyRfq({
      rfqId: String(payload.rfqId || ''),
      buyerId: payload.buyerId as string | undefined,
      event: 'created',
      data: payload,
    });
    await this.queues?.enqueueNotification({
      userId: payload.buyerId as string | undefined,
      channel: 'rfq',
      title: 'RFQ created',
      body: String(payload.title || payload.number || ''),
      meta: payload,
    });
  }

  @OnEvent(DomainEvents.RfqAwarded)
  async onRfqAwarded(payload: Record<string, unknown>) {
    this.logger.log(`RfqAwarded ${JSON.stringify(payload)}`);
    const rfqId = String(payload.rfqId || '');
    const offerId = String(payload.offerId || '');
    const orderId = payload.orderId ? String(payload.orderId) : undefined;
    const shopId = payload.shopId ? String(payload.shopId) : undefined;
    let buyerId = payload.buyerId ? String(payload.buyerId) : undefined;
    const totalCents =
      typeof payload.totalCents === 'number' ? payload.totalCents : undefined;

    let rfqNumber: string | undefined;
    let rfqTitle: string | undefined;
    if (rfqId) {
      const rfq = await this.prisma.rfqRequest.findUnique({
        where: { id: rfqId },
        select: { buyerId: true, number: true, title: true },
      });
      if (rfq) {
        buyerId = buyerId || rfq.buyerId;
        rfqNumber = rfq.number;
        rfqTitle = rfq.title;
      }
    }

    const amount =
      totalCents != null
        ? (totalCents / 100).toLocaleString('ru-RU')
        : undefined;
    const label = rfqNumber || rfqTitle || rfqId;
    const data = { rfqId, offerId, orderId, shopId, totalCents };

    if (buyerId) {
      await this.notifications.notify({
        userId: buyerId,
        type: NotificationType.RFQ_AWARDED,
        title: 'RFQ: предложение принято',
        body: `Вы выбрали поставщика по запросу «${label}»${orderId ? `. Создан заказ.` : ''}${amount ? ` Сумма: ${amount}` : ''}`,
        data,
        link: orderId ? `/orders/${orderId}` : `/rfq/${rfqId}`,
      });
    }

    if (shopId) {
      await this.notifications.notifyShopOwners(shopId, {
        type: NotificationType.RFQ_AWARDED,
        title: 'Ваше предложение принято',
        message: `Покупатель принял ваше предложение по RFQ «${label}»${orderId ? `. Создан заказ.` : ''}`,
        data,
        link: orderId
          ? `/merchant/orders/${orderId}`
          : `/merchant/rfq/${rfqId}`,
      });
    }
  }

  @OnEvent(DomainEvents.MerchantApproved)
  async onMerchantApproved(payload: Record<string, unknown>) {
    this.logger.log(`MerchantApproved ${JSON.stringify(payload)}`);
    await this.queues?.enqueueEmail({
      to: 'merchant@demo.com',
      subject: 'Shop approved',
      body: `Shop ${payload.shopId} is ACTIVE`,
    });
  }

  @OnEvent(DomainEvents.PayoutRequested)
  async onPayoutRequested(payload: Record<string, unknown>) {
    this.logger.log(`PayoutRequested ${JSON.stringify(payload)}`);
    const shopId = payload.shopId ? String(payload.shopId) : undefined;
    const amountCents =
      typeof payload.amountCents === 'number' ? payload.amountCents : 0;
    if (shopId) {
      await this.notifications.notifyShopOwners(shopId, {
        type: NotificationType.PAYOUT_REQUESTED,
        title: 'Запрос на выплату',
        message: `Создан запрос на выплату ${(amountCents / 100).toLocaleString('ru-RU')}`,
        data: {
          payoutId: payload.payoutId,
          amountCents,
          shopId,
        },
        link: '/merchant/balance',
      });
    }
    await this.queues?.enqueueNotification({
      channel: 'finance',
      title: 'Payout requested',
      body: String(payload.amountCents || ''),
      meta: payload,
    });
  }

  @OnEvent(DomainEvents.PayoutCompleted)
  async onPayoutCompleted(payload: Record<string, unknown>) {
    this.logger.log(`PayoutCompleted ${JSON.stringify(payload)}`);
    const shopId = payload.shopId ? String(payload.shopId) : undefined;
    const amountCents =
      typeof payload.amountCents === 'number' ? payload.amountCents : 0;
    const payoutId = payload.payoutId ? String(payload.payoutId) : undefined;

    if (shopId) {
      await this.notifications.notifyShopOwners(shopId, {
        type: NotificationType.PAYOUT_COMPLETED,
        title: 'Выплата выполнена',
        message: `Выплата ${(amountCents / 100).toLocaleString('ru-RU')} завершена`,
        data: { payoutId, amountCents, shopId },
        link: '/merchant/balance',
      });
    }
  }
}
