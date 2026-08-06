import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistService } from '../wishlist/wishlist.service';

class SavedSearchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** JSON string of search filters */
  @IsString()
  queryJson!: string;
}

@Controller('buyer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class BuyerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wishlist: WishlistService,
  ) {}

  /** @deprecated prefer GET /api/wishlist */
  @Get('wishlist')
  listWish(@CurrentUser() user: JwtPayload) {
    return this.wishlist.getWishlist(user.sub);
  }

  /** @deprecated prefer POST /api/wishlist */
  @Post('wishlist/:productId')
  addWish(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.addToWishlist(user.sub, productId);
  }

  /** @deprecated prefer DELETE /api/wishlist/:productId */
  @Delete('wishlist/:productId')
  removeWish(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.removeFromWishlist(user.sub, productId);
  }

  @Get('saved-searches')
  saved(@CurrentUser() user: JwtPayload) {
    return this.prisma.savedSearch.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('saved-searches')
  saveSearch(@CurrentUser() user: JwtPayload, @Body() dto: SavedSearchDto) {
    // validate JSON
    try {
      JSON.parse(dto.queryJson);
    } catch {
      dto.queryJson = '{}';
    }
    return this.prisma.savedSearch.create({
      data: {
        userId: user.sub,
        name: dto.name,
        queryJson: dto.queryJson,
      },
    });
  }

  @Delete('saved-searches/:id')
  async deleteSearch(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.prisma.savedSearch.deleteMany({
      where: { id, userId: user.sub },
    });
    return { ok: true };
  }

  @Get('orders')
  orders(@CurrentUser() user: JwtPayload) {
    return this.prisma.order.findMany({
      where: { customerId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        items: true,
        payments: true,
      },
    });
  }
}
