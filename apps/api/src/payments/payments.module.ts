import { Module, forwardRef } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { OrdersModule } from '../orders/orders.module';
import { RefundsModule } from '../refunds/refunds.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';

@Module({
  imports: [forwardRef(() => OrdersModule), RefundsModule, FinanceModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeConnectService],
  exports: [PaymentsService, StripeConnectService],
})
export class PaymentsModule {}
