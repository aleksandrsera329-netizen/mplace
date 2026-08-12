import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OrderStatusChangedEvent } from '../../common/events/order-status-changed.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';
import { OrdersGateway } from '../../common/websockets/orders.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
@EventsHandler(OrderStatusChangedEvent)
export class OrderStatusChangedHandler
  implements IEventHandler<OrderStatusChangedEvent>
{
  private readonly logger = new Logger(OrderStatusChangedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
    @Optional() private readonly ordersGateway?: OrdersGateway,
  ) {}

  async handle(event: OrderStatusChangedEvent) {
    this.logger.log(
      `Order ${event.orderId}: ${event.oldStatus} → ${event.newStatus}`,
    );

    this.ordersGateway?.emitOrderStatusChanged(event.orderId, event.newStatus, {
      oldStatus: event.oldStatus,
      changedBy: event.changedBy,
    });

    if (this.notificationsQueue) {
      await this.notificationsQueue.add('order-status-changed', {
        orderId: event.orderId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        changedBy: event.changedBy,
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        shopId: true,
        tenantId: true,
      },
    });
    if (!order) return;

    const title = 'Статус заказа изменён';
    const message = `Заказ №${order.orderNumber} теперь «${event.newStatus}» (было ${event.oldStatus})`;
    const link = `/orders/${order.id}`;
    const data = {
      orderId: order.id,
      status: event.newStatus,
      oldStatus: event.oldStatus,
    };

    // Prefer typed ORDER_PAID / SHIPPED / CANCELLED when status is known
    let type: string = 'ORDER_STATUS';
    if (event.newStatus === 'PAID') type = 'ORDER_PAID';
    else if (event.newStatus === 'SHIPPED') type = 'ORDER_SHIPPED';
    else if (event.newStatus === 'CANCELLED') type = 'ORDER_CANCELLED';
    else if (
      event.newStatus === 'PENDING_PAYMENT' &&
      (!event.oldStatus || event.oldStatus === 'DRAFT')
    ) {
      type = 'ORDER_CREATED';
    }

    // ORDER_PAID is also fanned out via DomainEvents.OrderPaid — avoid double
    // notify when status change is only PAID from payment webhook path that
    // already emits OrderPaid. Still notify for merchant-driven status changes.
    if (type === 'ORDER_PAID' && event.changedBy == null) {
      // Payment path: DomainEventListener.onOrderPaid handles durable notify
      return;
    }

    if (order.customerId) {
      await this.notifications.create({
        tenantId: order.tenantId,
        userId: order.customerId,
        type,
        title,
        message,
        data,
        link,
        sendEmail: true,
      });
    }

    await this.notifications.notifyShopOwners(order.shopId, {
      tenantId: order.tenantId,
      type,
      title,
      message,
      data,
      link: `/merchant/orders/${order.id}`,
      sendEmail: true,
    });
  }
}
