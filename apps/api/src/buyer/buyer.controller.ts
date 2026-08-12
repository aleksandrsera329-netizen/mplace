import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { BuyerService } from './buyer.service';

class SavedSearchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** JSON string of search filters */
  @IsString()
  queryJson!: string;
}

/**
 * Stage 14: Buyer cabinet API — CUSTOMER only (not merchant/admin).
 */
@ApiTags('Buyer')
@Controller('buyer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class BuyerController {
  constructor(
    private readonly buyer: BuyerService,
    private readonly prisma: PrismaService,
    private readonly wishlist: WishlistService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Buyer cabinet overview stats' })
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.buyer.getDashboard(user.sub);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Buyer orders (status: active | completed | cancelled | OrderStatus)',
  })
  orders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.buyer.getOrders(user.sub, status);
  }

  @Get('rfqs')
  @ApiOperation({
    summary: 'Buyer RFQs (status: draft | open | offers | awarded)',
  })
  rfqs(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.buyer.getRfqs(user.sub, status);
  }

  @Get('wishlist')
  listWish(@CurrentUser() user: JwtPayload) {
    return this.wishlist.getWishlist(user.sub);
  }

  @Post('wishlist/:productId')
  addWish(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.addToWishlist(user.sub, productId);
  }

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

  @Get('profile')
  @ApiOperation({ summary: 'Buyer profile (me)' })
  async profile(@CurrentUser() user: JwtPayload) {
    return this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
