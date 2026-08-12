import { Module } from '@nestjs/common';
import { WishlistModule } from '../wishlist/wishlist.module';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';

@Module({
  imports: [WishlistModule],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
