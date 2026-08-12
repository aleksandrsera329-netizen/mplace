import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CalculateShippingHandler } from './commands/calculate-shipping.handler';
import { CreateShippingMethodHandler } from './commands/create-shipping-method.handler';
import { CreateShippingRateHandler } from './commands/create-shipping-rate.handler';
import { CreateShippingZoneHandler } from './commands/create-shipping-zone.handler';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [CqrsModule],
  controllers: [ShippingController],
  providers: [
    CreateShippingMethodHandler,
    CreateShippingZoneHandler,
    CreateShippingRateHandler,
    CalculateShippingHandler,
  ],
  exports: [CalculateShippingHandler],
})
export class ShippingModule {}
