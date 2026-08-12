import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OrdersService } from '../orders.service';
import { CreateOrderCommand } from './create-order.command';

@Injectable()
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand>
{
  constructor(
    private readonly orders: OrdersService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: CreateOrderCommand) {
    // Checkout: multi-shop orders, warehouse reservation, payment tokens
    const result = await this.orders.checkout(
      command.user,
      command.sessionKey,
      command.dto,
    );

    const customerId = command.user?.sub ?? null;
    for (const o of result.orders || []) {
      const shopId = o.shop?.id;
      await this.outbox.enqueue('OrderCreatedEvent', {
        orderId: o.id,
        customerId,
        totalCents: o.totalCents,
        shopIds: shopId ? [shopId] : [],
        orderNumber: o.orderNumber,
      });
    }

    return result;
  }
}
