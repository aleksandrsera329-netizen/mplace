import { Module, forwardRef } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { TaxModule } from '../tax/tax.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderHandler } from './commands/create-order.handler';
import { ChangeOrderStatusHandler } from './commands/change-order-status.handler';
import { OrderCreatedHandler } from './events/order-created.handler';
import { OrderStatusChangedHandler } from './events/order-status-changed.handler';

@Module({
  imports: [forwardRef(() => PaymentsModule), TaxModule, WarehouseModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    CreateOrderHandler,
    ChangeOrderStatusHandler,
    OrderCreatedHandler,
    OrderStatusChangedHandler,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
