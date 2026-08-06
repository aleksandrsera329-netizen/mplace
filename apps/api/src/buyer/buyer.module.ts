import { Module } from '@nestjs/common';
import { WishlistModule } from '../wishlist/wishlist.module';
import { BuyerController } from './buyer.controller';

@Module({
  imports: [WishlistModule],
  controllers: [BuyerController],
})
export class BuyerModule {}
