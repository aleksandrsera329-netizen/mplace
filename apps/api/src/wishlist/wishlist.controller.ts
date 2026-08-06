import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

class AddWishlistDto {
  @IsString()
  @MinLength(1)
  productId!: string;
}

@ApiTags('Wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List current user wishlist' })
  list(@CurrentUser() user: JwtPayload) {
    return this.wishlist.getWishlist(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Add product to wishlist (body: { productId })' })
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddWishlistDto) {
    return this.wishlist.addToWishlist(user.sub, dto.productId);
  }

  /** Convenience alias: POST /wishlist/:productId */
  @Post(':productId')
  @ApiOperation({ summary: 'Add product to wishlist by path param' })
  addByParam(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.addToWishlist(user.sub, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.removeFromWishlist(user.sub, productId);
  }
}
