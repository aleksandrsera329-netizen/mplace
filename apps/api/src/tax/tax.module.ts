import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CalculateTaxHandler } from './commands/calculate-tax.handler';
import { CreateTaxRateHandler } from './commands/create-tax-rate.handler';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [CqrsModule],
  controllers: [TaxController],
  providers: [TaxService, CreateTaxRateHandler, CalculateTaxHandler],
  exports: [TaxService, CalculateTaxHandler],
})
export class TaxModule {}
