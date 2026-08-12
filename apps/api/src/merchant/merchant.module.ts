import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { SearchModule } from '../search/search.module';
import { MerchantController } from './merchant.controller';
import { MerchantProductsController } from './merchant-products.controller';
import { MerchantProductsService } from './merchant-products.service';
import { MerchantService } from './merchant.service';

@Module({
  imports: [FinanceModule, SearchModule],
  controllers: [MerchantController, MerchantProductsController],
  providers: [MerchantService, MerchantProductsService],
  exports: [MerchantService, MerchantProductsService],
})
export class MerchantModule {}
