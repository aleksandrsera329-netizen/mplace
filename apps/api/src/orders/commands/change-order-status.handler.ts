import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrderStatusChangedEvent } from '../../common/events/order-status-changed.event';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OrdersService } from '../orders.service';
import { ChangeOrderStatusCommand } from './change-order-status.command';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@CommandHandler(ChangeOrderStatusCommand)
export class ChangeOrderStatusHandler
  implements ICommandHandler<ChangeOrderStatusCommand>
{
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: ChangeOrderStatusCommand) {
    const before = await this.prisma.order.findUnique({
      where: { id: command.orderId },
      select: { status: true },
    });
    const oldStatus = before?.status ?? 'UNKNOWN';

    // updateStatus: permissions, transitions, stock release on cancel/refund
    const updated = await this.orders.updateStatus(
      command.user,
      command.orderId,
      command.newStatus,
      command.comment,
    );

    const event = new OrderStatusChangedEvent(
      command.orderId,
      oldStatus,
      updated.status,
      command.user.sub,
    );
    await this.outbox.enqueue('OrderStatusChangedEvent', {
      orderId: event.orderId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      changedBy: event.changedBy,
      eventId: event.eventId,
      occurredOn: event.occurredOn.toISOString(),
    });

    return updated;
  }
}
