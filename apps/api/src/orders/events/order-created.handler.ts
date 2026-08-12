import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OrderCreatedEvent } from '../../common/events/order-created.event';
import {
  QUEUE_EMAIL,
  QUEUE_NOTIFICATIONS,
  QUEUE_SEARCH,
} from '../../queue/queue.constants';
import { OrdersGateway } from '../../common/websockets/orders.gateway';

@Injectable()
@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  private readonly logger = new Logger(OrderCreatedHandler.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_EMAIL)
    private readonly emailsQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_SEARCH)
    private readonly searchQueue?: Queue,
    @Optional() private readonly ordersGateway?: OrdersGateway,
  ) {}

  async handle(event: OrderCreatedEvent) {
    this.logger.log(
      `OrderCreatedEvent: ${event.orderId} (${event.orderNumber || ''})`,
    );

    if (this.notificationsQueue) {
      if (event.customerId) {
        await this.notificationsQueue.add('order-created-customer', {
          orderId: event.orderId,
          customerId: event.customerId,
          totalCents: event.totalCents,
          orderNumber: event.orderNumber,
        });
      }
      for (const shopId of event.shopIds) {
        await this.notificationsQueue.add('order-created-merchant', {
          orderId: event.orderId,
          shopId,
          orderNumber: event.orderNumber,
        });
      }
    }

    if (this.emailsQueue && event.customerId) {
      await this.emailsQueue.add('order-confirmation', {
        orderId: event.orderId,
        customerId: event.customerId,
        orderNumber: event.orderNumber,
      });
    }

    if (this.searchQueue) {
      await this.searchQueue.add('reindex-order', {
        orderId: event.orderId,
      });
    }

    this.ordersGateway?.emitOrderCreated(event.orderId, {
      totalCents: event.totalCents,
      customerId: event.customerId,
      orderNumber: event.orderNumber,
      shopIds: event.shopIds,
    });
  }
}
